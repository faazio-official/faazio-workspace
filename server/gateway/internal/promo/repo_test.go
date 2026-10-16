package promo

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestPromoLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	// A temporary seller owns the opt-in (FK).
	sellerID := "sel-promo-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Promo Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	// Sector cap upsert + list.
	if _, err := repo.SetSectorCap(ctx, SectorCap{Sector: "MART", StateCode: "KA", MaxDiscountPercent: 40}); err != nil {
		t.Fatalf("SetSectorCap: %v", err)
	}
	caps, err := repo.SectorCaps(ctx)
	if err != nil || len(caps) == 0 {
		t.Fatalf("SectorCaps: err=%v n=%d", err, len(caps))
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from promo.sector_caps where sector='MART' and state_code='KA'`) })

	// Campaign create + status.
	c, err := repo.CreateCampaign(ctx, Campaign{
		Name: "Diwali", Scope: "GLOBAL", StartsAt: "2026-11-01T00:00:00Z",
		EndsAt: "2026-11-10T00:00:00Z", Status: "DRAFT",
	})
	if err != nil || c.CampaignID == "" {
		t.Fatalf("CreateCampaign: err=%v c=%+v", err, c)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from promo.festival_campaigns where campaign_id=$1`, c.CampaignID)
	})
	got, ok, err := repo.Campaign(ctx, c.CampaignID)
	if err != nil || !ok || got.Name != "Diwali" {
		t.Fatalf("Campaign: ok=%v err=%v", ok, err)
	}
	if live, ok, err := repo.SetCampaignStatus(ctx, c.CampaignID, "LIVE"); err != nil || !ok || live.Status != "LIVE" {
		t.Fatalf("SetCampaignStatus: ok=%v err=%v status=%q", ok, err, live.Status)
	}

	// Opt-in upsert + approve.
	o, err := repo.UpsertOptin(ctx, Optin{CampaignID: c.CampaignID, SellerID: sellerID, ProductID: "md-1", DiscountPercent: 15})
	if err != nil {
		t.Fatalf("UpsertOptin: %v", err)
	}
	if o.Status != "PENDING" {
		t.Fatalf("new opt-in status = %q, want PENDING", o.Status)
	}
	approved, ok, err := repo.SetOptinStatus(ctx, o.OptinID, "APPROVED")
	if err != nil || !ok || approved.Status != "APPROVED" {
		t.Fatalf("SetOptinStatus: ok=%v err=%v", ok, err)
	}
	// Re-optin resets to PENDING.
	if again, err := repo.UpsertOptin(ctx, Optin{CampaignID: c.CampaignID, SellerID: sellerID, ProductID: "md-1", DiscountPercent: 20}); err != nil || again.Status != "PENDING" {
		t.Fatalf("re-upsert must reset PENDING: err=%v status=%q", err, again.Status)
	}

	// Coupon create + toggle (money rupees -> paisa round-trip).
	cp, err := repo.CreateCoupon(ctx, Coupon{
		Code: "DIWALI10", Scope: "GLOBAL", ValuePercent: 10, MaxDiscount: 200,
		ValidTill: "2026-11-10T00:00:00Z", Active: true,
	})
	if err != nil || cp.MaxDiscount != 200 {
		t.Fatalf("CreateCoupon: err=%v max=%d", err, cp.MaxDiscount)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from promo.coupons where coupon_id=$1`, cp.CouponID) })
	toggled, ok, err := repo.ToggleCoupon(ctx, cp.CouponID)
	if err != nil || !ok || toggled.Active {
		t.Fatalf("ToggleCoupon: ok=%v err=%v active=%v", ok, err, toggled.Active)
	}
	coupons, err := repo.Coupons(ctx, "", "")
	if err != nil || len(coupons) == 0 {
		t.Fatalf("Coupons: err=%v n=%d", err, len(coupons))
	}
}

// TestPublicCoupons locks the anon projection the app's `GET /coupons` reads: only active,
// unexpired coupons, sector match-or-global, money in whole rupees.
func TestPublicCoupons(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	liveCode := "PUBLIVE-" + shortID()
	expiredCode := "PUBEXP-" + shortID()
	inactiveCode := "PUBOFF-" + shortID()
	martCode := "PUBMART-" + shortID()
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from promo.coupons where code = any($1)`,
			[]string{liveCode, expiredCode, inactiveCode, martCode})
	})

	insert := func(code, title string, sector any, validTill, active string) {
		t.Helper()
		if _, err := pool.Exec(ctx, `
			insert into promo.coupons
			  (coupon_id, code, title, scope, sector, value_percent, max_discount_paisa,
			   min_order_paisa, free_delivery, valid_till, active)
			values ($1,$2,$3,'GLOBAL',$4,25,5000,99900,true,`+validTill+`,`+active+`)`,
			"cpn-"+code, code, title, sector); err != nil {
			t.Fatalf("insert %s: %v", code, err)
		}
	}
	insert(liveCode, "Public Live", nil, "now() + interval '30 days'", "true")
	insert(expiredCode, "Public Expired", nil, "now() - interval '1 day'", "true")
	insert(inactiveCode, "Public Inactive", nil, "now() + interval '30 days'", "false")
	insert(martCode, "Public Mart", "MART", "now() + interval '30 days'", "true")

	got, err := repo.PublicCoupons(ctx, "", "")
	if err != nil {
		t.Fatalf("PublicCoupons: %v", err)
	}
	byCode := map[string]PublicCoupon{}
	for _, c := range got {
		byCode[c.Code] = c
	}
	live, ok := byCode[liveCode]
	if !ok {
		t.Fatalf("active unexpired coupon %q missing from public projection", liveCode)
	}
	if live.Title != "Public Live" || live.ValuePercent != 25 || live.MaxDiscount != 50 ||
		live.MinOrder != 999 || !live.FreeDelivery {
		t.Fatalf("public coupon shape = %+v", live)
	}
	if _, ok := byCode[expiredCode]; ok {
		t.Fatalf("expired coupon %q leaked into public projection", expiredCode)
	}
	if _, ok := byCode[inactiveCode]; ok {
		t.Fatalf("inactive coupon %q leaked into public projection", inactiveCode)
	}

	// Sector filter: a MART coupon shows for MART only, never for FOOD.
	mart, err := repo.PublicCoupons(ctx, "MART", "")
	if err != nil {
		t.Fatalf("PublicCoupons(MART): %v", err)
	}
	if !hasCode(mart, martCode) {
		t.Fatalf("MART coupon %q missing for app MART", martCode)
	}
	food, err := repo.PublicCoupons(ctx, "FOOD", "")
	if err != nil {
		t.Fatalf("PublicCoupons(FOOD): %v", err)
	}
	if hasCode(food, martCode) {
		t.Fatalf("MART coupon %q leaked into the FOOD sector", martCode)
	}
}

