package districts

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// maxNameLen bounds district_name; the longest real name (Tiruchirappalli) is well under it.
const maxNameLen = 80

// codePattern mirrors the DB CHECK widened by 0127: two uppercase letters then one to three
// uppercase letters/digits (TCH = Chennai, PY0 = Puducherry, UP71 = a state with >36 districts).
// The old 3-char cap could not express Uttar Pradesh's 75 districts.
var codePattern = regexp.MustCompile(`^[A-Z]{2}[A-Z0-9]{1,3}$`)

// statePattern is the ISO 3166-2:IN shape (char(2) uppercase).
var statePattern = regexp.MustCompile(`^[A-Z]{2}$`)

// Handler serves the district master: the read-only picker read for any signed-in account, and the
// SUPER_ADMIN write API that makes admins.district_master the single source of truth. Every write is
// audit-logged and reloads the in-process geo mirror so the new row validates immediately.
type Handler struct {
	repo  *Repo
	audit contracts.AuditWriter
	// reload refreshes internal/platform/geo after a write. Nil falls back to geo.Reload with no pool
	// (a no-op), so tests can inject a counter.
	reload func() error
}

// NewHandler builds the districts handler. reload is the geo cache refresh (usually a closure over
// the shared pool); pass nil in tests that do not care about the mirror.
func NewHandler(repo *Repo, audit contracts.AuditWriter, reload func() error) *Handler {
	return &Handler{repo: repo, audit: audit, reload: reload}
}

// Register mounts the districts routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/geo/districts", h.districts)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/districts", h.adminList)
		g.Get("/admin/districts/trash", h.adminTrash)
		g.Post("/admin/districts", h.create)
		g.Put("/admin/districts/{code}", h.update)
		g.Patch("/admin/districts/{code}/toggle", h.toggle)
		g.Delete("/admin/districts/{code}", h.remove)
		g.Post("/admin/districts/{code}/restore", h.restore)
		g.Delete("/admin/districts/{code}/permanent", h.permanentRemove)
	})
}

