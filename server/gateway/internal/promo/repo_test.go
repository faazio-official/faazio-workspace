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
