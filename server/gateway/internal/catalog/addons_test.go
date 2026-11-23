package catalog

import (
	"context"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

// setupFoodVenue seeds an owner + a FOOD store and returns (sellerID, storeID). Add-on writes are
// FOOD-gated (0122 + the foodVenuePredicate in addons.go), so a FOOD store is the only venue that
// can exercise the happy path.
func setupFoodVenue(t *testing.T) (sellerID, storeID string) {
	t.Helper()
	pool := testenv.Pool(t)
	ctx := context.Background()

	sellerID = "sel-addon-" + shortTestID()
	storeID = "store-addon-" + shortTestID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		values ($1,'Addon Test','O','TN','TCH')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'FOOD','Addon Kitchen',$2,'TN')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.product_addon_links where venue_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.menu_addon_links where venue_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.addons where venue_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from catalog.products where store_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID)
	})
	return sellerID, storeID
}

func shortTestID() string {
	b := make([]byte, 4)
	for i := range b {
		b[i] = "abcdefghijklmnopqrstuvwxyz0123456789"[i%36]
	}
	return string(b)
}

func TestAddonWorkflow(t *testing.T) {
	repo := New(testenv.Pool(t))
	ctx := context.Background()
	sellerID, venueID := setupFoodVenue(t)

	a, ok, err := repo.CreateAddon(ctx, venueID, "Extra Cheese", "Toppings", "", "", 20000, true, sellerID, "")
	if err != nil || !ok {
		t.Fatalf("create addon: ok=%v err=%v", ok, err)
	}
	if a.Status != "DRAFT" {
		t.Fatalf("expected DRAFT, got %s", a.Status)
	}

	submitted, found, err := repo.SubmitAddonForReview(ctx, a.AddonID, sellerID, "")
	if err != nil || !found {
		t.Fatalf("submit for review: err=%v found=%v", err, found)
	}
	if submitted.Status != "PENDING_REVIEW" {
		t.Fatalf("expected PENDING_REVIEW, got %s", submitted.Status)
	}

	approved, found, err := repo.SetAddonStatus(ctx, a.AddonID, "ACTIVE", "", sellerID, "")
	if err != nil || !found {
		t.Fatalf("approve: err=%v found=%v", err, found)
	}
	if approved.Status != "ACTIVE" {
		t.Fatalf("expected ACTIVE, got %s", approved.Status)
	}
}

func TestAddonRejectAndRequestChanges(t *testing.T) {
	repo := New(testenv.Pool(t))
	ctx := context.Background()
	sellerID, venueID := setupFoodVenue(t)

	a, ok, err := repo.CreateAddon(ctx, venueID, "Bad Addon", "Toppings", "", "", 10000, false, sellerID, "")
	if err != nil || !ok {
		t.Fatalf("create addon: ok=%v err=%v", ok, err)
	}
	if _, _, err := repo.SubmitAddonForReview(ctx, a.AddonID, sellerID, ""); err != nil {
		t.Fatalf("submit: %v", err)
	}

	rejected, _, err := repo.SetAddonStatus(ctx, a.AddonID, "DRAFT", "Too cheap", sellerID, "")
	if err != nil {
		t.Fatalf("reject addon: %v", err)
	}
	if rejected.Status != "DRAFT" || rejected.ReviewReason != "Too cheap" {
		t.Fatalf("reject did not set status/reason: %+v", rejected)
	}

	changed, _, err := repo.SetAddonStatus(ctx, a.AddonID, "CHANGES_REQUESTED", "Add description", sellerID, "")
	if err != nil {
		t.Fatalf("request changes: %v", err)
	}
	if changed.Status != "CHANGES_REQUESTED" {
		t.Fatalf("expected CHANGES_REQUESTED, got %s", changed.Status)
	}
}

// TestAddonSectorsAndFoodDishLink locks the contract 0122 shipped: add-ons are sector-agnostic, so a
// MART store can create, edit, submit and activate them — but `directory.menus` /
// `directory.menu_addon_links` are FOOD-owned, so the FOOD-only dish link must still be refused for a
// non-FOOD venue.
func TestAddonSectorsAndFoodDishLink(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-addon-mart-" + shortTestID()
	storeID := "store-addon-mart-" + shortTestID()
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Mart Addon','O','TN')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'MART','Mart Store',$2,'TN')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.addons where venue_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID)
	})

	// A MART store owns its add-ons (0122): the write succeeds and is tagged MART, not FOOD.
	addon, ok, err := repo.CreateAddon(ctx, storeID, "Gift Wrap", "", "", "", 5000, false, sellerID, "")
	if err != nil || !ok {
		t.Fatalf("MART add-on create must be allowed: ok=%v err=%v", ok, err)
	}
	var sector string
	if err := pool.QueryRow(ctx, `select sector_app from directory.addons where addon_id=$1`, addon.AddonID).Scan(&sector); err != nil {
		t.Fatalf("read sector_app: %v", err)
	}
	if sector != "MART" {
		t.Fatalf("sector_app must mirror the owning store, got %q", sector)
	}
	if _, ok, err := repo.UpdateAddon(ctx, addon.AddonID, "Renamed", "", "", "", 6000, false, sellerID, ""); err != nil || !ok {
		t.Fatalf("MART add-on update must be allowed: ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.SubmitAddonForReview(ctx, addon.AddonID, sellerID, ""); err != nil || !ok {
		t.Fatalf("MART add-on submit must be allowed: ok=%v err=%v", ok, err)
	}

	// The dish-link path stays FOOD-only: menu tables belong to the food vertical.
	dishID := "addon-dish-mart-" + shortTestID()
	if _, err := pool.Exec(ctx, `
		insert into catalog.products (id, store_id, name, app, category, price_paisa, status)
		values ($1,$2,'Mart Item','MART','GENERAL',500,'ACTIVE')`, dishID, storeID); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from catalog.products where id=$1`, dishID) })
	if ok, err := repo.LinkAddon(ctx, storeID, dishID, addon.AddonID, sellerID, ""); err != nil || ok {
		t.Fatalf("MART dish link must be denied: ok=%v err=%v", ok, err)
	}
}
