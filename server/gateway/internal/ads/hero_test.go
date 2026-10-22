package ads

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestHeroValidation(t *testing.T) {
	for _, p := range []string{"MART_HERO", "CATEGORY_TOP", "STORE_TOP", "HOME_HERO"} {
		if !validHeroPlacement(p) {
			t.Fatalf("expected %s to be a valid hero placement", p)
		}
	}
	if validHeroPlacement("HOME_TOP") {
		t.Fatal("rail placement must not be accepted as a hero placement")
	}
	if !validTargetType("PRODUCT") || !validTargetType("DISH") || validTargetType("BANNER") {
		t.Fatal("unexpected target-type validation")
	}
	// Placement ↔ sub-app fit: the sub-app heroes only accept their own app.
	if placementFitsApp("MART_HERO", "FOOD") || placementFitsApp("FOOD_HERO", "MART") {
		t.Fatal("sub-app hero must reject a mismatched app")
	}
	if !placementFitsApp("CATEGORY_TOP", "MART") || !placementFitsApp("HOME_HERO", "PHARMA") {
		t.Fatal("contextual/home placements must accept any app")
	}
	// Admin moderation is takedown/restore only.
	if !validHeroModerationStatus("REJECTED") || !validHeroModerationStatus("LIVE") || validHeroModerationStatus("REQUESTED") {
		t.Fatal("unexpected moderation-status validation")
	}
	start, end, err := heroWindowStrict("", "")
	if err != nil {
		t.Fatalf("default window: %v", err)
	}
	st, _ := time.Parse(time.RFC3339, start)
	en, _ := time.Parse(time.RFC3339, end)
	if !en.After(st) {
		t.Fatalf("default window must end after start: %s..%s", start, end)
	}
	if _, _, err := heroWindowStrict("2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z"); err == nil {
		t.Fatal("inverted window must be rejected")
	}
	if _, _, err := heroWindowStrict("2026-01-01T00:00:00Z", "2026-06-01T00:00:00Z"); err == nil {
		t.Fatal("window longer than 90 days must be rejected")
	}
}

func TestCampaignHeroLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-hero-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Hero Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	start := time.Now().UTC()
	created, err := repo.CreateCampaigns(ctx, Campaign{
		SellerID: sellerID, TargetType: "PRODUCT", TargetID: "fm-m1", TargetApp: "MART",
		Title: "Big Mart Savings", Subtitle: "UP TO 50% OFF", ImageURL: "https://img.test/hero.jpg",
		CTA: "Shop Now", StateCode: "KA",
		StartsAt: start.Format(time.RFC3339), EndsAt: start.Add(30 * 24 * time.Hour).Format(time.RFC3339),
	}, []string{"MART_HERO"})
	if err != nil {
		t.Fatalf("CreateCampaigns: %v", err)
	}
	// Self-serve: a create is LIVE immediately (no REQUESTED step).
	if len(created) != 1 || created[0].Status != "LIVE" || created[0].CampaignID == "" {
		t.Fatalf("unexpected created campaign: %+v", created)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from ads.campaigns where campaign_id=$1`, created[0].CampaignID)
	})

	// The seeded DB may already hold LIVE heroes for this placement, so assert on this campaign.
	served := func(heroes []HeroAd) *HeroAd {
		for i := range heroes {
			if heroes[i].CampaignID == created[0].CampaignID {
				return &heroes[i]
			}
		}
		return nil
	}
	heroes, err := repo.Heroes(ctx, "MART_HERO", "MART", "", "")
	if err != nil {
		t.Fatalf("Heroes: %v", err)
	}
	mine := served(heroes)
	if mine == nil {
		t.Fatalf("created campaign not served: %+v", heroes)
	}
	if mine.ImageURL != "https://img.test/hero.jpg" {
		t.Fatalf("image url not preserved: %q", mine.ImageURL)
	}
	// Wrong app must not match.
	if heroes, _ := repo.Heroes(ctx, "MART_HERO", "FOOD", "", ""); served(heroes) != nil {
		t.Fatalf("app filter leaked: %+v", heroes)
	}

	if n, err := repo.CountLiveBySellerPlacement(ctx, sellerID, "MART_HERO"); err != nil || n != 1 {
		t.Fatalf("CountLiveBySellerPlacement: err=%v n=%d", err, n)
	}

	// Takedown hides it (abuse brake, row kept) and records the reason; restore brings it back.
	taken, ok, err := repo.Takedown(ctx, created[0].PlacementID, "misleading creative")
	if err != nil || !ok || taken.Status != "REJECTED" || taken.TakedownReason != "misleading creative" {
		t.Fatalf("Takedown: ok=%v err=%v %+v", ok, err, taken)
	}
	if heroes, _ := repo.Heroes(ctx, "MART_HERO", "MART", "", ""); served(heroes) != nil {
		t.Fatalf("taken-down hero still served: %+v", heroes)
	}
	restored, ok, err := repo.SetCampaignStatus(ctx, created[0].PlacementID, "LIVE")
	if err != nil || !ok || restored.Status != "LIVE" || restored.TakedownReason != "" {
		t.Fatalf("restore: ok=%v err=%v %+v", ok, err, restored)
	}

	// Report counter increments per tap.
	if reports, ok, err := repo.ReportCampaign(ctx, created[0].PlacementID); err != nil || !ok || reports != 1 {
		t.Fatalf("ReportCampaign: ok=%v err=%v reports=%d", ok, err, reports)
	}

	list, err := repo.Campaigns(ctx, sellerID, "")
	if err != nil || len(list) != 1 {
		t.Fatalf("Campaigns: err=%v n=%d", err, len(list))
	}
	if _, ok, _ := repo.SetCampaignStatus(ctx, "ad-cmp-missing", "LIVE"); ok {
		t.Fatal("SetCampaignStatus on missing campaign must report ok=false")
	}
}

// TestPublishCampaignHTTP exercises the full self-serve publish path over HTTP: ownership enforcement,
// placement fit, image allow-list, cap, admin takedown and user report.
func TestPublishCampaignHTTP(t *testing.T) {
	pool := testenv.Pool(t)
	ctx := context.Background()
	router := newAdsRouter(t, New(pool), "https://img.faazio.in")

	owner := seedHeroSeller(t, ctx, pool, "OWNER")
	other := seedHeroSeller(t, ctx, pool, "OTHER")
	rival := seedHeroSeller(t, ctx, pool, "RIVAL")

	productID := "hero-prod-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into catalog.products (id, app, category, name, price_paisa, seller_id, status)
		values ($1,'MART','cat_dairy','Hero Atta',4500,$2,'ACTIVE')`, productID, owner.sellerID); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from catalog.products where id=$1`, productID) })

	dishID := "hero-dish-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into directory.menus (venue_id, dish_id, name, price_paisa, seller_id)
		values ($1,$2,'Hero Biryani',25000,$3)`, owner.storeID, dishID, owner.sellerID); err != nil {
		t.Fatalf("seed dish: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.menus where dish_id=$1`, dishID) })

	post := func(role, sellerID, body string) *httptest.ResponseRecorder {
		t.Helper()
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/ads/campaigns", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if role != "" {
			req.Header.Set("X-Dev-Role", role)
		}
		if sellerID != "" {
			req.Header.Set("X-Dev-Seller", sellerID)
		}
		router.ServeHTTP(rec, req)
		return rec
	}
	body := func(sellerID, targetType, targetID string, placements []string, imageURL string) string {
		b, _ := json.Marshal(map[string]any{
			"sellerId": sellerID, "placements": placements, "targetType": targetType, "targetId": targetID,
			"targetApp": "MART", "title": "Hero Deals", "subtitle": "UP TO 50% OFF", "imageUrl": imageURL,
			"cta": "Shop Now", "startsAt": time.Now().UTC().Format(time.RFC3339),
			"endsAt": time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339),
		})
		return string(b)
	}

	t.Run("own product goes LIVE", func(t *testing.T) {
		rec := post(auth.RoleSeller, owner.sellerID, body(owner.sellerID, "PRODUCT", productID, []string{"MART_HERO"}, "https://img.faazio.in/hero.jpg"))
		if rec.Code != http.StatusCreated || !strings.Contains(rec.Body.String(), `"status":"LIVE"`) {
			t.Fatalf("status = %d, want 201 LIVE (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("someone else's product is forbidden", func(t *testing.T) {
		rec := post(auth.RoleSeller, other.sellerID, body(other.sellerID, "PRODUCT", productID, []string{"MART_HERO"}, "https://img.faazio.in/hero.jpg"))
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403 (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("dish on a mart hero is rejected", func(t *testing.T) {
		rec := post(auth.RoleSeller, owner.sellerID, body(owner.sellerID, "DISH", dishID, []string{"MART_HERO"}, "https://img.faazio.in/hero.jpg"))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400 (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("own dish on a food hero goes LIVE with a derived app", func(t *testing.T) {
		rec := post(auth.RoleSeller, owner.sellerID, body(owner.sellerID, "DISH", dishID, []string{"FOOD_HERO"}, "https://img.faazio.in/hero.jpg"))
		if rec.Code != http.StatusCreated || !strings.Contains(rec.Body.String(), `"targetApp":"FOOD"`) {
			t.Fatalf("status = %d, want 201 FOOD (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("external image host is rejected", func(t *testing.T) {
		rec := post(auth.RoleSeller, owner.sellerID, body(owner.sellerID, "PRODUCT", productID, []string{"MART_HERO"}, "https://evil.example/hero.jpg"))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400 (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("per-seller placement cap returns 429", func(t *testing.T) {
		for i := 0; i < maxLivePerSellerPlacement; i++ {
			rec := post(auth.RoleSeller, rival.sellerID, body(rival.sellerID, "PRODUCT", rival.productID, []string{"MART_HERO"}, "https://img.faazio.in/hero.jpg"))
			if rec.Code != http.StatusCreated {
				t.Fatalf("cap seed %d: status = %d (%s)", i, rec.Code, rec.Body.String())
			}
		}
		rec := post(auth.RoleSeller, rival.sellerID, body(rival.sellerID, "PRODUCT", rival.productID, []string{"MART_HERO"}, "https://img.faazio.in/hero.jpg"))
		if rec.Code != http.StatusTooManyRequests {
			t.Fatalf("status = %d, want 429 (%s)", rec.Code, rec.Body.String())
		}
	})
}

type heroSeller struct {
	sellerID  string
	productID string
	storeID   string
}

// seedHeroSeller creates a seller + one owned store/product and registers cleanup.
func seedHeroSeller(t *testing.T, ctx context.Context, pool *pgxpool.Pool, tag string) heroSeller {
	t.Helper()
	suffix := shortID()
	s := heroSeller{sellerID: "sel-" + strings.ToLower(tag) + "-" + suffix}
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,$2,'Owner','MART','KA')`, s.sellerID, "Hero "+tag); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	s.storeID = "hero-store-" + suffix
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'MART','Hero Store',$2,'KA')`, s.storeID, s.sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	s.productID = "hero-item-" + suffix
	if _, err := pool.Exec(ctx, `
		insert into catalog.products (id, app, category, name, price_paisa, seller_id, status, store_id)
		values ($1,'MART','cat_dairy','Hero Item',1000,$2,'ACTIVE',$3)`, s.productID, s.sellerID, s.storeID); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from catalog.products where id=$1`, s.productID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, s.storeID)
		// ads.campaigns cascade with the seller FK.
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, s.sellerID)
	})
	return s
}

func newAdsRouter(t *testing.T, repo *Repo, cdnBase string) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(auth.Middleware(auth.Config{Disabled: true, DevUserID: "user-1"}))
	NewHandler(repo, c, nil, cdnBase).Register(r)
	return r
}
