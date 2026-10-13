// Package favourites serves the durable favourites context. Future service: Go + Postgres
// (monolith-breakdown.md §1). Favourites are auth-scoped and mutable — never edge-cached.
package favourites

import (
	"context"
	"fmt"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// Repo reads/writes favourites.items.
type Repo struct {
	pool *db.Pool
}

// New returns a favourites repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// List returns the user's favourite shelf ids, newest first.
func (r *Repo) List(ctx context.Context, userID string) ([]string, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("favourites: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select product_id from favourites.items
		 where user_id = $1 order by created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// Add records a favourite (idempotent: re-adding is a no-op).
func (r *Repo) Add(ctx context.Context, userID, productID string) error {
	if r.pool == nil {
		return fmt.Errorf("favourites: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		insert into favourites.items (user_id, product_id) values ($1, $2)
		on conflict (user_id, product_id) do nothing`, userID, productID)
	return err
}

// Remove deletes a favourite (idempotent: removing a non-favourite is a no-op).
func (r *Repo) Remove(ctx context.Context, userID, productID string) error {
	if r.pool == nil {
		return fmt.Errorf("favourites: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		delete from favourites.items where user_id = $1 and product_id = $2`, userID, productID)
	return err
}