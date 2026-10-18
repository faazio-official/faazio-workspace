package directory

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
	defaultStoreLimit = 100
	maxStoreLimit     = 200
)

// Handler serves store directory endpoints.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
	media contracts.MediaReader
}

// NewHandler builds the directory handler. media (optional) resolves a linked image asset id to its
// registry row so store/menu edits can store the object key without importing the media context.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, media contracts.MediaReader) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit, media: media}
}

// Register mounts directory endpoints onto the shared router.
func (h *Handler) Register(r chi.Router) {
	r.Get("/stores", h.list)
	r.Get("/store/{id}", h.get)
	r.Get("/venues", h.venues)
	r.Get("/venues/{id}", h.venue)
	r.Get("/pickup-points", h.pickupPoints)
	r.Get("/venues/{id}/menu", h.menu)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/stores", h.sellerStores)
		g.Put("/seller/stores/{id}/live", h.setStoreLive)
		g.Put("/seller/stores/{id}/cover", h.setStoreCover)
		g.Get("/seller/menus", h.sellerMenus)
		g.Post("/seller/menus", h.upsertMenu)
		g.Put("/seller/menus/{venueId}/{dishId}", h.upsertMenu)
		g.Put("/seller/menus/{venueId}/{dishId}/status", h.setMenuStatus)
		g.Delete("/seller/menus/{venueId}/{dishId}", h.deleteMenu)
	})
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

	// ByAppPage reads the PII-free list projection, so no redaction is needed here.
	stores, err := h.repo.ByAppPage(r.Context(), app, limit+1, cursorRating, cursorID, hasCursor)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
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

// pickupPoints serves durable self-pickup locations. When `storeIds` (comma-separated) is supplied,
// only those stores plus the neutral hub are returned; all active otherwise. Public business info.
func (h *Handler) pickupPoints(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("storeIds"))
	var storeIDs []string
	if raw != "" {
		for _, id := range strings.Split(raw, ",") {
			if id = strings.TrimSpace(id); id != "" {
				storeIDs = append(storeIDs, id)
			}
		}
	}
	cacheKey := "all"
	if len(storeIDs) > 0 {
		cacheKey = strings.Join(storeIDs, ",")
	}
	var cached []contracts.PickupPoint
	if h.cache.GetJSON(r.Context(), cache.PickupPoints(cacheKey), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	points, err := h.repo.PickupPoints(r.Context(), storeIDs)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if points == nil {
		points = []contracts.PickupPoint{}
	}
	h.cache.SetJSON(r.Context(), cache.PickupPoints(cacheKey), points, cache.TTLStore)
	httpx.JSON(w, http.StatusOK, points)
}

// menu serves a venue's dishes (public catalog data, cached 24 h).
func (h *Handler) menu(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached []contracts.MenuDish
	if h.cache.GetJSON(r.Context(), cache.Menu(id), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	dishes, err := h.repo.Menu(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if dishes == nil {
		dishes = []contracts.MenuDish{}
	}
	h.cache.SetJSON(r.Context(), cache.Menu(id), dishes, cache.TTLStore)
	httpx.JSON(w, http.StatusOK, dishes)
}

// venues serves the dining-venue list (public catalog data, cached 24 h). The repo reads only the
// PII-free projection, so the cached payload is safe for anonymous callers.
func (h *Handler) venues(w http.ResponseWriter, r *http.Request) {
	app := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("app")))
	key := app
	if key == "" {
		key = "all"
	}
	var cached []contracts.Venue
	if h.cache.GetJSON(r.Context(), cache.Venues(key), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	venues, err := h.repo.Venues(r.Context(), app)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if venues == nil {
		venues = []contracts.Venue{}
	}
	h.cache.SetJSON(r.Context(), cache.Venues(key), venues, cache.TTLStore)
	httpx.JSON(w, http.StatusOK, venues)
}

// venue serves one dining venue. Anonymous callers get the PII-redacted projection (cached 24 h);
// authenticated reads bypass the cache so address/phone are never persisted in Valkey.
func (h *Handler) venue(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	authed := auth.UserID(r.Context()) != ""
	if !authed {
		var cached contracts.Venue
		if h.cache.GetJSON(r.Context(), cache.Venue(id), &cached) {
			httpx.JSON(w, http.StatusOK, cached)
			return
		}
	}
	v, ok, err := h.repo.VenueByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "venue not found")
		return
	}
	if !authed {
		v.Address = ""
		v.Phone = ""
		h.cache.SetJSON(r.Context(), cache.Venue(id), v, cache.TTLStore)
	}
	httpx.JSON(w, http.StatusOK, v)
}