func hasCode(coupons []PublicCoupon, code string) bool {
	for _, c := range coupons {
		if c.Code == code {
			return true
		}
	}
	return false
}

// TestActiveDiscounts locks the shopper price authority's read side: a discount is live only for an
// APPROVED opt-in on a LIVE, in-window campaign, is best-wins per product, is capped by the sector
// cap, and disappears when the opt-in is rejected. `md-1` is a seeded MART catalog row.
func TestActiveDiscounts(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-disc-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Discount Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	c, err := repo.CreateCampaign(ctx, Campaign{
		Name: "Shopper Price", Scope: "GLOBAL", StartsAt: "2020-01-01T00:00:00Z",
		EndsAt: "2030-01-01T00:00:00Z", Status: "LIVE",
	})
	if err != nil {
		t.Fatalf("CreateCampaign: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from promo.festival_campaigns where campaign_id=$1`, c.CampaignID)
	})

	o, err := repo.UpsertOptin(ctx, Optin{CampaignID: c.CampaignID, SellerID: sellerID, ProductID: "md-1", DiscountPercent: 15})
	if err != nil {
		t.Fatalf("UpsertOptin: %v", err)
	}
	if _, ok, err := repo.SetOptinStatus(ctx, o.OptinID, "APPROVED"); err != nil || !ok {
		t.Fatalf("Approve opt-in: ok=%v err=%v", ok, err)
	}

	got, err := repo.ActiveDiscounts(ctx, []string{"md-1"})
	if err != nil {
		t.Fatalf("ActiveDiscounts: %v", err)
	}
	if len(got) != 1 || got[0].DiscountPercent != 15 || got[0].CampaignID != c.CampaignID {
		t.Fatalf("active discount = %+v, want 15%% on %s", got, c.CampaignID)
	}
	// Products with no live discount are simply omitted (no fabricated entry).
	if none, err := repo.ActiveDiscounts(ctx, []string{"does-not-exist"}); err != nil || len(none) != 0 {
		t.Fatalf("absent product must be omitted: err=%v got=%+v", err, none)
	}

	// A global MART cap clamps the approved 15% down to the cap.
	if _, err := repo.SetSectorCap(ctx, SectorCap{Sector: "MART", MaxDiscountPercent: 10}); err != nil {
		t.Fatalf("SetSectorCap: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from promo.sector_caps where sector='MART' and state_code is null`)
	})
	capped, err := repo.ActiveDiscounts(ctx, []string{"md-1"})
	if err != nil || len(capped) != 1 || capped[0].DiscountPercent != 10 {
		t.Fatalf("capped discount = %+v err=%v, want 10%%", capped, err)
	}

	// OptinProductIDs drives cache invalidation on campaign status change.
	ids, err := repo.OptinProductIDs(ctx, c.CampaignID)
	if err != nil || len(ids) != 1 || ids[0] != "md-1" {
		t.Fatalf("OptinProductIDs = %v err=%v, want [md-1]", ids, err)
	}

	// A rejected opt-in drops out of the projection.
	if _, ok, err := repo.SetOptinStatus(ctx, o.OptinID, "REJECTED"); err != nil || !ok {
		t.Fatalf("Reject opt-in: ok=%v err=%v", ok, err)
	}
	if after, err := repo.ActiveDiscounts(ctx, []string{"md-1"}); err != nil || len(after) != 0 {
		t.Fatalf("rejected opt-in must not be active: err=%v got=%+v", err, after)
	}
}

