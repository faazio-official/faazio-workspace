package directory

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/jackc/pgx/v5/pgxpool"
)

func manageID(prefix string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func i64(v int64) *int64 { return &v }

// seedLeafCategory creates a FOOD section header plus a leaf under it and returns both ids. Dishes
// must be filed under a leaf (a parent category is only a section header), so every menu write in
// these tests needs one.
func seedLeafCategory(t *testing.T, pool *pgxpool.Pool, label string) (sectionID, leafID string) {
	t.Helper()
	ctx := context.Background()
	sectionID = "cat-sec-" + manageID("")
	leafID = "cat-leaf-" + manageID("")
	slug := strings.ToLower(strings.ReplaceAll(label, " ", "-"))
	if _, err := pool.Exec(ctx, `
		insert into taxonomy.categories (id, app, name, slug, is_active)
		values ($1,'FOOD',$2,$3, true)`, sectionID, label+" Section", slug+"-sec"); err != nil {
		t.Fatalf("seed section category: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into taxonomy.categories (id, app, name, slug, parent_id, is_active)
		values ($1,'FOOD',$2,$3,$4, true)`, leafID, label+" Leaf", slug+"-leaf", sectionID); err != nil {
		t.Fatalf("seed leaf category: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from taxonomy.categories where id = any($1)`, []string{sectionID, leafID})
	})
	return sectionID, leafID
}

func TestStoreLiveModeration(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-dir-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		values ($1,'Directory Test','O','TN','TCH')`, sellerID); err != nil {
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
	if stores, err := repo.SellerStores(ctx, "", "TCH"); err != nil {
		t.Fatalf("district SellerStores: err=%v", err)
	} else {
		// Other packages seed their own sellers in TCH and `go test ./...` runs packages in
		// parallel against one database, so assert on THIS seller's row rather than on a district
		// count that a concurrent test can inflate.
		foundMine := false
		for _, s := range stores {
			if s.ID == storeID {
				foundMine = true
			}
		}
		if !foundMine {
			t.Fatalf("district SellerStores missing this seller's store (n=%d)", len(stores))
		}
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
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		values ($1,'Menu Test','O','TN','TCH')`, sellerID); err != nil {
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

	_, leafID := seedLeafCategory(t, pool, "Paneer Lifecycle")

	m, ok, err := repo.UpsertMenu(ctx, SellerMenu{
		VenueID: venueID, DishID: dishID, Name: "Paneer Tikka", Price: 240, MRP: i64(300),
		SubCategoryID: leafID,
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
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Hijack", Price: 1, SubCategoryID: leafID}, "sel-other", false); err != nil || ok {
		t.Fatalf("cross-seller menu update must be denied: ok=%v err=%v", ok, err)
	}
	if m, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Paneer Tikka Deluxe", Price: 260, MRP: i64(320), SubCategoryID: leafID}, sellerID, false); err != nil || !ok || m.Price != 260 || m.MRP == nil || *m.MRP != 320 {
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
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		values ($1,'Dining Test','O','TN','TCH'), ($2,'Other Dining','O','TN','TCO')`,
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
	// A dining venue is restaurant-only and not seller-bound (no directory.stores row), so its menu
	// carries no owner after 0070 dropped directory.menus.seller_id.
	if _, err := pool.Exec(ctx, `
		insert into directory.menus (venue_id, dish_id, name, price_paisa, status)
		values ($1,$2,'Seeded Dish',10000,'ACTIVE')`, venueID, dishID); err != nil {
		t.Fatalf("seed dining menu: %v", err)
	}

	_, leafID := seedLeafCategory(t, pool, "Dining Leaf")

	owner, ok, err := repo.MenuOrVenueSeller(ctx, venueID, dishID)
	if err != nil || ok || owner != "" {
		t.Fatalf("MenuOrVenueSeller: ok=%v err=%v owner=%q (dining venues are ownerless)", ok, err, owner)
	}
	if ok, err := repo.SellerInDistrict(ctx, sellerID, "TCH"); err != nil || !ok {
		t.Fatalf("district owner: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.SellerInDistrict(ctx, sellerID, "TCO"); err != nil || ok {
		t.Fatalf("cross-district owner must be denied: ok=%v err=%v", ok, err)
	}

	// A dining venue has no owning store, so a seller cannot edit its dish; super admin can.
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Updated", Price: 120, SubCategoryID: leafID}, sellerID, false); err != nil || ok {
		t.Fatalf("seller dining update must be denied: ok=%v err=%v", ok, err)
	}
	if m, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Updated", Price: 120, SubCategoryID: leafID}, sellerID, true); err != nil || !ok || m.Price != 120 {
		t.Fatalf("admin dining update: ok=%v err=%v m=%+v", ok, err, m)
	}
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Hijack", Price: 1, SubCategoryID: leafID}, otherID, false); err != nil || ok {
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
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Venue Owner','O','TN'), ($2,'Venue Other','O','TN')`,
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

	_, leafID := seedLeafCategory(t, pool, "Own Leaf")

	dishID := "dish-own-" + manageID("")
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Rogue", Price: 10, SubCategoryID: leafID}, otherID, false); err != nil || ok {
		t.Fatalf("cross-venue insert must be denied: ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: venueID, DishID: dishID, Name: "Mine", Price: 10, SubCategoryID: leafID}, ownerID, false); err != nil || !ok {
		t.Fatalf("owner insert: ok=%v err=%v", ok, err)
	}
}

// TestMenuWritesRequireFoodSector locks the sector guard on the FOOD-owned menu tables: a Mart or
// Pharmacy store that owns a venue id must still be unable to insert, re-status or delete a dish.
func TestMenuWritesRequireFoodSector(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-sector-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		values ($1,'Sector Guard','O','TN','TCH')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	martID := "store-mart-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live)
		values ($1,'MART','Sector Mart',$2,'TN', true)`, martID, sellerID); err != nil {
		t.Fatalf("seed mart store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.menus where venue_id=$1`, martID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, martID)
	})

	_, leafID := seedLeafCategory(t, pool, "Sector Leaf")

	dishID := "dish-mart-" + manageID("")
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{VenueID: martID, DishID: dishID, Name: "Rogue Dish", Price: 10, SubCategoryID: leafID}, sellerID, false); err != nil || ok {
		t.Fatalf("MART store insert must be denied: ok=%v err=%v", ok, err)
	}

	// Seed a row the store does not own sector-wise, then prove status/delete cannot touch it either.
	if _, err := pool.Exec(ctx, `
		insert into directory.menus (venue_id, dish_id, name, price_paisa, status)
		values ($1,$2,'Seeded',10000,'DRAFT')`, martID, dishID); err != nil {
		t.Fatalf("seed menu row: %v", err)
	}
	if _, ok, err := repo.SetMenuStatus(ctx, martID, dishID, sellerID, "ACTIVE", false); err != nil || ok {
		t.Fatalf("MART store status write must be denied: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.DeleteMenu(ctx, martID, dishID, sellerID, false); err != nil || ok {
		t.Fatalf("MART store delete must be denied: ok=%v err=%v", ok, err)
	}
}

