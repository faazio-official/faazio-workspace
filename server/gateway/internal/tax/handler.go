package tax

import (
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the GST rate pick-list, the category GST links and the platform rate card. Reads are
// available to any signed-in account (sellers need the approved category list + its rate); writes are
// SUPER_ADMIN only.
type Handler struct {
	repo *Repo
}

// NewHandler builds the tax handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts the tax routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		// Seller-facing approved category list, each with its mandatory GST.
		g.Get("/tax/categories", h.categories)
		g.Get("/tax/gst-rate-categories", h.gstRateCategories)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/tax/gst-rate-categories", h.adminGSTRateCategories)
		g.Post("/admin/tax/gst-rate-categories", h.createGSTRateCategory)
		g.Put("/admin/tax/gst-rate-categories/{id}", h.updateGSTRateCategory)
		g.Delete("/admin/tax/gst-rate-categories/{id}", h.deleteGSTRateCategory)
		g.Get("/admin/tax/category-gst-rates", h.categoryGSTRates)
		g.Put("/admin/tax/category-gst-rates/{id}", h.upsertCategoryGSTRate)
	})
}

func (h *Handler) categories(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.CategoryRates(r.Context(), true)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_unavailable", "tax categories unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) gstRateCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.GSTRateCategories(r.Context(), true)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_unavailable", "GST rates unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) adminGSTRateCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.GSTRateCategories(r.Context(), false)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_unavailable", "GST rates unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type gstRateCategoryRequest struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Sector     string `json:"sector"`
	GSTRatePct int    `json:"gstRatePct"`
	IsActive   *bool  `json:"isActive"`
}

// decodeGSTRateCategory reads and validates a slab payload, writing a 400 and returning false when
// the body is malformed.
func decodeGSTRateCategory(w http.ResponseWriter, r *http.Request) (GSTRateCategory, bool) {
	var req gstRateCategoryRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return GSTRateCategory{}, false
	}
	req.ID = strings.TrimSpace(req.ID)
	req.Name = strings.TrimSpace(req.Name)
	req.Sector = strings.ToUpper(strings.TrimSpace(req.Sector))
	if req.Name == "" || len(req.Name) > 120 || !ValidGSTSector(req.Sector) || !ValidGSTRatePct(req.GSTRatePct) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request",
			"name, sector and a valid GST rate are required")
		return GSTRateCategory{}, false
	}
	if req.ID != "" && !validSlug(req.ID) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "id must be a short slug")
		return GSTRateCategory{}, false
	}
	return GSTRateCategory{
		ID: req.ID, Name: req.Name, Sector: req.Sector, GSTRatePct: req.GSTRatePct,
		IsActiveInput: req.IsActive,
	}, true
}

func (h *Handler) createGSTRateCategory(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeGSTRateCategory(w, r)
	if !ok {
		return
	}
	item, err := h.repo.UpsertGSTRateCategory(r.Context(), req, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_write_failed", "could not save the GST rate")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) updateGSTRateCategory(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeGSTRateCategory(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if req.ID != "" && req.ID != id {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "id in the body does not match the path")
		return
	}
	req.ID = id
	item, err := h.repo.UpsertGSTRateCategory(r.Context(), req, auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_write_failed", "could not save the GST rate")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) deleteGSTRateCategory(w http.ResponseWriter, r *http.Request) {
	ok, err := h.repo.DeleteGSTRateCategory(r.Context(), chi.URLParam(r, "id"), auth.UserID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrInUse) {
			httpx.Fail(w, http.StatusConflict, "in_use",
				"this GST rate is linked to a category — re-rate the category first")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "tax_write_failed", "could not delete the GST rate")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "GST rate not found")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "deactivated": true})
}

func (h *Handler) categoryGSTRates(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.CategoryGSTRates(r.Context(), strings.TrimSpace(r.URL.Query().Get("category_id")))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "tax_unavailable", "category GST rates unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type categoryGSTRateRequest struct {
	GSTRateCategoryID string `json:"gstRateCategoryId"`
}

func (h *Handler) upsertCategoryGSTRate(w http.ResponseWriter, r *http.Request) {
	var req categoryGSTRateRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.GSTRateCategoryID = strings.TrimSpace(req.GSTRateCategoryID)
	if req.GSTRateCategoryID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "gstRateCategoryId is required")
		return
	}
	item, err := h.repo.UpsertCategoryGSTRate(r.Context(), chi.URLParam(r, "id"),
		req.GSTRateCategoryID, auth.UserID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrUnknownRate) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown or inactive GST rate")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "tax_write_failed", "could not save the category GST")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
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
	if req.PlatformGSTPct < 0 || req.PlatformGSTPct > 40 || req.TCSPct < 0 || req.TCSPct > 10 ||
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

// validSlug keeps superadmin-supplied ids to a URL-safe slug (letters, digits, dash, underscore).
func validSlug(s string) bool {
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
