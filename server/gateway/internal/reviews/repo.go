// Package reviews serves the product + vendor reviews context. Future service: Go +
// standalone Postgres (monolith-breakdown §1). The rating gate is derived from order
// history, never stored (db-schema §7.7).
package reviews

import (
	"context"
	"fmt"
	"time"

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

// ProductReviewsPage returns product-scoped reviews ordered by (created_at desc, id asc) with
// keyset pagination. It fetches limit+1 rows; when a further page exists it reports hasMore and the
// sort key (lastCreatedAt, lastID) of the final returned row for the caller's cursor.
func (r *Repo) ProductReviewsPage(ctx context.Context, productID string, limit int, cursorTime time.Time, cursorID string, hasCursor bool) (out []contracts.Review, lastCreatedAt time.Time, lastID string, hasMore bool, err error) {
	if r.pool == nil {
		return nil, time.Time{}, "", false, fmt.Errorf("reviews: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, product_id, app::text, user_name, coalesce(avatar,''), rating, comment, date_label, created_at
		  from reviews.reviews
		 where product_id = $1
		   and (not $2::bool or created_at < $3::timestamptz or (created_at = $3::timestamptz and id > $4))
		 order by created_at desc, id asc
		 limit $5`, productID, hasCursor, cursorTime, cursorID, limit+1)
	if err != nil {
		return nil, time.Time{}, "", false, err
	}
	defer rows.Close()
	out = []contracts.Review{}
	type keyed struct {
		created time.Time
		id      string
	}
	keys := []keyed{}
	for rows.Next() {
		var (
			rv      contracts.Review
			created time.Time
		)
		if err := rows.Scan(&rv.ID, &rv.ProductID, &rv.App, &rv.User, &rv.Avatar, &rv.Rating, &rv.Comment, &rv.Date, &created); err != nil {
			return nil, time.Time{}, "", false, err
		}
		out = append(out, rv)
		keys = append(keys, keyed{created: created, id: rv.ID})
	}
	if err := rows.Err(); err != nil {
		return nil, time.Time{}, "", false, err
	}
	if len(out) > limit {
		out = out[:limit]
		keys = keys[:limit]
		hasMore = true
	}
	if len(keys) > 0 {
		lastCreatedAt = keys[len(keys)-1].created
		lastID = keys[len(keys)-1].id
	}
	return out, lastCreatedAt, lastID, hasMore, nil
}

// VendorReviewsPage returns review rows ordered by (created_at desc, id asc) with keyset
// pagination. It fetches limit+1 rows; when a further page exists it reports hasMore and
// the sort key (lastCreatedAt, lastID) of the final returned row for the caller's cursor.
func (r *Repo) VendorReviewsPage(ctx context.Context, vendorID string, limit int, cursorTime time.Time, cursorID string, hasCursor bool) (out []contracts.VendorReview, lastCreatedAt time.Time, lastID string, hasMore bool, err error) {
	if r.pool == nil {
		return nil, time.Time{}, "", false, fmt.Errorf("reviews: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, vendor_id, app::text, user_name, rating, coalesce(comment,''), date_label, created_at
		  from reviews.vendor_reviews
		 where vendor_id = $1
		   and (not $2::bool or created_at < $3::timestamptz or (created_at = $3::timestamptz and id > $4))
		 order by created_at desc, id asc
		 limit $5`, vendorID, hasCursor, cursorTime, cursorID, limit+1)
	if err != nil {
		return nil, time.Time{}, "", false, err
	}
	defer rows.Close()
	out = []contracts.VendorReview{}
	type keyed struct {
		created time.Time
		id      string
	}
	keys := []keyed{}
	for rows.Next() {
		var (
			rv      contracts.VendorReview
			created time.Time
		)
		if err := rows.Scan(&rv.ID, &rv.VendorID, &rv.App, &rv.UserName, &rv.Rating, &rv.Comment, &rv.Date, &created); err != nil {
			return nil, time.Time{}, "", false, err
		}
		out = append(out, rv)
		keys = append(keys, keyed{created: created, id: rv.ID})
	}
	if err := rows.Err(); err != nil {
		return nil, time.Time{}, "", false, err
	}
	if len(out) > limit {
		out = out[:limit]
		keys = keys[:limit]
		hasMore = true
	}
	if len(keys) > 0 {
		lastCreatedAt = keys[len(keys)-1].created
		lastID = keys[len(keys)-1].id
	}
	return out, lastCreatedAt, lastID, hasMore, nil
}

// VendorSummary reads the trigger-maintained aggregate (reviews.vendor_summary) — an O(1) PK
// lookup instead of a per-request GROUP BY over reviews.vendor_reviews.
func (r *Repo) VendorSummary(ctx context.Context, vendorID string) (Summary, error) {
	if r.pool == nil {
		return Summary{}, fmt.Errorf("reviews: database not configured")
	}
	s := Summary{VendorID: vendorID}
	var sum int64
	err := r.pool.QueryRow(ctx, `
		select rating_sum, reviews_count, star1, star2, star3, star4, star5
		  from reviews.vendor_summary where vendor_id = $1`, vendorID).
		Scan(&sum, &s.Count,
			&s.Distribution[0], &s.Distribution[1], &s.Distribution[2], &s.Distribution[3], &s.Distribution[4])
	if err != nil {
		if err == pgx.ErrNoRows {
			return s, nil
		}
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

// VendorApp returns the app brand for a vendor id. Two indexed PK lookups (stores, then dining
// venues) instead of scanning the directory.vendors UNION ALL view.
func (r *Repo) VendorApp(ctx context.Context, vendorID string) (string, error) {
	if r.pool == nil {
		return "", fmt.Errorf("reviews: database not configured")
	}
	var app string
	err := r.pool.QueryRow(ctx, `
		select app::text from directory.stores where id = $1
		union all
		select 'FOOD'::text from directory.dining_venues where id = $1
		limit 1`, vendorID).Scan(&app)
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
