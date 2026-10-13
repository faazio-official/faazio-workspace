package promo

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the promo context. Sellers read campaigns and manage their own opt-ins; state/super
// admins manage caps, campaigns, approvals and coupons. Every mutation is audited.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
}

// NewHandler builds the promo handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts the promo routes.
func (h *Handler) Register(r chi.Router) {
	// Seller + admin reads/writes.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/promo/campaigns", h.listCampaigns)
		g.Get("/promo/optins", h.listOptins)
		g.Put("/promo/optins", h.upsertOptin)
	})
	// Admin-only management.
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/promo/sector-caps", h.listCaps)
		g.Put("/promo/sector-caps", h.setCap)
		g.Get("/promo/campaigns/{id}", h.getCampaign)
		g.Post("/promo/campaigns", h.createCampaign)
		g.Put("/promo/campaigns/{id}", h.setCampaignStatus)
		g.Put("/promo/optins/{id}/status", h.setOptinStatus)
		g.Get("/promo/coupons", h.listCoupons)
		g.Post("/promo/coupons", h.createCoupon)
		g.Put("/promo/coupons/{id}/toggle", h.toggleCoupon)
	})
}

func (h *Handler) listCaps(w http.ResponseWriter, r *http.Request) {
	caps, err := h.repo.SectorCaps(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "promo_unavailable", "promo unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, caps)
}

type capRequest struct {
	Sector             string `json:"sector"`
	StateCode          string `json:"stateCode"`
	MaxDiscountPercent int    `json:"maxDiscountPercent"`
}

func (h *Handler) setCap(w http.ResponseWriter, r *http.Request) {
	var req capRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Sector = strings.ToUpper(strings.TrimSpace(req.Sector))
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	// A state admin may only set their own state's override (super may set global/any).
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		req.StateCode = auth.StateCode(r.Context())
	}
	if !validSector(req.Sector) || (req.StateCode != "" && len(req.StateCode) != 2) ||
		req.MaxDiscountPercent < 0 || req.MaxDiscountPercent > 90 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid sector cap")
		return
	}
	cap, err := h.repo.SetSectorCap(r.Context(), SectorCap{
		Sector: req.Sector, StateCode: req.StateCode, MaxDiscountPercent: req.MaxDiscountPercent,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "promo_update_failed", "could not update sector cap")
		return
	}
	h.log(r, "SECTOR_CAP_UPDATE", req.Sector+":"+req.StateCode, nil, cap)
	httpx.JSON(w, http.StatusOK, cap)
}

func (h *Handler) listCampaigns(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		stateCode = auth.StateCode(r.Context())
	}
	if auth.Role(r.Context()) == auth.RoleSeller {
		stateCode = ""
	}
	scope := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("scope")))
	campaigns, err := h.repo.Campaigns(r.Context(), stateCode, scope)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "promo_unavailable", "promo unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, campaigns)
}

func (h *Handler) getCampaign(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var cached Campaign
	if h.cache.GetJSON(r.Context(), cache.PromoCampaign(id), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	c, ok, err := h.repo.Campaign(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "promo_unavailable", "promo unavailable")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	h.cache.SetJSON(r.Context(), cache.PromoCampaign(id), c, cache.TTLPromo)
	httpx.JSON(w, http.StatusOK, c)
}

type campaignRequest struct {
	Name      string `json:"name"`
	Scope     string `json:"scope"`
	StateCode string `json:"stateCode"`
	StartsAt  string `json:"startsAt"`
	EndsAt    string `json:"endsAt"`
	BannerURL string `json:"bannerUrl"`
	Status    string `json:"status"`
}

func (h *Handler) createCampaign(w http.ResponseWriter, r *http.Request) {
	var req campaignRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Scope = strings.ToUpper(strings.TrimSpace(req.Scope))
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		req.Status = "DRAFT"
	}
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		req.Scope = "STATE"
		req.StateCode = auth.StateCode(r.Context())
	}
	if strings.TrimSpace(req.Name) == "" || !validScope(req.Scope) || !validCampaignStatus(req.Status) ||
		(req.Scope == "STATE") != (req.StateCode != "") {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid campaign")
		return
	}
	start, err1 := time.Parse(time.RFC3339, req.StartsAt)
	end, err2 := time.Parse(time.RFC3339, req.EndsAt)
	if err1 != nil || err2 != nil || !end.After(start) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "campaign window must be valid RFC3339 with end after start")
		return
	}
	actor := auth.UserID(r.Context())
	if actor == "" {
		actor = auth.StateCode(r.Context())
	}
	c, err := h.repo.CreateCampaign(r.Context(), Campaign{
		Name: req.Name, Scope: req.Scope, StateCode: req.StateCode, StartsAt: req.StartsAt,
		EndsAt: req.EndsAt, BannerURL: req.BannerURL, Status: req.Status, CreatedBy: actor,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "campaign_create_failed", "could not create campaign")
		return
	}
	h.log(r, "CAMPAIGN_CREATE", c.CampaignID, nil, c)
	httpx.JSON(w, http.StatusCreated, c)
}

type statusRequest struct {
	Status string `json:"status"`
}

