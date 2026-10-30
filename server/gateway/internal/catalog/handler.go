package catalog

import (
	"context"
	"encoding/json"
	"math"
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
	media contracts.MediaReader
}

// NewHandler builds the catalog HTTP handler. media (optional) resolves a linked image asset id to its
// registry row so the seller edit can store the object key without importing the media context.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, media contracts.MediaReader) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit, media: media}
}

// Register mounts the catalog endpoints onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/product/{id}", h.getProduct)
	r.Get("/products/nearby", h.nearby)
	r.Post("/products/batch", h.batch)
	r.Get("/stores/{id}/products", h.storeProducts)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Post("/seller/products", h.createProduct)
		g.Get("/seller/products", h.sellerProducts)
		g.Put("/seller/products/{id}/status", h.setProductStatus)
		g.Put("/seller/products/{id}", h.updateProduct)
		// Inventory + pricing are first-class seller surfaces over the same catalog/stock row.
		g.Get("/seller/inventory", h.sellerInventory)
		g.Put("/seller/inventory/{productId}", h.setSellerInventory)
		g.Get("/seller/pricing", h.sellerPricing)
		g.Put("/seller/pricing/{productId}", h.setSellerPricing)
	})
}

// nearby serves ACTIVE products sold by live stores, nearest to the caller's foreground fix.
// The cache is stale-while-revalidate (same as GET /stores/nearby): a lapsed TTL serves the
// previous list and refreshes in the background instead of blanking the grid.
func (h *Handler) nearby(w http.ResponseWriter, r *http.Request) {
	lat, lng, ok := parseNearbyLatLng(r)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "lat and lng are required")
		return
	}
	app := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("app")))
	radius := 25.0
	if raw := strings.TrimSpace(r.URL.Query().Get("radius")); raw != "" {
		if v, err := strconv.ParseFloat(raw, 64); err == nil && v > 0 && v <= 100 {
			radius = v
		}
	}
	limit := httpx.LimitParam(r, 40, maxStoreProductLimit)
	latKey := strconv.FormatFloat(lat, 'f', 3, 64)
	lngKey := strconv.FormatFloat(lng, 'f', 3, 64)
	key := cache.NearbyProducts(latKey, lngKey, int(math.Ceil(radius)), app)
	var products []contracts.Product
	err := h.cache.ReadStale(r.Context(), key, &products, cache.TTLNearby, cache.TTLNearbyStale,
		func(ctx context.Context) (any, error) {
			// Cache one canonical size (the max) so a tile key serves every `limit` variant — the
			// first requester's limit never poisons the shared list. The response is sliced to the
			// caller's limit below (order is nearest-first, so the head is correct).
			p, err := h.repo.Nearby(ctx, app, lat, lng, radius, maxStoreProductLimit)
			if err != nil {
				return nil, err
			}
			if p == nil {
				p = []contracts.Product{}
			}
			return p, nil
		})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if len(products) > limit {
		products = products[:limit]
	}
	httpx.JSON(w, http.StatusOK, products)
}

func parseNearbyLatLng(r *http.Request) (float64, float64, bool) {
	lat, err1 := strconv.ParseFloat(strings.TrimSpace(r.URL.Query().Get("lat")), 64)
	lng, err2 := strconv.ParseFloat(strings.TrimSpace(r.URL.Query().Get("lng")), 64)
	if err1 != nil || err2 != nil || math.IsNaN(lat) || math.IsNaN(lng) ||
		math.IsInf(lat, 0) || math.IsInf(lng, 0) ||
		lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return 0, 0, false
	}
	return lat, lng, true
}

// purgeNearbyProductTiles flushes the geo:nearby:products tiles around a store's pin so a product
// edit/status change lands in nearby reads immediately for co-located shoppers. A missing pin is a
// no-op; readers beyond the 3×3 tile block stay bounded by TTLNearby + SWR.
func (h *Handler) purgeNearbyProductTiles(r *http.Request, storeID string) {
	if storeID == "" {
		return
	}
	lat, lng, err := h.repo.StorePin(r.Context(), storeID)
	if err != nil || (lat == 0 && lng == 0) {
		return
	}
	for _, p := range cache.NearbyProductsTilePrefixes(lat, lng) {
		h.cache.DelPrefix(r.Context(), p)
	}
}

