package checkout

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestOwnsAddress(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	var addressID, userID string
	if err := pool.QueryRow(ctx, `select address_id, user_id from checkout.addresses limit 1`).Scan(&addressID, &userID); err != nil {
		t.Skipf("no seeded addresses: %v", err)
	}

	ok, err := repo.OwnsAddress(ctx, userID, addressID)
	if err != nil || !ok {
		t.Fatalf("owner: ok=%v err=%v", ok, err)
	}
	ok, err = repo.OwnsAddress(ctx, userID+"-other", addressID)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("a different user must not own the address")
	}
}

func TestDeleteAddress(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	// addresses.user_id references checkout.users; seed the caller first.
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ('user-del-test','T','t@t','0') on conflict (user_id) do nothing`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id = 'user-del-test'`) })

	addr, ok, err := repo.UpsertAddress(ctx, "user-del-test", Address{Address: "1 Test Street, Testville"})
	if err != nil || !ok {
		t.Fatalf("upsert: ok=%v err=%v", ok, err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.addresses where address_id = $1`, addr.AddressID) })

	if ok, err := repo.DeleteAddress(ctx, "user-other", addr.AddressID); err != nil || ok {
		t.Fatalf("cross-user delete must be a no-op: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.DeleteAddress(ctx, "user-del-test", addr.AddressID); err != nil || !ok {
		t.Fatalf("owner delete: ok=%v err=%v", ok, err)
	}
	if ok, err := repo.DeleteAddress(ctx, "user-del-test", addr.AddressID); err != nil || ok {
		t.Fatalf("second delete must miss: ok=%v err=%v", ok, err)
	}
}

// The app-reported location persists state/district/pincode and mints the stable customer code once.
// The district's state is derived from the master (never a client pair), and invalid input is
// refused rather than silently stored.
func TestUpdateCustomerLocation(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	var districtCode, stateCode string
	if err := pool.QueryRow(ctx,
		`select district_code, state_code from admins.district_master where is_active limit 1`).
		Scan(&districtCode, &stateCode); err != nil {
		t.Skipf("no district master rows: %v", err)
	}

	uid := "user-loc-" + shortAddrID()
	if _, err := pool.Exec(ctx,
		`insert into checkout.users (user_id, name, email, phone) values ($1,'Loc Test','l@t','+91 98765 43210')`,
		uid); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id=$1`, uid) })

	loc, ok, err := repo.UpdateCustomerLocation(ctx, uid, stateCode, districtCode, "600001")
	if err != nil || !ok {
		t.Fatalf("UpdateCustomerLocation: ok=%v err=%v", ok, err)
	}
	if loc.DistrictCode != strings.ToUpper(districtCode) || loc.StateCode != strings.ToUpper(stateCode) {
		t.Fatalf("district/state not persisted: %+v", loc)
	}
	const wantCode = "fa6000019876543210"
	if loc.CustomerCode != wantCode {
		t.Fatalf("customer code = %q, want %q", loc.CustomerCode, wantCode)
	}

	if _, _, err := repo.UpdateCustomerLocation(ctx, uid, "", "", "12ab"); !errors.Is(err, ErrInvalidPincode) {
		t.Fatalf("invalid pincode err = %v, want ErrInvalidPincode", err)
	}
	if _, _, err := repo.UpdateCustomerLocation(ctx, uid, "", "ZZZZ", ""); !errors.Is(err, ErrUnknownDistrict) {
		t.Fatalf("unknown district err = %v, want ErrUnknownDistrict", err)
	}

	// A later move updates the location columns but keeps the assigned code stable.
	loc2, ok, err := repo.UpdateCustomerLocation(ctx, uid, stateCode, districtCode, "600002")
	if err != nil || !ok {
		t.Fatalf("second UpdateCustomerLocation: ok=%v err=%v", ok, err)
	}
	if loc2.CustomerCode != wantCode || loc2.Pincode != "600002" {
		t.Fatalf("code/pincode after move: %+v", loc2)
	}
}