func (h *Handler) districts(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if len(stateCode) > 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state must be a 2-letter code")
		return
	}
	items, err := h.repo.List(r.Context(), stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "districts_unavailable", "districts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// adminList returns every district including deactivated ones for the coverage page.
func (h *Handler) adminList(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if len(stateCode) > 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state must be a 2-letter code")
		return
	}
	items, err := h.repo.ListAll(r.Context(), stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "districts_unavailable", "districts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req Input
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Code = geo.Normalise(req.Code)
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.Name = strings.TrimSpace(req.Name)
	if msg, ok := validateShape(req.Code, req.Name, req.StateCode); !ok {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	if !h.stateExists(r.Context(), req.StateCode) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown state/UT code")
		return
	}
	item, err := h.repo.Create(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrDuplicate):
			httpx.Fail(w, http.StatusConflict, "conflict", "a district with this code already exists")
		default:
			httpx.Fail(w, http.StatusInternalServerError, "district_write_failed", "could not create district")
		}
		return
	}
	h.persisted(r, "DISTRICT_CREATE", item, nil)
	httpx.JSON(w, http.StatusCreated, item)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	code := geo.Normalise(chi.URLParam(r, "code"))
	var req Input
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.Name = strings.TrimSpace(req.Name)
	if msg, ok := validateShape(code, req.Name, req.StateCode); !ok {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	if !h.stateExists(r.Context(), req.StateCode) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown state/UT code")
		return
	}
	before, beforeErr := h.repo.Get(r.Context(), code)
	item, err := h.repo.Update(r.Context(), code, req)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "district not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "district_write_failed", "could not update district")
		return
	}
	var prev any
	if beforeErr == nil {
		prev = before
	}
	h.persisted(r, "DISTRICT_UPDATE", item, prev)
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) toggle(w http.ResponseWriter, r *http.Request) {
	code := geo.Normalise(chi.URLParam(r, "code"))
	var req struct {
		IsActive *bool `json:"isActive"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.IsActive == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "isActive is required")
		return
	}
	before, _ := h.repo.Get(r.Context(), code)
	item, err := h.repo.SetActive(r.Context(), code, *req.IsActive)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "district not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "district_write_failed", "could not update district")
		return
	}
	h.persisted(r, "DISTRICT_TOGGLE", item, before)
	httpx.JSON(w, http.StatusOK, item)
}

// adminTrash lists trashed districts still inside the undo window (GET /admin/districts/trash). It
// runs the expiry purge first so an expired row never appears as restorable.
func (h *Handler) adminTrash(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if len(stateCode) > 2 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state must be a 2-letter code")
		return
	}
	_, _ = h.repo.PurgeDeleted(r.Context(), DistrictTrashWindow)
	items, err := h.repo.ListDeleted(r.Context(), stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "districts_unavailable", "districts unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// remove moves a district to the trash (DELETE /admin/districts/{code}?reason=...). It is restorable
// for 7 days, then the purger removes it for good. A district still referenced by sellers, admins,
// portal logins or delivery orders is refused — deactivate it instead.
func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	code := geo.Normalise(chi.URLParam(r, "code"))
	reason := strings.TrimSpace(r.URL.Query().Get("reason"))
	if len(reason) > 500 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "delete reason is too long")
		return
	}
	before, err := h.repo.Get(r.Context(), code)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "district not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "district_write_failed", "could not delete district")
		return
	}
	if before.DeletedAt != "" {
		httpx.Fail(w, http.StatusNotFound, "not_found", "district not found")
		return
	}
	if before.InUse {
		httpx.Fail(w, http.StatusConflict, "district_in_use",
			"this district still has sellers, admins or payouts — deactivate it instead")
		return
	}
	item, ok, err := h.repo.SoftDelete(r.Context(), code, reason)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "district_write_failed", "could not delete district")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "district_in_use",
			"this district still has sellers, admins or payouts — deactivate it instead")
		return
	}
	h.persisted(r, "DISTRICT_DELETE", item, before)
	httpx.JSON(w, http.StatusOK, item)
}

// restore clears the trash flag (POST /admin/districts/{code}/restore). The row comes back
// deactivated so the operator re-enables it deliberately.
func (h *Handler) restore(w http.ResponseWriter, r *http.Request) {
	code := geo.Normalise(chi.URLParam(r, "code"))
	before, err := h.repo.Get(r.Context(), code)
	if err != nil {
		httpx.Fail(w, http.StatusNotFound, "not_found", "district not found")
		return
	}
	if before.DeletedAt == "" {
		httpx.Fail(w, http.StatusNotFound, "not_found", "district not found in trash")
		return
	}
	if deletedAt, parseErr := time.Parse(time.RFC3339, before.DeletedAt); parseErr == nil &&
		time.Since(deletedAt) > DistrictTrashWindow {
		_, _ = h.repo.PurgeOne(r.Context(), code)
		httpx.Fail(w, http.StatusGone, "trash_expired",
			"the restore window has closed; this district was permanently deleted")
		return
	}
	item, ok, err := h.repo.Restore(r.Context(), code)
	if err != nil || !ok {
		httpx.Fail(w, http.StatusInternalServerError, "district_write_failed", "could not restore district")
		return
	}
	h.persisted(r, "DISTRICT_RESTORE", item, before)
	httpx.JSON(w, http.StatusOK, item)
}

// permanentRemove hard-deletes one trashed, unreferenced district now (DELETE
// /admin/districts/{code}/permanent). Referenced rows are refused; the row is otherwise unrecoverable.
func (h *Handler) permanentRemove(w http.ResponseWriter, r *http.Request) {
	code := geo.Normalise(chi.URLParam(r, "code"))
	before, err := h.repo.Get(r.Context(), code)
	if err != nil {
		httpx.Fail(w, http.StatusNotFound, "not_found", "district not found")
		return
	}
	if before.DeletedAt == "" {
		httpx.Fail(w, http.StatusNotFound, "not_found", "district not found in trash")
		return
	}
	if before.InUse {
		httpx.Fail(w, http.StatusConflict, "district_in_use",
			"this district still has sellers, admins or payouts — it cannot be permanently deleted")
		return
	}
	ok, err := h.repo.PurgeOne(r.Context(), code)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "district_write_failed", "could not delete district")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusConflict, "district_in_use",
			"this district still has sellers, admins or payouts — it cannot be permanently deleted")
		return
	}
	h.persisted(r, "DISTRICT_PURGE", nil, before)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": code})
}

// persisted records the audit row and refreshes the geo mirror. Both are best-effort: a failed audit
// insert or reload must never fail a write the DB already committed.
func (h *Handler) persisted(r *http.Request, action string, after, before any) {
	if h.audit != nil {
		entry := contracts.AuditEntry{
			ActorID:   auth.UserID(r.Context()),
			ActorRole: auth.Role(r.Context()),
			Action:    action,
			Entity:    "admins.district_master",
			EntityID:  entityID(after, before),
		}
		if b := snapshot(before); b != nil {
			entry.Before = b
		}
		if a := snapshot(after); a != nil {
			entry.After = a
		}
		_ = h.audit.Audit(r.Context(), entry)
	}
	if h.reload != nil {
		_ = h.reload()
	}
}

// snapshot marshals an audit payload, dropping a zero District (a failed pre-read must not write an
// empty "before" object into the trail).
func snapshot(v any) json.RawMessage {
	if d, ok := v.(District); ok && d.DistrictCode == "" {
		return nil
	}
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return b
}

func entityID(after, before any) string {
	if d, ok := after.(District); ok && d.DistrictCode != "" {
		return d.DistrictCode
	}
	if d, ok := before.(District); ok {
		return d.DistrictCode
	}
	return ""
}

// validateShape enforces the table's CHECK constraints (code/name/state shape) so a malformed
// payload is a 400 here rather than a 500 from Postgres. The state allowlist is checked separately
// against admins.states (stateExists) because the extensible master lives in the DB.
func validateShape(code, name, stateCode string) (string, bool) {
	if !codePattern.MatchString(code) {
		return "district code must be 2 letters followed by a letter or digit (e.g. TCH)", false
	}
	if name == "" || len([]rune(name)) > maxNameLen {
		return "district name is required (max 80 characters)", false
	}
	if !statePattern.MatchString(stateCode) {
		return "stateCode must be a 2-letter ISO state/UT code", false
	}
	return "", true
}

// stateExists reports whether stateCode is a known state/UT. Coverage states short-circuit (the geo
// mirror already knows them); everything else is looked up in admins.states, so adding a new state
// stays data-only — no gateway deploy.
func (h *Handler) stateExists(ctx context.Context, stateCode string) bool {
	if geo.InCoverageState(stateCode) {
		return true
	}
	ok, err := h.repo.StateExists(ctx, stateCode)
	if err != nil {
		// An unreachable DB should not turn a valid write into a 400; let it through and let the
		// insert itself decide (a bad state then fails on the FK-free column, as before).
		return true
	}
	return ok
}