// updateProduct edits price/MRP/stock/image (seller-scoped). Body: {price?, mrp?, inStockQty?,
// available?, imageAssetId?, imageKey?}. A confirmed PUBLIC media asset (by id or object key) is
// resolved to its canonical key here and linked into catalog.products.
func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Price        *int64  `json:"price"`
		MRP          *int64  `json:"mrp"`
		InStockQty   *int64  `json:"inStockQty"`
		Available    *bool   `json:"available"`
		ImageAssetID *string `json:"imageAssetId"`
		ImageKey     *string `json:"imageKey"`
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
	sellerID, district, scopeOK := managementScope(r)
	if !scopeOK {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no product scope on this account")
		return
	}
	imageKey, imageAssetID, ok := h.resolveImageLink(w, r, body.ImageAssetID, body.ImageKey, auth.IsAdmin(r.Context()))
	if !ok {
		return // resolveImageLink already wrote the error
	}
	p, found, err := h.repo.UpdateProduct(r.Context(), id, sellerID, district, ProductEdit{
		Price: body.Price, MRP: body.MRP, InStockQty: body.InStockQty, Available: body.Available,
		ImageKey: imageKey, ImageAssetID: imageAssetID,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	h.cache.Del(r.Context(), cache.Product(id), cache.Stock(id), cache.StoreProducts(p.StoreID))
	h.purgeNearbyProductTiles(r, p.StoreID)
	h.log(r, "PRODUCT_EDIT", id, map[string]any{"price": p.Price})
	httpx.JSON(w, http.StatusOK, p)
}

// resolveImageLink turns optional imageAssetId/imageKey body fields into (key, assetID) pointers for
// the repo. Both absent → image unchanged; present but empty → clear; otherwise the asset must exist by
// id (preferred) or key, be an ACTIVE PUBLIC asset, and be created by the caller (or the caller is an
// admin). On failure it writes the HTTP error and returns ok=false.
func (h *Handler) resolveImageLink(w http.ResponseWriter, r *http.Request, assetID, imageKey *string, admin bool) (*string, *string, bool) {
	if assetID == nil && imageKey == nil {
		return nil, nil, true
	}
	rawID, rawKey := "", ""
	if assetID != nil {
		rawID = strings.TrimSpace(*assetID)
	}
	if imageKey != nil {
		rawKey = strings.TrimPrefix(strings.TrimSpace(*imageKey), "r2:")
	}
	if rawID == "" && rawKey == "" {
		empty := ""
		return &empty, &empty, true
	}
	if h.media == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "media_unavailable", "media registry not configured")
		return nil, nil, false
	}
	var (
		asset contracts.MediaAsset
		found bool
		err   error
	)
	if rawID != "" {
		asset, found, err = h.media.ByID(r.Context(), rawID)
	} else {
		asset, found, err = h.media.ByKey(r.Context(), rawKey)
	}
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "media unavailable")
		return nil, nil, false
	}
	actor := auth.UserID(r.Context())
	if actor == "" {
		actor = auth.SellerID(r.Context())
	}
	if !found || asset.Kind != "PUBLIC" || asset.Status != "ACTIVE" || (!admin && asset.CreatedBy != actor) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid or unowned image asset")
		return nil, nil, false
	}
	key, id := asset.Key, asset.ID
	return &key, &id, true
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

