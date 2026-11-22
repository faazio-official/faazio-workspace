package promo

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestPromoLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	// A temporary seller owns the opt-in (FK).
	sellerID := "sel-promo-" + shortID()
	otherSellerID := "sel-promo-other-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Promo Test','O','KA'), ($2,'Promo Other','O','KA')`,
		sellerID, otherSellerID); err != nil {
		t.Fatalf("seed sellers: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = any($1)`, []string{sellerID, otherSellerID})
	})

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
	// A second seller can never rewrite the first seller's row (product-keyed conflict).
	if _, err := repo.UpsertOptin(ctx, Optin{CampaignID: c.CampaignID, SellerID: otherSellerID, ProductID: "md-1", DiscountPercent: 90}); !errors.Is(err, ErrOptinNotOwned) {
		t.Fatalf("cross-seller opt-in must be rejected, got %v", err)
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
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Discount Test','O','KA')`, sellerID); err != nil {
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
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Window Test','O','KA')`, sellerID); err != nil {
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

// TestDecideCoupon locks the pure coupon ruling (no DB): active/expiry/sector/state/min-order and
// the server-computed capped discount.
func TestDecideCoupon(t *testing.T) {
	now := time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC)
	base := CouponRow{
		Code: "SAVE10", ValuePercent: 10, MaxDiscountPaisa: 5000, MinOrderPaisa: 20000,
		ValidTill: now.Add(24 * time.Hour), Active: true,
	}

	// Valid: 10% of ₹300 = ₹30 (30000 paisa < ₹50 cap).
	v := DecideCoupon(base, "MART", "KA", 30000, now)
	if !v.Valid || v.DiscountPaisa != 3000 || v.Reason != "" {
		t.Fatalf("valid coupon: %+v", v)
	}

	// Capped: 10% of ₹1000 = ₹100 → capped at ₹50.
	if v := DecideCoupon(base, "", "", 100000, now); v.DiscountPaisa != 5000 {
		t.Fatalf("cap not applied: %d", v.DiscountPaisa)
	}

	// Expiry, inactivity, sector, state and min-order each reject with a reason.
	expired := base
	expired.ValidTill = now.Add(-time.Minute)
	if v := DecideCoupon(expired, "", "", 30000, now); v.Valid || v.Reason != "expired" {
		t.Fatalf("expired: %+v", v)
	}
	inactive := base
	inactive.Active = false
	if v := DecideCoupon(inactive, "", "", 30000, now); v.Valid || v.Reason != "inactive" {
		t.Fatalf("inactive: %+v", v)
	}
	sector := base
	sector.Sector = "FOOD"
	if v := DecideCoupon(sector, "MART", "", 30000, now); v.Valid || v.Reason != "wrong_sector" {
		t.Fatalf("wrong_sector: %+v", v)
	}
	if v := DecideCoupon(sector, "", "", 30000, now); !v.Valid {
		t.Fatalf("empty app must be permissive: %+v", v)
	}
	state := base
	state.StateCode = "KA"
	if v := DecideCoupon(state, "", "TN", 30000, now); v.Valid || v.Reason != "wrong_state" {
		t.Fatalf("wrong_state: %+v", v)
	}
	if v := DecideCoupon(base, "", "", 10000, now); v.Valid || v.Reason != "min_order" {
		t.Fatalf("min_order: %+v", v)
	}
}

