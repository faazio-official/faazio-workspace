package bookings

import (
	"context"
	"errors"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/testenv"
)

func TestBookingLifecycle(t *testing.T) {
	pool := testenv.Pool(t)
	repo := New(pool)
	ctx := context.Background()

	const uid = "user-bookings-test"
	if _, err := pool.Exec(ctx, `insert into checkout.users (user_id, name, email, phone) values ($1, 'T', 't@t', '0') on conflict (user_id) do nothing`, uid); err != nil {
		t.Fatalf("seed test user: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, `delete from checkout.users where user_id = $1`, uid) })

	b, err := repo.Create(ctx, uid, contracts.Booking{VendorID: "v-test", RestaurantName: "Test Bistro", Date: "2026-03-01", Time: "19:00", Guests: 2})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if b.Status != "confirmed" || b.ID == "" {
		t.Fatalf("booking = %+v", b)
	}

	// A second live booking for the same (vendor, date, slot) must conflict.
	if _, err := repo.Create(ctx, uid, contracts.Booking{VendorID: "v-test", Date: "2026-03-01", Time: "19:00", Guests: 1}); !errors.Is(err, ErrSlotTaken) {
		t.Fatalf("expected ErrSlotTaken, got %v", err)
	}

	list, err := repo.ByUser(ctx, uid)
	if err != nil || len(list) != 1 {
		t.Fatalf("ByUser = %+v, err %v", list, err)
	}

	// Cancelling frees the slot.
	if err := repo.Cancel(ctx, uid, b.ID); err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	if _, err := repo.Create(ctx, uid, contracts.Booking{VendorID: "v-test", Date: "2026-03-01", Time: "19:00", Guests: 1}); err != nil {
		t.Fatalf("re-create after cancel: %v", err)
	}

	f, err := repo.CreateFood(ctx, uid, contracts.FoodBooking{Dish: []byte(`{"id":"bd-1"}`), Guests: 2, Date: "2026-03-02", Time: "20:00"})
	if err != nil || f.OrderID == "" {
		t.Fatalf("CreateFood: %+v err %v", f, err)
	}
	food, err := repo.FoodByUser(ctx, uid)
	if err != nil || len(food) != 1 || food[0].Timestamp == 0 {
		t.Fatalf("FoodByUser = %+v, err %v", food, err)
	}
}