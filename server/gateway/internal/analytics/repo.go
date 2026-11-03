// Package analytics serves live portal dashboards from the real ledger. The trends come straight
// from checkout.orders / order_items grouped by IST day — no seeded or generated numbers. It is the
// DB-backed replacement for the portal's old client-side seeded series.
package analytics

import (
	"context"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// Point is one daily bucket on the wire (views/carts are 0: checkout does not track them).
type Point struct {
	Date     string `json:"date"`
	GMVPaisa int64  `json:"gmvPaisa"`
	Orders   int64  `json:"orders"`
	Views    int    `json:"views"`
	Carts    int    `json:"carts"`
}

// Rank is one aggregate row for the overview rankings / per-item sums.
type Rank struct {
	ID       string `json:"id"`
	GMVPaisa int64  `json:"gmvPaisa"`
	Orders   int64  `json:"orders"`
}

// Ranks holds the seller / state / product totals for one window.
type Ranks struct {
	Sellers  []Rank `json:"sellers"`
	States   []Rank `json:"states"`
	Products []Rank `json:"products"`
}

// MaxDays bounds an analytics window so a typo cannot scan the whole ledger.
const MaxDays = 90

// ValidOrderFilter excludes non-money orders (cancelled / rejected / returned) from an aggregate.
// Assumes the orders table is aliased `o`.
const ValidOrderFilter = `o.status not in ('Cancelled', 'REJECTED', 'RETURNED')`

// Repo reads the live aggregate views.
type Repo struct {
	pool *db.Pool
}

// NewRepo builds the analytics repo.
func NewRepo(pool *db.Pool) *Repo { return &Repo{pool: pool} }

var errDisabled = fmt.Errorf("analytics: database not configured")

// Since returns the floor timestamp for an N-day window (UTC), clamped to [1, MaxDays].
func Since(days int) time.Time {
	if days < 1 {
		days = 30
	}
	if days > MaxDays {
		days = MaxDays
	}
	return time.Now().UTC().AddDate(0, 0, -days)
}

// storeWhere maps a scope to the extra SQL the daily series needs. join is the extra FROM clause
// (product), exists is an extra `where` predicate bound to param (seller/state); global adds none.
func storeWhere(scope, id string) (join string, exists string, param any) {
	switch scope {
	case "seller":
		return "", " and exists (select 1 from directory.stores s where s.id = any(o.vendor_store_ids) and s.seller_id = $2)", id
	case "state":
		return "", " and exists (select 1 from directory.stores s where s.id = any(o.vendor_store_ids) and s.state_code = $2)", id
	case "product":
		return " join checkout.order_items oi on oi.order_id = o.order_id and oi.product_id = $2", "", id
	default:
		return "", "", nil
	}
}

// Series returns the IST-day buckets for one scope (global | seller | state | product) over the
// last `days` days, oldest first.
func (r *Repo) Series(ctx context.Context, scope, id string, days int) ([]Point, error) {
	if r.pool == nil {
		return nil, errDisabled
	}
	join, exists, param := storeWhere(scope, id)
	args := []any{Since(days)}
	if param != nil {
		args = append(args, param)
	}
	// Product scope sums item value from order_items; every other scope charges the order total.
	valueExpr := "coalesce(sum(o.total_charged_paisa), 0)"
	if scope == "product" {
		valueExpr = "coalesce(sum(oi.unit_price_paisa * oi.qty), 0)"
	}
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		select to_char((o.placed_at at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as day,
		       count(*) as orders, %s as gmv
		  from checkout.orders o%s
		 where o.placed_at >= $1 and %s%s
		 group by 1 order by 1`, valueExpr, join, ValidOrderFilter, exists), args...)
	if err != nil {
		return nil, fmt.Errorf("analytics: series: %w", err)
	}
	defer rows.Close()
	out := []Point{}
	for rows.Next() {
		var date string
		var orders, gmv int64
		if err := rows.Scan(&date, &orders, &gmv); err != nil {
			return nil, fmt.Errorf("analytics: series scan: %w", err)
		}
		out = append(out, Point{Date: date, GMVPaisa: gmv, Orders: orders})
	}
	return out, rows.Err()
}

// Ranks returns the seller / state / product totals for one window, sorted by GMV descending.
func (r *Repo) Ranks(ctx context.Context, days int) (*Ranks, error) {
	if r.pool == nil {
		return nil, errDisabled
	}
	since := Since(days)
	ranks := &Ranks{}

	sellers, err := r.pool.Query(ctx, `
		select s.seller_id, count(distinct o.order_id), coalesce(sum(o.total_charged_paisa), 0)
		  from checkout.orders o
		  join directory.stores s on s.id = any(o.vendor_store_ids)
		 where o.placed_at >= $1 and `+ValidOrderFilter+`
		 group by s.seller_id order by 3 desc`, since)
	if err != nil {
		return nil, fmt.Errorf("analytics: seller ranks: %w", err)
	}
	for sellers.Next() {
		var id string
		var orders, gmv int64
		if err := sellers.Scan(&id, &orders, &gmv); err != nil {
			sellers.Close()
			return nil, fmt.Errorf("analytics: seller rank scan: %w", err)
		}
		ranks.Sellers = append(ranks.Sellers, Rank{ID: id, GMVPaisa: gmv, Orders: orders})
	}
	sellers.Close()
	if err := sellers.Err(); err != nil {
		return nil, fmt.Errorf("analytics: seller ranks: %w", err)
	}

	states, err := r.pool.Query(ctx, `
		select s.state_code, count(distinct o.order_id), coalesce(sum(o.total_charged_paisa), 0)
		  from checkout.orders o
		  join directory.stores s on s.id = any(o.vendor_store_ids)
		 where o.placed_at >= $1 and `+ValidOrderFilter+`
		 group by s.state_code order by 3 desc`, since)
	if err != nil {
		return nil, fmt.Errorf("analytics: state ranks: %w", err)
	}
	for states.Next() {
		var id string
		var orders, gmv int64
		if err := states.Scan(&id, &orders, &gmv); err != nil {
			states.Close()
			return nil, fmt.Errorf("analytics: state rank scan: %w", err)
		}
		ranks.States = append(ranks.States, Rank{ID: id, GMVPaisa: gmv, Orders: orders})
	}
	states.Close()
	if err := states.Err(); err != nil {
		return nil, fmt.Errorf("analytics: state ranks: %w", err)
	}

	products, err := r.pool.Query(ctx, `
		select oi.product_id, count(distinct o.order_id), coalesce(sum(oi.unit_price_paisa * oi.qty), 0)
		  from checkout.order_items oi
		  join checkout.orders o on o.order_id = oi.order_id
		 where o.placed_at >= $1 and `+ValidOrderFilter+`
		 group by oi.product_id order by 3 desc`, since)
	if err != nil {
		return nil, fmt.Errorf("analytics: product ranks: %w", err)
	}
	for products.Next() {
		var id string
		var orders, gmv int64
		if err := products.Scan(&id, &orders, &gmv); err != nil {
			products.Close()
			return nil, fmt.Errorf("analytics: product rank scan: %w", err)
		}
		ranks.Products = append(ranks.Products, Rank{ID: id, GMVPaisa: gmv, Orders: orders})
	}
	products.Close()
	if err := products.Err(); err != nil {
		return nil, fmt.Errorf("analytics: product ranks: %w", err)
	}
	return ranks, nil
}