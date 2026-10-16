// Package bookings persists seat-based dinner reservations (bookings.tables) and the seller-private
// booking config (bookings.venue_configs) plus the booking-scoped payments ledger (bookings.payments).
// Future service: Go + Postgres (monolith-breakdown.md §1).
//
// `bookings.food_orders` (0011) is a reserved, unseeded table: food-order bookings have no screen or
// gateway route in the MVP (W29 follow-up removed the dead handler/repo/contract).
//
// Money: the DB stores INT8 paisa; this layer is the only conversion boundary and every JSON DTO it
// returns exposes whole rupees (money freeze §4). The per-seat platform fee is a server constant the
// caller can never set — `Create` derives it from the config row, not the request body.
package bookings

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Booking lifecycle / seat rules.
const (
	maxSeatsPerBooking = 30
	defaultOpenTime    = "09:00"
	defaultCloseTime   = "21:00"
)

// holdTTL bounds an un-decided pending hold: after it elapses the held seats stop counting toward
// occupancy (a stale request must not block a slot forever). Decision itself is not blocked by TTL.
const holdTTL = 15 * time.Minute

// ist is the restaurant wall-clock zone for the open/close window (MVP: single-country).
var ist = time.FixedZone("IST", 5*3600+30*60)

// Repo errors surfaced to the handler as stable HTTP codes.
var (
	// ErrBookableClosed: vendor not configured, disabled, paused, outside hours, or zero seats.
	ErrBookableClosed = errors.New("bookings: vendor not accepting bookings")
	// ErrSeatsUnavailable: the requested seats exceed the remaining tracked occupancy.
	ErrSeatsUnavailable = errors.New("bookings: not enough seats")
	// ErrNotPending: decision attempted on a booking that is not awaiting one.
	ErrNotPending = errors.New("bookings: booking is not pending")
)

// Repo reads/writes the bookings schema.
type Repo struct {
	pool     *db.Pool
	feePaisa int64
}

// New returns a bookings repo. feePaisa is the fixed per-seat platform fee (config.BookingFeePaisa).
func New(pool *db.Pool, feePaisa int64) *Repo {
	if feePaisa <= 0 {
		feePaisa = 5000
	}
	return &Repo{pool: pool, feePaisa: feePaisa}
}

// FeePerSeat is the server fee in whole rupees.
func (r *Repo) FeePerSeat() int64 { return r.feePaisa / 100 }

const bookingColumns = `t.id, t.user_id, t.vendor_id, t.restaurant_name, t.booking_date::text,
       t.slot, t.guests, t.seats, t.fee_paisa,
       coalesce(t.razorpay_order_id,''), coalesce(t.razorpay_payment_id,''),
       t.status::text, t.created_at, coalesce(p.status,'')`

const bookingFrom = ` from bookings.tables t
  left join lateral (
    select status from bookings.payments p
     where p.booking_id = t.id order by p.created_at desc limit 1
  ) p on true`

type rowScanner interface{ Scan(dest ...any) error }

func scanBooking(s rowScanner) (contracts.Booking, error) {
	var (
		b         contracts.Booking
		slot      string
		feePaisa  int64
		createdAt time.Time
	)
	if err := s.Scan(
		&b.ID, &b.UserID, &b.VendorID, &b.RestaurantName, &b.Date, &slot, &b.Guests, &b.Seats,
		&feePaisa, &b.RazorpayOrderID, &b.RazorpayPaymentID, &b.Status, &createdAt, &b.PaymentStatus,
	); err != nil {
		return contracts.Booking{}, err
	}
	b.Guests = b.Seats
	b.Fee = feePaisa / 100
	b.AmountPaisa = feePaisa
	b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return b, nil
}

func (r *Repo) byID(ctx context.Context, id string) (contracts.Booking, bool, error) {
	row := r.pool.QueryRow(ctx, `select `+bookingColumns+bookingFrom+` where t.id = $1`, id)
	b, err := scanBooking(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return contracts.Booking{}, false, nil
		}
		return contracts.Booking{}, false, err
	}
	return b, true, nil
}

