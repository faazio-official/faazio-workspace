package admins

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the audit trail and the state-admin directory. Both are role-gated; the caller's
// role comes from the JWT claims, never a request body.
type Handler struct {
	repo        *Repo
	provisioner *Provisioner
}

// NewHandler builds the admins handler. provisioner owns roster+login writes (unified creator).
func NewHandler(repo *Repo, provisioner *Provisioner) *Handler {
	return &Handler{repo: repo, provisioner: provisioner}
}

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
	Name       string `json:"name"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	StateCode  string `json:"stateCode"`
	IssueLogin *bool  `json:"issueLogin"`
	Password   string `json:"password,omitempty"`
	// ForceChange is accepted for forward-compat but ignored: a STATE_ADMIN login is ALWAYS forced to
	// rotate its temporary password (must_change locked true) so the temp password is single-use.
	ForceChange *bool `json:"forceChange,omitempty"`
}

func (h *Handler) createAdmin(w http.ResponseWriter, r *http.Request) {
	var req createAdminRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.StateCode = NormaliseStateCode(req.StateCode)
	if req.Name == "" || len(req.Name) < 3 || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a name of at least 3 characters is required")
		return
	}
	if !validEmail(req.Email) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid email is required")
		return
	}
	phoneDigits, ok := NormalisePhone(req.Phone)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "invalid_phone", "phone must be a 10-digit Indian mobile number")
		return
	}
	if !IsValidState(req.StateCode) {
		httpx.Fail(w, http.StatusBadRequest, "unknown_state", "unknown state code")
		return
	}
	issueLogin := true
	if req.IssueLogin != nil {
		issueLogin = *req.IssueLogin
	}
	if issueLogin {
		if len(req.Password) < minNewPasswordLen || len(req.Password) > maxPasswordLen || weakPassword(req.Password) {
			httpx.Fail(w, http.StatusBadRequest, "weak_password", "password must be at least 12 characters and not a common value")
			return
		}
	}

	res, err := h.provisioner.Create(r.Context(), CreateParams{
		Name: req.Name, Email: req.Email, PhoneDigits: phoneDigits, StateCode: req.StateCode,
		IssueLogin: issueLogin, Password: req.Password,
	})
	if err != nil {
		if conflict := AsConflict(err); conflict != nil {
			// Audit the block with a hashed identity, never the raw email/phone (AGENTS.md security).
			before, _ := json.Marshal(map[string]string{"emailHash": shortHash(req.Email), "reason": conflict.Code})
			_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
				ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
				Action: "STATE_ADMIN_CREATE_BLOCKED", Entity: "admins.state_admins", EntityID: conflict.ConflictingID,
				Before: before,
			})
			httpx.FailConflict(w, conflict.Code, conflict.Message, conflict.ConflictingRole, conflict.ConflictingID)
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "state_admin_create_failed", "could not create state admin")
		return
	}

	h.auditCreate(r, res)
	out := map[string]any{"admin": res.Admin}
	if res.LoginIssued {
		out["credential"] = res.Credential
	}
	if len(res.Warnings) > 0 {
		// Soft, non-blocking notices (shared phone across a seller/roster row) — creation succeeded.
		out["warnings"] = res.Warnings
	}
	httpx.JSON(w, http.StatusCreated, out)
}

// auditCreate records the roster row and, when a login was minted, the credential row.
func (h *Handler) auditCreate(r *http.Request, res CreateResult) {
	afterAdmin, _ := json.Marshal(res.Admin)
	if err := h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
		Action: "STATE_ADMIN_CREATE", Entity: "admins.state_admins", EntityID: res.Admin.AdminID, After: afterAdmin,
	}); err != nil {
		return
	}
	if res.LoginIssued {
		afterUser, _ := json.Marshal(res.Credential)
		_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
			ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
			Action: "PORTAL_USER_CREATE", Entity: "admins.portal_users", EntityID: res.Credential.ID, After: afterUser,
		})
	}
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
	admin, ok, err := h.provisioner.SetActive(r.Context(), id, req.Active)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "state_admin_update_failed", "could not update state admin")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "state admin not found")
		return
	}
	after, _ := json.Marshal(admin)
	_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
		Action: "STATE_ADMIN_UPDATE", Entity: "admins.state_admins", EntityID: admin.AdminID, After: after,
	})
	httpx.JSON(w, http.StatusOK, admin)
}

func (h *Handler) deleteAdmin(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.provisioner.Delete(r.Context(), id); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "state_admin_delete_failed", "could not delete state admin")
		return
	}
	_ = h.repo.Audit(r.Context(), contracts.AuditEntry{
		ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
		Action: "STATE_ADMIN_DELETE", Entity: "admins.state_admins", EntityID: id,
	})
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// shortHash returns a stable 64-bit hex prefix of an identity for audit logs (never raw PII).
func shortHash(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:8])
}