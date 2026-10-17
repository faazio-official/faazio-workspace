package ads

import (
	"errors"
	"net/http"
	neturl "net/url"
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
	maxHeroPlacements         = 6
	maxHeroTitle              = 40
	maxHeroSubtitle           = 60
	maxHeroImageLen           = 512
	maxHeroCTALen             = 24
	maxHeroCategory           = 64
	maxHeroWindowDays         = 90
	maxLivePerSellerPlacement = 3
	maxHeroPublishesPerDay    = 10
)

// publishCampaign is the self-serve replacement for the old admin-gated request: it machine-checks
// what an admin used to (ownership, placement fit, creative bounds, per-seller cap), then inserts one
// LIVE row per placement and purges the hero cache. A rejected check writes nothing. The client's
// `targetApp` is ignored — the app is derived from the owning row.
func (h *Handler) publishCampaign(w http.ResponseWriter, r *http.Request) {
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
	targetType := strings.ToUpper(strings.TrimSpace(req.TargetType))
	targetID := strings.TrimSpace(req.TargetID)
	category := strings.TrimSpace(req.Category)
	storeID := strings.TrimSpace(req.StoreID)
	title := strings.TrimSpace(req.Title)
	subtitle := strings.TrimSpace(req.Subtitle)
	imageURL := strings.TrimSpace(req.ImageURL)
	cta := strings.TrimSpace(req.CTA)

	placements := dedupePlacements(req.Placements)
	if sellerID == "" || targetID == "" || len(targetID) > 64 || title == "" ||
		!validTargetType(targetType) || len(placements) == 0 ||
		len(title) > maxHeroTitle || len(subtitle) > maxHeroSubtitle ||
		len(imageURL) > maxHeroImageLen || len(cta) > maxHeroCTALen || len(category) > maxHeroCategory {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid campaign request")
		return
	}
	for _, p := range placements {
		if !validHeroPlacement(p) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid placement")
			return
		}
	}

	// -------- ownership: resolve the target against the authoritative table, never the client claim.
	resolved, found, err := h.repo.ResolveOwnedTarget(r.Context(), sellerID, targetType, targetID, storeID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusBadRequest, "target_not_found", "that item does not exist")
		return
	}
	if resolved.SellerID == "" || resolved.SellerID != sellerID {
		httpx.Fail(w, http.StatusForbidden, "not_owner", "you can only promote your own items")
		return
	}
	targetApp := resolved.App
	if storeID == "" {
		storeID = resolved.StoreID
	}

	// -------- placement fit: a placement may only host the sub-app whose surface renders it.
	for _, p := range placements {
		if !placementFitsApp(p, targetApp) {
			httpx.Fail(w, http.StatusBadRequest, "placement_app_mismatch", "that placement does not fit this item's app")
			return
		}
		if p == "CATEGORY_TOP" && category == "" {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "category required for CATEGORY_TOP")
			return
		}
		if p == "STORE_TOP" {
			if storeID == "" {
				httpx.Fail(w, http.StatusBadRequest, "bad_request", "storeId required for STORE_TOP")
				return
			}
			// The header must be a store OR a dining venue the seller owns (a dish's vendor id may
			// resolve to either half of directory.vendors), so try both tables.
			st, ok, err := h.repo.ResolveOwnedTarget(r.Context(), sellerID, "STORE", storeID, "")
			if err != nil {
				httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
				return
			}
			if !ok {
				if st, ok, err = h.repo.ResolveOwnedTarget(r.Context(), sellerID, "VENUE", storeID, ""); err != nil {
					httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
					return
				}
			}
			if !ok || st.SellerID != sellerID {
				httpx.Fail(w, http.StatusForbidden, "store_not_owned", "you can only use your own store header")
				return
			}
		}
	}

	// -------- creative: poster must be non-empty and hosted on our own R2 CDN (no random links).
	if imageURL == "" || !h.validImageHost(imageURL) {
		httpx.Fail(w, http.StatusBadRequest, "image_host_not_allowed", "upload the poster to Faazio — external image links are not allowed")
		return
	}

	// -------- schedule: strict parse, ends > starts, window ≤ 90 days.
	startsAt, endsAt, err := heroWindowStrict(req.StartsAt, req.EndsAt)
	if err != nil {
		httpx.Fail(w, http.StatusBadRequest, "invalid_window", "schedule must end after it starts and run at most 90 days")
		return
	}

	// -------- cap: one seller cannot fill a placement (max 3 LIVE rows per placement).
	for _, p := range placements {
		n, err := h.repo.CountLiveBySellerPlacement(r.Context(), sellerID, p)
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "ads unavailable")
			return
		}
		if n >= maxLivePerSellerPlacement {
			httpx.Fail(w, http.StatusTooManyRequests, "placement_cap_reached", "you already have the maximum live ads on this placement")
			return
		}
	}

	// -------- rate limit: per-seller publishes per UTC day (best-effort; fail-open without Valkey).
	day := time.Now().UTC().Format("20060102")
	if n, err := h.cache.Incr(r.Context(), cache.AdsPublishRate(sellerID, day), cache.TTLAdsPublishRate); err == nil && n > maxHeroPublishesPerDay {
		httpx.Fail(w, http.StatusTooManyRequests, "rate_limited", "daily publish limit reached — try again tomorrow")
		return
	}

	created, err := h.repo.CreateCampaigns(r.Context(), Campaign{
		SellerID: sellerID, TargetType: targetType, TargetID: targetID, TargetApp: targetApp,
		Category: category, StoreID: storeID, Title: title, Subtitle: subtitle, ImageURL: imageURL,
		CTA: cta, StateCode: stateCode, StartsAt: startsAt, EndsAt: endsAt,
	}, placements)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ad_publish_failed", "could not publish campaign")
		return
	}
	h.cache.DelPrefix(r.Context(), cache.AdsHeroPrefix())
	h.logEntity(r, "AD_CAMPAIGN_PUBLISH", "ads.campaigns", created[0].CampaignID, nil, created)
	httpx.JSON(w, http.StatusCreated, created)
}