// Availability is the public, seat-count-free projection of a vendor's config (app-renderable).
func (r *Repo) Availability(ctx context.Context, vendorID string) (contracts.BookingAvailability, error) {
	out := contracts.BookingAvailability{VendorID: vendorID, FeePerSeat: r.FeePerSeat()}
	if r.pool == nil {
		return out, fmt.Errorf("bookings: database not configured")
	}
	cfg, ok, err := r.ConfigByVendor(ctx, vendorID)
	if err != nil {
		return out, err
	}
	if !ok {
		return out, nil
	}
	out.TimingLabel = timingLabel(cfg.OpenTime, cfg.CloseTime)
	out.OpenNow = withinWindow(time.Now(), cfg.OpenTime, cfg.CloseTime)
	out.Bookable = cfg.Enabled && !cfg.Paused && cfg.TotalSeats > 0
	return out, nil
}

// ConfigByVendor reads a vendor's seller-private booking config.
func (r *Repo) ConfigByVendor(ctx context.Context, vendorID string) (contracts.BookingConfig, bool, error) {
	if r.pool == nil {
		return contracts.BookingConfig{}, false, fmt.Errorf("bookings: database not configured")
	}
	cfg, err := r.scanConfig(r.pool.QueryRow(ctx, configSelect+` where vendor_id = $1`, vendorID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return contracts.BookingConfig{}, false, nil
		}
		return contracts.BookingConfig{}, false, err
	}
	return cfg, true, nil
}

const configSelect = `select vendor_id, seller_id, booking_enabled, total_seats, track_occupancy,
       open_time::text, close_time::text, paused, updated_at
  from bookings.venue_configs`

func (r *Repo) scanConfig(s rowScanner) (contracts.BookingConfig, error) {
	var (
		cfg       contracts.BookingConfig
		updatedAt time.Time
	)
	if err := s.Scan(&cfg.VendorID, &cfg.SellerID, &cfg.Enabled, &cfg.TotalSeats, &cfg.TrackOccupancy,
		&cfg.OpenTime, &cfg.CloseTime, &cfg.Paused, &updatedAt); err != nil {
		return contracts.BookingConfig{}, err
	}
	cfg.OpenTime = shortTime(cfg.OpenTime)
	cfg.CloseTime = shortTime(cfg.CloseTime)
	cfg.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return cfg, nil
}

// UpsertConfig writes a vendor's config. A non-admin may only write a vendor they own (a store, a
// dining venue, or an existing config row under their seller_id). Returns ok=false when not owned.
func (r *Repo) UpsertConfig(ctx context.Context, cfg contracts.BookingConfig, sellerID string, admin bool) (contracts.BookingConfig, bool, error) {
	if r.pool == nil {
		return contracts.BookingConfig{}, false, fmt.Errorf("bookings: database not configured")
	}
	if cfg.VendorID == "" {
		return contracts.BookingConfig{}, false, nil
	}
	if !admin {
		owned, err := r.ownsVendor(ctx, sellerID, cfg.VendorID)
		if err != nil {
			return contracts.BookingConfig{}, false, err
		}
		if !owned {
			return contracts.BookingConfig{}, false, nil
		}
	}
	total := cfg.TotalSeats
	if total < 0 {
		total = 0
	}
	if total > 500 {
		total = 500
	}
	open := shortTime(cfg.OpenTime)
	if !validHHMM(open) {
		open = defaultOpenTime
	}
	close := shortTime(cfg.CloseTime)
	if !validHHMM(close) {
		close = defaultCloseTime
	}
	owner := sellerID
	if admin && owner == "" {
		owner = cfg.SellerID
	}
	if owner == "" {
		owner = cfg.SellerID
	}
	out, err := r.scanConfig(r.pool.QueryRow(ctx, `
		insert into bookings.venue_configs
		  (vendor_id, seller_id, booking_enabled, total_seats, track_occupancy, open_time, close_time, paused)
		values ($1,$2,$3,$4,$5,$6::time,$7::time,$8)
		on conflict (vendor_id) do update
		   set booking_enabled = excluded.booking_enabled,
		       total_seats     = excluded.total_seats,
		       track_occupancy = excluded.track_occupancy,
		       open_time       = excluded.open_time,
		       close_time      = excluded.close_time,
		       paused          = excluded.paused,
		       updated_at      = now()
		 where $9 or bookings.venue_configs.seller_id = $2
		returning vendor_id, seller_id, booking_enabled, total_seats, track_occupancy,
		          open_time::text, close_time::text, paused, updated_at`,
		cfg.VendorID, owner, cfg.Enabled, total, cfg.TrackOccupancy, open, close, cfg.Paused, admin))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return contracts.BookingConfig{}, false, nil
		}
		return contracts.BookingConfig{}, false, err
	}
	return out, true, nil
}

