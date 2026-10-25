package checkout

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

func TestSellerOrderLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-ord-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Order Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	storeID := "store-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'MART','Order Store',$2,'KA')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	orderID := "ORD-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into checkout.orders (order_id, order_number, user_id, placed_at, status, total_paisa, vendor_store_ids)
		values ($1,'#T','user-1', now(), 'Processing', 1000, array[$2])`, orderID, storeID); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.orders where order_id=$1`, orderID) })

	orders, err := repo.SellerOrders(ctx, SellerScope{SellerID: sellerID}, "", "")
	if err != nil || len(orders) != 1 {
		t.Fatalf("SellerOrders: err=%v n=%d", err, len(orders))
	}
	if orders[0].Status != "Processing" {
		t.Fatalf("stored status = %q, want Processing", orders[0].Status)
	}

	// Cross-seller transition denied.
	if _, ok, err := repo.SetOrderStatus(ctx, orderID, SellerScope{SellerID: "sel-other"}, "PACKED"); err != nil || ok {
		t.Fatalf("cross-seller order write must be denied: ok=%v err=%v", ok, err)
	}
	o, ok, err := repo.SetOrderStatus(ctx, orderID, SellerScope{SellerID: sellerID}, "PACKED")
	if err != nil || !ok || o.Status != "PACKED" || o.StatusDate == "" {
		t.Fatalf("owner transition: ok=%v err=%v status=%q date=%q", ok, err, o.Status, o.StatusDate)
	}
}

func TestOrderTrackingOwnerScoped(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	orderID := "ORD-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into checkout.orders (order_id, order_number, user_id, placed_at, status, total_paisa, vendor_store_ids)
		values ($1,'#T','user-1', now(), 'NEW', 1000, '{}')`, orderID); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.orders where order_id=$1`, orderID) })

	// Owner read maps the portal lifecycle back to the mobile vocabulary (NEW -> Processing).
	track, ok, err := repo.OrderTrackingForUser(ctx, orderID, "user-1")
	if err != nil || !ok || track.ID != orderID || track.Status != "Processing" || track.PlacedAt == "" {
		t.Fatalf("tracking: ok=%v err=%v id=%q status=%q placedAt=%q", ok, err, track.ID, track.Status, track.PlacedAt)
	}
	// Cross-user read is denied (no leak of another user's order).
	if _, ok, err := repo.OrderTrackingForUser(ctx, orderID, "user-2"); err != nil || ok {
		t.Fatalf("cross-user tracking must be denied: ok=%v err=%v", ok, err)
	}
}

func TestOrderStatusProjection(t *testing.T) {
	for raw, want := range map[string]string{
		"Processing": "NEW",
		"Shipped":    "SHIPPED",
		"Delivered":  "DELIVERED",
		"Cancelled":  "CANCELLED",
		"NEW":        "NEW",
		"REJECTED":   "REJECTED",
	} {
		if got := portalStatus(raw); got != want {
			t.Fatalf("portalStatus(%q) = %q, want %q", raw, got, want)
		}
	}
	for raw, want := range map[string]string{
		"SHIPPED":   "Shipped",
		"DELIVERED": "Delivered",
		"CANCELLED": "Cancelled",
		"NEW":       "NEW",
		"PACKED":    "PACKED",
	} {
		if got := canonicalOrderStatus(raw); got != want {
			t.Fatalf("canonicalOrderStatus(%q) = %q, want %q", raw, got, want)
		}
	}
}

func TestSellerOrderDistrictScope(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-scope-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Scope Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	storeID := "store-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'MART','Scope Store',$2,'KA')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	orderID := "ORD-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into checkout.orders (order_id, order_number, user_id, placed_at, status, total_paisa, vendor_store_ids)
		values ($1,'#S','user-1', now(), 'Processing', 1000, array[$2])`, orderID, storeID); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.orders where order_id=$1`, orderID) })

	// A district admin in the seller's state (seller has no district) may read the order.
	inState := SellerScope{StateCode: "KA", DistrictCode: "TCH"}
	if _, ok, err := repo.SellerOrderByID(ctx, orderID, inState); err != nil || !ok {
		t.Fatalf("in-state admin read: ok=%v err=%v", ok, err)
	}
	// A district admin outside the seller's state must not see it.
	outOfState := SellerScope{StateCode: "TN", DistrictCode: "MCH"}
	if _, ok, err := repo.SellerOrderByID(ctx, orderID, outOfState); err != nil || ok {
		t.Fatalf("out-of-state admin read must be denied: ok=%v err=%v", ok, err)
	}
	// Passing a sellerId query parameter must not widen an out-of-state admin's scope.
	if orders, err := repo.SellerOrders(ctx, outOfState, "", sellerID); err != nil || len(orders) != 0 {
		t.Fatalf("out-of-state admin list must be empty: n=%d err=%v", len(orders), err)
	}
	// Super admins see everything.
	if _, ok, err := repo.SellerOrderByID(ctx, orderID, SellerScope{SuperAdmin: true}); err != nil || !ok {
		t.Fatalf("super-admin read: ok=%v err=%v", ok, err)
	}
}
