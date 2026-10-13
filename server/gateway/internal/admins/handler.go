package admins

import (
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the audit trail and the state-admin directory. Both are role-gated; the caller's
// role comes from the JWT claims, never a request body.
type Handler struct {
	repo *Repo
}

// NewHandler builds the admins handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts the admins routes.
func (h *Handler) Register(r chi.Router) {
	// Audit trail: any admin role may read.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/audit-logs", h.listLogs)
		g.Get("/customers", h.listCustomers)
	})
	// State-admin directory: super admin only.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/state-admins", h.listAdmins)
		g.Post("/state-admins", h.createAdmin)
		g.Put("/state-admins/{id}", h.setAdminActive)
		g.Delete("/state-admins/{id}", h.deleteAdmin)
	})
}

func (h *Handler) listLogs(w http.ResponseWriter, r *http.Request) {
	actorRole := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("actorRole")))
	entity := strings.TrimSpace(r.URL.Query().Get("entity"))
	logs, err := h.repo.ListLogs(r.Context(), actorRole, entity, httpx.LimitParam(r, 100, 200))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "audit_unavailable", "audit trail unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, logs)
}

func (h *Handler) listCustomers(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		stateCode = auth.StateCode(r.Context())
	}
	items, err := h.repo.Customers(r.Context(), stateCode, httpx.LimitParam(r, 200, 500))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "customers_unavailable", "customers unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) listAdmins(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	items, err := h.repo.ListStateAdmins(r.Context(), stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "state_admins_unavailable", "state admins unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type createAdminRequest struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	StateCode string `json:"stateCode"`
}

func (h *Handler) createAdmin(w http.ResponseWriter, r *http.Request) {
	var req createAdminRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	if req.Name == "" || req.Email == "" || len(req.StateCode) != 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "name, email and a 2-letter state are required")
		return
	}
	admin, err := h.repo.CreateStateAdmin(r.Context(), StateAdmin{
		Name: req.Name, Email: req.Email, Phone: req.Phone, StateCode: req.StateCode,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "state_admin_create_failed", "could not create state admin")
		return
	}
	httpx.JSON(w, http.StatusCreated, admin)
}

type setActiveRequest struct {
	Active bool `json:"active"`
}

func (h *Handler) setAdminActive(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req setActiveRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	admin, ok, err := h.repo.SetStateAdminActive(r.Context(), id, req.Active)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "state_admin_update_failed", "could not update state admin")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "state admin not found")
		return
	}
	httpx.JSON(w, http.StatusOK, admin)
}

func (h *Handler) deleteAdmin(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.DeleteStateAdmin(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "state_admin_delete_failed", "could not delete state admin")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
