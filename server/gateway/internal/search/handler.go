// Package search serves the full-text search context. It reads through a
// contracts.ProductReader (delegated to the catalog repo at composition time); the
// Scaling-stage Rust/Tantivy extraction replaces only the injected reader.
// Future service: Rust + Tantivy (monolith-breakdown §1).
package search

import (
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

const (
	defaultSearchLimit = 40
	maxSearchLimit     = 100
)

// Handler serves search.
type Handler struct {
	reader contracts.ProductReader
	cache  *cache.Cache
}

// NewHandler builds the search handler.
func NewHandler(reader contracts.ProductReader, c *cache.Cache) *Handler {
	return &Handler{reader: reader, cache: c}
}

// Register mounts the search endpoint onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/search", h.search)
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	app := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("app")))
	limit := httpx.LimitParam(r, defaultSearchLimit, maxSearchLimit)

	// Empty queries have no FTS term — return empty instead of running an ORDER BY rating full scan.
	if q == "" {
		httpx.JSON(w, http.StatusOK, []contracts.Product{})
		return
	}
	// Whitelist the app filter so an arbitrary app::text value can never bypass the app index.
	switch app {
	case contracts.AppMart, contracts.AppFood, contracts.AppPharma:
	default:
		app = ""
	}

	// Cache key: faazio:v1:search:q:{query}, app-scoped variant includes the app.
	key := cache.SearchQuery(q)
	if app != "" {
		key = cache.SearchQuery(app + ":" + q)
	}
	var cached []contracts.Product
	if h.cache.GetJSON(r.Context(), key, &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}

	products, err := h.reader.Search(r.Context(), q, app, limit)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "search_unavailable", "search unavailable")
		return
	}
	if products == nil {
		products = []contracts.Product{}
	}
	h.cache.SetJSON(r.Context(), key, products, cache.TTLSearch)
	httpx.JSON(w, http.StatusOK, products)
}