func (h *Handler) sellerStores(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	items, err := h.repo.SellerStores(r.Context(), sellerID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) setStoreLive(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Live *bool `json:"live"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Live == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "`live` boolean is required")
		return
	}
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	store, ok, err := h.repo.SetStoreLive(r.Context(), id, auth.SellerID(r.Context()), *body.Live, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "store not found")
		return
	}
	// The store projection is cached per id (24 h) for anonymous callers.
	h.cache.Del(r.Context(), cache.Store(id))
	h.log(r, "directory.stores", "STORE_LIVE_"+boolToken(*body.Live), id)
	httpx.JSON(w, http.StatusOK, store)
}

// setStoreCover links a confirmed PUBLIC media asset (by id or object key) as the store cover, or
// clears it when neither is supplied, scoped to the owning seller unless admin.
func (h *Handler) setStoreCover(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		ImageAssetID *string `json:"imageAssetId"`
		ImageKey     *string `json:"imageKey"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	admin := roleAdmin(r)
	assetID, imageKey := "", ""
	if body.ImageAssetID != nil {
		assetID = strings.TrimSpace(*body.ImageAssetID)
	}
	if body.ImageKey != nil {
		imageKey = strings.TrimSpace(*body.ImageKey)
	}
	key, linkedID, ok := h.resolveImageLink(w, r, assetID, imageKey, admin)
	if !ok {
		return
	}
	store, found, err := h.repo.SetStoreCover(r.Context(), id, auth.SellerID(r.Context()), key, linkedID, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "store not found")
		return
	}
	h.cache.Del(r.Context(), cache.Store(id))
	h.log(r, "directory.stores", "STORE_COVER", id)
	httpx.JSON(w, http.StatusOK, store)
}

// resolveImageLink turns an (assetId, imageKey) pair into (key, assetID). Both empty → no change
// ("" key/id). Otherwise the asset must exist by id (preferred) or key, be an ACTIVE PUBLIC asset and
// be created by the caller (or the caller is an admin). On failure it writes the HTTP error and
// returns ok=false.
func (h *Handler) resolveImageLink(w http.ResponseWriter, r *http.Request, assetID, imageKey string, admin bool) (string, string, bool) {
	assetID = strings.TrimSpace(assetID)
	imageKey = strings.TrimPrefix(strings.TrimSpace(imageKey), "r2:")
	if assetID == "" && imageKey == "" {
		return "", "", true
	}
	if h.media == nil {
		httpx.Fail(w, http.StatusServiceUnavailable, "media_unavailable", "media registry not configured")
		return "", "", false
	}
	var (
		asset contracts.MediaAsset
		found bool
		err   error
	)
	if assetID != "" {
		asset, found, err = h.media.ByID(r.Context(), assetID)
	} else {
		asset, found, err = h.media.ByKey(r.Context(), imageKey)
	}
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "media_unavailable", "media unavailable")
		return "", "", false
	}
	actor := auth.UserID(r.Context())
	if actor == "" {
		actor = auth.SellerID(r.Context())
	}
	if !found || asset.Kind != "PUBLIC" || asset.Status != "ACTIVE" || (!admin && asset.CreatedBy != actor) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid or unowned image asset")
		return "", "", false
	}
	return asset.Key, asset.ID, true
}

func boolToken(b bool) string {
	if b {
		return "ON"
	}
	return "OFF"
}

func (h *Handler) sellerMenus(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
		if sellerID == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
			return
		}
	}
	items, err := h.repo.SellerMenus(r.Context(), sellerID, strings.TrimSpace(r.URL.Query().Get("venueId")))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

type menuRequest struct {
	VenueID      string   `json:"venueId"`
	DishID       string   `json:"dishId"`
	Name         string   `json:"name"`
	Price        int64    `json:"price"`
	MRP          *int64   `json:"mrp"`
	IsVeg        *bool    `json:"isVeg"`
	Cuisine      string   `json:"cuisine"`
	Rating       *float64 `json:"rating"`
	Image        string   `json:"image"`
	ImageAssetID string   `json:"imageAssetId"`
	ImageKey     string   `json:"imageKey"`
}