// A stored point must round-trip, and a partial/out-of-range pair must be refused rather than
// silently stored — delivery pricing and proximity matching both trust a stored point.
func TestUpsertAddressCoordinates(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ('user-geo-test','T','t@t','0') on conflict (user_id) do nothing`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id = 'user-geo-test'`) })
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.addresses where user_id = 'user-geo-test'`) })

	lat, lng := 10.9254, 79.838
	if _, ok, err := repo.UpsertAddress(ctx, "user-geo-test", Address{
		Address: "1 Test Street, Testville", Latitude: &lat, Longitude: &lng,
	}); err != nil || !ok {
		t.Fatalf("upsert with point: ok=%v err=%v", ok, err)
	}

	rows, err := repo.AddressesByUser(ctx, "user-geo-test")
	if err != nil || len(rows) != 1 {
		t.Fatalf("read back: n=%d err=%v", len(rows), err)
	}
	gotLat, gotLng, hasPoint := rows[0].Coordinates()
	if !hasPoint || gotLat != lat || gotLng != lng {
		t.Fatalf("point round-trip = %v,%v ok=%v, want %v,%v", gotLat, gotLng, hasPoint, lat, lng)
	}

	// A lone axis is a bug, not a partial fix.
	if _, _, err := repo.UpsertAddress(ctx, "user-geo-test", Address{
		Address: "2 Test Street", Latitude: &lat,
	}); err == nil {
		t.Fatal("a lone latitude must be rejected")
	}
	// Out-of-range must never reach the table.
	bad := 99.0
	if _, _, err := repo.UpsertAddress(ctx, "user-geo-test", Address{
		Address: "3 Test Street", Latitude: &bad, Longitude: &lng,
	}); err == nil {
		t.Fatal("an out-of-range latitude must be rejected")
	}
}

func TestProvisionUserIDLinksOnFirstLogin(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	authUID := "11111111-2222-3333-4444-555555555555"
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where auth_uid = $1`, authUID) })

	first, err := repo.ProvisionUserID(ctx, authUID, "+919000000001", "otp@t")
	if err != nil || first == "" {
		t.Fatalf("provision: id=%q err=%v", first, err)
	}
	second, err := repo.ProvisionUserID(ctx, authUID, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if second != first {
		t.Fatalf("second provision changed the slug: %q != %q", second, first)
	}
	// Read-only resolution must now find the linked row.
	resolved, err := repo.ResolveUserID(ctx, authUID)
	if err != nil || resolved != first {
		t.Fatalf("resolve: id=%q err=%v", resolved, err)
	}
}

func TestProvisionUserIDAfterDeletionCreatesFreshAccount(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	authUID := "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
	first, err := repo.ProvisionUserID(ctx, authUID, "+919000000002", "after-delete@t")
	if err != nil || first == "" {
		t.Fatalf("initial provision: id=%q err=%v", first, err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from accounts.profile where id = $1`, first)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, first)
	})

	if _, ok, err := repo.DeleteAccount(ctx, first); err != nil || !ok {
		t.Fatalf("delete account: ok=%v err=%v", ok, err)
	}

	second, err := repo.ProvisionUserID(ctx, authUID, "", "")
	if err != nil || second == "" {
		t.Fatalf("provision after deletion: id=%q err=%v", second, err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from accounts.profile where id = $1`, second)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, second)
	})
	if second == first {
		t.Fatalf("re-registration revived the anonymised account: %q", first)
	}
	resolved, err := repo.ResolveUserID(ctx, authUID)
	if err != nil || resolved != second {
		t.Fatalf("resolve after re-registration: id=%q err=%v", resolved, err)
	}
	var deleted bool
	if err := pool.QueryRow(ctx,
		`select deleted_at is not null from checkout.users where user_id = $1`, first).Scan(&deleted); err != nil || !deleted {
		t.Fatalf("old account should stay anonymised: deleted=%v err=%v", deleted, err)
	}
}

