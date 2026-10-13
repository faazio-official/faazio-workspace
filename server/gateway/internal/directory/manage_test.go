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
