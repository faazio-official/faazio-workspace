package ads

import (
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// hero serves the anon-visible LIVE hero projection for a placement context, read-through cached.
// placement/app/category/storeId are optional filters (empty = any).
func (h *Handler) hero(w http.ResponseWriter, r *http.Request) {
	placement := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("placement")))
	app := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("app")))
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	storeID := strings.TrimSpace(r.URL.Query().Get("storeId"))
	if placement != "" && !validHeroPlacement(placement) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid placement")
		return
	}
	if app != "" && !validApp(app) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid app")
		return
	}
	key := cache.AdsHero(placement, app, category, storeID)
	var cached []HeroAd
	if h.cache.GetJSON(r.Context(), key, &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	ads, err := h.repo.Heroes(r.Context(), placement, app, category, storeID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), key, ads, cache.TTLAdsHero)
	httpx.JSON(w, http.StatusOK, ads)
}

// campaignBody is the seller wizard payload: one creative + target requested on ≥1 placement.
type campaignBody struct {
	SellerID   string   `json:"sellerId"`
	Placements []string `json:"placements"`
	TargetType string   `json:"targetType"`
	TargetID   string   `json:"targetId"`
	TargetApp  string   `json:"targetApp"`
	Category   string   `json:"category"`
	StoreID    string   `json:"storeId"`
	Title      string   `json:"title"`
	Subtitle   string   `json:"subtitle"`
	ImageURL   string   `json:"imageUrl"`
	CTA        string   `json:"cta"`
	StateCode  string   `json:"stateCode"`
	StartsAt   string   `json:"startsAt"`
	EndsAt     string   `json:"endsAt"`
}

// Bounds mirror the SDUI banner (title ≤40, image ≤512) so a creative can never grow unbounded.
const (
	maxHeroPlacements = 6
	maxHeroTitle      = 40
	maxHeroSubtitle   = 60
	maxHeroImageLen   = 512
	maxHeroCTALen     = 24
	maxHeroCategory   = 64
)

func (h *Handler) requestCampaign(w http.ResponseWriter, r *http.Request) {
	var req campaignBody
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	sellerID := strings.TrimSpace(req.SellerID)
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	stateCode := strings.ToUpper(strings.TrimSpace(req.StateCode))
	if auth.Role(r.Context()) == auth.RoleStateAdmin {
		stateCode = auth.StateCode(r.Context())
	}
	targetType := strings.ToUpper(strings.TrimSpace(req.TargetType))
	targetID := strings.TrimSpace(req.TargetID)
	targetApp := strings.ToUpper(strings.TrimSpace(req.TargetApp))
	category := strings.TrimSpace(req.Category)
	storeID := strings.TrimSpace(req.StoreID)
	title := strings.TrimSpace(req.Title)
	subtitle := strings.TrimSpace(req.Subtitle)
	imageURL := strings.TrimSpace(req.ImageURL)
	cta := strings.TrimSpace(req.CTA)

	placements := dedupePlacements(req.Placements)
	if sellerID == "" || targetID == "" || len(targetID) > 64 || title == "" ||
		!validTargetType(targetType) || !validApp(targetApp) || len(placements) == 0 ||
		len(title) > maxHeroTitle || len(subtitle) > maxHeroSubtitle ||
		len(imageURL) > maxHeroImageLen || len(cta) > maxHeroCTALen || len(category) > maxHeroCategory {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid campaign request")
		return
	}
	// Contextual placements need their scope: CATEGORY_TOP a category, STORE_TOP a store/venue.
	for _, p := range placements {
		if !validHeroPlacement(p) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid placement")
			return
		}
		if p == "CATEGORY_TOP" && category == "" {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "category required for CATEGORY_TOP")
			return
		}
		if p == "STORE_TOP" && storeID == "" {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "storeId required for STORE_TOP")
			return
		}
	}
	startsAt, endsAt := heroWindow(req.StartsAt, req.EndsAt)

	created, err := h.repo.CreateCampaigns(r.Context(), Campaign{
		SellerID: sellerID, TargetType: targetType, TargetID: targetID, TargetApp: targetApp,
		Category: category, StoreID: storeID, Title: title, Subtitle: subtitle, ImageURL: imageURL,
		CTA: cta, StateCode: stateCode, StartsAt: startsAt, EndsAt: endsAt,
	}, placements)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ad_request_failed", "could not request campaign")
		return
	}
	h.logEntity(r, "AD_CAMPAIGN_REQUEST", "ads.campaigns", created[0].CampaignID, nil, created)
	httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) listCampaigns(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	stateCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("state")))
	switch auth.Role(r.Context()) {
	case auth.RoleSeller:
		sellerID = auth.SellerID(r.Context())
		stateCode = ""
	case auth.RoleStateAdmin:
		stateCode = auth.StateCode(r.Context())
	}
	items, err := h.repo.Campaigns(r.Context(), sellerID, stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) setCampaignStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	before, ok, err := h.repo.CampaignByID(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
		return
	}
	if !ok || (auth.Role(r.Context()) == auth.RoleStateAdmin && before.StateCode != auth.StateCode(r.Context())) {
		httpx.Fail(w, http.StatusNotFound, "not_found", "campaign not found")
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
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid campaign status")
		return
	}
	after, ok, err := h.repo.SetCampaignStatus(r.Context(), id, req.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ad_update_failed", "could not update campaign")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	// Any hero context may now be stale; purge the whole namespace + the rail key for good measure.
	h.cache.DelPrefix(r.Context(), cache.AdsHeroPrefix())
	h.cache.Del(r.Context(), cache.AdsLive(after.Placement))
	h.logEntity(r, "AD_CAMPAIGN_"+req.Status, "ads.campaigns", id,
		map[string]string{"status": before.Status}, map[string]string{"status": after.Status})
	httpx.JSON(w, http.StatusOK, after)
}

func dedupePlacements(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, p := range in {
		p = strings.ToUpper(strings.TrimSpace(p))
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	if len(out) > maxHeroPlacements {
		return out[:maxHeroPlacements]
	}
	return out
}

// heroWindow parses an optional ISO window; both default to [now, now+30d]. Ends must be > starts.
func heroWindow(startsRaw, endsRaw string) (string, string) {
	start := time.Now().UTC()
	if t, err := time.Parse(time.RFC3339, strings.TrimSpace(startsRaw)); err == nil {
		start = t.UTC()
	}
	end := start.Add(30 * 24 * time.Hour)
	if t, err := time.Parse(time.RFC3339, strings.TrimSpace(endsRaw)); err == nil {
		end = t.UTC()
	}
	if !end.After(start) {
		end = start.Add(30 * 24 * time.Hour)
	}
	return start.Format(time.RFC3339), end.Format(time.RFC3339)
}

func validHeroPlacement(p string) bool {
	switch p {
	case "HOME_HERO", "MART_HERO", "PHARMA_HERO", "FOOD_HERO", "CATEGORY_TOP", "STORE_TOP":
		return true
	default:
		return false
	}
}

func validTargetType(t string) bool {
	switch t {
	case "PRODUCT", "DISH", "STORE", "VENUE":
		return true
	default:
		return false
	}
}

func validApp(a string) bool {
	switch a {
	case "MART", "FOOD", "PHARMA":
		return true
	default:
		return false
	}
}
