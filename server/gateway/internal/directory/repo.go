// Package directory serves the store directory context. Future service: Go +
// Postgres/CockroachDB (monolith-breakdown §1).
package directory

import (
	"context"
	"fmt"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo reads directory.stores.
type Repo struct {
	pool *db.Pool
}

// New returns a directory repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const storeSelect = `
select id, app::text, name, categories, rating, reviews_count, delivery_time, distance,
       cover_image, emoji, desc_text, offer_tag, is_veg, address, phone, hours
from directory.stores`

// storeListSelect is the public list projection: it never fetches the PII columns (address/phone),
// so they cannot reach the gateway, the wire, or the edge cache. Product detail keeps storeSelect.
const storeListSelect = `
select id, app::text, name, categories, rating, reviews_count, delivery_time, distance,
       cover_image, emoji, desc_text, offer_tag, is_veg, null::text as address, null::text as phone, hours
from directory.stores`

// ByApp returns stores for one app (empty app = all).
func (r *Repo) ByApp(ctx context.Context, app string) ([]contracts.Store, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, storeSelect+` where ($1 = '' or app::text = $1) order by rating desc`, app)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStores(rows)
}

// ByAppPage returns stores ordered by (rating desc, id asc) using keyset pagination.
// When hasCursor is true, rows at or before (cursorRating, cursorID) are skipped. The
// query fetches limit+1 rows so the caller can tell whether another page exists.
func (r *Repo) ByAppPage(ctx context.Context, app string, limit int, cursorRating float64, cursorID string, hasCursor bool) ([]contracts.Store, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, storeListSelect+`
		where ($1 = '' or app::text = $1)
		  and (not $2::bool or rating < $3::float8 or (rating = $3::float8 and id > $4))
		order by rating desc, id asc
		limit $5`, app, hasCursor, cursorRating, cursorID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStores(rows)
}

// ByID returns one store.
func (r *Repo) ByID(ctx context.Context, id string) (contracts.Store, bool, error) {
	if r.pool == nil {
		return contracts.Store{}, false, fmt.Errorf("directory: database not configured")
	}
	rows, err := r.pool.Query(ctx, storeSelect+` where id = $1`, id)
	if err != nil {
		return contracts.Store{}, false, err
	}
	defer rows.Close()
	stores, err := scanStores(rows)
	if err != nil {
		return contracts.Store{}, false, err
	}
	if len(stores) == 0 {
		return contracts.Store{}, false, nil
	}
	return stores[0], true, nil
}

func scanStores(rows pgx.Rows) ([]contracts.Store, error) {
	out := []contracts.Store{}
	for rows.Next() {
		var (
			s        contracts.Store
			reviews  *int64
			offerTag *string
			isVeg    *bool
			address  *string
			phone    *string
			hours    *string
		)
		if err := rows.Scan(
			&s.ID, &s.App, &s.Name, &s.Categories, &s.Rating, &reviews,
			&s.DeliveryTime, &s.Distance, &s.CoverImage, &s.Emoji, &s.Desc,
			&offerTag, &isVeg, &address, &phone, &hours,
		); err != nil {
			return nil, err
		}
		s.ReviewsCount = reviews
		s.OfferTag = derefStr(offerTag)
		s.IsVeg = isVeg
		s.Address = derefStr(address)
		s.Phone = derefStr(phone)
		s.Hours = derefStr(hours)
		out = append(out, s)
	}
	return out, rows.Err()
}

func derefStr(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