func (r *Repo) ownsVendor(ctx context.Context, sellerID, vendorID string) (bool, error) {
	if sellerID == "" {
		return false, nil
	}
	var owned bool
	err := r.pool.QueryRow(ctx, `
		select exists(
		  select 1 from directory.stores        where id = $1 and seller_id = $2
		  union all
		  select 1 from directory.dining_venues where id = $1 and seller_id = $2
		  union all
		  select 1 from bookings.venue_configs  where vendor_id = $1 and seller_id = $2
		)`, vendorID, sellerID).Scan(&owned)
	return owned, err
}

// Create places a pending hold (no payment capture yet). The fee is derived server-side; occupancy
// is checked under a row lock on the config so concurrent requests cannot oversell. Idempotent per
// (user, idempotencyKey): a replay returns the existing booking unchanged.
func (r *Repo) Create(ctx context.Context, userID string, b contracts.Booking) (contracts.Booking, error) {
	if r.pool == nil {
		return contracts.Booking{}, fmt.Errorf("bookings: database not configured")
	}
	if b.IdempotencyKey != "" {
		var existingID string
		err := r.pool.QueryRow(ctx, `
			select id from bookings.tables where user_id = $1 and idempotency_key = $2`,
			userID, b.IdempotencyKey).Scan(&existingID)
		if err == nil {
			existing, ok, err := r.byID(ctx, existingID)
			if err != nil {
				return contracts.Booking{}, err
			}
			if ok {
				return existing, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return contracts.Booking{}, err
		}
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return contracts.Booking{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		enabled bool
		total   int
		track   bool
		open    string
		close   string
		paused  bool
	)
	err = tx.QueryRow(ctx, `
		select booking_enabled, total_seats, track_occupancy, open_time::text, close_time::text, paused
		  from bookings.venue_configs where vendor_id = $1 for update`, b.VendorID).
		Scan(&enabled, &total, &track, &open, &close, &paused)
	if errors.Is(err, pgx.ErrNoRows) {
		return contracts.Booking{}, ErrBookableClosed
	}
	if err != nil {
		return contracts.Booking{}, err
	}
	if !enabled || paused || total <= 0 || !withinWindow(time.Now(), shortTime(open), shortTime(close)) {
		return contracts.Booking{}, ErrBookableClosed
	}

	seats := b.Seats
	if seats < 1 {
		seats = 1
	}
	if seats > maxSeatsPerBooking {
		seats = maxSeatsPerBooking
	}
	if seats > int64(total) {
		return contracts.Booking{}, ErrSeatsUnavailable
	}
	if track {
		var occupied int64
		cutoff := time.Now().Add(-holdTTL)
		if err := tx.QueryRow(ctx, `
			select coalesce(sum(seats), 0) from bookings.tables
			 where vendor_id = $1 and booking_date = $2::date
			   and (status = 'confirmed' or (status = 'pending' and created_at > $3))`,
			b.VendorID, b.Date, cutoff).Scan(&occupied); err != nil {
			return contracts.Booking{}, err
		}
		if int64(total)-occupied < seats {
			return contracts.Booking{}, ErrSeatsUnavailable
		}
	}

	date := strings.TrimSpace(b.Date)
	if date == "" {
		date = time.Now().In(ist).Format("2006-01-02")
	}
	feePaisa := r.feePaisa * seats
	id := "BKG-" + shortID()
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		insert into bookings.tables
		  (id, user_id, vendor_id, restaurant_name, booking_date, slot, guests, seats, fee_paisa, status, idempotency_key)
		values ($1,$2,$3,$4,$5::date,'',$6,$7,$8,'pending',$9)
		returning created_at`,
		id, userID, b.VendorID, b.RestaurantName, date, seats, seats, feePaisa, nullIfEmpty(b.IdempotencyKey)).
		Scan(&createdAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			// Concurrent replay of the same idempotency key: return the winner.
			if b.IdempotencyKey != "" {
				if existing, ok, e := r.byIdempotencyKey(ctx, userID, b.IdempotencyKey); e == nil && ok {
					return existing, nil
				}
			}
		}
		return contracts.Booking{}, err
	}
	if _, err := tx.Exec(ctx, `
		insert into bookings.payments (id, booking_id, user_id, amount_paisa, status)
		values ($1,$2,$3,$4,'CREATED')`, "bpay-"+shortID(), id, userID, feePaisa); err != nil {
		return contracts.Booking{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return contracts.Booking{}, err
	}

	return contracts.Booking{
		ID: id, UserID: userID, VendorID: b.VendorID, RestaurantName: b.RestaurantName,
		Date: date, Seats: seats, Guests: seats,
		Fee: feePaisa / 100, AmountPaisa: feePaisa, Status: "pending", PaymentStatus: "CREATED",
		CreatedAt: createdAt.UTC().Format(time.RFC3339),
	}, nil
}

func (r *Repo) byIdempotencyKey(ctx context.Context, userID, key string) (contracts.Booking, bool, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		select id from bookings.tables where user_id = $1 and idempotency_key = $2`, userID, key).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return contracts.Booking{}, false, nil
		}
		return contracts.Booking{}, false, err
	}
	return r.byID(ctx, id)
}