// TestMenuRequiresLeafSubCategory locks the "dishes live under a leaf sub-category only" rule at the
// repo boundary: a parent category (section header) can never receive a dish, and an unknown or
// non-FOOD category id is rejected too.
func TestMenuRequiresLeafSubCategory(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-leaf-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		values ($1,'Leaf Test','O','TN','TCH')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	venueID := "venue-leaf-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live)
		values ($1,'FOOD','Leaf Venue',$2,'TN', true)`, venueID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from directory.menus where venue_id=$1`, venueID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, venueID)
	})

	// A FOOD section header (parent) and a leaf under it.
	sectionID := "cat-sec-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into taxonomy.categories (id, app, name, slug, is_active)
		values ($1,'FOOD','ZZ Biryani','zz-biryani', true)`, sectionID); err != nil {
		t.Fatalf("seed section: %v", err)
	}
	leafID := "cat-leaf-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into taxonomy.categories (id, app, name, slug, parent_id, is_active)
		values ($1,'FOOD','ZZ Mutton Biryani','zz-mutton-biryani',$2, true)`, leafID, sectionID); err != nil {
		t.Fatalf("seed leaf: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from taxonomy.categories where id = any($1)`, []string{sectionID, leafID})
	})

	if leaf, err := repo.TaxonomyLeafCategory(ctx, sectionID); err != nil || leaf {
		t.Fatalf("a parent category must not be a leaf: leaf=%v err=%v", leaf, err)
	}
	if leaf, err := repo.TaxonomyLeafCategory(ctx, leafID); err != nil || !leaf {
		t.Fatalf("a child category must be a leaf: leaf=%v err=%v", leaf, err)
	}
	if leaf, err := repo.TaxonomyLeafCategory(ctx, "cat-does-not-exist"); err != nil || leaf {
		t.Fatalf("unknown category must not be a leaf: leaf=%v err=%v", leaf, err)
	}

	// Writing a dish onto the parent header is rejected (no row returned).
	if _, ok, err := repo.UpsertMenu(ctx, SellerMenu{
		VenueID: venueID, DishID: "dish-parent-" + manageID(""), Name: "Wrong", Price: 10,
		SectionID: sectionID, SubCategoryID: sectionID,
	}, sellerID, false); err != nil || ok {
		t.Fatalf("dish on a parent category must be rejected: ok=%v err=%v", ok, err)
	}

	// The same dish under the leaf succeeds and persists the taxonomy link.
	m, ok, err := repo.UpsertMenu(ctx, SellerMenu{
		VenueID: venueID, DishID: "dish-leaf-" + manageID(""), Name: "Mutton Biryani", Price: 240,
		SectionID: sectionID, SubCategoryID: leafID, DietaryType: "NON_VEG",
	}, sellerID, false)
	if err != nil || !ok {
		t.Fatalf("dish on a leaf category: ok=%v err=%v", ok, err)
	}
	if m.SubCategoryID != leafID || m.SectionID != sectionID || m.DietaryType != "NON_VEG" {
		t.Fatalf("taxonomy link not persisted: %+v", m)
	}

	// The seller-scoped list resolves the taxonomy display names for grouping.
	rows, err := repo.SellerMenus(ctx, sellerID, "", venueID)
	if err != nil || len(rows) != 1 {
		t.Fatalf("SellerMenus: err=%v rows=%+v", err, rows)
	}
	if rows[0].SectionName != "ZZ Biryani" || rows[0].SubCategoryName != "ZZ Mutton Biryani" {
		t.Fatalf("taxonomy names not resolved: %+v", rows[0])
	}

	// Publishing the dish makes the public menu read serve the taxonomy placement + names.
	if _, ok, err := repo.SetMenuStatus(ctx, venueID, m.DishID, sellerID, "ACTIVE", false); err != nil || !ok {
		t.Fatalf("publish dish: ok=%v err=%v", ok, err)
	}
	dishes, err := repo.Menu(ctx, venueID)
	if err != nil || len(dishes) != 1 {
		t.Fatalf("public menu read: err=%v dishes=%+v", err, dishes)
	}
	d := dishes[0]
	if d.SectionID != sectionID || d.SubCategoryID != leafID || d.DietaryType != "NON_VEG" {
		t.Fatalf("public menu dropped taxonomy ids: %+v", d)
	}
	if d.SectionName != "ZZ Biryani" || d.SubCategoryName != "ZZ Mutton Biryani" {
		t.Fatalf("public menu dropped taxonomy names: %+v", d)
	}
}

