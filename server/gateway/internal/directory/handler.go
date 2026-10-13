package directory

import (
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves store directory endpoints.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
}

// NewHandler builds the directory handler.
func NewHandler(repo *Repo, c *cache.Cache) *Handler { return &Handler{repo: repo, cache: c} }

// Register mounts directory endpoints onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/stores", h.list)
	r.Get("/store/{id}", h.get)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	app := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("app")))
	stores, err := h.repo.ByApp(r.Context(), app)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if stores == nil {
		stores = []contracts.Store{}
	}
	httpx.JSON(w, http.StatusOK, stores)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached contracts.Store
	if h.cache.GetJSON(r.Context(), cache.Store(id), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	store, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "store not found")
		return
	}
	h.cache.SetJSON(r.Context(), cache.Store(id), store, cache.TTLStore)
	httpx.JSON(w, http.StatusOK, store)
}