// createProduct creates a seller listing under one of the caller's stores. Body:
// {storeId, name, category, description (or desc), price, mrp?, unit?, emoji?, imageUrl?,
// imageKey?, imageAssetId?, isVeg?, isPrescription?, attributes?}. Money is whole rupees. A seller
// may only target a live store they own; admins keep their district/super scope. The listing opens
// as PENDING_REVIEW and both catalog.products + inventory.stock are written in one transaction.
func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StoreID        string         `json:"storeId"`
		Name           string         `json:"name"`
		Category       string         `json:"category"`
		Desc           string         `json:"desc"`
		Description    string         `json:"description"`
		Price          int64          `json:"price"`
		MRP            *int64         `json:"mrp"`
		Unit           string         `json:"unit"`
		Emoji          string         `json:"emoji"`
		ImageURL       string         `json:"imageUrl"`
		ImageKey       *string        `json:"imageKey"`
		ImageAssetID   *string        `json:"imageAssetId"`
		IsVeg          *bool          `json:"isVeg"`
		IsPrescription bool           `json:"isPrescription"`
		Attributes     map[string]any `json:"attributes"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.Price < 0 || body.Price > 10_000_000 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid price")
		return
	}
	if body.MRP != nil && (*body.MRP < 0 || *body.MRP > 10_000_000) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid mrp")
		return
	}
	if body.MRP != nil && *body.MRP < body.Price {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "mrp must be at least the price")
		return
	}
	storeID := strings.TrimSpace(body.StoreID)
	name := strings.TrimSpace(body.Name)
	category := strings.TrimSpace(body.Category)
	desc := strings.TrimSpace(body.Desc)
	if desc == "" {
		desc = strings.TrimSpace(body.Description)
	}
	if storeID == "" || name == "" || category == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "storeId, name and category are required")
		return
	}
	if len(name) > 200 || len(category) > 120 || len(desc) > 4000 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "name, category or description too long")
		return
	}
	sellerID, district, scopeOK := managementScope(r)
	if !scopeOK {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no product scope on this account")
		return
	}
	// A portal upload stores an `r2:<key>` reference in imageUrl; treat it as the media key so the
	// registry ownership check runs. Only https legacy URLs may be stored verbatim.
	imageKey, imageAssetID := body.ImageKey, body.ImageAssetID
	imageURL := strings.TrimSpace(body.ImageURL)
	if imageKey == nil && imageAssetID == nil && strings.HasPrefix(imageURL, "r2:") {
		key := strings.TrimPrefix(imageURL, "r2:")
		imageKey = &key
		imageURL = ""
	}
	if imageURL != "" && !strings.HasPrefix(imageURL, "https://") && !strings.HasPrefix(imageURL, "http://") {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "imageUrl must be an http(s) URL")
		return
	}
	imageKey, imageAssetID, ok := h.resolveImageLink(w, r, imageAssetID, imageKey, auth.IsAdmin(r.Context()))
	if !ok {
		return // resolveImageLink already wrote the error
	}
	if imageKey != nil && *imageKey != "" {
		imageURL = ""
	}
	p, found, err := h.repo.CreateProduct(r.Context(), sellerID, district, ProductCreateInput{
		StoreID: storeID, Name: name, Category: category, Desc: desc,
		Price: body.Price, MRP: body.MRP, Unit: body.Unit, Emoji: body.Emoji,
		ImageURL: imageURL, ImageKey: imageKey, ImageAssetID: imageAssetID,
		IsVeg: body.IsVeg, IsPrescription: body.IsPrescription, Attributes: body.Attributes,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "store not found or not owned")
		return
	}
	h.cache.Del(r.Context(), cache.Product(p.ID), cache.Stock(p.ID), cache.StoreProducts(p.StoreID))
	h.purgeNearbyProductTiles(r, p.StoreID)
	h.log(r, "PRODUCT_CREATE", p.ID, map[string]any{
		"storeId": p.StoreID, "status": p.Status, "price": p.Price,
	})
	httpx.JSON(w, http.StatusCreated, p)
}

func (h *Handler) sellerProducts(w http.ResponseWriter, r *http.Request) {
	sellerID, district, ok := managementScope(r)
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no product scope on this account")
		return
	}
	if auth.Role(r.Context()) != auth.RoleSeller {
		sellerID = strings.TrimSpace(r.URL.Query().Get("sellerId"))
	}
	items, err := h.repo.SellerProducts(r.Context(), sellerID, district, strings.TrimSpace(r.URL.Query().Get("status")))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// sellerInventory lists the caller's product stock rows (GET /seller/inventory). The projection is
// the shared seller-product shape; inStockQty/available/eta are the inventory facts the console edits.
func (h *Handler) sellerInventory(w http.ResponseWriter, r *http.Request) {
	h.sellerProducts(w, r)
}

// setSellerInventory updates one listing's on-hand quantity and ETA (PUT /seller/inventory/{productId}).
// Body: {inStockQty?, etaMinutes?}. Seller-scoped; writes catalog+inventory in one transaction.
func (h *Handler) setSellerInventory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "productId")
	var body struct {
		InStockQty *int64 `json:"inStockQty"`
		EtaMinutes *int64 `json:"etaMinutes"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.InStockQty == nil && body.EtaMinutes == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "nothing to update")
		return
	}
	if body.InStockQty != nil && (*body.InStockQty < 0 || *body.InStockQty > 1_000_000) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid stock quantity")
		return
	}
	var eta *string
	if body.EtaMinutes != nil {
		if *body.EtaMinutes < 0 || *body.EtaMinutes > 600 {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid eta")
			return
		}
		v := strconv.FormatInt(*body.EtaMinutes, 10)
		eta = &v
	}
	h.applyProductEdit(w, r, id, ProductEdit{InStockQty: body.InStockQty, Eta: eta}, "INVENTORY_UPDATE",
		map[string]any{"inStockQty": body.InStockQty, "etaMinutes": body.EtaMinutes})
}

