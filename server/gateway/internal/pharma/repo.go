// Package pharma serves the prescriptions context. Future service: Go + Postgres
// (monolith-breakdown.md §1). Prescription images live in Supabase Storage (private bucket) as object
// keys — never bytes in Postgres, never URLs, never logged (AGENTS.md security).
//
// The partner quote workflow (W24, db-schema §12.12): a seller enters quote lines, saves them
// (status QUOTED), then flips READY — which requires at least one line, records revealed_at/by and
// only then exposes the customer's phone/address. Every transition is appended to status_history.
package pharma

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

// ErrEmptyQuote is returned when a seller tries to mark an unpriced prescription READY.
var ErrEmptyQuote = errors.New("prescription has no quote items")

// errNoQuote is an internal sentinel for a missing/not-owned prescription.
var errNoQuote = errors.New("pharma: prescription not found")

// QuoteItem is one pharma.quote_items row (money exposed in whole rupees).
type QuoteItem struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Qty       int64  `json:"qty"`
	MRP       int64  `json:"mrp"`
	Price     int64  `json:"price"`
	Discount  int64  `json:"discount"`
	CreatedAt string `json:"createdAt"`
}

// StatusEntry is one pharma.status_history row (append-only transition log).
type StatusEntry struct {
	FromStatus string `json:"fromStatus,omitempty"`
	ToStatus   string `json:"toStatus"`
	ActorID    string `json:"actorId"`
	ActorRole  string `json:"actorRole"`
	CreatedAt  string `json:"createdAt"`
}

// Prescription is a pharma.prescriptions row (owner/full view). ImagePaths are Storage object keys
// (never URLs). Quote + History are attached for the owner view.
type Prescription struct {
	ID          string        `json:"id"`
	UserID      string        `json:"userId"`
	VendorID    string        `json:"vendorId,omitempty"`
	Fulfillment string        `json:"fulfillment,omitempty"`
	Pages       int64         `json:"pages"`
	Note        string        `json:"note,omitempty"`
	ImagePaths  []string      `json:"imagePaths"`
	Status      string        `json:"status"`
	AddressID   string        `json:"addressId,omitempty"`
	QuotedTotal int64         `json:"quotedTotal"`
	RevealedAt  string        `json:"revealedAt,omitempty"`
	RevealedBy  string        `json:"revealedBy,omitempty"`
	Quote       []QuoteItem   `json:"quote"`
	History     []StatusEntry `json:"history,omitempty"`
	CreatedAt   string        `json:"createdAt"`
	UpdatedAt   string        `json:"updatedAt"`
}

// VendorPrescription is the seller-facing projection. It NEVER exposes user_id; contact fields stay
// empty until the prescription is READY/FULFILLED (the audited reveal gate — §12.12).
type VendorPrescription struct {
	ID              string        `json:"id"`
	CustomerName    string        `json:"customerName"`
	Status          string        `json:"status"`
	Fulfillment     string        `json:"fulfillment,omitempty"`
	Pages           int64         `json:"pages"`
	Note            string        `json:"note,omitempty"`
	ImagePaths      []string      `json:"imagePaths"`
	QuotedTotal     int64         `json:"quotedTotal"`
	Quote           []QuoteItem   `json:"quote"`
	History         []StatusEntry `json:"history,omitempty"`
	RevealedAt      string        `json:"revealedAt,omitempty"`
	RevealedBy      string        `json:"revealedBy,omitempty"`
	CreatedAt       string        `json:"createdAt"`
	UpdatedAt       string        `json:"updatedAt"`
	CustomerPhone   string        `json:"customerPhone,omitempty"`
	CustomerAddress string        `json:"customerAddress,omitempty"`
}

// Repo reads/writes pharma.prescriptions + quote_items + status_history.
type Repo struct {
	pool *db.Pool
}

