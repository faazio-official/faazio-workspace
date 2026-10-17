package ads

import (
	"context"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/testenv"
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
	start, end := heroWindow("", "")
	st, _ := time.Parse(time.RFC3339, start)
	en, _ := time.Parse(time.RFC3339, end)
	if !en.After(st) {
		t.Fatalf("default window must end after start: %s..%s", start, end)
	}
	// An inverted window falls back to the 30-day default.
	_, end2 := heroWindow("2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z")
	en2, _ := time.Parse(time.RFC3339, end2)
	if !en2.After(time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("inverted window must be corrected, got %s", end2)
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
	if len(created) != 1 || created[0].Status != "REQUESTED" || created[0].CampaignID == "" {
		t.Fatalf("unexpected created campaign: %+v", created)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from ads.campaigns where campaign_id=$1`, created[0].CampaignID)
	})

	// A REQUESTED row is not visible to the anon hero projection.
	if heroes, err := repo.Heroes(ctx, "MART_HERO", "MART", "", ""); err != nil || len(heroes) != 0 {
		t.Fatalf("expected no live heroes, err=%v n=%d", err, len(heroes))
	}

	live, ok, err := repo.SetCampaignStatus(ctx, created[0].PlacementID, "LIVE")
	if err != nil || !ok || live.Status != "LIVE" {
		t.Fatalf("SetCampaignStatus: ok=%v err=%v status=%q", ok, err, live.Status)
	}
	heroes, err := repo.Heroes(ctx, "MART_HERO", "MART", "", "")
	if err != nil || len(heroes) != 1 {
		t.Fatalf("Heroes: err=%v n=%d", err, len(heroes))
	}
	if heroes[0].ImageURL != "https://img.test/hero.jpg" {
		t.Fatalf("image url not preserved: %q", heroes[0].ImageURL)
	}
	// Wrong app must not match.
	if heroes, _ := repo.Heroes(ctx, "MART_HERO", "FOOD", "", ""); len(heroes) != 0 {
		t.Fatalf("app filter leaked: n=%d", len(heroes))
	}

	list, err := repo.Campaigns(ctx, sellerID, "")
	if err != nil || len(list) != 1 {
		t.Fatalf("Campaigns: err=%v n=%d", err, len(list))
	}
	if _, ok, _ := repo.SetCampaignStatus(ctx, "ad-cmp-missing", "LIVE"); ok {
		t.Fatal("SetCampaignStatus on missing campaign must report ok=false")
	}
}
