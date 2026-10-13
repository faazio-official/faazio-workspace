// Package pharma serves the prescriptions context. Future service: Go + Postgres
// (monolith-breakdown.md §1). Prescription images live in Supabase Storage (private bucket) as object
// keys — never bytes in Postgres, never URLs, never logged (AGENTS.md security).
package pharma

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Prescription is a pharma.prescriptions row. ImagePaths are Storage object keys (never URLs).
type Prescription struct {
	ID          string   `json:"id"`
	UserID      string   `json:"userId"`
	VendorID    string   `json:"vendorId,omitempty"`
	Fulfillment string   `json:"fulfillment,omitempty"`
	Pages       int64    `json:"pages"`
	Note        string   `json:"note,omitempty"`
	ImagePaths  []string `json:"imagePaths"`
	Status      string   `json:"status"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

// Repo reads/writes pharma.prescriptions.
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
		insert into pharma.prescriptions (id, user_id, vendor_id, fulfillment, pages, note, image_paths)
		values ($1,$2,$3,$4,$5,$6,$7)
		returning created_at, updated_at`,
		p.ID, p.UserID, nullIfEmpty(p.VendorID), fulfillment, p.Pages, nullIfEmpty(p.Note), p.ImagePaths).
		Scan(&createdAt, &updatedAt)
	if err != nil {
		return Prescription{}, err
	}
	p.Status = "RECEIVED"
	p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return p, nil
}

// ByUser returns the caller's prescriptions, newest first.
func (r *Repo) ByUser(ctx context.Context, userID string) ([]Prescription, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("pharma: database not configured")
	}
	rows, err := r.pool.Query(ctx, prescriptionSelect+` where user_id = $1 order by created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPrescriptions(rows)
}

const prescriptionSelect = `
select id, user_id, coalesce(vendor_id,''), coalesce(fulfillment::text,''), pages,
       coalesce(note,''), image_paths, status::text, created_at, updated_at
  from pharma.prescriptions`

// VendorPrescriptions lists prescriptions routed to a seller's stores (admin: all), by status.
func (r *Repo) VendorPrescriptions(ctx context.Context, sellerID, status string) ([]Prescription, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("pharma: database not configured")
	}
	rows, err := r.pool.Query(ctx, prescriptionSelect+`
		where ($1 = '' or exists (
		        select 1 from directory.stores s
		         where s.seller_id = $1 and s.id = vendor_id))
		  and ($2 = '' or status::text = $2)
		order by created_at desc`, sellerID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPrescriptions(rows)
}

// SetStatus advances a prescription's status, scoped to a seller's stores unless admin.
// Prescription images are PII — the caller must invalidate the owner cache key.
func (r *Repo) SetStatus(ctx context.Context, id, sellerID, status string, admin bool) (Prescription, bool, error) {
	if r.pool == nil {
		return Prescription{}, false, fmt.Errorf("pharma: database not configured")
	}
	rows, err := r.pool.Query(ctx, prescriptionSelect+`
		where id = $1
		  and ($2 or exists (
		        select 1 from directory.stores s
		         where s.seller_id = $3 and s.id = vendor_id))`, id, admin, sellerID)
	if err != nil {
		return Prescription{}, false, err
	}
	items, err := scanPrescriptions(rows)
	rows.Close()
	if err != nil {
		return Prescription{}, false, err
	}
	if len(items) == 0 {
		return Prescription{}, false, nil
	}
	var updatedAt time.Time
	if err := r.pool.QueryRow(ctx, `
		update pharma.prescriptions set status = $2::prescription_status, updated_at = now()
		 where id = $1
		 returning updated_at`, id, status).Scan(&updatedAt); err != nil {
		return Prescription{}, false, err
	}
	p := items[0]
	p.Status = status
	p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return p, true, nil
}

func scanPrescriptions(rows pgx.Rows) ([]Prescription, error) {
	out := []Prescription{}
	for rows.Next() {
		var (
			p         Prescription
			createdAt time.Time
			updatedAt time.Time
		)
		if err := rows.Scan(&p.ID, &p.UserID, &p.VendorID, &p.Fulfillment, &p.Pages, &p.Note,
			&p.ImagePaths, &p.Status, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, p)
	}
	return out, rows.Err()
}

func newRxID() string {
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	return "RX-" + hex.EncodeToString(b)
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}
