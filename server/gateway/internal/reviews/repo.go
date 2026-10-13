// Package reviews serves the product + vendor reviews context. Future service: Go +
// standalone Postgres (monolith-breakdown §1). The rating gate is derived from order
// history, never stored (db-schema §7.7).
package reviews

import (
	"context"
	"fmt"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Summary is the vendor rating aggregate.
type Summary struct {
	VendorID string  `json:"vendorId"`
	Average  float64 `json:"average"`
	Count    int64   `json:"count"`
	// Distribution[i] = count of (i+1)-star ratings, i.e. index 0 = 1 star.
	Distribution [5]int64 `json:"distribution"`
}

// Repo reads/writes reviews.
type Repo struct {
	pool *db.Pool
}

// New returns a reviews repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// ProductReviews returns product-scoped reviews.
func (r *Repo) ProductReviews(ctx context.Context, productID string) ([]contracts.Review, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("reviews: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, product_id, app::text, user_name, coalesce(avatar,''), rating, comment, date_label
		  from reviews.reviews where product_id = $1 order by created_at desc`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.Review{}
	for rows.Next() {
		var rv contracts.Review
		if err := rows.Scan(&rv.ID, &rv.ProductID, &rv.App, &rv.User, &rv.Avatar, &rv.Rating, &rv.Comment, &rv.Date); err != nil {
			return nil, err
		}
		out = append(out, rv)
	}
	return out, rows.Err()
}

// VendorReviews returns the public vendor review projection.
func (r *Repo) VendorReviews(ctx context.Context, vendorID string) ([]contracts.VendorReview, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("reviews: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, vendor_id, app::text, user_name, rating, coalesce(comment,''), date_label
		  from reviews.vendor_reviews where vendor_id = $1 order by created_at desc`, vendorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contracts.VendorReview{}
	for rows.Next() {
		var rv contracts.VendorReview
		if err := rows.Scan(&rv.ID, &rv.VendorID, &rv.App, &rv.UserName, &rv.Rating, &rv.Comment, &rv.Date); err != nil {
			return nil, err
		}
		out = append(out, rv)
	}
	return out, rows.Err()
}

// VendorSummary aggregates ratings for a vendor.
func (r *Repo) VendorSummary(ctx context.Context, vendorID string) (Summary, error) {
	if r.pool == nil {
		return Summary{}, fmt.Errorf("reviews: database not configured")
	}
	s := Summary{VendorID: vendorID}
	rows, err := r.pool.Query(ctx, `
		select rating, count(*) from reviews.vendor_reviews where vendor_id = $1 group by rating`, vendorID)
	if err != nil {
		return Summary{}, err
	}
	defer rows.Close()
	var sum int64
	for rows.Next() {
		var star, count int64
		if err := rows.Scan(&star, &count); err != nil {
			return Summary{}, err
		}
		if star >= 1 && star <= 5 {
			s.Distribution[star-1] = count
		}
		s.Count += count
		sum += star * count
	}
	if err := rows.Err(); err != nil {
		return Summary{}, err
	}
	if s.Count > 0 {
		s.Average = float64(sum) / float64(s.Count)
	}
	return s, nil
}

// UserName returns the display name for a user (public-safe).
func (r *Repo) UserName(ctx context.Context, userID string) (string, error) {
	if r.pool == nil {
		return "", fmt.Errorf("reviews: database not configured")
	}
	var name string
	err := r.pool.QueryRow(ctx, `select name from accounts.profile where id = $1`, userID).Scan(&name)
	if err == pgx.ErrNoRows {
		return "Faazio Customer", nil
	}
	return name, err
}

// VendorApp returns the app brand for a vendor id.
func (r *Repo) VendorApp(ctx context.Context, vendorID string) (string, error) {
	if r.pool == nil {
		return "", fmt.Errorf("reviews: database not configured")
	}
	var app string
	err := r.pool.QueryRow(ctx, `select app::text from directory.vendors where id = $1`, vendorID).Scan(&app)
	if err == pgx.ErrNoRows {
		return "MART", nil
	}
	return app, err
}

// UpsertRating inserts or replaces the user's live rating (one per user/vendor).
func (r *Repo) UpsertRating(ctx context.Context, userID, userName, vendorID, app string, rating int64, comment string, orderIDs []string) error {
	if r.pool == nil {
		return fmt.Errorf("reviews: database not configured")
	}
	if orderIDs == nil {
		orderIDs = []string{}
	}
	_, err := r.pool.Exec(ctx, `
		insert into reviews.vendor_reviews
		  (id, vendor_id, app, user_id, user_name, rating, comment, order_ids, date_label, created_at, updated_at)
		values ($1, $2, $3::app_brand, $4, $5, $6, $7, $8, 'Just now', now(), now())
		on conflict (vendor_id, user_id) do update
		  set rating = excluded.rating,
		      comment = excluded.comment,
		      user_name = excluded.user_name,
		      order_ids = excluded.order_ids,
		      date_label = 'Just now',
		      updated_at = now()`,
		"vr-"+userID+"-"+vendorID, vendorID, app, userID, userName, rating, comment, orderIDs)
	return err
}