// AttachOrder links the created Razorpay order to the booking + its ledger row.
func (r *Repo) AttachOrder(ctx context.Context, bookingID, orderID string) error {
	if r.pool == nil {
		return fmt.Errorf("bookings: database not configured")
	}
	if _, err := r.pool.Exec(ctx, `update bookings.tables set razorpay_order_id = $2 where id = $1`, bookingID, orderID); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `update bookings.payments set razorpay_order_id = $2 where booking_id = $1 and status = 'CREATED'`, bookingID, orderID)
	return err
}

// FailPayment marks the booking cancelled and its pending ledger row FAILED (Razorpay order failed).
func (r *Repo) FailPayment(ctx context.Context, bookingID string) error {
	if r.pool == nil {
		return fmt.Errorf("bookings: database not configured")
	}
	if _, err := r.pool.Exec(ctx, `update bookings.payments set status = 'FAILED' where booking_id = $1 and status = 'CREATED'`, bookingID); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `update bookings.tables set status = 'cancelled' where id = $1 and status = 'pending'`, bookingID)
	return err
}

// ByUser lists the caller's reservations, newest first.
func (r *Repo) ByUser(ctx context.Context, userID string) ([]contracts.Booking, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("bookings: database not configured")
	}
	rows, err := r.pool.Query(ctx, `select `+bookingColumns+bookingFrom+`
		 where t.user_id = $1 order by t.booking_date desc, t.created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBookings(rows)
}

// SellerBookings lists reservations at a seller's venues (admin: all), newest first. Ownership
// spans stores, dining venues and an existing config row.
func (r *Repo) SellerBookings(ctx context.Context, sellerID, status string) ([]contracts.Booking, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("bookings: database not configured")
	}
	rows, err := r.pool.Query(ctx, `select `+bookingColumns+bookingFrom+`
		 where ($1 = '' or exists (select 1 from directory.stores s        where s.seller_id = $1 and s.id = t.vendor_id)
		              or exists (select 1 from directory.dining_venues d where d.seller_id = $1 and d.id = t.vendor_id)
		              or exists (select 1 from bookings.venue_configs c  where c.seller_id = $1 and c.vendor_id = t.vendor_id))
		   and ($2 = '' or t.status::text = $2)
		 order by (t.status = 'pending') desc, t.booking_date desc, t.created_at desc`, sellerID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBookings(rows)
}

// ForSeller loads one booking scoped to the seller's venues (or any, when admin).
func (r *Repo) ForSeller(ctx context.Context, id, sellerID string, admin bool) (contracts.Booking, bool, error) {
	if r.pool == nil {
		return contracts.Booking{}, false, fmt.Errorf("bookings: database not configured")
	}
	row := r.pool.QueryRow(ctx, `select `+bookingColumns+bookingFrom+`
		 where t.id = $1
		   and ($2 or exists (select 1 from directory.stores s        where s.seller_id = $3 and s.id = t.vendor_id)
		           or exists (select 1 from directory.dining_venues d where d.seller_id = $3 and d.id = t.vendor_id)
		           or exists (select 1 from bookings.venue_configs c  where c.seller_id = $3 and c.vendor_id = t.vendor_id))`,
		id, admin, sellerID)
	b, err := scanBooking(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return contracts.Booking{}, false, nil
		}
		return contracts.Booking{}, false, err
	}
	return b, true, nil
}

// Decide moves a pending booking to confirmed (accept) or rejected (reject). Returns ErrNotPending
// when the row is no longer awaiting a decision (guards double-decide races).
func (r *Repo) Decide(ctx context.Context, id, status string) (contracts.Booking, error) {
	if r.pool == nil {
		return contracts.Booking{}, fmt.Errorf("bookings: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update bookings.tables set status = $2::booking_status, updated_at = now()
		 where id = $1 and status = 'pending'`, id, status)
	if err != nil {
		return contracts.Booking{}, err
	}
	if tag.RowsAffected() == 0 {
		return contracts.Booking{}, ErrNotPending
	}
	b, _, err := r.byID(ctx, id)
	return b, err
}