// New returns a pharma repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Create inserts a prescription and returns the persisted row.
func (r *Repo) Create(ctx context.Context, p Prescription) (Prescription, error) {
	if r.pool == nil {
		return Prescription{}, fmt.Errorf("pharma: database not configured")
	}
	var fulfillment any
	if p.Fulfillment == "PICKUP" || p.Fulfillment == "DELIVERY" {
		fulfillment = p.Fulfillment
	}
	p.ID = newRxID()
	if p.ImagePaths == nil {
		p.ImagePaths = []string{}
	}
	var (
		createdAt time.Time
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		insert into pharma.prescriptions (id, user_id, vendor_id, fulfillment, pages, note, image_paths, address_id)
		values ($1,$2,$3,$4,$5,$6,$7,$8)
		returning created_at, updated_at`,
		p.ID, p.UserID, nullIfEmpty(p.VendorID), fulfillment, p.Pages, nullIfEmpty(p.Note), p.ImagePaths,
		nullIfEmpty(p.AddressID)).
		Scan(&createdAt, &updatedAt)
	if err != nil {
		return Prescription{}, err
	}
	p.Status = "RECEIVED"
	p.Quote = []QuoteItem{}
	p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return p, nil
}

// ByUser returns the caller's prescriptions (newest first) with quote lines + status history.
func (r *Repo) ByUser(ctx context.Context, userID string) ([]Prescription, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("pharma: database not configured")
	}
	rows, err := r.pool.Query(ctx, prescriptionSelect+` where user_id = $1 order by created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out, err := scanPrescriptions(rows)
	if err != nil {
		return nil, err
	}
	return r.attachQuoteAndHistory(ctx, out)
}

// ByIDForUser returns one of the caller's own prescriptions (owner-scoped). Returns ok=false for an
// unknown id or a prescription owned by someone else — the row is never exposed cross-user.
func (r *Repo) ByIDForUser(ctx context.Context, id, userID string) (Prescription, bool, error) {
	if r.pool == nil {
		return Prescription{}, false, fmt.Errorf("pharma: database not configured")
	}
	rows, err := r.pool.Query(ctx, prescriptionSelect+` where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return Prescription{}, false, err
	}
	defer rows.Close()
	items, err := scanPrescriptions(rows)
	if err != nil || len(items) == 0 {
		return Prescription{}, false, err
	}
	withQuote, err := r.attachQuoteAndHistory(ctx, items)
	if err != nil {
		return Prescription{}, false, err
	}
	return withQuote[0], true, nil
}

const prescriptionSelect = `
select id, user_id, coalesce(vendor_id,''), coalesce(fulfillment::text,''), pages,
       coalesce(note,''), image_paths, status::text, coalesce(address_id,''),
       quoted_total_paisa / 100, revealed_at, coalesce(revealed_by,''), created_at, updated_at
  from pharma.prescriptions`

// VendorPrescriptions lists prescriptions routed to a seller's stores (admin: all), by status, as a
// PII-redacted projection (name only until READY/FULFILLED).
func (r *Repo) VendorPrescriptions(ctx context.Context, sellerID, district, status string) ([]VendorPrescription, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("pharma: database not configured")
	}
	rows, err := r.pool.Query(ctx, vendorPrescriptionSelect+`
		 where ($1 = '' or exists (
		         select 1 from directory.stores s
		          where s.seller_id = $1 and s.id = p.vendor_id))
		   and ($2 = '' or exists (
		         select 1 from directory.stores s
		          join sellers.sellers se on se.seller_id = s.seller_id
		          where s.id = p.vendor_id and se.district_code = $2))
		   and ($3 = '' or p.status::text = $3)
		 order by p.created_at desc`, sellerID, district, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out, err := scanVendorPrescriptions(rows)
	if err != nil {
		return nil, err
	}
	return r.attachVendorQuoteAndHistory(ctx, out)
}

// VendorPrescriptionByID returns one prescription routed to a seller's stores (admin: any), as the
// same PII-redacted projection as the list. ok=false for an unknown id or a row outside the seller's
// scope — another seller's Rx is never exposed. Used by the portal deep-link view.
func (r *Repo) VendorPrescriptionByID(ctx context.Context, id, sellerID, district string) (VendorPrescription, bool, error) {
	if r.pool == nil {
		return VendorPrescription{}, false, fmt.Errorf("pharma: database not configured")
	}
	rows, err := r.pool.Query(ctx, vendorPrescriptionSelect+`
		 where p.id = $2
		   and (
		       ($1 <> '' and exists (
		          select 1 from directory.stores s
		           where s.seller_id = $1 and s.id = p.vendor_id)) or
		       ($3 <> '' and exists (
		          select 1 from directory.stores s
		           join sellers.sellers se on se.seller_id = s.seller_id
		           where s.id = p.vendor_id and se.district_code = $3)) or
		       ($1 = '' and $3 = ''))`, sellerID, id, district)
	if err != nil {
		return VendorPrescription{}, false, err
	}
	defer rows.Close()
	items, err := scanVendorPrescriptions(rows)
	if err != nil {
		return VendorPrescription{}, false, err
	}
	if len(items) == 0 {
		return VendorPrescription{}, false, nil
	}
	withQuote, err := r.attachVendorQuoteAndHistory(ctx, items)
	if err != nil {
		return VendorPrescription{}, false, err
	}
	return withQuote[0], true, nil
}

// vendorPrescriptionSelect is the shared PII-redacted seller projection. It selects the customer
// name only (never user_id); phone/address are blanked by the CASE until READY/FULFILLED.
const vendorPrescriptionSelect = `
		select p.id, coalesce(u.name, 'Faazio Customer'), p.status::text,
		       coalesce(p.fulfillment::text,''), p.pages, coalesce(p.note,''), p.image_paths,
		       p.quoted_total_paisa / 100, p.revealed_at, coalesce(p.revealed_by,''), p.created_at, p.updated_at,
		       case when p.status in ('READY','FULFILLED') then coalesce(u.phone,'') else '' end,
		       case when p.status in ('READY','FULFILLED') then coalesce(a.address,'') else '' end
		  from pharma.prescriptions p
		  left join checkout.users u on u.user_id = p.user_id
		  left join checkout.addresses a on a.address_id = nullif(p.address_id,'')`

func (r *Repo) attachVendorQuoteAndHistory(ctx context.Context, out []VendorPrescription) ([]VendorPrescription, error) {
	if len(out) == 0 {
		return out, nil
	}
	quotes, err := r.quotesForIDs(ctx, vendorIDs(out))
	if err != nil {
		return nil, err
	}
	hist, err := r.historyForIDs(ctx, vendorIDs(out))
	if err != nil {
		return nil, err
	}
	for i := range out {
		if q, ok := quotes[out[i].ID]; ok {
			out[i].Quote = q
		}
		if h, ok := hist[out[i].ID]; ok {
			out[i].History = h
		}
	}
	return out, nil
}

func scanVendorPrescriptions(rows pgx.Rows) ([]VendorPrescription, error) {
	out := []VendorPrescription{}
	for rows.Next() {
		var (
			v          VendorPrescription
			revealedAt *time.Time
			createdAt  time.Time
			updatedAt  time.Time
		)
		if err := rows.Scan(&v.ID, &v.CustomerName, &v.Status, &v.Fulfillment, &v.Pages, &v.Note,
			&v.ImagePaths, &v.QuotedTotal, &revealedAt, &v.RevealedBy, &createdAt, &updatedAt,
			&v.CustomerPhone, &v.CustomerAddress); err != nil {
			return nil, err
		}
		if revealedAt != nil {
			v.RevealedAt = revealedAt.UTC().Format(time.RFC3339)
		}
		v.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		v.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		v.Quote = []QuoteItem{}
		out = append(out, v)
	}
	return out, rows.Err()
}

// UpsertQuote replaces the seller's quote lines, recomputes the total and advances the status to
// QUOTED (unless already READY/FULFILLED/CANCELLED). Scoped to the seller's own stores or a
// district (strict). Returns ok=false when the prescription is absent or not owned.
func (r *Repo) UpsertQuote(ctx context.Context, id, sellerID, district, actorID, actorRole string, items []QuoteItem) (Prescription, bool, error) {
	if r.pool == nil {
		return Prescription{}, false, fmt.Errorf("pharma: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Prescription{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	fromStatus, err := ownedStatus(ctx, tx, id, sellerID, district)
	if err != nil {
		if errors.Is(err, errNoQuote) {
			return Prescription{}, false, nil
		}
		return Prescription{}, false, err
	}

	if _, err := tx.Exec(ctx, `delete from pharma.quote_items where prescription_id = $1`, id); err != nil {
		return Prescription{}, false, err
	}
	total := int64(0)
	for _, it := range items {
		if _, err := tx.Exec(ctx, `
			insert into pharma.quote_items (id, prescription_id, name, qty, mrp_paisa, price_paisa, discount_paisa)
			values ($1,$2,$3,$4,$5,$6,$7)`,
			newQuoteID(), id, it.Name, it.Qty, it.MRP*100, it.Price*100, it.Discount*100); err != nil {
			return Prescription{}, false, err
		}
		total += it.Qty * (it.Price - it.Discount)
	}
	if total < 0 {
		total = 0
	}
	next := fromStatus
	if fromStatus == "RECEIVED" || fromStatus == "QUOTED" {
		next = "QUOTED"
	}
	if _, err := tx.Exec(ctx, `
		update pharma.prescriptions
		   set quoted_total_paisa = $2, status = $3::prescription_status, updated_at = now()
		 where id = $1`, id, total*100, next); err != nil {
		return Prescription{}, false, err
	}
	if next != fromStatus {
		if err := appendHistory(ctx, tx, id, fromStatus, next, actorID, actorRole); err != nil {
			return Prescription{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Prescription{}, false, err
	}
	p, ok, err := r.byID(ctx, id)
	return p, ok, err
}

// SetStatus advances a prescription's status, scoped to a seller's stores unless admin. READY
// requires at least one quote line and records the reveal (the audited transition to PII access).
// Every change appends a status_history row. Prescription images are PII — the caller must
// invalidate the owner cache key.
func (r *Repo) SetStatus(ctx context.Context, id, sellerID, district, status, actorID, actorRole string) (Prescription, bool, error) {
	if r.pool == nil {
		return Prescription{}, false, fmt.Errorf("pharma: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Prescription{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	fromStatus, err := ownedStatus(ctx, tx, id, sellerID, district)
	if err != nil {
		if errors.Is(err, errNoQuote) {
			return Prescription{}, false, nil
		}
		return Prescription{}, false, err
	}

	// Idempotent no-op: a repeated transition writes no duplicate status_history row and triggers no
	// duplicate notification (the deferred rollback discards the empty tx).
	if fromStatus == status {
		p, ok, err := r.byID(ctx, id)
		return p, ok, err
	}

	if status == "READY" {
		var n int64
		if err := tx.QueryRow(ctx, `select count(*) from pharma.quote_items where prescription_id = $1`, id).Scan(&n); err != nil {
			return Prescription{}, false, err
		}
		if n == 0 {
			return Prescription{}, false, ErrEmptyQuote
		}
	}
	if _, err := tx.Exec(ctx, `
		update pharma.prescriptions
		   set status = $2::prescription_status,
		       revealed_at = case when $2 = 'READY' then now() else revealed_at end,
		       revealed_by = case when $2 = 'READY' then $3 else revealed_by end,
		       updated_at = now()
		 where id = $1`, id, status, actorID); err != nil {
		return Prescription{}, false, err
	}
	if err := appendHistory(ctx, tx, id, fromStatus, status, actorID, actorRole); err != nil {
		return Prescription{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Prescription{}, false, err
	}
	p, ok, err := r.byID(ctx, id)
	return p, ok, err
}

// ScopedStatus returns a prescription's current status within a seller's scope (admin: any).
// ok=false when the row is absent or outside the seller's stores — used for a pre-flight idempotency
// check so a repeated READY never fires a duplicate customer notification.
func (r *Repo) ScopedStatus(ctx context.Context, id, sellerID, district string) (string, bool, error) {
	if r.pool == nil {
		return "", false, fmt.Errorf("pharma: database not configured")
	}
	var status string
	err := r.pool.QueryRow(ctx, `
		select p.status::text from pharma.prescriptions p
		 where p.id = $1
		   and (
		       ($2 <> '' and exists (
		          select 1 from directory.stores s
		           where s.seller_id = $2 and s.id = p.vendor_id)) or
		       ($3 <> '' and exists (
		          select 1 from directory.stores s
		           join sellers.sellers se on se.seller_id = s.seller_id
		           where s.id = p.vendor_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))`, id, sellerID, district).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	return status, true, nil
}

// ImagePathsFor authorises the caller and returns the prescription's Storage object keys.
// The owner, the assigned vendor, or an admin may view them.
func (r *Repo) ImagePathsFor(ctx context.Context, id, userID, sellerID, district string, all bool) ([]string, bool, error) {
	if r.pool == nil {
		return nil, false, fmt.Errorf("pharma: database not configured")
	}
	var paths []string
	err := r.pool.QueryRow(ctx, `
		select image_paths from pharma.prescriptions p
		 where p.id = $1
		   and (p.user_id = $2
		        or $5
		        or ($3 <> '' and exists (
		            select 1 from directory.stores s
		             where s.seller_id = $3 and s.id = p.vendor_id))
		        or ($4 <> '' and exists (
		            select 1 from directory.stores s
		             join sellers.sellers se on se.seller_id = s.seller_id
		             where s.id = p.vendor_id and se.district_code = $4)))`, id, userID, sellerID, district, all).Scan(&paths)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return paths, true, nil
}

func (r *Repo) byID(ctx context.Context, id string) (Prescription, bool, error) {
	rows, err := r.pool.Query(ctx, prescriptionSelect+` where id = $1`, id)
	if err != nil {
		return Prescription{}, false, err
	}
	defer rows.Close()
	items, err := scanPrescriptions(rows)
	if err != nil || len(items) == 0 {
		return Prescription{}, false, err
	}
	withQuote, err := r.attachQuoteAndHistory(ctx, items)
	if err != nil {
		return Prescription{}, false, err
	}
	return withQuote[0], true, nil
}

// ownedStatus locks the row and returns its current status, enforcing seller or district scope
// (strict). Passing neither is the super-admin case. Returns errNoQuote when the row is absent or
// outside the caller's scope.
func ownedStatus(ctx context.Context, tx pgx.Tx, id, sellerID, district string) (string, error) {
	var status string
	err := tx.QueryRow(ctx, `
		select status::text from pharma.prescriptions p
		 where p.id = $1
		   and (
		       ($2 <> '' and exists (
		          select 1 from directory.stores s
		           where s.seller_id = $2 and s.id = p.vendor_id)) or
		       ($3 <> '' and exists (
		          select 1 from directory.stores s
		           join sellers.sellers se on se.seller_id = s.seller_id
		           where s.id = p.vendor_id and se.district_code = $3)) or
		       ($2 = '' and $3 = ''))
		 for update`, id, sellerID, district).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errNoQuote
		}
		return "", err
	}
	return status, nil
}

func appendHistory(ctx context.Context, tx pgx.Tx, id, from, to, actorID, actorRole string) error {
	_, err := tx.Exec(ctx, `
		insert into pharma.status_history (prescription_id, from_status, to_status, actor_id, actor_role)
		values ($1, $2::prescription_status, $3::prescription_status, $4, $5)`,
		id, nullIfEmpty(from), to, actorID, actorRole)
	return err
}

func (r *Repo) attachQuoteAndHistory(ctx context.Context, out []Prescription) ([]Prescription, error) {
	if len(out) == 0 {
		return out, nil
	}
	ids := make([]string, 0, len(out))
	for i := range out {
		ids = append(ids, out[i].ID)
		out[i].Quote = []QuoteItem{}
	}
	quotes, err := r.quotesForIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	hist, err := r.historyForIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		if q, ok := quotes[out[i].ID]; ok {
			out[i].Quote = q
		}
		if h, ok := hist[out[i].ID]; ok {
			out[i].History = h
		}
	}
	return out, nil
}

func (r *Repo) quotesForIDs(ctx context.Context, ids []string) (map[string][]QuoteItem, error) {
	out := map[string][]QuoteItem{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		select id, prescription_id, name, qty, mrp_paisa / 100, price_paisa / 100,
		       discount_paisa / 100, created_at
		  from pharma.quote_items
		 where prescription_id = any($1)
		 order by created_at asc, id asc`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			q         QuoteItem
			rxID      string
			createdAt time.Time
		)
		if err := rows.Scan(&q.ID, &rxID, &q.Name, &q.Qty, &q.MRP, &q.Price, &q.Discount, &createdAt); err != nil {
			return nil, err
		}
		q.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out[rxID] = append(out[rxID], q)
	}
	return out, rows.Err()
}

func (r *Repo) historyForIDs(ctx context.Context, ids []string) (map[string][]StatusEntry, error) {
	out := map[string][]StatusEntry{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		select prescription_id, coalesce(from_status::text,''), to_status::text, actor_id, actor_role, created_at
		  from pharma.status_history
		 where prescription_id = any($1)
		 order by created_at asc, id asc`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			e         StatusEntry
			rxID      string
			createdAt time.Time
		)
		if err := rows.Scan(&rxID, &e.FromStatus, &e.ToStatus, &e.ActorID, &e.ActorRole, &createdAt); err != nil {
			return nil, err
		}
		e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out[rxID] = append(out[rxID], e)
	}
	return out, rows.Err()
}

func scanPrescriptions(rows pgx.Rows) ([]Prescription, error) {
	out := []Prescription{}
	for rows.Next() {
		var (
			p          Prescription
			revealedAt *time.Time
			createdAt  time.Time
			updatedAt  time.Time
		)
		if err := rows.Scan(&p.ID, &p.UserID, &p.VendorID, &p.Fulfillment, &p.Pages, &p.Note,
			&p.ImagePaths, &p.Status, &p.AddressID, &p.QuotedTotal, &revealedAt, &p.RevealedBy,
			&createdAt, &updatedAt); err != nil {
			return nil, err
		}
		if revealedAt != nil {
			p.RevealedAt = revealedAt.UTC().Format(time.RFC3339)
		}
		p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, p)
	}
	return out, rows.Err()
}

func vendorIDs(out []VendorPrescription) []string {
	ids := make([]string, 0, len(out))
	for i := range out {
		ids = append(ids, out[i].ID)
	}
	return ids
}

func newRxID() string {
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	return "RX-" + hex.EncodeToString(b)
}

func newQuoteID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return "qi-" + hex.EncodeToString(b)
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}