// TestActiveDiscountsCampaignWindow verifies a non-LIVE campaign never surfaces a discount.
func TestActiveDiscountsCampaignWindow(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-disc2-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Window Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	c, err := repo.CreateCampaign(ctx, Campaign{
		Name: "Draft Price", Scope: "GLOBAL", StartsAt: "2020-01-01T00:00:00Z",
		EndsAt: "2030-01-01T00:00:00Z", Status: "DRAFT",
	})
	if err != nil {
		t.Fatalf("CreateCampaign: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from promo.festival_campaigns where campaign_id=$1`, c.CampaignID)
	})
	o, err := repo.UpsertOptin(ctx, Optin{CampaignID: c.CampaignID, SellerID: sellerID, ProductID: "md-2", DiscountPercent: 20})
	if err != nil {
		t.Fatalf("UpsertOptin: %v", err)
	}
	if _, ok, err := repo.SetOptinStatus(ctx, o.OptinID, "APPROVED"); err != nil || !ok {
		t.Fatalf("Approve opt-in: ok=%v err=%v", ok, err)
	}
	if got, err := repo.ActiveDiscounts(ctx, []string{"md-2"}); err != nil || len(got) != 0 {
		t.Fatalf("DRAFT campaign must not surface a discount: err=%v got=%+v", err, got)
	}
}