// TestProductInSellerStoreSectorGuard locks the store/sector clause the opt-in handler relies on: a
// product is only opt-in-able from the store it is listed under, and its app must match that store's
// app (so a FOOD row can never ride a MART shop's opt-in, or vice versa).
func TestProductInSellerStoreSectorGuard(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-optin-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Optin Guard','O','TN')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	martID := "store-mart-" + shortID()
	foodID := "store-food-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'MART','Guard Mart',$3,'TN'), ($2,'FOOD','Guard Food',$3,'TN')`,
		martID, foodID, sellerID); err != nil {
		t.Fatalf("seed stores: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from catalog.products where store_id = any($1)`, []string{martID, foodID})
		_, _ = pool.Exec(ctx, `delete from directory.stores where id = any($1)`, []string{martID, foodID})
	})

	martProduct := "pd-mart-" + shortID()
	foodProduct := "pd-food-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into catalog.products (id, app, category, name, price_paisa, store_id)
		values ($1,'MART','Snacks','Guard Mart SKU',10000,$2),
		       ($3,'FOOD','Mains','Guard Food Dish',15000,$4)`,
		martProduct, martID, foodProduct, foodID); err != nil {
		t.Fatalf("seed products: %v", err)
	}

	cases := []struct {
		name      string
		productID string
		storeID   string
		want      bool
	}{
		{"same store, matching sector", martProduct, martID, true},
		{"no store named, matching sector", martProduct, "", true},
		{"cross-sector product on mart store", foodProduct, martID, false},
		{"cross-sector product on food store", martProduct, foodID, false},
		{"product from the other store", foodProduct, martID, false},
	}
	for _, tc := range cases {
		got, err := repo.ProductInSellerStore(ctx, tc.productID, sellerID, tc.storeID)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if got != tc.want {
			t.Fatalf("%s: got %v want %v", tc.name, got, tc.want)
		}
	}
	if got, err := repo.ProductInSellerStore(ctx, martProduct, "sel-other", ""); err != nil || got {
		t.Fatalf("foreign seller must be rejected: got=%v err=%v", got, err)
	}
}

// TestCampaignSectorGuard locks the 0123 campaign vertical: a sector-less campaign accepts every
// product, a sector-scoped campaign accepts only that vertical, and an unknown campaign/product is
// reported as not-found rather than silently allowed.
func TestCampaignSectorGuard(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-cmp-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Campaign Sector','O','TN')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	storeID := "store-cmp-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'MART','Campaign Mart',$2,'TN')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	productID := "pd-cmp-" + shortID()
	if _, err := pool.Exec(ctx, `
		insert into catalog.products (id, app, category, name, price_paisa, store_id)
		values ($1,'MART','Snacks','Campaign SKU',10000,$2)`, productID, storeID); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from promo.festival_campaigns where campaign_id like $1`, "cmp-test-%")
		_, _ = pool.Exec(ctx, `delete from catalog.products where id=$1`, productID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID)
	})

	window := func() (string, string) {
		start := time.Now().UTC().Add(-time.Hour).Format(time.RFC3339)
		end := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
		return start, end
	}

	// Sector-less campaign: every product is acceptable.
	openStart, openEnd := window()
	openCampaign, err := repo.CreateCampaign(ctx, Campaign{
		Name: "Open", Scope: "GLOBAL", StartsAt: openStart, EndsAt: openEnd, Status: "LIVE",
	})
	if err != nil {
		t.Fatalf("CreateCampaign(open): %v", err)
	}
	if allowed, found, err := repo.ProductInCampaignSector(ctx, productID, openCampaign.CampaignID); err != nil || !found || !allowed {
		t.Fatalf("sector-less campaign must accept any product: allowed=%v found=%v err=%v", allowed, found, err)
	}

	// FOOD-scoped campaign: a MART product must be refused.
	foodStart, foodEnd := window()
	foodCampaign, err := repo.CreateCampaign(ctx, Campaign{
		Name: "Food Only", Scope: "GLOBAL", Sector: "FOOD",
		StartsAt: foodStart, EndsAt: foodEnd, Status: "LIVE",
	})
	if err != nil {
		t.Fatalf("CreateCampaign(food): %v", err)
	}
	if allowed, found, err := repo.ProductInCampaignSector(ctx, productID, foodCampaign.CampaignID); err != nil || !found || allowed {
		t.Fatalf("FOOD campaign must refuse a MART product: allowed=%v found=%v err=%v", allowed, found, err)
	}

	// MART-scoped campaign: the same product is acceptable, and the sector round-trips on read.
	martStart, martEnd := window()
	martCampaign, err := repo.CreateCampaign(ctx, Campaign{
		Name: "Mart Only", Scope: "GLOBAL", Sector: "MART",
		StartsAt: martStart, EndsAt: martEnd, Status: "LIVE",
	})
	if err != nil {
		t.Fatalf("CreateCampaign(mart): %v", err)
	}
	if allowed, found, err := repo.ProductInCampaignSector(ctx, productID, martCampaign.CampaignID); err != nil || !found || !allowed {
		t.Fatalf("MART campaign must accept a MART product: allowed=%v found=%v err=%v", allowed, found, err)
	}
	got, ok, err := repo.Campaign(ctx, martCampaign.CampaignID)
	if err != nil || !ok || got.Sector != "MART" {
		t.Fatalf("campaign sector did not round-trip: ok=%v err=%v sector=%q", ok, err, got.Sector)
	}

	// Unknown ids are reported as not-found, never as an allowed write.
	if _, found, err := repo.ProductInCampaignSector(ctx, productID, "cmp-missing"); err != nil || found {
		t.Fatalf("unknown campaign must be not-found: found=%v err=%v", found, err)
	}
	if _, found, err := repo.ProductInCampaignSector(ctx, "pd-missing", openCampaign.CampaignID); err != nil || found {
		t.Fatalf("unknown product must be not-found: found=%v err=%v", found, err)
	}
}
