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
	if err := repo.InsertOrder(ctx, order, lines, key); err != nil {
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
