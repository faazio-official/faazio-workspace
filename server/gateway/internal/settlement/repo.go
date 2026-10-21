// Package settlement owns the append-only seller settlement ledger and payout records
// (payments.settlement_ledger + payments.payouts, migration 0015). Future service: Go + CockroachDB
// (monolith-breakdown.md §1). Real money is never client-computed. Writes are service_role; the
// public surface is read-only. Money is INT8 paisa in the DB, whole rupees on the wire.
package settlement

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

// LedgerEntry is one payments.settlement_ledger row (amounts in whole rupees).
type LedgerEntry struct {
	EntryID    string `json:"entryId"`
	SellerID   string `json:"sellerId"`
	Cycle      string `json:"cycle"`
	OrderValue int64  `json:"orderValue"`
	Commission int64  `json:"commission"`
	TCS        int64  `json:"tcs"`
	NetPayout  int64  `json:"netPayout"`
}

// Payout is one payments.payouts row (amount in whole rupees).
type Payout struct {
	PayoutID           string `json:"payoutId"`
	SellerID           string `json:"sellerId"`
	Cycle              string `json:"cycle"`
	Amount             int64  `json:"amount"`
	Status             string `json:"status"`
	ScheduledFor       string `json:"scheduledFor"`
	RazorpayTransferID string `json:"razorpayTransferId,omitempty"`
	ReleaseAfter       string `json:"releaseAfter,omitempty"`
	ReleasedAt         string `json:"releasedAt,omitempty"`
}

// Repo reads/writes the settlement tables.
type Repo struct {
	pool *db.Pool
}

