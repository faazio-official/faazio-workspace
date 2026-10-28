package checkout

import (
	"context"
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
