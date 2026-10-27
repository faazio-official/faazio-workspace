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

// LiveAd is the anon-visible LIVE ad projection (display fields only; no performance counters).
type LiveAd struct {
	SlotID    string `json:"slotId"`
	SellerID  string `json:"sellerId"`
	ProductID string `json:"productId"`
	Placement string `json:"placement"`
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

// Live lists LIVE slots, optionally filtered by placement, as the anon-visible projection.
func (r *Repo) Live(ctx context.Context, placement string) ([]LiveAd, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("ads: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select slot_id, seller_id, product_id, placement::text
		  from ads.sponsored_slots
		 where status = 'LIVE' and ($1 = '' or placement::text = $1)
		 order by requested_at desc`, placement)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LiveAd{}
	for rows.Next() {
		var a LiveAd
		if err := rows.Scan(&a.SlotID, &a.SellerID, &a.ProductID, &a.Placement); err != nil {
			return nil, err
		}
		out = append(out, a)
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

// ProductOwnedBy reports whether the catalog product belongs to the seller. A slot may only point
// at the requesting seller's own SKU (it is rendered as that seller's paid placement).
func (r *Repo) ProductOwnedBy(ctx context.Context, productID, sellerID string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("ads: database not configured")
	}
	var ok bool
	err := r.pool.QueryRow(ctx, `
		select exists (
			select 1 from catalog.products where id = $1 and seller_id = $2)`, productID, sellerID).Scan(&ok)
	return ok, err
}

// SellerScope returns a seller's district and parent state so an admin request can be scoped before
// a slot is created.
func (r *Repo) SellerScope(ctx context.Context, sellerID string) (districtCode, stateCode string, ok bool, err error) {
	if r.pool == nil {
		return "", "", false, fmt.Errorf("ads: database not configured")
	}
	err = r.pool.QueryRow(ctx, `
		select coalesce(district_code,''), coalesce(state_code,'')
		  from sellers.sellers where seller_id = $1`, sellerID).Scan(&districtCode, &stateCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", false, nil
		}
		return "", "", false, err
	}
	return districtCode, stateCode, true, nil
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

// RecordEvent increments a slot's impression/click counter. A nil/absent slot is a no-op (the
// caller is best-effort), so the app never breaks on a stale slot id.
func (r *Repo) RecordEvent(ctx context.Context, slotID, event string) error {
	if r.pool == nil {
		return fmt.Errorf("ads: database not configured")
	}
	var col string
	switch event {
	case "impression":
		col = "impressions"
	case "click":
		col = "clicks"
	default:
		return fmt.Errorf("ads: unknown event %q", event)
	}
	// One round-trip touches whichever surface owns the id: rail slots (`ads.sponsored_slots`) or
	// hero campaigns (`ads.campaigns`). Ids never collide (`ad-*` vs `ad-cmp-*`), so the other
	// branch updates zero rows.
	_, err := r.pool.Exec(ctx, `
		with s as (update ads.sponsored_slots set `+col+` = `+col+` + 1 where slot_id = $1),
		     c as (update ads.campaigns set `+col+` = `+col+` + 1 where placement_id = $1)
		select 1`, slotID)
	return err
}

// AttributeOrder increments a slot's attributed-order counter (closed-loop conversion). Implements
// contracts.AdAttributor so checkout can credit the last-clicked slot after an order commits.
func (r *Repo) AttributeOrder(ctx context.Context, slotID string) error {
	if r.pool == nil {
		return fmt.Errorf("ads: database not configured")
	}
	if slotID == "" {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		with s as (update ads.sponsored_slots set orders_attributed = orders_attributed + 1 where slot_id = $1),
		     c as (update ads.campaigns set orders_attributed = orders_attributed + 1 where placement_id = $1)
		select 1`, slotID)
	return err
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
