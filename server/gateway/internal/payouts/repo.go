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

// PayoutInvoice is one payments.payout_invoices row — the separate B2B settlement document for a
// manual "Mark as Paid" event, distinct from the per-order tax invoice (tax.tax_invoices). Amounts
// are in paisa on the wire (the seller portal renders rupees).
type PayoutInvoice struct {
	PayoutInvoiceID string `json:"payoutInvoiceId"`
	PayoutID        string `json:"payoutId"`
	SellerID        string `json:"sellerId"`
	Cycle           string `json:"cycle"`
	InvoiceNumber   string `json:"invoiceNumber"`
	GrossPaisa      int64  `json:"grossPaisa"`
	CommissionPaisa int64  `json:"commissionPaisa"`
	TCSPaisa        int64  `json:"tcsPaisa"`
	TDSPaisa        int64  `json:"tdsPaisa"`
	NetPaisa        int64  `json:"netPaisa"`
	PaidAmountPaisa int64  `json:"paidAmountPaisa"`
	BalancePaisa    int64  `json:"balancePaisa"`
	GeneratedAt     string `json:"generatedAt,omitempty"`
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
	// PayoutID is the cycle's accumulated payout row id (stable across partial payments; the
	// upsert keeps the first id), used by the board to link the separate payout invoice (0078).
	PayoutID string `json:"payoutId,omitempty"`
}

// ErrAboveBalance is returned when a "Mark as Paid" amount exceeds the seller's outstanding net
// balance for the cycle. The admin UI caps the input, so this only fires on a race/override.
var ErrAboveBalance = errors.New("payouts: amount exceeds outstanding balance")

// sellerEarningsCTE aggregates delivered order earnings to the store level. Each plotted line is
// attributed to its own vendor store's platform_fee_pct (0078 store_id), so multi-store orders are
// charged the correct per-store fee instead of guessing from vendor_store_ids[1]. Order-level TCS
// and TDS are allocated to each seller proportionally to their gross share of the order.
const sellerEarningsCTE = `
with seller_lines as (
  select st.seller_id,
         coalesce(sl.business_name, '') as business_name,
         coalesce(sl.state_code, '') as state_code,
         coalesce(sl.district_code, '') as district_code,
         to_char(o.placed_at, 'YYYY-MM') as cycle,
         o.order_id,
         sum(oi.unit_price_paisa * oi.qty)::bigint as gross_paisa,
         round(sum(oi.unit_price_paisa * oi.qty) * coalesce(st.platform_fee_pct, 0) / 100.0)::bigint as commission_paisa
    from checkout.order_items oi
    join checkout.orders o on o.order_id = oi.order_id
    join directory.stores st on st.id = oi.store_id
    join sellers.sellers sl on sl.seller_id = st.seller_id
   where o.status = 'Delivered' and o.total_charged_paisa > 0
     and oi.store_id is not null
     and st.seller_id is not null and st.seller_id <> ''
   group by st.id, st.platform_fee_pct, st.seller_id, sl.business_name, sl.state_code,
            sl.district_code, to_char(o.placed_at, 'YYYY-MM'), o.order_id
),
order_gross as (
  select o.order_id,
         sum(oi.unit_price_paisa * oi.qty)::bigint as gross_paisa
    from checkout.order_items oi
    join checkout.orders o on o.order_id = oi.order_id
    join directory.stores st on st.id = oi.store_id
   where o.status = 'Delivered' and o.total_charged_paisa > 0
     and oi.store_id is not null
   group by o.order_id
)
`

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

