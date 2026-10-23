package tax

import (
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the category/GST master data and the platform rate card. Reads are available to any
// signed-in account (sellers need the approved category list); writes are SUPER_ADMIN only.
type Handler struct {
	repo *Repo
}

// NewHandler builds the tax handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts the tax routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/tax/categories", h.categories)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/tax/categories", h.adminCategories)
		g.Put("/admin/tax/categories", h.upsertCategory)
		g.Delete("/admin/tax/categories/{id}", h.deleteCategory)
		g.Get("/admin/tax/settings", h.settings)
		g.Put("/admin/tax/settings", h.updateSettings)
	})
}

func (h *Handler) categories(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.Categories(r.Context(), true)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_unavailable", "tax categories unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) adminCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.Categories(r.Context(), false)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_unavailable", "tax categories unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type categoryRequest struct {
	Sector     string `json:"sector"`
	Category   string `json:"category"`
	GSTRatePct int    `json:"gstRatePct"`
}

var validRates = map[int]bool{0: true, 5: true, 12: true, 18: true, 28: true}

func validSector(s string) bool {
	switch s {
	case "MART", "FOOD", "PHARMA":
		return true
	}
	return false
}

func (h *Handler) upsertCategory(w http.ResponseWriter, r *http.Request) {
	var req categoryRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Sector = strings.ToUpper(strings.TrimSpace(req.Sector))
	req.Category = strings.TrimSpace(req.Category)
	if !validSector(req.Sector) || req.Category == "" || len(req.Category) > 80 || !validRates[req.GSTRatePct] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "sector, category and a valid GST rate are required")
		return
	}
	item, err := h.repo.UpsertCategory(r.Context(), req.Sector, req.Category, req.GSTRatePct, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_write_failed", "could not save category")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) deleteCategory(w http.ResponseWriter, r *http.Request) {
	ok, err := h.repo.DeleteCategory(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_write_failed", "could not delete category")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "category not found")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) settings(w http.ResponseWriter, r *http.Request) {
	s, err := h.repo.Settings(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_unavailable", "tax settings unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}

func (h *Handler) updateSettings(w http.ResponseWriter, r *http.Request) {
	var req Settings
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if req.PlatformGSTPct < 0 || req.PlatformGSTPct > 28 || req.TCSPct < 0 || req.TCSPct > 10 ||
		req.TDSPct < 0 || req.TDSPct > 10 || req.DeliveryFeePaisa < 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "rates are out of range")
		return
	}
	s, err := h.repo.UpdateSettings(r.Context(), req, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_write_failed", "could not save settings")
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}
