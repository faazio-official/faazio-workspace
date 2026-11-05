// Package payouts owns the manual seller payout ledger (payments.settlement_ledger +
// payments.payouts, migrations 0015/0051 + 0077). Razorpay Route is removed: a payout is a
// recorded "Mark as Paid" entry with balance carry-forward, never a transfer. Money is
// server-derived (paisa on the wire); the client never writes a ledger row. Writes are
// service_role; the seller-facing reads are scoped to the token.
package payouts

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// LedgerEntry is one payments.settlement_ledger row (amounts in whole rupees on the wire).
type LedgerEntry struct {
	EntryID     string `json:"entryId"`
	SellerID    string `json:"sellerId"`
	Cycle       string `json:"cycle"`
	OrderValue  int64  `json:"orderValue"`
	Commission  int64  `json:"commission"`
	TCS         int64  `json:"tcs"`
	TDS         int64  `json:"tds"`
	ProductTax  int64  `json:"productTax"`
	PlatformGST int64  `json:"platformGst"`
	NetPayout   int64  `json:"netPayout"`
}

// Payout is one payments.payouts row. PaidAmount accumulates manual "Mark as Paid" entries so an
// unpaid balance (Amount-PaidAmount) carries to the next cycle.
type Payout struct {
	PayoutID     string `json:"payoutId"`
	SellerID     string `json:"sellerId"`
	Cycle        string `json:"cycle"`
	Amount       int64  `json:"amount"`
	PaidAmount   int64  `json:"paidAmount"`
	Balance      int64  `json:"balance"`
	Status       string `json:"status"`
	ScheduledFor string `json:"scheduledFor"`
	PaidBy       string `json:"paidBy,omitempty"`
	PaidAt       string `json:"paidAt,omitempty"`
}

// SellerPayoutSummary is one owed/paid row on the admin payout board. It is computed live from
// delivered checkout orders (gross − commission − TCS − TDS) merged with accumulated payouts.
type SellerPayoutSummary struct {
	SellerID        string `json:"sellerId"`
	BusinessName    string `json:"businessName"`
	StateCode       string `json:"stateCode"`
	DistrictCode    string `json:"districtCode"`
	Cycle           string `json:"cycle"`
	OrderCount      int64  `json:"orderCount"`
	GrossPaisa      int64  `json:"grossPaisa"`
	CommissionPaisa int64  `json:"commissionPaisa"`
	TCSPaisa        int64  `json:"tcsPaisa"`
	TDSPaisa        int64  `json:"tdsPaisa"`
	NetPaisa        int64  `json:"netPaisa"`
	PaidPaisa       int64  `json:"paidPaisa"`
	BalancePaisa    int64  `json:"balancePaisa"`
	Status          string `json:"status"` // PENDING | PARTIAL | PAID
}

// Repo reads/writes the payout tables.
type Repo struct {
	pool *db.Pool
}

// New returns a payout repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

func (r *Repo) ready() error {
	if r.pool == nil {
		return fmt.Errorf("payouts: database not configured")
	}
	return nil
}

// Ledger returns settlement entries for a seller (optionally one cycle).
func (r *Repo) Ledger(ctx context.Context, sellerID, cycle string) ([]LedgerEntry, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		select entry_id, seller_id, cycle, order_value_paisa, commission_paisa, tcs_paisa,
		       tds_paisa, product_tax_paisa, platform_gst_paisa, net_paisa
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
		if err := rows.Scan(&e.EntryID, &e.SellerID, &e.Cycle, &e.OrderValue, &e.Commission, &e.TCS,
			&e.TDS, &e.ProductTax, &e.PlatformGST, &e.NetPayout); err != nil {
			return nil, err
		}
		e.OrderValue /= 100
		e.Commission /= 100
		e.TCS /= 100
		e.TDS /= 100
		e.ProductTax /= 100
		e.PlatformGST /= 100
		e.NetPayout /= 100
		out = append(out, e)
	}
	return out, rows.Err()
}

