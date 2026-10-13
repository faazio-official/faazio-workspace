package catalog

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

func TestSellerProductManagement(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-cat-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Catalog Test','O','MART','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	pid := "prod-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into catalog.products (id, app, category, name, price_paisa, seller_id, status)
		values ($1,'MART','Test','Unit', 12345, $2, 'DRAFT')`, pid, sellerID); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from catalog.products where id=$1`, pid) })

	// Rupees on the wire, paisa in the DB.
	items, err := repo.SellerProducts(ctx, sellerID, "")
	if err != nil || len(items) != 1 {
		t.Fatalf("SellerProducts: err=%v n=%d", err, len(items))
	}
	if items[0].Price != 123 {
		t.Fatalf("price = %d, want 123 (rupees)", items[0].Price)
	}

	// A seller cannot touch another seller's product.
	if _, ok, err := repo.SetProductStatus(ctx, pid, "sel-other", "PENDING_REVIEW", false); err != nil || ok {
		t.Fatalf("cross-seller write must be denied: ok=%v err=%v", ok, err)
	}
	// The owner can submit for review; admin can activate.
	if p, ok, err := repo.SetProductStatus(ctx, pid, sellerID, "PENDING_REVIEW", false); err != nil || !ok || p.Status != "PENDING_REVIEW" {
		t.Fatalf("owner submit: ok=%v err=%v status=%q", ok, err, p.Status)
	}
	if p, ok, err := repo.SetProductStatus(ctx, pid, "", "ACTIVE", true); err != nil || !ok || p.Status != "ACTIVE" {
		t.Fatalf("admin activate: ok=%v err=%v status=%q", ok, err, p.Status)
	}
}