// TestDeleteAccountErasesPostedBloodRequestsAndRouteSequence verifies the right-to-erasure paths
// behind account deletion: the user's posted blood.requests rows (with contact/address PII) are
// deleted, and retained delivery routes for a rider linked to the deleted user are purged.
func TestDeleteAccountErasesPostedBloodRequestsAndRouteSequence(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	uid := "user-del-erasure"
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ($1, 'T', 't@t', '0') on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed test user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	brID := "br-del-erasure"
	if _, err := pool.Exec(ctx, `
		insert into blood.requests (id, hospital, city, state, blood_group, units, created_by, contact)
		values ($1, 'H', 'Chennai', 'TN', 'O+', 1, $2, '+91 99999 99999')`, brID, uid); err != nil {
		t.Fatalf("seed blood request: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from blood.requests where id = $1`, brID) })

	riderID := "rider-erasure"
	if _, err := pool.Exec(ctx, `
		insert into delivery.delivery_boys (rider_id, user_id, phone, state_code)
		values ($1, $2, '0', 'TN') on conflict (rider_id) do nothing`, riderID, uid); err != nil {
		t.Fatalf("seed delivery boy: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from delivery.delivery_boys where rider_id = $1`, riderID) })

	dlvID := "dlv-erasure"
	if _, err := pool.Exec(ctx, `
		insert into delivery.delivery_orders (order_id, customer_order_id, store_id, rider_id, route_sequence, status)
		values ($1, 'co-erasure', 'store-x', $2, '["stop-a","stop-b"]'::jsonb, 'ROUTE_COMPLETE')`, dlvID, riderID); err != nil {
		t.Fatalf("seed delivery order: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from delivery.delivery_orders where order_id = $1`, dlvID) })

	if _, ok, err := repo.DeleteAccount(ctx, uid); err != nil || !ok {
		t.Fatalf("DeleteAccount: ok=%v err=%v", ok, err)
	}

	var remaining int
	if err := pool.QueryRow(ctx, `select count(*) from blood.requests where created_by = $1`, uid).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("deleted user's blood.requests should be erased, %d remain", remaining)
	}

	var seq string
	if err := pool.QueryRow(ctx, `select route_sequence::text from delivery.delivery_orders where order_id = $1`, dlvID).Scan(&seq); err != nil {
		t.Fatal(err)
	}
	if seq != "[]" {
		t.Fatalf("route_sequence should be reset, got %s", seq)
	}
}

func TestOrderByIdempotencyKeyMiss(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	if _, found, err := repo.OrderByIdempotencyKey(context.Background(), "user-1", "no-such-key"); err != nil {
		t.Fatal(err)
	} else if found {
		t.Fatal("unexpected idempotency hit")
	}
}

func TestInsertOrderRecordsIdempotency(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	const orderID = "ORD-TEST-IDEM"
	const key = "test-idem-key-abc"
	cleanup := func() {
		_, _ = pool.Exec(ctx, `delete from checkout.order_items where order_id = $1`, orderID)
		_, _ = pool.Exec(ctx, `delete from checkout.idempotency_keys where order_id = $1`, orderID)
		_, _ = pool.Exec(ctx, `delete from checkout.orders where order_id = $1`, orderID)
	}
	cleanup()
	t.Cleanup(cleanup)

	order := Order{ID: orderID, OrderNumber: "#T", UserID: "user-1", Status: "Processing", VendorStoreIDs: []string{}}
	lines := []OrderLineItem{{LineID: orderID + "-l1", ProductID: "fm-m1", Name: "x", Qty: 1, UnitPrice: 100}}
	if err := repo.InsertOrder(ctx, order, lines, key, nil); err != nil {
		t.Fatalf("InsertOrder: %v", err)
	}

	gotID, found, err := repo.OrderByIdempotencyKey(ctx, "user-1", key)
	if err != nil || !found || gotID != orderID {
		t.Fatalf("OrderByIdempotencyKey: id=%q found=%v err=%v", gotID, found, err)
	}
	got, ok, err := repo.OrderByID(ctx, orderID)
	if err != nil || !ok {
		t.Fatalf("OrderByID: ok=%v err=%v", ok, err)
	}
	if len(got.LineItems) != 1 || got.LineItems[0].UnitPrice != 100 {
		t.Fatalf("line items = %+v", got.LineItems)
	}
}

// The admin order boards show the vendor's revenue district, not a city. The projection used to
// alias `admins.district_master.district_name` onto the JSON key `city`, so every "City" column and
// city-mix chart silently rendered district data. The row now carries `districtName` and no `city`.
func TestAdminOrderRowsExposeDistrictNotCity(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "SL-TEST-DIST"
	const districtCode = "PY1" // Karaikal (seeded master)
	cleanup := func() {
		_, _ = pool.Exec(ctx, `delete from checkout.order_items where order_id like 'ORD-TEST-DIST%'`)
		_, _ = pool.Exec(ctx, `delete from checkout.orders where order_id like 'ORD-TEST-DIST%'`)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id = 'store-test-dist'`)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = $1`, sellerID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx,
		`insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		 values ($1, 'Test Seller', 'Test Owner', 'PY', $2)`, sellerID, districtCode); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`insert into directory.stores (id, app, name, seller_id) values ('store-test-dist', 'MART', 'Test Store', $1)`,
		sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}

	order := Order{
		ID: "ORD-TEST-DIST-1", OrderNumber: "#DIST", UserID: "user-1",
		Status: "Processing", VendorStoreIDs: []string{"store-test-dist"},
	}
	lines := []OrderLineItem{{LineID: order.ID + "-l1", ProductID: "fm-m1", Name: "x", Qty: 1, UnitPrice: 100}}
	if err := repo.InsertOrder(ctx, order, lines, "", nil); err != nil {
		t.Fatalf("InsertOrder: %v", err)
	}

	rows, err := repo.AllOrders(ctx, AdminOrderFilter{Limit: 50})
	if err != nil {
		t.Fatalf("AllOrders: %v", err)
	}
	var found *AdminOrderRow
	for i := range rows {
		if rows[i].OrderID == order.ID {
			found = &rows[i]
			break
		}
	}
	if found == nil {
		t.Fatal("seeded order missing from the admin board")
	}
	if found.DistrictName != "Karaikal" {
		t.Fatalf("districtName = %q, want the master district name", found.DistrictName)
	}
	if found.DistrictCode != districtCode {
		t.Fatalf("districtCode = %q, want %q", found.DistrictCode, districtCode)
	}
}

func TestUpdateProfileNameWritesBothIdentityRows(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	const userID = "u-test-profile-name"
	cleanup := func() {
		_, _ = pool.Exec(ctx, `delete from accounts.profile where id = $1`, userID)
		_, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, userID)
	}
	cleanup()
	t.Cleanup(cleanup)

	if _, err := pool.Exec(ctx,
		`insert into checkout.users (user_id, name, email, phone)
		 values ($1, 'Faazio User', '', '+919000000010')`, userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	// No accounts.profile row yet (pre-provision user): the write must create it, not only update.
	p, ok, err := repo.UpdateProfileName(ctx, userID, "  Anitha R  ")
	if err != nil || !ok {
		t.Fatalf("update: ok=%v err=%v", ok, err)
	}
	if p.Name != "Anitha R" {
		t.Fatalf("name = %q, want the trimmed input", p.Name)
	}

	var userName string
	if err := pool.QueryRow(ctx, `select name from checkout.users where user_id = $1`, userID).Scan(&userName); err != nil {
		t.Fatal(err)
	}
	if userName != "Anitha R" {
		t.Fatalf("checkout.users.name = %q, want the same name", userName)
	}

	// GET /profile reads accounts.profile, so the two surfaces must agree after the write.
	got, ok, err := repo.ProfileByUser(ctx, userID)
	if err != nil || !ok || got.Name != "Anitha R" {
		t.Fatalf("profile read-back: %+v ok=%v err=%v", got, ok, err)
	}

	if _, _, err := repo.UpdateProfileName(ctx, userID, "   "); !errors.Is(err, ErrInvalidProfileName) {
		t.Fatalf("empty name err = %v, want ErrInvalidProfileName", err)
	}
	longName := strings.Repeat("x", maxProfileNameRunes+1)
	if _, _, err := repo.UpdateProfileName(ctx, userID, longName); !errors.Is(err, ErrInvalidProfileName) {
		t.Fatalf("over-long name err = %v, want ErrInvalidProfileName", err)
	}
	if _, ok, err := repo.UpdateProfileName(ctx, "u-test-profile-missing", "Someone"); err != nil || ok {
		t.Fatalf("unknown user: ok=%v err=%v, want ok=false", ok, err)
	}
}