// Payouts returns a seller's payout records.
func (r *Repo) Payouts(ctx context.Context, sellerID string) ([]Payout, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		select payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		       coalesce(paid_amount_paisa,0), coalesce(paid_by,''), paid_at
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

// Summmary aggregates delivered-order earnings per seller per cycle. commission is derived from
// the seller's vendor store platform_fee_pct applied to the GST-inclusive gross, matching the
// checkout split; TCS/TDS come from the stored order tax columns.
func (r *Repo) Summaries(ctx context.Context, district, state string) ([]SellerPayoutSummary, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		select st.seller_id, coalesce(sl.business_name,''), coalesce(sl.state_code,''),
		       coalesce(sl.district_code,''), to_char(co.placed_at,'YYYY-MM') as cycle,
		       count(*)::bigint,
		       sum(co.total_charged_paisa),
		       round(sum(co.total_charged_paisa) * min(st.platform_fee_pct) / 100.0),
		       sum(co.tcs_paisa), sum(co.tds_paisa),
		       sum(co.total_charged_paisa)
		         - round(sum(co.total_charged_paisa) * min(st.platform_fee_pct) / 100.0)
		         - sum(co.tcs_paisa) - sum(co.tds_paisa),
		       coalesce(pp.paid_paisa,0), coalesce(pp.fully_paid,false)
		  from checkout.orders co
		  join directory.stores st on st.id = co.vendor_store_ids[1]
		  join sellers.sellers sl on sl.seller_id = st.seller_id
		  left join (
		        select seller_id, cycle, coalesce(sum(paid_amount_paisa),0)::bigint as paid_paisa,
		               bool_or(status='PAID') as fully_paid
		          from payments.payouts
		         group by seller_id, cycle
		       ) pp on pp.seller_id = st.seller_id
		          and pp.cycle = to_char(co.placed_at,'YYYY-MM')
		 where co.status = 'Delivered' and co.total_charged_paisa > 0
		   and ($1 = '' or coalesce(sl.district_code,'') = $1)
		   and ($2 = '' or coalesce(sl.state_code,'') = $2)
		 group by st.seller_id, sl.business_name, sl.state_code, sl.district_code, cycle, pp.paid_paisa, pp.fully_paid
		 order by cycle desc, st.seller_id`, district, strings.ToUpper(strings.TrimSpace(state)))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SellerPayoutSummary{}
	for rows.Next() {
		var (
			s       SellerPayoutSummary
			paid    int64
			fully   bool
		)
		if err := rows.Scan(&s.SellerID, &s.BusinessName, &s.StateCode, &s.DistrictCode,
			&s.Cycle, &s.OrderCount, &s.GrossPaisa, &s.CommissionPaisa, &s.TCSPaisa, &s.TDSPaisa,
			&s.NetPaisa, &paid, &fully); err != nil {
			return nil, err
		}
		s.PaidPaisa = paid
		s.BalancePaisa = s.NetPaisa - s.PaidPaisa
		if s.BalancePaisa < 0 {
			s.BalancePaisa = 0
		}
		switch {
		case s.PaidPaisa >= s.NetPaisa && s.PaidPaisa > 0:
			s.Status = "PAID"
		case s.PaidPaisa > 0:
			s.Status = "PARTIAL"
		default:
			s.Status = "PENDING"
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// MarkSellerPayoutPaid records a manual "Mark as Paid" for one seller + cycle. The paid amount may
// be less than the owed amount — the balance carries forward (payouts are additive per cycle via
// the payouts_seller_cycle_idx unique index). The owed amount is recomputed and stored so the
// payout row is self-describing.
func (r *Repo) MarkSellerPayoutPaid(ctx context.Context, sellerID, cycle string, amountPaisa int64, actorID string) (Payout, error) {
	if err := r.ready(); err != nil {
		return Payout{}, err
	}
	if amountPaisa <= 0 {
		return Payout{}, errors.New("payouts: amount must be positive")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Payout{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var owed int64
	// fee source is the store; zero owed (seller has nothing due this cycle) is allowed — the
	// payout row records a manual credit.
	err = tx.QueryRow(ctx, `
		select coalesce(sum(co.total_charged_paisa),0)
		         - coalesce(round(sum(co.total_charged_paisa) * min(st.platform_fee_pct) / 100.0),0)
		         - coalesce(sum(co.tcs_paisa),0) - coalesce(sum(co.tds_paisa),0)
		  from checkout.orders co
		  join directory.stores st on st.id = co.vendor_store_ids[1]
		 where co.status = 'Delivered' and co.total_charged_paisa > 0
		   and st.seller_id = $1 and to_char(co.placed_at,'YYYY-MM') = $2`, sellerID, cycle).Scan(&owed)
	if err != nil {
		return Payout{}, err
	}
	p, err := scanPayout(tx.QueryRow(ctx, `
		insert into payments.payouts
		  (payout_id, seller_id, cycle, amount_paisa, status, scheduled_for,
		   paid_amount_paisa, paid_by, paid_at)
		values ($1,$2,$3,$4,'PAID',now(),$5,$6,now())
		on conflict (seller_id, cycle) do update
		  set paid_amount_paisa = payments.payouts.paid_amount_paisa + excluded.paid_amount_paisa,
		      amount_paisa = excluded.amount_paisa,
		      paid_by = excluded.paid_by, paid_at = now(), status = 'PAID'
		returning payout_id, seller_id, cycle, amount_paisa, status::text, scheduled_for,
		          coalesce(paid_amount_paisa,0), coalesce(paid_by,''), paid_at`,
		"pyt-"+shortID(), sellerID, cycle, owed, amountPaisa, actorID))
	if err != nil {
		return Payout{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Payout{}, err
	}
	return p, nil
}

type payoutScanner interface{ Scan(dest ...any) error }

func scanPayout(row payoutScanner) (Payout, error) {
	var (
		p         Payout
		scheduled time.Time
		paidAt    *time.Time
	)
	if err := row.Scan(&p.PayoutID, &p.SellerID, &p.Cycle, &p.Amount, &p.Status, &scheduled,
		&p.PaidAmount, &p.PaidBy, &paidAt); err != nil {
		return Payout{}, err
	}
	p.Amount /= 100
	p.PaidAmount /= 100
	p.Balance = p.Amount - p.PaidAmount
	if p.Balance < 0 {
		p.Balance = 0
	}
	p.ScheduledFor = scheduled.UTC().Format(time.RFC3339)
	if paidAt != nil {
		p.PaidAt = paidAt.UTC().Format(time.RFC3339)
	}
	return p, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}