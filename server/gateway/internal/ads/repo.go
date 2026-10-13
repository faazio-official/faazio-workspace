// Package ads owns sponsored ad slots (ads.sponsored_slots, migration 0015). Future service:
// Go + Postgres (monolith-breakdown.md §1). Sellers request slots and read their own; admins
// moderate. Non-PII business data, cached by slot id. Every mutation is audited.
package ads

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Slot is one ads.sponsored_slots row.
type Slot struct {
	SlotID           string `json:"slotId"`
	SellerID         string `json:"sellerId"`
	ProductID        string `json:"productId"`
	Placement        string `json:"placement"`
	StateCode        string `json:"stateCode,omitempty"`
	Status           string `json:"status"`
	Impressions      int64  `json:"impressions"`
	Clicks           int64  `json:"clicks"`
	OrdersAttributed int64  `json:"ordersAttributed"`
	RequestedAt      string `json:"requestedAt"`
}

// Repo reads/writes the ads schema.
type Repo struct {
	pool *db.Pool
}

// New returns an ads repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const slotSelect = `
	select slot_id, seller_id, product_id, placement::text, coalesce(state_code,''),
	       status::text, impressions, clicks, orders_attributed, requested_at
	  from ads.sponsored_slots`

// List returns slots scoped by seller and/or state.
func (r *Repo) List(ctx context.Context, sellerID, stateCode string) ([]Slot, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("ads: database not configured")
	}
	rows, err := r.pool.Query(ctx, slotSelect+`
		 where ($1 = '' or seller_id = $1) and ($2 = '' or state_code = $2)
		 order by requested_at desc`, sellerID, stateCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Slot{}
	for rows.Next() {
		s, err := scanSlot(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ByID returns one slot.
func (r *Repo) ByID(ctx context.Context, id string) (Slot, bool, error) {
	if r.pool == nil {
		return Slot{}, false, fmt.Errorf("ads: database not configured")
	}
	s, err := scanSlot(r.pool.QueryRow(ctx, slotSelect+` where slot_id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Slot{}, false, nil
		}
		return Slot{}, false, err
	}
	return s, true, nil
}

// Request inserts a REQUESTED slot.
func (r *Repo) Request(ctx context.Context, s Slot) (Slot, error) {
	if r.pool == nil {
		return Slot{}, fmt.Errorf("ads: database not configured")
	}
	s.SlotID = "ad-" + shortID()
	return scanSlot(r.pool.QueryRow(ctx, `
		insert into ads.sponsored_slots (slot_id, seller_id, product_id, placement, state_code)
		values ($1,$2,$3,$4::ad_placement,$5)
		returning slot_id, seller_id, product_id, placement::text, coalesce(state_code,''),
		          status::text, impressions, clicks, orders_attributed, requested_at`,
		s.SlotID, s.SellerID, s.ProductID, s.Placement, nullIfEmpty(s.StateCode)))
}

// SetStatus moderates a slot (REQUESTED/APPROVED/REJECTED/LIVE).
func (r *Repo) SetStatus(ctx context.Context, id, status string) (Slot, bool, error) {
	if r.pool == nil {
		return Slot{}, false, fmt.Errorf("ads: database not configured")
	}
	s, err := scanSlot(r.pool.QueryRow(ctx, `
		update ads.sponsored_slots set status = $2::ad_status
		 where slot_id = $1
		 returning slot_id, seller_id, product_id, placement::text, coalesce(state_code,''),
		           status::text, impressions, clicks, orders_attributed, requested_at`, id, status))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Slot{}, false, nil
		}
		return Slot{}, false, err
	}
	return s, true, nil
}

func scanSlot(row interface{ Scan(...any) error }) (Slot, error) {
	var (
		s           Slot
		requestedAt time.Time
	)
	if err := row.Scan(&s.SlotID, &s.SellerID, &s.ProductID, &s.Placement, &s.StateCode,
		&s.Status, &s.Impressions, &s.Clicks, &s.OrdersAttributed, &requestedAt); err != nil {
		return Slot{}, err
	}
	s.RequestedAt = requestedAt.UTC().Format(time.RFC3339)
	return s, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}