// Vacate marks an accepted booking completed (occupancy freed) once the floor clears the party.
func (r *Repo) Vacate(ctx context.Context, id, sellerID string, admin bool) (contracts.Booking, bool, error) {
	if r.pool == nil {
		return contracts.Booking{}, false, fmt.Errorf("bookings: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update bookings.tables t set status = 'completed', updated_at = now()
		 where t.id = $1 and t.status = 'confirmed'
		   and ($2 or exists (select 1 from directory.stores s        where s.seller_id = $3 and s.id = t.vendor_id)
		           or exists (select 1 from directory.dining_venues d where d.seller_id = $3 and d.id = t.vendor_id)
		           or exists (select 1 from bookings.venue_configs c  where c.seller_id = $3 and c.vendor_id = t.vendor_id))`,
		id, admin, sellerID)
	if err != nil {
		return contracts.Booking{}, false, err
	}
	if tag.RowsAffected() == 0 {
		return contracts.Booking{}, false, nil
	}
	b, _, err := r.byID(ctx, id)
	return b, err == nil, err
}

// CancelByUser cancels the caller's own pending/confirmed booking (refund handled by the service).
func (r *Repo) CancelByUser(ctx context.Context, userID, id string) (contracts.Booking, bool, error) {
	if r.pool == nil {
		return contracts.Booking{}, false, fmt.Errorf("bookings: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update bookings.tables set status = 'cancelled', updated_at = now()
		 where id = $1 and user_id = $2 and status in ('pending','confirmed')`, id, userID)
	if err != nil {
		return contracts.Booking{}, false, err
	}
	if tag.RowsAffected() == 0 {
		return contracts.Booking{}, false, nil
	}
	b, _, err := r.byID(ctx, id)
	return b, err == nil, err
}

// AttachPaymentID records the authorized payment id returned by the client checkout callback.
func (r *Repo) AttachPaymentID(ctx context.Context, userID, id, paymentID string) (contracts.Booking, bool, error) {
	if r.pool == nil {
		return contracts.Booking{}, false, fmt.Errorf("bookings: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update bookings.tables set razorpay_payment_id = $3, updated_at = now()
		 where id = $1 and user_id = $2`, id, userID, paymentID)
	if err != nil {
		return contracts.Booking{}, false, err
	}
	if tag.RowsAffected() == 0 {
		return contracts.Booking{}, false, nil
	}
	if _, err := r.pool.Exec(ctx, `
		update bookings.payments set razorpay_payment_id = $2, updated_at = now()
		 where booking_id = $1 and status in ('CREATED','AUTHORIZED')`, id, paymentID); err != nil {
		return contracts.Booking{}, false, err
	}
	b, _, err := r.byID(ctx, id)
	return b, err == nil, err
}

// SetPaymentStatus updates the latest ledger row for a booking (accept → CAPTURED, reject → REFUNDED).
func (r *Repo) SetPaymentStatus(ctx context.Context, bookingID, status, paymentID string) error {
	if r.pool == nil {
		return fmt.Errorf("bookings: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		update bookings.payments
		   set status = $2, razorpay_payment_id = coalesce(nullif($3,''), razorpay_payment_id), updated_at = now()
		 where id = (select id from bookings.payments where booking_id = $1 order by created_at desc limit 1)`,
		bookingID, status, paymentID)
	return err
}

// MarkWebhook applies a signature-verified Razorpay event to the ledger, matching by order id
// (payment events) or payment id (refund events). Idempotent: a replayed event rewrites the row.
func (r *Repo) MarkWebhook(ctx context.Context, orderID, paymentID, status string) error {
	if r.pool == nil {
		return fmt.Errorf("bookings: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		update bookings.payments
		   set status = $3, razorpay_payment_id = coalesce(nullif($2,''), razorpay_payment_id), updated_at = now()
		 where ($1 <> '' and razorpay_order_id = $1)
		    or ($2 <> '' and razorpay_payment_id = $2)`, orderID, paymentID, status)
	return err
}

func scanBookings(rows pgx.Rows) ([]contracts.Booking, error) {
	out := []contracts.Booking{}
	for rows.Next() {
		b, err := scanBooking(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------- helpers

// withinWindow reports whether now (IST) falls in [open, close); a window crossing midnight is
// handled. An unparseable window never blocks bookings.
func withinWindow(now time.Time, open, close string) bool {
	om, ok1 := parseHHMM(open)
	cm, ok2 := parseHHMM(close)
	if !ok1 || !ok2 {
		return true
	}
	t := now.In(ist)
	m := t.Hour()*60 + t.Minute()
	if cm <= om {
		return m >= om || m < cm
	}
	return m >= om && m < cm
}

func timingLabel(open, close string) string {
	if !validHHMM(open) || !validHHMM(close) {
		return ""
	}
	return shortTime(open) + " – " + shortTime(close)
}

func parseHHMM(v string) (int, bool) {
	v = shortTime(v)
	parts := strings.Split(v, ":")
	if len(parts) != 2 {
		return 0, false
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}

func validHHMM(v string) bool {
	_, ok := parseHHMM(v)
	return ok
}

// shortTime trims a Postgres `time` text value ("09:00:00") to "HH:MM".
func shortTime(v string) string {
	v = strings.TrimSpace(v)
	if len(v) >= 5 {
		return v[:5]
	}
	return v
}

func nullIfEmpty(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}