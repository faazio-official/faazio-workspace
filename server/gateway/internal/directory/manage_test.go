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

func i64(v int64) *int64 { return &v }

func TestStoreLiveModeration(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-dir-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code, district_code)
		values ($1,'Directory Test','O','MART','TN','TCH')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	storeID := "store-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live)
		values ($1,'MART','Live Test',$2,'TN', false)`, storeID, sellerID); err != nil {
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
	if _, ok, err := repo.SetStoreLive(ctx, storeID, "sel-other", "", true); err != nil || ok {
		t.Fatalf("cross-seller live write must be denied: ok=%v err=%v", ok, err)
	}
	if s, ok, err := repo.SetStoreLive(ctx, storeID, sellerID, "", true); err != nil || !ok || !s.IsLive {
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

	stores, err := repo.SellerStores(ctx, sellerID, "")
	if err != nil || len(stores) != 1 {
		t.Fatalf("SellerStores: err=%v n=%d", err, len(stores))
	}
	if stores, err := repo.SellerStores(ctx, "", "TCH"); err != nil || len(stores) != 1 {
		t.Fatalf("district SellerStores: err=%v n=%d", err, len(stores))
	}
	if stores, err := repo.SellerStores(ctx, "", "TCO"); err != nil || len(stores) != 0 {
		t.Fatalf("cross-district SellerStores must be empty: err=%v n=%d", err, len(stores))
	}
	if ok, err := repo.SellerInDistrict(ctx, sellerID, "TCH"); err != nil || !ok {
		t.Fatalf("SellerInDistrict TCH: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.SellerInDistrict(ctx, sellerID, "TCO"); err != nil || ok {
		t.Fatalf("cross-district venue must be denied: ok=%v err=%v", ok, err)
	}
}

func TestMenuLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-menu-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code, district_code)
		values ($1,'Menu Test','O','FOOD','TN','TCH')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	venueID := "venue-" + manageID("")
	dishID := "dish-" + manageID("")
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.menus where venue_id=$1`, venueID) })
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live)
		values ($1,'FOOD','Menu Venue',$2,'TN', true)`, venueID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, venueID) })

	m, ok, err := repo.UpsertMenu(ctx, SellerMenu{
		VenueID: venueID, DishID: dishID, Name: "Paneer Tikka", Price: 240, MRP: i64(300),
	}, sellerID, false)
	if err != nil || !ok {
		t.Fatalf("UpsertMenu insert: ok=%v err=%v", ok, err)
	}
	if m.Price != 240 || m.Status != "DRAFT" || m.SellerID != sellerID {
		t.Fatalf("unexpected inserted menu: %+v", m)
	}
	// The authored MRP rides the write path (the strike the Food offers rail renders).
	if m.MRP == nil || *m.MRP != 300 {
		t.Fatalf("MRP not persisted on insert: %+v", m)
	}
	// A DRAFT row is not yet public: the menu read serves ACTIVE rows only.
	if dishes, err := repo.Menu(ctx, venueID); err != nil || len(dishes) != 0 {
		t.Fatalf("DRAFT dish leaked into the public menu: err=%v dishes=%+v", err, dishes)
	}

	// Cross-seller update denied, owner update allowed.
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Hijack", Price: 1}, "sel-other", false); err != nil || ok {
		t.Fatalf("cross-seller menu update must be denied: ok=%v err=%v", ok, err)
	}
	if m, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Paneer Tikka Deluxe", Price: 260, MRP: i64(320)}, sellerID, false); err != nil || !ok || m.Price != 260 || m.MRP == nil || *m.MRP != 320 {
		t.Fatalf("owner menu update: ok=%v err=%v m=%+v", ok, err, m)
	}

	// Status writes are ownership-scoped (the handler separately gates which statuses a role may set).
	if _, ok, err := repo.SetMenuStatus(ctx, venueID, dishID, "sel-other", "ACTIVE", false); err != nil || ok {
		t.Fatalf("cross-seller status write must be denied: ok=%v err=%v", ok, err)
	}
	if m, ok, err := repo.SetMenuStatus(ctx, venueID, dishID, sellerID, "ACTIVE", false); err != nil || !ok || m.Status != "ACTIVE" {
		t.Fatalf("owner status write: ok=%v err=%v m=%+v", ok, err, m)
	}

	// Public menu read reflects the rupees conversion and now serves the ACTIVE row.
	dishes, err := repo.Menu(ctx, venueID)
	if err != nil || len(dishes) != 1 || dishes[0].Price != 260 {
		t.Fatalf("Menu read: err=%v dishes=%+v", err, dishes)
	}
	if dishes[0].OriginalPrice == nil || *dishes[0].OriginalPrice != 320 {
		t.Fatalf("menu read dropped MRP: %+v", dishes[0])
	}

	// Delisting removes it from the public menu (the seller pull takes effect).
	if _, ok, err := repo.SetMenuStatus(ctx, venueID, dishID, sellerID, "DELISTED", false); err != nil || !ok {
		t.Fatalf("delist: ok=%v err=%v", ok, err)
	}
	if dishes, err := repo.Menu(ctx, venueID); err != nil || len(dishes) != 0 {
		t.Fatalf("DELISTED dish still public: err=%v dishes=%+v", err, dishes)
	}

	if ok, err := repo.DeleteMenu(ctx, venueID, dishID, "sel-other", false); err != nil || ok {
		t.Fatalf("cross-seller delete must be denied: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.DeleteMenu(ctx, venueID, dishID, sellerID, false); err != nil || !ok {
		t.Fatalf("owner delete: ok=%v err=%v", ok, err)
	}
}

func TestMenuDiningVenueOwnership(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-dining-" + manageID("")
	otherID := "sel-dining-other-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code, district_code)
		values ($1,'Dining Test','O','FOOD','TN','TCH'), ($2,'Other Dining','O','FOOD','TN','TCO')`,
		sellerID, otherID); err != nil {
		t.Fatalf("seed sellers: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = any($1)`, []string{sellerID, otherID})
	})

	venueID := "tr-test-" + manageID("")
	dishID := "dish-dining-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.dining_venues (id, name, app)
		values ($1,'Dining Test Venue','FOOD')`, venueID); err != nil {
		t.Fatalf("seed dining venue: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.menus where venue_id=$1`, venueID)
		_, _ = pool.Exec(ctx, `delete from directory.dining_venues where id=$1`, venueID)
	})
	// A seeded dining-venue dish carries its seller in directory.menus (no store row exists).
	if _, err := pool.Exec(ctx, `
		insert into directory.menus (venue_id, dish_id, name, price_paisa, seller_id, status)
		values ($1,$2,'Seeded Dish',10000,$3,'ACTIVE')`, venueID, dishID, sellerID); err != nil {
		t.Fatalf("seed dining menu: %v", err)
	}

	owner, ok, err := repo.MenuOrVenueSeller(ctx, venueID, dishID)
	if err != nil || !ok || owner != sellerID {
		t.Fatalf("MenuOrVenueSeller: ok=%v err=%v owner=%q", ok, err, owner)
	}
	if ok, err := repo.SellerInDistrict(ctx, sellerID, "TCH"); err != nil || !ok {
		t.Fatalf("district owner: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.SellerInDistrict(ctx, sellerID, "TCO"); err != nil || ok {
		t.Fatalf("cross-district owner must be denied: ok=%v err=%v", ok, err)
	}

	// The seeded owner can edit the dining-venue dish; another seller cannot.
	if m, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Updated", Price: 120}, sellerID, false); err != nil || !ok || m.Price != 120 {
		t.Fatalf("owner dining update: ok=%v err=%v m=%+v", ok, err, m)
	}
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Hijack", Price: 1}, otherID, false); err != nil || ok {
		t.Fatalf("cross-seller dining update must be denied: ok=%v err=%v", ok, err)
	}
}

func TestMenuInsertRequiresVenueOwnership(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	ownerID := "sel-venue-" + manageID("")
	otherID := "sel-venue-other-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Venue Owner','O','FOOD','TN'), ($2,'Venue Other','O','FOOD','TN')`,
		ownerID, otherID); err != nil {
		t.Fatalf("seed sellers: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = any($1)`, []string{ownerID, otherID})
	})

	venueID := "venue-own-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live)
		values ($1,'FOOD','Owned Venue',$2,'TN', true)`, venueID, ownerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.menus where venue_id=$1`, venueID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, venueID)
	})

	dishID := "dish-own-" + manageID("")
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Rogue", Price: 10}, otherID, false); err != nil || ok {
		t.Fatalf("cross-venue insert must be denied: ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Mine", Price: 10}, ownerID, false); err != nil || !ok {
		t.Fatalf("owner insert: ok=%v err=%v", ok, err)
	}
}
