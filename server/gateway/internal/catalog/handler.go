package catalog

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
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
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/products", h.sellerProducts)
		g.Put("/seller/products/{id}/status", h.setProductStatus)
	})
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
	h.cache.Del(r.Context(), cache.Product(id))
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
