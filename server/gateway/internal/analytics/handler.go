package analytics

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

var validScopes = map[string]bool{"global": true, "seller": true, "state": true, "product": true}

// Handler serves the DB-backed portal dashboards.
type Handler struct {
	repo *Repo
}

// NewHandler builds the analytics handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts GET /analytics/series + GET /analytics/ranks (any signed-in portal account).
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/analytics/series", h.series)
		g.Get("/analytics/ranks", h.ranks)
	})
}

func parseDays(raw string) int {
	days, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || days <= 0 {
		return 30
	}
	if days > MaxDays {
		return MaxDays
	}
	return days
}

// series returns the daily GMV/orders buckets for a scope (GET /analytics/series?scope=&id=&days=).
func (h *Handler) series(w http.ResponseWriter, r *http.Request) {
	scope := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if !validScopes[scope] {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "scope must be global | seller | state | product")
		return
	}
	if scope != "global" && id == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "id is required for this scope")
		return
	}
	points, err := h.repo.Series(r.Context(), scope, id, parseDays(r.URL.Query().Get("days")))
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "analytics_unavailable", "analytics unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, points)
}

// ranks returns the seller/state/product totals for a window (GET /analytics/ranks?days=).
func (h *Handler) ranks(w http.ResponseWriter, r *http.Request) {
	ranks, err := h.repo.Ranks(r.Context(), parseDays(r.URL.Query().Get("days")))
	if err != nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "analytics_unavailable", "analytics unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, ranks)
}