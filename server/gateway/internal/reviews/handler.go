package reviews

import (
	"errors"
	"net/http"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves product + vendor review endpoints.
type Handler struct {
	repo    *Repo
	service *Service
	cache   *cache.Cache
}

// NewHandler builds the reviews handler.
func NewHandler(repo *Repo, service *Service, c *cache.Cache) *Handler {
	return &Handler{repo: repo, service: service, cache: c}
}

// Register mounts review endpoints onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/product/{id}/reviews", h.productReviews)
	r.Get("/vendors/{id}/reviews", h.vendorReviews)
	r.Get("/vendors/{id}/reviews/summary", h.vendorSummary)
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Put("/vendors/{id}/rating", h.rateVendor)
	})
}

func (h *Handler) productReviews(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached []contracts.Review
	if h.cache.GetJSON(r.Context(), cache.ProductReviews(id), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	rows, err := h.repo.ProductReviews(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "reviews_unavailable", "reviews unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.ProductReviews(id), rows, cache.TTLReviews)
	httpx.JSON(w, http.StatusOK, rows)
}

func (h *Handler) vendorReviews(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached []contracts.VendorReview
	if h.cache.GetJSON(r.Context(), cache.VendorReviews(id), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	rows, err := h.repo.VendorReviews(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "reviews_unavailable", "reviews unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.VendorReviews(id), rows, cache.TTLReviews)
	httpx.JSON(w, http.StatusOK, rows)
}

func (h *Handler) vendorSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.repo.VendorSummary(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "reviews_unavailable", "reviews unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, summary)
}

func (h *Handler) rateVendor(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Rating  int64  `json:"rating"`
		Comment string `json:"comment"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	err := h.service.RateVendor(r.Context(), auth.UserID(r.Context()), chi.URLParam(r, "id"), body.Rating, body.Comment)
	switch {
	case errors.Is(err, ErrNotEligible):
		httpx.Fail(w, http.StatusForbidden, "not_eligible", "you can only rate vendors you have ordered from")
	case errors.Is(err, ErrInvalidRating):
		httpx.Fail(w, http.StatusBadRequest, "invalid_rating", "rating must be between 1 and 5")
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "rating_failed", "could not save rating")
	default:
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}
