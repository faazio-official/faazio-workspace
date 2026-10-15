package bookings

import (
	"context"
	"errors"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestBookingSeatLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, 5000)
	ctx := context.Background()

	const uid = "user-seats-test"
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ($1,'T','t@t','0') on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	sellerID := "sel-seat-" + shortID()
	storeID := "store-" + shortID()
	if _, err := pool.Exec(ctx, `insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code) values ($1,'Seat Test','O','FOOD','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	if _, err := pool.Exec(ctx, `insert into directory.stores (id, app, name, seller_id, state_code) values ($1,'FOOD','Seat Store',$2,'KA')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from bookings.payments where booking_id in (select id from bookings.tables where vendor_id=$1)`, storeID)
		_, _ = pool.Exec(ctx, `delete from bookings.tables where vendor_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from bookings.venue_configs where vendor_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID)
	})

	if _, ok, err := repo.UpsertConfig(ctx, contracts.BookingConfig{
		VendorID: storeID, Enabled: true, TotalSeats: 3, TrackOccupancy: true, OpenTime: "00:00", CloseTime: "23:59",
	}, sellerID, false); err != nil || !ok {
		t.Fatalf("UpsertConfig: ok=%v err=%v", ok, err)
	}

	av, err := repo.Availability(ctx, storeID)
	if err != nil || !av.Bookable || av.FeePerSeat != 50 {
		t.Fatalf("Availability = %+v err=%v", av, err)
	}

	// Idempotent replay returns the same row.
	b, err := repo.Create(ctx, uid, contracts.Booking{VendorID: storeID, Date: "2026-05-01", Seats: 2, IdempotencyKey: "idem-1"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if b.Status != "pending" || b.Seats != 2 || b.Fee != 100 || b.AmountPaisa != 10000 {
		t.Fatalf("booking = %+v", b)
	}
	again, err := repo.Create(ctx, uid, contracts.Booking{VendorID: storeID, Date: "2026-05-01", Seats: 2, IdempotencyKey: "idem-1"})
	if err != nil || again.ID != b.ID {
		t.Fatalf("idempotent replay: id=%q vs %q err=%v", again.ID, b.ID, err)
	}

	// Oversell: 2 held of 3 → a request for 2 more must conflict.
	if _, err := repo.Create(ctx, uid, contracts.Booking{VendorID: storeID, Date: "2026-05-01", Seats: 2}); !errors.Is(err, ErrSeatsUnavailable) {
		t.Fatalf("expected ErrSeatsUnavailable, got %v", err)
	}

	// Accept captures, then vacate completes.
	decided, err := repo.Decide(ctx, b.ID, "confirmed")
	if err != nil || decided.Status != "confirmed" {
		t.Fatalf("Decide accept: %+v err=%v", decided, err)
	}
	if _, err := repo.Decide(ctx, b.ID, "rejected"); !errors.Is(err, ErrNotPending) {
		t.Fatalf("double decide must be ErrNotPending, got %v", err)
	}
	if _, ok, err := repo.Vacate(ctx, b.ID, sellerID, false); err != nil || !ok {
		t.Fatalf("Vacate: ok=%v err=%v", ok, err)
	}
	if got, _, _ := repo.ForSeller(ctx, b.ID, sellerID, false); got.Status != "completed" {
		t.Fatalf("status after vacate = %q", got.Status)
	}
}

func TestBookingUntrackedAndClosed(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool, 5000)
	ctx := context.Background()

	const uid = "user-seats-test2"
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ($1,'T2','t2@t','0') on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	sellerID := "sel-seat2-" + shortID()
	storeID := "store-" + shortID()
	if _, err := pool.Exec(ctx, `insert into sellers.sellers (seller_id, business_name, owner_name, category, state_code) values ($1,'Seat2','O','FOOD','KA')`, sellerID); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	if _, err := pool.Exec(ctx, `insert into directory.stores (id, app, name, seller_id, state_code) values ($1,'FOOD','Seat2',$2,'KA')`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from bookings.payments where booking_id in (select id from bookings.tables where vendor_id=$1)`, storeID)
		_, _ = pool.Exec(ctx, `delete from bookings.tables where vendor_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from bookings.venue_configs where vendor_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID)
	})

	// Un-tracked: two full-capacity holds both succeed (no occupancy decrement).
	if _, ok, err := repo.UpsertConfig(ctx, contracts.BookingConfig{
		VendorID: storeID, Enabled: true, TotalSeats: 5, TrackOccupancy: false, OpenTime: "00:00", CloseTime: "23:59",
	}, sellerID, false); err != nil || !ok {
		t.Fatalf("UpsertConfig: ok=%v err=%v", ok, err)
	}
	for i := 0; i < 2; i++ {
		if _, err := repo.Create(ctx, uid, contracts.Booking{VendorID: storeID, Date: "2026-05-02", Seats: 5}); err != nil {
			t.Fatalf("untracked create #%d: %v", i, err)
		}
	}

	// Paused vendor is closed to new requests.
	if _, ok, err := repo.UpsertConfig(ctx, contracts.BookingConfig{
		VendorID: storeID, Enabled: true, TotalSeats: 5, TrackOccupancy: false, Paused: true, OpenTime: "00:00", CloseTime: "23:59",
	}, sellerID, false); err != nil || !ok {
		t.Fatalf("UpsertConfig paused: ok=%v err=%v", ok, err)
	}
	if _, err := repo.Create(ctx, uid, contracts.Booking{VendorID: storeID, Date: "2026-05-02", Seats: 1}); !errors.Is(err, ErrBookableClosed) {
		t.Fatalf("paused create must be ErrBookableClosed, got %v", err)
	}

	// Unknown vendor is not bookable.
	if _, err := repo.Create(ctx, uid, contracts.Booking{VendorID: "vendor-missing", Date: "2026-05-02", Seats: 1}); !errors.Is(err, ErrBookableClosed) {
		t.Fatalf("unknown vendor must be ErrBookableClosed, got %v", err)
	}
}