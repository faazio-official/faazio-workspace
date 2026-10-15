package bookings

import (
	"context"
	"errors"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestSellerBookingOwnershipAndDecision(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, 5000)
	svc := NewService(repo, mockGateway{}, nil, nil)
	ctx := context.Background()

	const uid = "user-manage-test"
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ($1,'M','m@t','0') on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	owner := "sel-own-" + shortID()
	other := "sel-oth-" + shortID()
	storeID := "store-" + shortID()
	for _, s := range []string{owner, other} {
		if _, err := pool.Exec(ctx, `insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code) values ($1,'B','O','FOOD','KA')`, s); err != nil {
			t.Fatalf("seed seller: %v", err)
		}
	}
	if _, err := pool.Exec(ctx, `insert into directory.stores (id, app, name, seller_id, state_code) values ($1,'FOOD','Own',$2,'KA')`, storeID, owner); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from bookings.payments where booking_id in (select id from bookings.tables where vendor_id=$1)`, storeID)
		_, _ = pool.Exec(ctx, `delete from bookings.tables where vendor_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from bookings.venue_configs where vendor_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id in ($1,$2)`, owner, other)
	})

	// A non-owner may not configure the vendor.
	if _, ok, err := repo.UpsertConfig(ctx, contracts.BookingConfig{VendorID: storeID, Enabled: true, TotalSeats: 4}, other, false); err != nil || ok {
		t.Fatalf("cross-seller config must be denied: ok=%v err=%v", ok, err)
	}
	// The owner may.
	if _, ok, err := repo.UpsertConfig(ctx, contracts.BookingConfig{VendorID: storeID, Enabled: true, TotalSeats: 4, OpenTime: "00:00", CloseTime: "23:59"}, owner, false); err != nil || !ok {
		t.Fatalf("owner config: ok=%v err=%v", ok, err)
	}

	b, err := svc.Create(ctx, uid, contracts.Booking{VendorID: storeID, Date: "2026-06-01", Seats: 2})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if b.RazorpayOrderID == "" {
		t.Fatalf("expected an order id on create, got %+v", b)
	}

	items, err := repo.SellerBookings(ctx, owner, "")
	if err != nil || len(items) != 1 {
		t.Fatalf("SellerBookings: n=%d err=%v", len(items), err)
	}
	if _, ok, err := repo.ForSeller(ctx, b.ID, other, false); err != nil || ok {
		t.Fatalf("cross-seller ForSeller must be denied: ok=%v err=%v", ok, err)
	}
	if _, err := svc.Decide(ctx, b.ID, other, "accept", false); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-seller decide must be ErrNotFound, got %v", err)
	}

	// Owner accept captures the payment.
	decided, err := svc.Decide(ctx, b.ID, owner, "accept", false)
	if err != nil || decided.Status != "confirmed" || decided.PaymentStatus != "CAPTURED" {
		t.Fatalf("accept: %+v err=%v", decided, err)
	}

	// Reject path on a second booking refunds with fixed copy (notifier nil).
	b2, err := svc.Create(ctx, uid, contracts.Booking{VendorID: storeID, Date: "2026-06-02", Seats: 1})
	if err != nil {
		t.Fatalf("Create2: %v", err)
	}
	rejected, err := svc.Decide(ctx, b2.ID, owner, "reject", false)
	if err != nil || rejected.Status != "rejected" || rejected.PaymentStatus != "REFUNDED" {
		t.Fatalf("reject: %+v err=%v", rejected, err)
	}

	// Cross-seller vacate is denied.
	if _, ok, err := repo.Vacate(ctx, b.ID, other, false); err != nil || ok {
		t.Fatalf("cross-seller vacate must be denied: ok=%v err=%v", ok, err)
	}
}