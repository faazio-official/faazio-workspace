package pharma

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

func TestVendorPrescriptionFulfillment(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-rx-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Rx Test','O','PHARMA','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	storeID := "store-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'PHARMA','Rx Store',$2,'KA')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	rx, err := repo.Create(ctx, Prescription{UserID: "user-1", VendorID: storeID, Fulfillment: "DELIVERY", Pages: 1})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from pharma.prescriptions where id=$1`, rx.ID) })

	items, err := repo.VendorPrescriptions(ctx, sellerID, "")
	if err != nil || len(items) != 1 {
		t.Fatalf("VendorPrescriptions: err=%v n=%d", err, len(items))
	}

	// Cross-seller status change denied; owner can fulfil.
	if _, ok, err := repo.SetStatus(ctx, rx.ID, "sel-other", "FULFILLED", false); err != nil || ok {
		t.Fatalf("cross-seller rx write must be denied: ok=%v err=%v", ok, err)
	}
	if p, ok, err := repo.SetStatus(ctx, rx.ID, sellerID, "FULFILLED", false); err != nil || !ok || p.Status != "FULFILLED" {
		t.Fatalf("owner fulfil: ok=%v err=%v status=%q", ok, err, p.Status)
	}
}