// TestSellerOwnsVenue pins the venue-ownership probe used to stop a seller writing to a foreign shop.
func TestSellerOwnsVenue(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	ownerID := "sel-own-" + manageID("")
	otherID := "sel-own-other-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code)
		values ($1,'Own Probe','O','TN'), ($2,'Own Probe Other','O','TN')`,
		ownerID, otherID); err != nil {
		t.Fatalf("seed sellers: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = any($1)`, []string{ownerID, otherID})
	})

	venueID := "venue-ownprobe-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live)
		values ($1,'FOOD','Own Probe Venue',$2,'TN', true)`, venueID, ownerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, venueID) })

	if ok, err := repo.SellerOwnsVenue(ctx, ownerID, venueID); err != nil || !ok {
		t.Fatalf("owner probe: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.SellerOwnsVenue(ctx, otherID, venueID); err != nil || ok {
		t.Fatalf("foreign probe must be false: ok=%v err=%v", ok, err)
	}
}

// TestSlugDishID pins the server-owned dish id derivation: readable slug + short hash, stable for the
// same name, distinct for different names, and never empty.
func TestSlugDishID(t *testing.T) {
	a := slugDishID("Mutton Biryani")
	b := slugDishID("Mutton Biryani")
	if a != b {
		t.Fatalf("slug not stable: %q vs %q", a, b)
	}
	if !strings.HasPrefix(a, "mutton-biryani-") {
		t.Fatalf("slug missing readable prefix: %q", a)
	}
	if c := slugDishID("Paneer Tikka"); c == a {
		t.Fatalf("different names collided: %q", c)
	}
	if got := slugDishID("தமிழ் உணவு"); got == "" || !strings.Contains(got, "-") {
		t.Fatalf("non-latin name must still yield a usable id: %q", got)
	}
}
