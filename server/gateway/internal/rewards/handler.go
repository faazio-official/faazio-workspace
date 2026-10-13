package rewards

import (
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the auth-scoped rewards view. Writes happen inside checkout's order transaction
// (the server-authoritative earn path), never as a public endpoint — so a client cannot forge coins.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
}

// NewHandler builds the rewards handler.
func NewHandler(repo *Repo, c *cache.Cache) *Handler { return &Handler{repo: repo, cache: c} }

// Register mounts rewards onto the shared router (auth-scoped).
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/rewards", h.get)
	})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached View
	if h.cache.GetJSON(r.Context(), cache.Rewards(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	view, err := h.repo.View(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "rewards_unavailable", "rewards unavailable")
		return
	}
	if view.Ledger == nil {
		view.Ledger = []LedgerEntry{}
	}
	h.cache.SetJSON(r.Context(), cache.Rewards(userID), view, cache.TTLRewards)
	httpx.JSON(w, http.StatusOK, view)
}