// Package settlement owns the append-only seller settlement ledger and payout records
// (payments.settlement_ledger + payments.payouts, migration 0015). Future service: Go + CockroachDB
// (monolith-breakdown.md §1). Real money is never client-computed. Writes are service_role; the
// public surface is read-only. Money is INT8 paisa in the DB, whole rupees on the wire.
package settlement

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
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
	PayoutID     string `json:"payoutId"`
	SellerID     string `json:"sellerId"`
	Cycle        string `json:"cycle"`
	Amount       int64  `json:"amount"`
	Status       string `json:"status"`
	ScheduledFor string `json:"scheduledFor"`
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
		select payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for
		  from payments.payouts
		 where ($1 = '' or seller_id = $1)
		 order by scheduled_for desc`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Payout{}
	for rows.Next() {
		var (
			p         Payout
			scheduled time.Time
		)
		if err := rows.Scan(&p.PayoutID, &p.SellerID, &p.Cycle, &p.Amount, &p.Status, &scheduled); err != nil {
			return nil, err
		}
		p.Amount /= 100
		p.ScheduledFor = scheduled.UTC().Format(time.RFC3339)
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
	var scheduled time.Time
	err := r.pool.QueryRow(ctx, `
		insert into payments.payouts (payout_id, seller_id, cycle, amount_paisa, status, scheduled_for)
		values ($1,$2,$3,$4,'SCHEDULED',$5::timestamptz)
		returning payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for`,
		p.PayoutID, p.SellerID, p.Cycle, p.Amount*100, p.ScheduledFor).
		Scan(&p.PayoutID, &p.SellerID, &p.Cycle, &p.Amount, &p.Status, &scheduled)
	if err != nil {
		return Payout{}, err
	}
	p.Amount /= 100
	p.ScheduledFor = scheduled.UTC().Format(time.RFC3339)
	return p, nil
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
