package festival

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the SUPER_ADMIN festival calendar CRUD.
type Handler struct {
	repo  *Repo
	audit contracts.AuditWriter
}

// NewHandler builds the festival admin handler.
func NewHandler(repo *Repo, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, audit: audit}
}

// Register mounts the SUPER_ADMIN calendar endpoints.
func (h *Handler) Register(r chi.Router) {
	r.With(auth.RequireRole(auth.RoleSuperAdmin)).Get("/admin/festival/calendar", h.list)
	r.With(auth.RequireRole(auth.RoleSuperAdmin)).Post("/admin/festival/calendar", h.create)
	r.With(auth.RequireRole(auth.RoleSuperAdmin)).Delete("/admin/festival/calendar/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "festival_unavailable", "festival calendar unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req Festival
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if err := Validate(req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	// A newly-inserted window is live unless the operator deletes it (the calendar has no edit
	// route); this also stops a missing `active` field from silently creating a dead row.
	req.Active = true
	created, err := h.repo.Insert(r.Context(), req, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "festival_unavailable", "could not save festival")
		return
	}
	if h.audit != nil {
		after, _ := json.Marshal(created)
		_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
			ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
			Action: "FESTIVAL_CREATE", Entity: "ops.festival_calendar", EntityID: created.ID, After: after,
		})
	}
	httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "id is required")
		return
	}
	ok, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "festival_unavailable", "could not delete festival")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "festival not found")
		return
	}
	if h.audit != nil {
		_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
			ActorID: auth.UserID(r.Context()), ActorRole: auth.Role(r.Context()),
			Action: "FESTIVAL_DELETE", Entity: "ops.festival_calendar", EntityID: id,
		})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
}

// Validate checks a festival payload. Dates are YYYY-MM-DD and end must not precede start.
func Validate(f Festival) error {
	if strings.TrimSpace(f.Name) == "" {
		return errors.New("name is required")
	}
	start, err := time.Parse("2006-01-02", f.StartDate)
	if err != nil {
		return errors.New("startDate must be YYYY-MM-DD")
	}
	end, err := time.Parse("2006-01-02", f.EndDate)
	if err != nil {
		return errors.New("endDate must be YYYY-MM-DD")
	}
	if end.Before(start) {
		return errors.New("endDate must be on or after startDate")
	}
	if f.SurgePaisa < 0 {
		return errors.New("surgePaisa must be >= 0")
	}
	return nil
}
