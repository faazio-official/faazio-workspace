// Package catalog serves the catalog context (product detail + batch joins).
// Future service: Go + Postgres/CockroachDB (monolith-breakdown §1).
package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"math"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Repo reads catalog.products joined with inventory.stock.
type Repo struct {
	pool *db.Pool
}

// New returns a catalog repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const productSelect = `
select p.id, p.app::text, p.category, p.name, p.search_tokens,
       p.price_paisa, p.mrp_paisa, p.rating, p.reviews_count,
       p.emoji, p.image_url, p.desc_text, p.badge, p.shop, p.unit, p.attributes,
       s.available, s.in_stock_qty, s.price_paisa, s.mrp_paisa, s.eta, s.is_prescription
from catalog.products p
left join inventory.stock s on s.product_id = p.id`

// productListSelect is the slim projection for list/search/batch reads. It never fetches the
// TOAST-able desc_text / attributes columns (constant placeholders keep the scan shape identical),
// so search/list stop paying their bytes on the wire and in the Valkey value. Product detail
// (ByID) keeps the full productSelect.
const productListSelect = `
select p.id, p.app::text, p.category, p.name, p.search_tokens,
       p.price_paisa, p.mrp_paisa, p.rating, p.reviews_count,
       p.emoji, p.image_url, ''::text as desc_text, p.badge, null::text as shop, p.unit, null::jsonb as attributes,
       s.available, s.in_stock_qty, s.price_paisa, s.mrp_paisa, s.eta, s.is_prescription
from catalog.products p
left join inventory.stock s on s.product_id = p.id`

// ByID returns one product with stock.
func (r *Repo) ByID(ctx context.Context, id string) (contracts.Product, bool, error) {
	if r.pool == nil {
		return contracts.Product{}, false, fmt.Errorf("catalog: database not configured")
	}
	rows, err := r.pool.Query(ctx, productSelect+" where p.id = $1", id)
	if err != nil {
		return contracts.Product{}, false, err
	}
	defer rows.Close()
	products, err := scanProducts(rows)
	if err != nil {
		return contracts.Product{}, false, err
	}
	if len(products) == 0 {
		return contracts.Product{}, false, nil
	}
	return products[0], true, nil
}

// ByIDs returns products for the given ids (stable input order preserved by app).
func (r *Repo) ByIDs(ctx context.Context, ids []string) ([]contracts.Product, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	if len(ids) == 0 {
		return []contracts.Product{}, nil
	}
	rows, err := r.pool.Query(ctx, productListSelect+" where p.id = any($1)", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	products, err := scanProducts(rows)
	if err != nil {
		return nil, err
	}
	// Re-order to the requested id sequence.
	byID := make(map[string]contracts.Product, len(products))
	for _, p := range products {
		byID[p.ID] = p
	}
	out := make([]contracts.Product, 0, len(ids))
	for _, id := range ids {
		if p, ok := byID[id]; ok {
			out = append(out, p)
		}
	}
	return out, nil
}

// Search runs the Postgres FTS query (tsvector + pg_trgm), optionally app-scoped.
func (r *Repo) Search(ctx context.Context, q, app string, limit int) ([]contracts.Product, error) {
	return r.SearchScoped(ctx, q, app, limit)
}

// SearchScoped is Search with an explicit app filter.
func (r *Repo) SearchScoped(ctx context.Context, q, app string, limit int) ([]contracts.Product, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("catalog: database not configured")
	}
	if limit <= 0 || limit > 100 {
		limit = 40
	}
	var (
		rows pgx.Rows
		err  error
	)
	if q == "" {
		rows, err = r.pool.Query(ctx, productListSelect+
			` where ($1 = '' or p.app::text = $1) order by p.rating desc, p.reviews_count desc limit $2`, app, limit)
	} else {
		// FTS only: the pg_trgm `%` fallback was dropped with products_name_trgm_idx (0005) so the
		// planner stays on products_search_vec_idx instead of seq-scanning the OR.
		rows, err = r.pool.Query(ctx, productListSelect+`
			where p.search_vec @@ websearch_to_tsquery('simple', catalog.immutable_unaccent($1))
			  and ($2 = '' or p.app::text = $2)
			order by ts_rank(p.search_vec, websearch_to_tsquery('simple', catalog.immutable_unaccent($1))) desc,
			         p.rating desc
			limit $3`, q, app, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProducts(rows)
}

func scanProducts(rows pgx.Rows) ([]contracts.Product, error) {
	out := []contracts.Product{}
	for rows.Next() {
		var (
			p                                contracts.Product
			pricePaisa, mrpPaisa, stockPrice *int64
			rating                           float64
			reviewsCount                     *int64
			attrsRaw                         []byte
			badge, shop, unit                *string
			sAvail                           *bool
			sQty, sMRP                       *int64
			sETA                             *string
			sRx                              *bool
		)
		if err := rows.Scan(
			&p.ID, &p.App, &p.Category, &p.Name, &p.SearchTokens,
			&pricePaisa, &mrpPaisa, &rating, &reviewsCount,
			&p.Emoji, &p.Image, &p.Desc, &badge, &shop, &unit, &attrsRaw,
			&sAvail, &sQty, &stockPrice, &sMRP, &sETA, &sRx,
		); err != nil {
			return nil, err
		}
		// rating is stored as real (float4); round to the 1-decimal domain precision so the JSON
		// number is exact (e.g. 4.9, not 4.900000095367432).
		p.Rating = math.Round(rating*10) / 10
		p.Price = toRupees(pricePaisa)
		p.OriginalPrice = moneyPtr(mrpPaisa)
		p.ReviewsCount = reviewsCount
		p.Badge = deref(badge)
		p.Shop = deref(shop)
		p.Unit = deref(unit)
		if len(attrsRaw) > 0 {
			_ = json.Unmarshal(attrsRaw, &p.Attributes)
		}
		if sAvail != nil {
			st := &contracts.Stock{
				ProductID:      p.ID,
				Available:      *sAvail,
				InStockQty:     derefInt(sQty),
				Price:          toRupees(stockPrice),
				MRP:            moneyPtr(sMRP),
				IsPrescription: sRx != nil && *sRx,
			}
			if sETA != nil {
				st.ETA = *sETA
			}
			p.Stock = st
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func toRupees(paisa *int64) int64 {
	if paisa == nil {
		return 0
	}
	return *paisa / 100
}

func moneyPtr(paisa *int64) *int64 {
	if paisa == nil {
		return nil
	}
	r := *paisa / 100
	return &r
}

func derefInt(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
