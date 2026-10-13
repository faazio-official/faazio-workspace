package directory

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func manageID(prefix string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func TestStoreLiveModeration(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-dir-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Directory Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	storeID := "store-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live)
		values ($1,'MART','Live Test',$2,'KA', false)`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	// A non-live store is hidden from the public list.
	page, err := repo.ByAppPage(ctx, "MART", 500, 0, "", false)
	if err != nil {
		t.Fatalf("ByAppPage: %v", err)
	}
	for _, s := range page {
		if s.ID == storeID {
			t.Fatal("non-live store leaked into the public list")
		}
	}

	// Cross-seller write denied; owner can go live; public list then includes it.
	if _, ok, err := repo.SetStoreLive(ctx, storeID, "sel-other", true, false); err != nil || ok {
		t.Fatalf("cross-seller live write must be denied: ok=%v err=%v", ok, err)
	}
	if s, ok, err := repo.SetStoreLive(ctx, storeID, sellerID, true, false); err != nil || !ok || !s.IsLive {
		t.Fatalf("owner go-live: ok=%v err=%v live=%v", ok, err, s.IsLive)
	}
	page, _ = repo.ByAppPage(ctx, "MART", 500, 0, "", false)
	found := false
	for _, s := range page {
		if s.ID == storeID {
			found = true
		}
	}
	if !found {
		t.Fatal("live store missing from the public list")
	}

	stores, err := repo.SellerStores(ctx, sellerID)
	if err != nil || len(stores) != 1 {
		t.Fatalf("SellerStores: err=%v n=%d", err, len(stores))
	}
}

func TestMenuLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-menu-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Menu Test','O','FOOD','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	venueID := "venue-" + manageID("")
	dishID := "dish-" + manageID("")
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.menus where venue_id=$1`, venueID) })

	m, ok, err := repo.UpsertMenu(ctx, SellerMenu{
		VenueID: venueID, DishID: dishID, Name: "Paneer Tikka", Price: 240,
	}, sellerID, false)
	if err != nil || !ok {
		t.Fatalf("UpsertMenu insert: ok=%v err=%v", ok, err)
	}
	if m.Price != 240 || m.Status != "DRAFT" || m.SellerID != sellerID {
		t.Fatalf("unexpected inserted menu: %+v", m)
	}

	// Cross-seller update denied, owner update allowed.
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Hijack", Price: 1}, "sel-other", false); err != nil || ok {
		t.Fatalf("cross-seller menu update must be denied: ok=%v err=%v", ok, err)
	}
	if m, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Paneer Tikka Deluxe", Price: 260}, sellerID, false); err != nil || !ok || m.Price != 260 {
		t.Fatalf("owner menu update: ok=%v err=%v m=%+v", ok, err, m)
	}

	// Status writes are ownership-scoped (the handler separately gates which statuses a role may set).
	if _, ok, err := repo.SetMenuStatus(ctx, venueID, dishID, "sel-other", "ACTIVE", false); err != nil || ok {
		t.Fatalf("cross-seller status write must be denied: ok=%v err=%v", ok, err)
	}
	if m, ok, err := repo.SetMenuStatus(ctx, venueID, dishID, sellerID, "ACTIVE", false); err != nil || !ok || m.Status != "ACTIVE" {
		t.Fatalf("owner status write: ok=%v err=%v m=%+v", ok, err, m)
	}

	// Public menu read reflects the rupees conversion.
	dishes, err := repo.Menu(ctx, venueID)
	if err != nil || len(dishes) != 1 || dishes[0].Price != 260 {
		t.Fatalf("Menu read: err=%v dishes=%+v", err, dishes)
	}

	if ok, err := repo.DeleteMenu(ctx, venueID, dishID, "sel-other", false); err != nil || ok {
		t.Fatalf("cross-seller delete must be denied: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.DeleteMenu(ctx, venueID, dishID, sellerID, false); err != nil || !ok {
		t.Fatalf("owner delete: ok=%v err=%v", ok, err)
	}
}
