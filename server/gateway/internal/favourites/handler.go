package favourites

import (
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

const maxFavouriteIDLen = 64

// Handler serves the auth-scoped favourites endpoints.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
}

// NewHandler builds the favourites handler.
func NewHandler(repo *Repo, c *cache.Cache) *Handler { return &Handler{repo: repo, cache: c} }

// Register mounts favourites onto the shared router. Every route is auth-scoped.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/favourites", h.list)
		g.Put("/favourites/{productId}", h.add)
		g.Delete("/favourites/{productId}", h.remove)
	})
}

type favouritesResponse struct {
	Items []string `json:"items"`
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached favouritesResponse
	if h.cache.GetJSON(r.Context(), cache.Favourites(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	items, err := h.repo.List(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "favourites_unavailable", "favourites unavailable")
		return
	}
	if items == nil {
		items = []string{}
	}
	resp := favouritesResponse{Items: items}
	h.cache.SetJSON(r.Context(), cache.Favourites(userID), resp, cache.TTLFavourites)
	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) add(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, true)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, false)
}

func (h *Handler) mutate(w http.ResponseWriter, r *http.Request, add bool) {
	userID := auth.UserID(r.Context())
	productID := chi.URLParam(r, "productId")
	if productID == "" || len(productID) > maxFavouriteIDLen {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid favourite id")
		return
	}
	var err error
	if add {
		err = h.repo.Add(r.Context(), userID, productID)
	} else {
		err = h.repo.Remove(r.Context(), userID, productID)
	}
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "favourites_unavailable", "favourites unavailable")
		return
	}
	h.cache.Del(r.Context(), cache.Favourites(userID))
	items, err := h.repo.List(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "favourites_unavailable", "favourites unavailable")
		return
	}
	if items == nil {
		items = []string{}
	}
	httpx.JSON(w, http.StatusOK, favouritesResponse{Items: items})
}