// sellerPricing lists the caller's price/MRP rows (GET /seller/pricing). Same projection as inventory;
// price/mrp are the fields the pricing console edits.
func (h *Handler) sellerPricing(w http.ResponseWriter, r *http.Request) {
	h.sellerProducts(w, r)
}

// setSellerPricing updates one listing's shelf price and MRP (PUT /seller/pricing/{productId}).
// Body: {price?, mrp?} in whole rupees. MRP may not fall below price.
func (h *Handler) setSellerPricing(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "productId")
	var body struct {
		Price *int64 `json:"price"`
		MRP   *int64 `json:"mrp"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.Price == nil && body.MRP == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "nothing to update")
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
	if body.Price != nil && body.MRP != nil && *body.MRP < *body.Price {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "mrp must be at least the price")
		return
	}
	h.applyProductEdit(w, r, id, ProductEdit{Price: body.Price, MRP: body.MRP}, "PRICE_UPDATE",
		map[string]any{"price": body.Price, "mrp": body.MRP})
}

// applyProductEdit runs a scoped catalog/inventory edit, invalidates the product/stock/store caches
// (plus nearby tiles) and writes an audit row. Shared by the inventory and pricing PUT endpoints.
func (h *Handler) applyProductEdit(w http.ResponseWriter, r *http.Request, id string, edit ProductEdit, action string, after any) {
	sellerID, district, scopeOK := managementScope(r)
	if !scopeOK {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no product scope on this account")
		return
	}
	p, found, err := h.repo.UpdateProduct(r.Context(), id, sellerID, district, edit)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	h.cache.Del(r.Context(), cache.Product(id), cache.Stock(id), cache.StoreProducts(p.StoreID))
	h.purgeNearbyProductTiles(r, p.StoreID)
	h.log(r, action, id, after)
	httpx.JSON(w, http.StatusOK, p)
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
	if !allowedProductStatus(status, auth.IsAdmin(r.Context())) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "status not permitted for this role")
		return
	}
	sellerID, district, scopeOK := managementScope(r)
	if !scopeOK {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no product scope on this account")
		return
	}
	p, ok, err := h.repo.SetProductStatus(r.Context(), id, sellerID, district, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "catalog_unavailable", "catalog unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	h.cache.Del(r.Context(), cache.Product(id), cache.StoreProducts(p.StoreID))
	h.purgeNearbyProductTiles(r, p.StoreID)
	h.log(r, "PRODUCT_"+status, id, map[string]string{"status": status})
	httpx.JSON(w, http.StatusOK, p)
}

// managementScope resolves the row filter for product management. A seller is scoped to their own
// seller_id; a district admin to their district (strict — no state fallback); a super admin sees all.
func managementScope(r *http.Request) (sellerID, district string, ok bool) {
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
		return sellerID, "", sellerID != ""
	}
	district, super, ok := auth.AdminScope(r.Context())
	if !ok || super {
		return "", "", ok
	}
	return "", district, true
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