func (h *Handler) upsertMenu(w http.ResponseWriter, r *http.Request) {
	var req menuRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if v := chi.URLParam(r, "venueId"); v != "" {
		req.VenueID = v
	}
	if d := chi.URLParam(r, "dishId"); d != "" {
		req.DishID = d
	}
	req.VenueID = strings.TrimSpace(req.VenueID)
	req.DishID = strings.TrimSpace(req.DishID)
	req.Name = strings.TrimSpace(req.Name)
	if req.VenueID == "" || req.DishID == "" || req.Name == "" || req.Price < 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "venueId, dishId, name and a non-negative price are required")
		return
	}
	// MRP is the list price (strike). It may equal, but never fall below, the selling price — the
	// discount predicate is `mrp > price` and the DB check `menus_mrp_gte_price` (migration 0022)
	// guards the same invariant. A negative list price is nonsense.
	if req.MRP != nil && (*req.MRP < req.Price || *req.MRP < 0) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "mrp must be present, non-negative and not below the selling price")
		return
	}
	admin := roleAdmin(r)
	sellerID := auth.SellerID(r.Context())
	if !admin && sellerID == "" {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
		return
	}
	imageKey, imageAssetID := "", ""
	if strings.TrimSpace(req.ImageAssetID) != "" || strings.TrimSpace(req.ImageKey) != "" {
		var ok bool
		imageKey, imageAssetID, ok = h.resolveImageLink(w, r, req.ImageAssetID, req.ImageKey, admin)
		if !ok {
			return
		}
	}
	m, ok, err := h.repo.UpsertMenu(r.Context(), SellerMenu{
		VenueID: req.VenueID, DishID: req.DishID, Name: req.Name, Price: req.Price, MRP: req.MRP,
		IsVeg: req.IsVeg, Cuisine: req.Cuisine, Rating: req.Rating, Image: req.Image,
		ImageKey: imageKey, ImageAssetID: imageAssetID,
	}, sellerID, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusForbidden, "forbidden", "dish belongs to another seller")
		return
	}
	h.cache.Del(r.Context(), cache.Menu(req.VenueID))
	h.log(r, "directory.menus", "MENU_UPSERT", req.VenueID+":"+req.DishID)
	httpx.JSON(w, http.StatusOK, m)
}

func (h *Handler) setMenuStatus(w http.ResponseWriter, r *http.Request) {
	status := ""
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	status = strings.ToUpper(strings.TrimSpace(body.Status))
	admin := roleAdmin(r)
	if !allowedMenuStatus(status, admin) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "status not permitted for this role")
		return
	}
	venueID := chi.URLParam(r, "venueId")
	m, ok, err := h.repo.SetMenuStatus(r.Context(), venueID, chi.URLParam(r, "dishId"), auth.SellerID(r.Context()), status, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "dish not found")
		return
	}
	h.cache.Del(r.Context(), cache.Menu(venueID))
	h.log(r, "directory.menus", "MENU_"+status, venueID+":"+m.DishID)
	httpx.JSON(w, http.StatusOK, m)
}

func (h *Handler) deleteMenu(w http.ResponseWriter, r *http.Request) {
	venueID := chi.URLParam(r, "venueId")
	ok, err := h.repo.DeleteMenu(r.Context(), venueID, chi.URLParam(r, "dishId"), auth.SellerID(r.Context()), roleAdmin(r))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "directory_unavailable", "directory unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "dish not found")
		return
	}
	h.cache.Del(r.Context(), cache.Menu(venueID))
	h.log(r, "directory.menus", "MENU_DELETE", venueID)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func roleAdmin(r *http.Request) bool {
	role := auth.Role(r.Context())
	return role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
}

// allowedMenuStatus mirrors catalog's product-status gate: sellers self-serve DRAFT/PENDING/DELISTED,
// admins moderate ACTIVE/REJECTED/DELISTED.
func allowedMenuStatus(status string, admin bool) bool {
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

func (h *Handler) log(r *http.Request, entity, action, entityID string) {
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
	raw, _ := json.Marshal(map[string]string{"action": action})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: entity, EntityID: entityID, After: raw,
	})
}
