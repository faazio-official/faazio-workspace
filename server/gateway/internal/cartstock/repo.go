// Package cartstock serves the cart + stock context. Future service: Go + DynamoDB
// / Firestore (monolith-breakdown §1). Stock decrements use SELECT … FOR UPDATE SKIP
// LOCKED for production contention safety (mvp-backend §1).
package cartstock

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// ErrInsufficientStock is returned when a decrement cannot be satisfied.
var ErrInsufficientStock = errors.New("insufficient stock")

// CartItem is one cart line (inventory.carts.items JSON).
type CartItem struct {
	ProductID string `json:"productId"`
	Qty       int64  `json:"qty"`
}

// Repo reads/writes inventory.
type Repo struct {
	pool *db.Pool
}

// New returns a cartstock repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// StockByProductID returns one stock row.
func (r *Repo) StockByProductID(ctx context.Context, productID string) (contracts.Stock, bool, error) {
	if r.pool == nil {
		return contracts.Stock{}, false, fmt.Errorf("cartstock: database not configured")
	}
	var (
		s   contracts.Stock
		mrp *int64
		rx  *bool
	)
	err := r.pool.QueryRow(ctx, `
		select product_id, available, in_stock_qty, price_paisa, mrp_paisa, eta, is_prescription
		from inventory.stock where product_id = $1`, productID).
		Scan(&s.ProductID, &s.Available, &s.InStockQty, &s.Price, &mrp, &s.ETA, &rx)
	if err != nil {
		if isNoRows(err) {
			return contracts.Stock{}, false, nil
		}
		return contracts.Stock{}, false, err
	}
	s.Price = s.Price / 100
	if mrp != nil {
		v := *mrp / 100
		s.MRP = &v
	}
	s.IsPrescription = rx != nil && *rx
	return s, true, nil
}

// StockByProductIDs returns stock rows keyed by product id.
func (r *Repo) StockByProductIDs(ctx context.Context, ids []string) (map[string]contracts.Stock, error) {
	out := map[string]contracts.Stock{}
	if r.pool == nil || len(ids) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		select product_id, available, in_stock_qty, price_paisa, mrp_paisa, eta, is_prescription
		from inventory.stock where product_id = any($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			s   contracts.Stock
			mrp *int64
			rx  *bool
		)
		if err := rows.Scan(&s.ProductID, &s.Available, &s.InStockQty, &s.Price, &mrp, &s.ETA, &rx); err != nil {
			return nil, err
		}
		s.Price = s.Price / 100
		if mrp != nil {
			v := *mrp / 100
			s.MRP = &v
		}
		s.IsPrescription = rx != nil && *rx
		out[s.ProductID] = s
	}
	return out, rows.Err()
}

// Decrement atomically reduces stock. Uses SELECT … FOR UPDATE SKIP LOCKED so
// concurrent decrements don't block each other; returns ok=false when unavailable. Runs on the
// provided Querier (the checkout transaction's handle, or the pool for a standalone call) so the
// caller controls the commit boundary.
func (r *Repo) Decrement(ctx context.Context, q contracts.Querier, productID string, qty int64) (int64, bool, error) {
	if r.pool == nil {
		return 0, false, fmt.Errorf("cartstock: database not configured")
	}
	if qty <= 0 {
		return 0, false, ErrInsufficientStock
	}
	var remaining int64
	err := q.QueryRow(ctx, `
		update inventory.stock
		   set in_stock_qty = in_stock_qty - $2, updated_at = now()
		 where product_id = (
		       select product_id from inventory.stock
		        where product_id = $1 and in_stock_qty >= $2 and available
		        for update skip locked
		     )
		 returning in_stock_qty`, productID, qty).Scan(&remaining)
	if err != nil {
		if isNoRows(err) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return remaining, true, nil
}

// GetCart returns the user's cart lines.
func (r *Repo) GetCart(ctx context.Context, userID string) ([]CartItem, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("cartstock: database not configured")
	}
	var raw []byte
	err := r.pool.QueryRow(ctx, `select items from inventory.carts where user_id = $1`, userID).Scan(&raw)
	if err != nil {
		if isNoRows(err) {
			return []CartItem{}, nil
		}
		return nil, err
	}
	items := []CartItem{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &items)
	}
	return items, nil
}

// SetCartItem adds or updates a line (qty <= 0 removes it).
func (r *Repo) SetCartItem(ctx context.Context, userID, productID string, qty int64) ([]CartItem, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("cartstock: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var raw []byte
	err = tx.QueryRow(ctx, `select items from inventory.carts where user_id = $1 for update`, userID).Scan(&raw)
	items := []CartItem{}
	if err == nil && len(raw) > 0 {
		_ = json.Unmarshal(raw, &items)
	} else if err != nil && !isNoRows(err) {
		return nil, err
	}
	items = mergeItem(items, productID, qty)

	encoded, err := json.Marshal(items)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		insert into inventory.carts (user_id, items, updated_at)
		values ($1, $2, now())
		on conflict (user_id) do update set items = excluded.items, updated_at = now()`,
		userID, encoded)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}

func mergeItem(items []CartItem, productID string, qty int64) []CartItem {
	out := make([]CartItem, 0, len(items)+1)
	found := false
	for _, it := range items {
		if it.ProductID == productID {
			found = true
			if qty > 0 {
				out = append(out, CartItem{ProductID: productID, Qty: qty})
			}
			continue
		}
		out = append(out, it)
	}
	if !found && qty > 0 {
		out = append(out, CartItem{ProductID: productID, Qty: qty})
	}
	return out
}

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
