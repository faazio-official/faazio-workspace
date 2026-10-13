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

	orders, err := repo.SellerOrders(ctx, sellerID, "")
	if err != nil || len(orders) != 1 {
		t.Fatalf("SellerOrders: err=%v n=%d", err, len(orders))
	}
	if orders[0].Status != "Processing" {
		t.Fatalf("stored status = %q, want Processing", orders[0].Status)
	}

	// Cross-seller transition denied.
	if _, ok, err := repo.SetOrderStatus(ctx, orderID, "sel-other", "PACKED", false); err != nil || ok {
		t.Fatalf("cross-seller order write must be denied: ok=%v err=%v", ok, err)
	}
	o, ok, err := repo.SetOrderStatus(ctx, orderID, sellerID, "PACKED", false)
	if err != nil || !ok || o.Status != "PACKED" || o.StatusDate == "" {
		t.Fatalf("owner transition: ok=%v err=%v status=%q date=%q", ok, err, o.Status, o.StatusDate)
	}
}
