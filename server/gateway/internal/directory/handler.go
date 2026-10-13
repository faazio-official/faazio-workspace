package directory

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

const (
	defaultStoreLimit = 100
	maxStoreLimit     = 200
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
	limit := httpx.LimitParam(r, defaultStoreLimit, maxStoreLimit)

	var (
		cursorRating float64
		cursorID     string
		hasCursor    bool
	)
	if parts, ok := httpx.DecodeCursor(r.URL.Query().Get("cursor"), 2); ok {
		if rating, err := strconv.ParseFloat(parts[0], 64); err == nil {
			cursorRating, cursorID, hasCursor = rating, parts[1], true
		}
	}

	stores, err := h.repo.ByAppPage(r.Context(), app, limit+1, cursorRating, cursorID, hasCursor)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if auth.UserID(r.Context()) == "" {
		for i := range stores {
			redactStore(&stores[i])
		}
	}
	if len(stores) > limit {
		stores = stores[:limit]
		last := stores[len(stores)-1]
		httpx.SetNextCursor(w, httpx.EncodeCursor(strconv.FormatFloat(last.Rating, 'f', -1, 64), last.ID))
	}
	if stores == nil {
		stores = []contracts.Store{}
	}
	httpx.JSON(w, http.StatusOK, stores)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	authed := auth.UserID(r.Context()) != ""

	// Only the redacted (PII-free) projection is ever cached; authed reads bypass the
	// cache so phone/address are never persisted in Valkey (caching doc §6).
	if !authed {
		var cached contracts.Store
		if h.cache.GetJSON(r.Context(), cache.Store(id), &cached) {
			httpx.JSON(w, http.StatusOK, cached)
			return
		}
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
	if !authed {
		redactStore(&store)
		h.cache.SetJSON(r.Context(), cache.Store(id), store, cache.TTLStore)
	}
	httpx.JSON(w, http.StatusOK, store)
}

// redactStore strips PII columns from a public (unauthenticated) store projection.
func redactStore(s *contracts.Store) {
	s.Address = ""
	s.Phone = ""
}