// placementFitsApp reports whether a placement's surface can render a target of the given app.
// MART/PHARMA/FOOD heroes are sub-app-specific; CATEGORY_TOP/STORE_TOP/HOME_HERO accept any app.
func placementFitsApp(placement, app string) bool {
	switch placement {
	case "MART_HERO":
		return app == "MART"
	case "PHARMA_HERO":
		return app == "PHARMA"
	case "FOOD_HERO":
		return app == "FOOD"
	default:
		return true
	}
}

// validImageHost enforces the poster host allow-list: https on our R2 CDN base. When no CDN base is
// configured (media disabled / local dev) any https URL is accepted — production always sets one.
func (h *Handler) validImageHost(raw string) bool {
	u, err := neturl.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" {
		return false
	}
	base := strings.ToLower(strings.TrimSpace(h.cdnBase))
	base = strings.TrimPrefix(strings.TrimPrefix(base, "https://"), "http://")
	if base == "" {
		return true
	}
	host := strings.ToLower(u.Hostname())
	return host == base || strings.HasSuffix(host, "."+base)
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

// setCampaignStatus is the admin-only abuse brake: takedown (LIVE/anything → REJECTED) and restore
// (REJECTED → LIVE). Request/approval transitions are gone — sellers publish straight to LIVE.
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
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if !validHeroModerationStatus(req.Status) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid campaign status")
		return
	}
	var (
		after Campaign
		found bool
	)
	if req.Status == "REJECTED" {
		after, found, err = h.repo.Takedown(r.Context(), id, req.Reason)
	} else {
		after, found, err = h.repo.SetCampaignStatus(r.Context(), id, req.Status)
	}
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ad_update_failed", "could not update campaign")
		return
	}
	if !found {
		httpx.Fail(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	// Any hero context may now be stale; purge the whole namespace + the rail key for good measure.
	h.cache.DelPrefix(r.Context(), cache.AdsHeroPrefix())
	h.cache.Del(r.Context(), cache.AdsLive(after.Placement))
	h.logEntity(r, "AD_CAMPAIGN_"+req.Status, "ads.campaigns", id,
		map[string]string{"status": before.Status}, map[string]any{"status": after.Status, "reason": req.Reason})
	httpx.JSON(w, http.StatusOK, after)
}

// reportCampaign records a user "Report ad" tap: best-effort, de-duped per (user, placement), and
// audit-logged with a counter only (no reporter identity, no PII). It never removes the ad itself —
// a human takedown is the only removal path.
func (h *Handler) reportCampaign(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" || len(id) > 64 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid campaign id")
		return
	}
	if userID := auth.UserID(r.Context()); userID != "" {
		if err := h.cache.AcquireLock(r.Context(), cache.AdsReport(userID, id), cache.TTLAdReport); err != nil {
			if errors.Is(err, cache.ErrLockHeld) {
				httpx.JSON(w, http.StatusAccepted, map[string]any{"ok": true, "deduped": true})
				return
			}
		}
	}
	reports, ok, err := h.repo.ReportCampaign(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "ads_unavailable", "could not record report")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	h.logEntity(r, "AD_CAMPAIGN_REPORT", "ads.campaigns", id, nil, map[string]any{"reports": reports})
	httpx.JSON(w, http.StatusAccepted, map[string]any{"ok": true, "reports": reports})
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

// heroWindowStrict parses an optional ISO window; both default to [now, now+30d]. Unlike the lenient
// old helper it rejects a malformed/inverted window and any window longer than 90 days, so a publish
// either gets a sane schedule or a 400 (nothing written).
func heroWindowStrict(startsRaw, endsRaw string) (string, string, error) {
	start := time.Now().UTC()
	if s := strings.TrimSpace(startsRaw); s != "" {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			return "", "", err
		}
		start = t.UTC()
	}
	end := start.Add(30 * 24 * time.Hour)
	if e := strings.TrimSpace(endsRaw); e != "" {
		t, err := time.Parse(time.RFC3339, e)
		if err != nil {
			return "", "", err
		}
		end = t.UTC()
	}
	if !end.After(start) {
		return "", "", errors.New("ends must be after starts")
	}
	if end.Sub(start) > maxHeroWindowDays*24*time.Hour {
		return "", "", errors.New("window exceeds 90 days")
	}
	return start.Format(time.RFC3339), end.Format(time.RFC3339), nil
}

func validHeroPlacement(p string) bool {
	switch p {
	case "HOME_HERO", "MART_HERO", "PHARMA_HERO", "FOOD_HERO", "CATEGORY_TOP", "STORE_TOP":
		return true
	default:
		return false
	}
}

// validHeroModerationStatus is the admin-only transition set for hero campaigns: takedown (REJECTED)
// and restore (LIVE). REQUESTED/APPROVED are deprecated and never accepted.
func validHeroModerationStatus(s string) bool {
	return s == "REJECTED" || s == "LIVE"
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
