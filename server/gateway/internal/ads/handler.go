package ads

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

// Handler serves the ads context. Sellers request/read their own slots in their state; state/super
// admins moderate. Every mutation is audited.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
}

// NewHandler builds the ads handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts the ads routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/ads/slots", h.list)
		g.Get("/ads/slots/{id}", h.get)
		g.Post("/ads/slots", h.request)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Put("/ads/slots/{id}", h.setStatus)
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	switch auth.Role(r.Context()) {
	case auth.RoleSeller:
		sellerID = auth.SellerID(r.Context())
		stateCode = ""
	case auth.RoleStateAdmin:
		stateCode = auth.StateCode(r.Context())
	}
	items, err := h.repo.List(r.Context(), sellerID, stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached Slot
	if h.cache.GetJSON(r.Context(), cache.AdSlot(id), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	s, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
		return
	}
	if !ok || !auth.CanActForSeller(r.Context(), s.SellerID, s.StateCode) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "ad slot not found")
		return
	}
	h.cache.SetJSON(r.Context(), cache.AdSlot(id), s, cache.TTLAds)
	httpx.JSON(w, http.StatusOK, s)
}

type requestBody struct {
	SellerID  string `json:"sellerId"`
	ProductID string `json:"productId"`
	Placement string `json:"placement"`
	StateCode string `json:"stateCode"`
}

func (h *Handler) request(w http.ResponseWriter, r *http.Request) {
	var req requestBody
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	sellerID := strings.TrimSpace(req.SellerID)
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	productID := strings.TrimSpace(req.ProductID)
	placement := strings.ToUpper(strings.TrimSpace(req.Placement))
	stateCode := strings.ToUpper(strings.TrimSpace(req.StateCode))
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		stateCode = auth.StateCode(r.Context())
	}
	if sellerID == "" || productID == "" || len(productID) > 64 || !validPlacement(placement) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid ad slot request")
		return
	}
	s, err := h.repo.Request(r.Context(), Slot{
		SellerID: sellerID, ProductID: productID, Placement: placement, StateCode: stateCode,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ad_request_failed", "could not request ad slot")
		return
	}
	h.log(r, "AD_REQUEST", s.SlotID, nil, s)
	httpx.JSON(w, http.StatusCreated, s)
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	before, ok, err := h.repo.ByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
		return
	}
	if !ok || (auth.Role(r.Context()) == auth.RoleStateAdmin && before.StateCode != auth.StateCode(r.Context())) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "ad slot not found")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if !validStatus(req.Status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid ad status")
		return
	}
	after, ok, err := h.repo.SetStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ad_update_failed", "could not update ad slot")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "ad slot not found")
		return
	}
	h.cache.Del(r.Context(), cache.AdSlot(id))
	h.log(r, "AD_"+req.Status, id, map[string]string{"status": before.Status}, map[string]string{"status": after.Status})
	httpx.JSON(w, http.StatusOK, after)
}

func (h *Handler) log(r *http.Request, action, entityID string, before, after any) {
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
		role = auth.RoleSuperAdmin
	}
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: "ads.sponsored_slots", EntityID: entityID,
		Before: marshal(before), After: marshal(after),
	})
}

func marshal(v any) json.RawMessage {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return b
}

func validPlacement(p string) bool {
	switch p {
	case "HOME_TOP", "SPONSORED_SHOWCASE", "SECTOR_RAIL":
		return true
	default:
		return false
	}
}

func validStatus(s string) bool {
	switch s {
	case "REQUESTED", "APPROVED", "REJECTED", "LIVE":
		return true
	default:
		return false
	}
}
