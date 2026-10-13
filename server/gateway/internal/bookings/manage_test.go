package bookings

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func manageID(prefix string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func TestSellerBookingModeration(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	sellerID := "sel-bkg-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code)
		values ($1,'Booking Test','O','FOOD','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID) })

	storeID := "store-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code)
		values ($1,'FOOD','Bkg Store',$2,'KA')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	b, err := repo.Create(ctx, "user-1", contracts.Booking{
		VendorID: storeID, RestaurantName: "Bkg Store", Date: "2026-12-01", Time: "19:00", Guests: 2,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from bookings.tables where id=$1`, b.ID) })

	items, err := repo.SellerBookings(ctx, sellerID, "")
	if err != nil || len(items) != 1 {
		t.Fatalf("SellerBookings: err=%v n=%d", err, len(items))
	}

	if _, ok, err := repo.SetStatus(ctx, b.ID, "sel-other", "cancelled", false); err != nil || ok {
		t.Fatalf("cross-seller booking write must be denied: ok=%v err=%v", ok, err)
	}
	if got, ok, err := repo.SetStatus(ctx, b.ID, sellerID, "cancelled", false); err != nil || !ok || got.Status != "cancelled" {
		t.Fatalf("owner cancel: ok=%v err=%v status=%q", ok, err, got.Status)
	}
}
