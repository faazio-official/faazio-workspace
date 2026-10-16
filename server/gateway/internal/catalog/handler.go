package catalog

import (
	"encoding/json"
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
	defaultStoreProductLimit = 40
	maxStoreProductLimit     = 100
)

// Handler serves product detail + batch endpoints and seller product management.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
}

// NewHandler builds the catalog HTTP handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts the catalog endpoints onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/product/{id}", h.getProduct)
	r.Post("/products/batch", h.batch)
	r.Get("/stores/{id}/products", h.storeProducts)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/products", h.sellerProducts)
		g.Put("/seller/products/{id}/status", h.setProductStatus)
		g.Put("/seller/products/{id}", h.updateProduct)
	})
}

// updateProduct edits price/MRP/stock (seller-scoped). Body: {price?, mrp?, inStockQty?, available?}.
func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Price      *int64 `json:"price"`
		MRP        *int64 `json:"mrp"`
		InStockQty *int64 `json:"inStockQty"`
		Available  *bool  `json:"available"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.Price != nil && (*body.Price < 0 || *body.Price > 10_000_000) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid price")
		return
	}
	if body.MRP != nil && (*body.MRP < 0 || *body.MRP > 10_000_000) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid mrp")
		return
	}
	if body.InStockQty != nil && (*body.InStockQty < 0 || *body.InStockQty > 1_000_000) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid stock quantity")
		return
	}
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	p, ok, err := h.repo.UpdateProduct(r.Context(), id, auth.SellerID(r.Context()), admin, ProductEdit{
		Price: body.Price, MRP: body.MRP, InStockQty: body.InStockQty, Available: body.Available,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	h.cache.Del(r.Context(), cache.Product(id), cache.Stock(id), cache.StoreProducts(p.StoreID))
	h.log(r, "PRODUCT_EDIT", id, map[string]any{"price": p.Price})
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached contracts.Product
	if h.cache.GetJSON(r.Context(), cache.Product(id), &cached) {
		httpx.JSON(w, http.StatusOK, map[string]any{"product": cached})
		return
	}
	p, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	h.cache.SetJSON(r.Context(), cache.Product(id), p, cache.TTLProduct)
	httpx.JSON(w, http.StatusOK, map[string]any{"product": p})
}

func (h *Handler) batch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if len(body.IDs) > 200 {
		body.IDs = body.IDs[:200]
	}
	products, err := h.repo.ByIDs(r.Context(), body.IDs)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, products)
}

// storeProducts serves a store's ACTIVE catalog rows (vendor drill-in) with keyset pagination.
// Anonymous/public: the projection is PII-free product data, so the first page is edge-cacheable.
func (h *Handler) storeProducts(w http.ResponseWriter, r *http.Request) {
	storeID := strings.TrimSpace(chi.URLParam(r, "id"))
	if storeID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "store id is required")
		return
	}
	limit := httpx.LimitParam(r, defaultStoreProductLimit, maxStoreProductLimit)

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

	// Only the first (cursor-free) page is cached; later pages are cheap and stay fresh.
	if !hasCursor {
		var cached []contracts.Product
		if h.cache.GetJSON(r.Context(), cache.StoreProducts(storeID), &cached) {
			httpx.JSON(w, http.StatusOK, cached)
			return
		}
	}

	products, err := h.repo.ByStorePage(r.Context(), storeID, limit+1, cursorRating, cursorID, hasCursor)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if len(products) > limit {
		products = products[:limit]
		last := products[len(products)-1]
		httpx.SetNextCursor(w, httpx.EncodeCursor(strconv.FormatFloat(last.Rating, 'f', -1, 64), last.ID))
	}
	if products == nil {
		products = []contracts.Product{}
	}
	if !hasCursor {
		h.cache.SetJSON(r.Context(), cache.StoreProducts(storeID), products, cache.TTLStoreProducts)
	}
	httpx.JSON(w, http.StatusOK, products)
}

func (h *Handler) sellerProducts(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	items, err := h.repo.SellerProducts(r.Context(), sellerID, strings.TrimSpace(r.URL.Query().Get("status")))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) setProductStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	status := strings.ToUpper(strings.TrimSpace(body.Status))
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	if !allowedProductStatus(status, admin) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "status not permitted for this role")
		return
	}
	p, ok, err := h.repo.SetProductStatus(r.Context(), id, auth.SellerID(r.Context()), status, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	h.cache.Del(r.Context(), cache.Product(id), cache.StoreProducts(p.StoreID))
	h.log(r, "PRODUCT_"+status, id, map[string]string{"status": status})
	httpx.JSON(w, http.StatusOK, p)
}

// allowedProductStatus separates seller self-service transitions from admin moderation.
func allowedProductStatus(status string, admin bool) bool {
	if admin {
		switch status {
		case "ACTIVE", "REJECTED", "DELISTED":
			return true
		}
		return false
	}
	switch status {
	case "DRAFT", "PENDING_REVIEW", "DELISTED":
		return true
	}
	return false
}

func (h *Handler) log(r *http.Request, action, entityID string, after any) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = auth.SellerID(r.Context())
	}
	if actorID == "" {
		actorID = "anonymous"
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSeller
	}
	var raw json.RawMessage
	if b, err := json.Marshal(after); err == nil {
		raw = b
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: "catalog.products", EntityID: entityID, After: raw,
	})
}