// Summaries aggregates delivered-order earnings per seller per cycle from the per-store line
// breakdown (0078): store A's 10% platform fee applies to store A's lines, store B's 15% to store
// B's lines, and order-level TCS/TDS are split by each seller's gross share of the order. Merged
// with accumulated manual payouts so the board shows owed → paid → balance.
func (r *Repo) Summaries(ctx context.Context, district, state string) ([]SellerPayoutSummary, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, sellerEarningsCTE+`
		select s.seller_id, max(s.business_name), max(s.state_code), max(s.district_code), s.cycle,
		       count(distinct s.order_id)::bigint,
		       sum(s.gross_paisa),
		       sum(s.commission_paisa),
		       sum(round(o.tcs_paisa * s.gross_paisa::numeric / nullif(og.gross_paisa, 0)))::bigint,
		       sum(round(o.tds_paisa * s.gross_paisa::numeric / nullif(og.gross_paisa, 0)))::bigint,
		       sum(s.gross_paisa) - sum(s.commission_paisa)
		         - sum(round(o.tcs_paisa * s.gross_paisa::numeric / nullif(og.gross_paisa, 0)))
		         - sum(round(o.tds_paisa * s.gross_paisa::numeric / nullif(og.gross_paisa, 0)))::bigint,
		       coalesce(pp.paid_paisa, 0), coalesce(pp.fully_paid, false),
		       coalesce(min(pp.payout_id), '')
		  from seller_lines s
		  join checkout.orders o on o.order_id = s.order_id
		  join order_gross og on og.order_id = s.order_id
		  left join (
		        select seller_id, cycle, coalesce(sum(paid_amount_paisa),0)::bigint as paid_paisa,
		               bool_or(status='PAID') as fully_paid,
		               min(payout_id) as payout_id
		          from payments.payouts
		         group by seller_id, cycle
		       ) pp on pp.seller_id = s.seller_id
		          and pp.cycle = s.cycle
		 where ($1 = '' or s.district_code = $1)
		   and ($2 = '' or s.state_code = $2)
		 group by s.seller_id, s.cycle, pp.paid_paisa, pp.fully_paid
		 order by s.cycle desc, s.seller_id`, district, strings.ToUpper(strings.TrimSpace(state)))
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
			&s.NetPaisa, &paid, &fully, &s.PayoutID); err != nil {
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
// the payouts_seller_cycle_idx unique index). The owed amount is recomputed per store (0078) and
// stored so the payout row is self-describing. Payment is capped at the outstanding net balance
// (ErrAboveBalance when exceeded), and a separate payout invoice (payments.payout_invoices) is
// created for the event.
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

	// Per-store attribution (same CTE as the board): each store's fee applies to its own lines and
	// order-level TCS/TDS are split by gross share. Zero owed (seller has nothing due this cycle) is
	// allowed so a manual credit can still be recorded.
	var gross, commission, tcs, tds int64
	err = tx.QueryRow(ctx, sellerEarningsCTE+`
		select coalesce(sum(s.gross_paisa), 0)::bigint,
		       coalesce(sum(s.commission_paisa), 0)::bigint,
		       coalesce(sum(round(o.tcs_paisa * s.gross_paisa::numeric / nullif(og.gross_paisa, 0))), 0)::bigint,
		       coalesce(sum(round(o.tds_paisa * s.gross_paisa::numeric / nullif(og.gross_paisa, 0))), 0)::bigint
		  from seller_lines s
		  join checkout.orders o on o.order_id = s.order_id
		  join order_gross og on og.order_id = s.order_id
		 where s.seller_id = $1 and s.cycle = $2`, sellerID, cycle).Scan(&gross, &commission, &tcs, &tds)
	if err != nil {
		return Payout{}, err
	}
	owed := gross - commission - tcs - tds
	if owed < 0 {
		owed = 0
	}
	var paidAlready int64
	if err := tx.QueryRow(ctx, `
		select coalesce(paid_amount_paisa, 0) from payments.payouts
		 where seller_id = $1 and cycle = $2`, sellerID, cycle).Scan(&paidAlready); err != nil {
		return Payout{}, err
	}
	if balance := owed - paidAlready; amountPaisa > balance {
		return Payout{}, ErrAboveBalance
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
	// The separate B2B payout invoice (0078): one per Mark-as-Paid event, distinct from the
	// per-order tax invoice. pdf_key stays empty until a rendered PDF exists.
	if _, err := tx.Exec(ctx, `
		insert into payments.payout_invoices
		  (payout_invoice_id, payout_id, seller_id, cycle, invoice_number,
		   gross_paisa, commission_paisa, tcs_paisa, tds_paisa, net_paisa, paid_amount_paisa)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		"pinv-"+shortID(), p.PayoutID, sellerID, cycle,
		"PINV-"+strings.ReplaceAll(cycle, "-", "")+"-"+shortID(),
		gross, commission, tcs, tds, owed, amountPaisa); err != nil {
		return Payout{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Payout{}, err
	}
	return p, nil
}

// PayoutInvoices returns the payout invoices for one payout id (superadmin download). PDF keys are
// intentionally not serialized — the portal renders the invoice JSON natively until a PDF exists.
func (r *Repo) PayoutInvoices(ctx context.Context, payoutID string) ([]PayoutInvoice, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	return r.queryInvoices(ctx, payoutID, "")
}

// PayoutInvoicesForSeller returns the payout invoices for one payout id the caller's seller owns
// (seller-facing download; the seller_id filter prevents cross-account reads).
func (r *Repo) PayoutInvoicesForSeller(ctx context.Context, sellerID, payoutID string) ([]PayoutInvoice, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	return r.queryInvoices(ctx, payoutID, sellerID)
}

func (r *Repo) queryInvoices(ctx context.Context, payoutID, sellerID string) ([]PayoutInvoice, error) {
	rows, err := r.pool.Query(ctx, `
		select payout_invoice_id, payout_id, seller_id, cycle, invoice_number,
		       gross_paisa, commission_paisa, tcs_paisa, tds_paisa, net_paisa, paid_amount_paisa, generated_at
		  from payments.payout_invoices
		 where payout_id = $1 and ($2 = '' or seller_id = $2)
		 order by generated_at desc`, payoutID, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PayoutInvoice{}
	for rows.Next() {
		var (
			pi  PayoutInvoice
			gen time.Time
		)
		if err := rows.Scan(&pi.PayoutInvoiceID, &pi.PayoutID, &pi.SellerID, &pi.Cycle,
			&pi.InvoiceNumber, &pi.GrossPaisa, &pi.CommissionPaisa, &pi.TCSPaisa, &pi.TDSPaisa,
			&pi.NetPaisa, &pi.PaidAmountPaisa, &gen); err != nil {
			return nil, err
		}
		pi.BalancePaisa = pi.NetPaisa - pi.PaidAmountPaisa
		if pi.BalancePaisa < 0 {
			pi.BalancePaisa = 0
		}
		pi.GeneratedAt = gen.UTC().Format(time.RFC3339)
		out = append(out, pi)
	}
	return out, rows.Err()
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