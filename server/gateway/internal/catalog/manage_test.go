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

func TestCreateProduct(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerA := "sel-cat-" + manageID("")
	sellerB := "sel-cat-" + manageID("")
	for _, id := range []string{sellerA, sellerB} {
		if _, err := pool.Exec(ctx, `
			insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code, district_code)
			values ($1,'Catalog Create','O','MART','TN','TCH')`, id); err != nil {
			t.Fatalf("seed seller: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id = any($1)`, []string{sellerA, sellerB})
	})

	storeA := "store-cat-" + manageID("")
	storeB := "store-cat-" + manageID("")
	for id, seller := range map[string]string{storeA: sellerA, storeB: sellerB} {
		if _, err := pool.Exec(ctx, `
			insert into directory.stores (id, app, name, seller_id, state_code, is_live, latitude, longitude)
			values ($1,'MART','Create Store',$2,'TN',true,17.44,78.38)`, id, seller); err != nil {
			t.Fatalf("seed store: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from inventory.stock where product_id in (
			select id from catalog.products where store_id = any($1))`, []string{storeA, storeB})
		_, _ = pool.Exec(ctx, `delete from catalog.products where store_id = any($1)`, []string{storeA, storeB})
		_, _ = pool.Exec(ctx, `delete from directory.stores where id = any($1)`, []string{storeA, storeB})
	})

	input := ProductCreateInput{
		StoreID: storeA, Name: "New Listing", Category: "Test", Desc: "A test listing",
		Price: 199, Unit: "1 pc",
	}
	p, ok, err := repo.CreateProduct(ctx, sellerA, "", input)
	if err != nil || !ok {
		t.Fatalf("create: ok=%v err=%v", ok, err)
	}
	if p.Status != "PENDING_REVIEW" || p.StoreID != storeA || p.SellerID != sellerA || p.Price != 199 {
		t.Fatalf("unexpected projection: %+v", p)
	}
	var (
		qty   int64
		price int64
	)
	if err := pool.QueryRow(ctx, `
		select in_stock_qty, price_paisa from inventory.stock where product_id = $1`, p.ID).
		Scan(&qty, &price); err != nil {
		t.Fatalf("stock row missing: %v", err)
	}
	if qty != 0 || price != 19900 {
		t.Fatalf("stock = qty %d price %d, want 0 / 19900", qty, price)
	}

	// Another seller cannot create under a store they do not own.
	if _, ok, err := repo.CreateProduct(ctx, sellerB, "", input); err != nil || ok {
		t.Fatalf("cross-seller create must be denied: ok=%v err=%v", ok, err)
	}
	// District admins are confined to their district.
	if _, ok, err := repo.CreateProduct(ctx, "", "TCO", input); err != nil || ok {
		t.Fatalf("cross-district create must be denied: ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.CreateProduct(ctx, "", "TCH", input); err != nil || !ok {
		t.Fatalf("district create: ok=%v err=%v", ok, err)
	}
	// MRP cannot sit below the selling price.
	if _, _, err := repo.CreateProduct(ctx, sellerA, "", ProductCreateInput{
		StoreID: storeA, Name: "Bad MRP", Category: "Test", Price: 200, MRP: ptr(100),
	}); err == nil {
		t.Fatal("expected MRP validation error")
	}
}

func ptr(v int64) *int64 { return &v }

func TestSellerProductManagement(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-cat-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code, district_code)
		values ($1,'Catalog Test','O','MART','TN','TCH')`, sellerID); err != nil {
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
	items, err := repo.SellerProducts(ctx, sellerID, "", "")
	if err != nil || len(items) != 1 {
		t.Fatalf("SellerProducts: err=%v n=%d", err, len(items))
	}
	if items[0].Price != 123 {
		t.Fatalf("price = %d, want 123 (rupees)", items[0].Price)
	}
	if items, err := repo.SellerProducts(ctx, "", "TCH", ""); err != nil || len(items) != 1 {
		t.Fatalf("district list: err=%v n=%d", err, len(items))
	}
	if items, err := repo.SellerProducts(ctx, "", "TCO", ""); err != nil || len(items) != 0 {
		t.Fatalf("cross-district list must be empty: err=%v n=%d", err, len(items))
	}
	if _, ok, err := repo.SetProductStatus(ctx, pid, "", "TCO", "PENDING_REVIEW"); err != nil || ok {
		t.Fatalf("cross-district write must be denied: ok=%v err=%v", ok, err)
	}

	// A seller cannot touch another seller's product.
	if _, ok, err := repo.SetProductStatus(ctx, pid, "sel-other", "", "PENDING_REVIEW"); err != nil || ok {
		t.Fatalf("cross-seller write must be denied: ok=%v err=%v", ok, err)
	}
	// The owner can submit for review; admin can activate.
	if p, ok, err := repo.SetProductStatus(ctx, pid, sellerID, "", "PENDING_REVIEW"); err != nil || !ok || p.Status != "PENDING_REVIEW" {
		t.Fatalf("owner submit: ok=%v err=%v status=%q", ok, err, p.Status)
	}
	if p, ok, err := repo.SetProductStatus(ctx, pid, "", "", "ACTIVE"); err != nil || !ok || p.Status != "ACTIVE" {
		t.Fatalf("admin activate: ok=%v err=%v status=%q", ok, err, p.Status)
	}
}