func (h *Handler) setCampaignStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req statusRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if !validCampaignStatus(req.Status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid campaign status")
		return
	}
	c, ok, err := h.repo.SetCampaignStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "campaign_update_failed", "could not update campaign")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	h.cache.Del(r.Context(), cache.PromoCampaign(id))
	h.log(r, "CAMPAIGN_"+req.Status, id, nil, map[string]string{"status": c.Status})
	httpx.JSON(w, http.StatusOK, c)
}

func (h *Handler) listOptins(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
		if sellerID == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no seller scope on this account")
			return
		}
	}
	optins, err := h.repo.Optins(r.Context(), sellerID, strings.TrimSpace(r.URL.Query().Get("campaignId")))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "promo_unavailable", "promo unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, optins)
}

type optinRequest struct {
	CampaignID      string `json:"campaignId"`
	SellerID        string `json:"sellerId"`
	ProductID       string `json:"productId"`
	DiscountPercent int    `json:"discountPercent"`
}

func (h *Handler) upsertOptin(w http.ResponseWriter, r *http.Request) {
	var req optinRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	sellerID := strings.TrimSpace(req.SellerID)
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	productID := strings.TrimSpace(req.ProductID)
	if sellerID == "" || req.CampaignID == "" || productID == "" || len(productID) > 64 ||
		req.DiscountPercent <= 0 || req.DiscountPercent > 90 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid opt-in")
		return
	}
	o, err := h.repo.UpsertOptin(r.Context(), Optin{
		CampaignID: req.CampaignID, SellerID: sellerID, ProductID: productID, DiscountPercent: req.DiscountPercent,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "optin_update_failed", "could not save opt-in")
		return
	}
	h.log(r, "FESTIVAL_OPTIN", req.CampaignID+":"+productID, nil, o)
	httpx.JSON(w, http.StatusOK, o)
}

func (h *Handler) setOptinStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req statusRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status != "APPROVED" && req.Status != "REJECTED" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid opt-in status")
		return
	}
	o, ok, err := h.repo.SetOptinStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "optin_update_failed", "could not update opt-in")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "opt-in not found")
		return
	}
	h.log(r, "OPTIN_"+req.Status, id, nil, map[string]string{"status": o.Status})
	httpx.JSON(w, http.StatusOK, o)
}

func (h *Handler) listCoupons(w http.ResponseWriter, r *http.Request) {
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		stateCode = auth.StateCode(r.Context())
	}
	coupons, err := h.repo.Coupons(r.Context(), stateCode, strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("scope"))))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "promo_unavailable", "promo unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, coupons)
}

type couponRequest struct {
	Code         string `json:"code"`
	Scope        string `json:"scope"`
	StateCode    string `json:"stateCode"`
	Sector       string `json:"sector"`
	ValuePercent int    `json:"valuePercent"`
	MaxDiscount  int64  `json:"maxDiscount"`
	ValidTill    string `json:"validTill"`
}

func (h *Handler) createCoupon(w http.ResponseWriter, r *http.Request) {
	var req couponRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Scope = strings.ToUpper(strings.TrimSpace(req.Scope))
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.Sector = strings.ToUpper(strings.TrimSpace(req.Sector))
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		req.Scope = "STATE"
		req.StateCode = auth.StateCode(r.Context())
	}
	if strings.TrimSpace(req.Code) == "" || !validScope(req.Scope) ||
		(req.Scope == "STATE") != (req.StateCode != "") ||
		(req.Sector != "" && !validSector(req.Sector)) ||
		req.ValuePercent <= 0 || req.ValuePercent > 90 || req.MaxDiscount < 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid coupon")
		return
	}
	c, err := h.repo.CreateCoupon(r.Context(), Coupon{
		Code: req.Code, Scope: req.Scope, StateCode: req.StateCode, Sector: req.Sector,
		ValuePercent: req.ValuePercent, MaxDiscount: req.MaxDiscount, ValidTill: req.ValidTill, Active: true,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "coupon_create_failed", "could not create coupon")
		return
	}
	h.log(r, "COUPON_CREATE", c.CouponID, nil, c)
	httpx.JSON(w, http.StatusCreated, c)
}

func (h *Handler) toggleCoupon(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	c, ok, err := h.repo.ToggleCoupon(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "coupon_update_failed", "could not update coupon")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "coupon not found")
		return
	}
	h.log(r, "COUPON_TOGGLE", id, nil, map[string]bool{"active": c.Active})
	httpx.JSON(w, http.StatusOK, c)
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
		Entity: entityOf(action), EntityID: entityID,
		Before: marshal(before), After: marshal(after),
	})
}

func entityOf(action string) string {
	switch {
	case strings.HasPrefix(action, "CAMPAIGN"):
		return "promo.festival_campaigns"
	case strings.HasPrefix(action, "OPTIN"), strings.HasPrefix(action, "FESTIVAL"):
		return "promo.festival_optins"
	case strings.HasPrefix(action, "COUPON"):
		return "promo.coupons"
	default:
		return "promo.sector_caps"
	}
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

func validSector(s string) bool { return s == "MART" || s == "FOOD" || s == "PHARMA" }

func validScope(s string) bool { return s == "GLOBAL" || s == "STATE" }

func validCampaignStatus(s string) bool {
	switch s {
	case "DRAFT", "SCHEDULED", "LIVE", "ENDED":
		return true
	default:
		return false
	}
}
