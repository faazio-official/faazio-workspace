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
	rows, err := r.pool.Query(ctx, `
		select id, user_id, coalesce(vendor_id,''), coalesce(fulfillment::text,''), pages,
		       coalesce(note,''), image_paths, status::text, created_at, updated_at
		  from pharma.prescriptions where user_id = $1 order by created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
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