// New returns a settlement repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Ledger returns settlement entries for a seller (optionally one cycle).
func (r *Repo) Ledger(ctx context.Context, sellerID, cycle string) ([]LedgerEntry, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("settlement: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select entry_id, seller_id, cycle, order_value_paisa, commission_paisa, tcs_paisa, net_paisa
		  from payments.settlement_ledger
		 where ($1 = '' or seller_id = $1) and ($2 = '' or cycle = $2)
		 order by cycle desc, created_at desc`, sellerID, cycle)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LedgerEntry{}
	for rows.Next() {
		var e LedgerEntry
		if err := rows.Scan(&e.EntryID, &e.SellerID, &e.Cycle, &e.OrderValue, &e.Commission, &e.TCS, &e.NetPayout); err != nil {
			return nil, err
		}
		e.OrderValue /= 100
		e.Commission /= 100
		e.TCS /= 100
		e.NetPayout /= 100
		out = append(out, e)
	}
	return out, rows.Err()
}

// Payouts returns a seller's payout records.
func (r *Repo) Payouts(ctx context.Context, sellerID string) ([]Payout, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("settlement: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		       coalesce(razorpay_transfer_id,''), release_after, released_at
		  from payments.payouts
		 where ($1 = '' or seller_id = $1)
		 order by scheduled_for desc`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Payout{}
	for rows.Next() {
		p, err := scanPayout(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// CreatePayout inserts a SCHEDULED payout (amount in whole rupees).
func (r *Repo) CreatePayout(ctx context.Context, p Payout) (Payout, error) {
	if r.pool == nil {
		return Payout{}, fmt.Errorf("settlement: database not configured")
	}
	p.PayoutID = "pyt-" + shortID()
	p, err := scanPayout(r.pool.QueryRow(ctx, `
		insert into payments.payouts (payout_id, seller_id, cycle, amount_paisa, status, scheduled_for)
		values ($1,$2,$3,$4,'SCHEDULED',$5::timestamptz)
		returning payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		          coalesce(razorpay_transfer_id,''), release_after, released_at`,
		p.PayoutID, p.SellerID, p.Cycle, p.Amount*100, p.ScheduledFor))
	if err != nil {
		return Payout{}, err
	}
	return p, nil
}

// CreateHoldPayout records a Route transfer held for the buyer-protection window (ON_HOLD).
func (r *Repo) CreateHoldPayout(ctx context.Context, p Payout) (Payout, error) {
	if r.pool == nil {
		return Payout{}, fmt.Errorf("settlement: database not configured")
	}
	p.PayoutID = "pyt-" + shortID()
	if p.ScheduledFor == "" {
		p.ScheduledFor = p.ReleaseAfter
	}
	return scanPayout(r.pool.QueryRow(ctx, `
		insert into payments.payouts
		  (payout_id, seller_id, cycle, amount_paisa, status, scheduled_for, razorpay_transfer_id, release_after)
		values ($1,$2,$3,$4,'ON_HOLD',$5::timestamptz,$6,$7::timestamptz)
		returning payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		          coalesce(razorpay_transfer_id,''), release_after, released_at`,
		p.PayoutID, p.SellerID, p.Cycle, p.Amount*100, p.ScheduledFor,
		nullIfEmpty(p.RazorpayTransferID), nullIfEmpty(p.ReleaseAfter)))
}

// DueHolds returns ON_HOLD payouts whose release window has elapsed, oldest first.
func (r *Repo) DueHolds(ctx context.Context, now time.Time, limit int) ([]Payout, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("settlement: database not configured")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx, `
		select payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		       coalesce(razorpay_transfer_id,''), release_after, released_at
		  from payments.payouts
		 where status='ON_HOLD' and release_after is not null and release_after <= $1
		 order by release_after asc
		 limit $2`, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Payout{}
	for rows.Next() {
		p, err := scanPayout(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// PayoutByID returns one payout row.
func (r *Repo) PayoutByID(ctx context.Context, id string) (Payout, bool, error) {
	if r.pool == nil {
		return Payout{}, false, fmt.Errorf("settlement: database not configured")
	}
	p, err := scanPayout(r.pool.QueryRow(ctx, `
		select payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		       coalesce(razorpay_transfer_id,''), release_after, released_at
		  from payments.payouts where payout_id=$1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Payout{}, false, nil
		}
		return Payout{}, false, err
	}
	return p, true, nil
}

// ReleasePayout marks a held payout PAID and stamps released_at.
func (r *Repo) ReleasePayout(ctx context.Context, id string) (Payout, bool, error) {
	if r.pool == nil {
		return Payout{}, false, fmt.Errorf("settlement: database not configured")
	}
	p, err := scanPayout(r.pool.QueryRow(ctx, `
		update payments.payouts set status='PAID', released_at=now()
		 where payout_id=$1 and status='ON_HOLD'
		 returning payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		           coalesce(razorpay_transfer_id,''), release_after, released_at`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Payout{}, false, nil
		}
		return Payout{}, false, err
	}
	return p, true, nil
}

type payoutScanner interface{ Scan(dest ...any) error }

func scanPayout(row payoutScanner) (Payout, error) {
	var (
		p            Payout
		scheduled    time.Time
		releaseAfter *time.Time
		releasedAt   *time.Time
	)
	if err := row.Scan(&p.PayoutID, &p.SellerID, &p.Cycle, &p.Amount, &p.Status, &scheduled,
		&p.RazorpayTransferID, &releaseAfter, &releasedAt); err != nil {
		return Payout{}, err
	}
	p.Amount /= 100
	p.ScheduledFor = scheduled.UTC().Format(time.RFC3339)
	if releaseAfter != nil {
		p.ReleaseAfter = releaseAfter.UTC().Format(time.RFC3339)
	}
	if releasedAt != nil {
		p.ReleasedAt = releasedAt.UTC().Format(time.RFC3339)
	}
	return p, nil
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}

// AddLedgerEntry appends one settlement row (service_role path; amounts in whole rupees).
func (r *Repo) AddLedgerEntry(ctx context.Context, e LedgerEntry) (LedgerEntry, error) {
	if r.pool == nil {
		return LedgerEntry{}, fmt.Errorf("settlement: database not configured")
	}
	e.EntryID = "set-" + shortID()
	_, err := r.pool.Exec(ctx, `
		insert into payments.settlement_ledger
		  (entry_id, seller_id, cycle, order_value_paisa, commission_paisa, tcs_paisa, net_paisa)
		values ($1,$2,$3,$4,$5,$6,$7)`,
		e.EntryID, e.SellerID, e.Cycle, e.OrderValue*100, e.Commission*100, e.TCS*100, e.NetPayout*100)
	if err != nil {
		return LedgerEntry{}, err
	}
	return e, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
