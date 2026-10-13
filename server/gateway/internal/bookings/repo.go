// Package bookings persists dinner/table reservations (bookings.tables) and food order bookings
// (bookings.food_orders). Future service: Go + Postgres (monolith-breakdown.md §1). Both stores were
// previously memory-only; they are unified here so they cannot diverge.
package bookings

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrSlotTaken is returned when a live booking already occupies the (vendor, date, slot) slot.
var ErrSlotTaken = errors.New("bookings: slot already taken")

// Repo reads/writes the bookings schema.
type Repo struct {
	pool *db.Pool
}

// New returns a bookings repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Create inserts a table reservation for userID. Returns ErrSlotTaken on a live double-book.
func (r *Repo) Create(ctx context.Context, userID string, b contracts.Booking) (contracts.Booking, error) {
	if r.pool == nil {
		return contracts.Booking{}, fmt.Errorf("bookings: database not configured")
	}
	b.ID = "BKG-" + shortID()
	b.UserID = userID
	b.Status = "confirmed"
	if b.Guests < 1 {
		b.Guests = 1
	}
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into bookings.tables
		  (id, user_id, vendor_id, restaurant_name, booking_date, slot, guests, status)
		values ($1,$2,$3,$4,$5::date,$6,$7,'confirmed')
		returning created_at`,
		b.ID, b.UserID, b.VendorID, b.RestaurantName, b.Date, b.Time, b.Guests).Scan(&createdAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return contracts.Booking{}, ErrSlotTaken
		}
		return contracts.Booking{}, err
	}
	b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return b, nil
}

// ByUser lists the caller's reservations, newest first.
func (r *Repo) ByUser(ctx context.Context, userID string) ([]contracts.Booking, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("bookings: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, user_id, vendor_id, restaurant_name, booking_date::text, slot, guests, status::text, created_at
		  from bookings.tables where user_id = $1 order by booking_date desc, created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.Booking{}
	for rows.Next() {
		var (
			b         contracts.Booking
			createdAt time.Time
		)
		if err := rows.Scan(&b.ID, &b.UserID, &b.VendorID, &b.RestaurantName, &b.Date, &b.Time, &b.Guests, &b.Status, &createdAt); err != nil {
			return nil, err
		}
		b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, b)
	}
	return out, rows.Err()
}

// Cancel marks a booking cancelled (own rows only). Idempotent.
func (r *Repo) Cancel(ctx context.Context, userID, id string) error {
	if r.pool == nil {
		return fmt.Errorf("bookings: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		update bookings.tables set status = 'cancelled', updated_at = now()
		 where id = $1 and user_id = $2 and status <> 'cancelled'`, id, userID)
	return err
}

// CreateFood inserts a food order booking for userID.
func (r *Repo) CreateFood(ctx context.Context, userID string, f contracts.FoodBooking) (contracts.FoodBooking, error) {
	if r.pool == nil {
		return contracts.FoodBooking{}, fmt.Errorf("bookings: database not configured")
	}
	f.OrderID = "BKG-" + shortID()
	f.UserID = userID
	if f.Guests < 1 {
		f.Guests = 1
	}
	if len(f.Dish) == 0 {
		f.Dish = []byte("{}")
	}
	if f.AddedIDs == nil {
		f.AddedIDs = []string{}
	}
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into bookings.food_orders
		  (order_id, user_id, dish, guests, booking_date, slot, added_ids)
		values ($1,$2,$3::jsonb,$4,$5::date,$6,$7)
		returning created_at`,
		f.OrderID, f.UserID, string(f.Dish), f.Guests, f.Date, f.Time, f.AddedIDs).Scan(&createdAt)
	if err != nil {
		return contracts.FoodBooking{}, err
	}
	f.Timestamp = createdAt.UnixMilli()
	return f, nil
}

// FoodByUser lists the caller's food order bookings, newest first.
func (r *Repo) FoodByUser(ctx context.Context, userID string) ([]contracts.FoodBooking, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("bookings: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select order_id, user_id, dish, guests, booking_date::text, slot, added_ids, created_at
		  from bookings.food_orders where user_id = $1 order by created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.FoodBooking{}
	for rows.Next() {
		var (
			f         contracts.FoodBooking
			dish      []byte
			createdAt time.Time
		)
		if err := rows.Scan(&f.OrderID, &f.UserID, &dish, &f.Guests, &f.Date, &f.Time, &f.AddedIDs, &createdAt); err != nil {
			return nil, err
		}
		f.Dish = dish
		f.Timestamp = createdAt.UnixMilli()
		out = append(out, f)
	}
	return out, rows.Err()
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}