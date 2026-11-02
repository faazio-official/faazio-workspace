package reference

import (
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the read-only reference catalogues. Reads are available to any signed-in account
// (the onboarding/seller/campaign pickers are the consumers).
type Handler struct {
	repo *Repo
}

// NewHandler builds the reference handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts the reference routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/geo/states", h.states)
		g.Get("/geo/apps", h.apps)
		g.Get("/ads/placements", h.placements)
	})
}

func (h *Handler) states(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.States(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "states_unavailable", "states unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) apps(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.Apps(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "apps_unavailable", "app brands unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) placements(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.Placements(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "placements_unavailable", "ad placements unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}
