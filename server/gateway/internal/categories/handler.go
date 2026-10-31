package categories

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the superadmin category taxonomy. Reads (drill-in tree + home rail) are available to
// any signed-in account; every mutation is SUPER_ADMIN only.
type Handler struct {
	repo *Repo
}

// NewHandler builds the categories handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts the category routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/categories", h.list)
		g.Get("/categories/rail", h.rail)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/categories", h.adminList)
		g.Post("/categories", h.create)
		g.Put("/categories/{id}", h.update)
		g.Delete("/categories/{id}", h.remove)
	})
}

func validApp(s string) bool {
	switch s {
	case "MART", "FOOD", "PHARMA":
		return true
	}
	return false
}

// list returns active categories, optionally filtered by app and/or parent.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	opts := ListOptions{
		App:        strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("app"))),
		ActiveOnly: true,
	}
	if opts.App != "" && !validApp(opts.App) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown app")
		return
	}
	if r.URL.Query().Has("parent_id") {
		pid := strings.TrimSpace(r.URL.Query().Get("parent_id"))
		opts.ParentID = &pid
	}
	if r.URL.Query().Get("top_level") == "true" {
		opts.TopLevel = true
	}
	h.respond(w, r, opts)
}

// rail returns the flat active top-level categories for the home header rail.
func (h *Handler) rail(w http.ResponseWriter, r *http.Request) {
	h.respond(w, r, ListOptions{TopLevel: true, ActiveOnly: true})
}

// adminList returns every category (including deactivated) for the portal.
func (h *Handler) adminList(w http.ResponseWriter, r *http.Request) {
	opts := ListOptions{App: strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("app")))}
	if opts.App != "" && !validApp(opts.App) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown app")
		return
	}
	h.respond(w, r, opts)
}

func (h *Handler) respond(w http.ResponseWriter, r *http.Request, opts ListOptions) {
	items, err := h.repo.List(r.Context(), opts)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "categories_unavailable", "categories unavailable")
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
	req.App = strings.ToUpper(strings.TrimSpace(req.App))
	req.Name = strings.TrimSpace(req.Name)
	req.ID = strings.TrimSpace(req.ID)
	if !validApp(req.App) || req.Name == "" || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "app and name are required")
		return
	}
	if req.ID != "" && !validID(req.ID) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "id must be a short slug")
		return
	}
	if !h.validParent(r.Context(), req.App, req.ParentID) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "parent category is invalid")
		return
	}
	item, err := h.repo.Create(r.Context(), req, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not save category")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req Input
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.App = strings.ToUpper(strings.TrimSpace(req.App))
	req.Name = strings.TrimSpace(req.Name)
	if !validApp(req.App) || req.Name == "" || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "app and name are required")
		return
	}
	if req.ParentID != nil && *req.ParentID == id {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a category cannot be its own parent")
		return
	}
	if !h.validParent(r.Context(), req.App, req.ParentID) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "parent category is invalid")
		return
	}
	item, err := h.repo.Update(r.Context(), id, req, auth.UserID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "category not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not save category")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.repo.Deactivate(r.Context(), id, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not delete category")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "category not found")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "deactivated": true, "id": id})
}

// validParent accepts a nil parent, or a parent that exists for the same app.
func (h *Handler) validParent(ctx context.Context, app string, parentID *string) bool {
	if parentID == nil || strings.TrimSpace(*parentID) == "" {
		return true
	}
	parent, err := h.repo.Get(ctx, strings.TrimSpace(*parentID))
	if err != nil {
		return false
	}
	return parent.App == app
}

// validID keeps superadmin-supplied ids to a URL-safe slug (letters, digits, dash, underscore).
func validID(s string) bool {
	if len(s) > 80 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
		default:
			return false
		}
	}
	return true
}
