// Package checkout serves the checkout/orders + accounts context. Future service: Go
// + CockroachDB (monolith-breakdown §1). Owns the derived rating-eligibility gate.
package checkout

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// OrderLineItem is one order_items row, JSON shaped for OrderLineItem.
type OrderLineItem struct {
	LineID    string `json:"lineId"`
	ProductID string `json:"productId,omitempty"`
	Name      string `json:"name"`
	Variant   string `json:"variant,omitempty"`
	Qty       int64  `json:"qty"`
	UnitPrice int64  `json:"unitPrice"` // rupees
}

// Order is a checkout.orders row with its line items, JSON shaped for OrderRow.
type Order struct {
	ID             string          `json:"id"`
	OrderNumber    string          `json:"orderNumber"`
	UserID         string          `json:"userId"`
	AddressID      string          `json:"addressId,omitempty"`
	PlacedAt       string          `json:"placedAt"`
	Status         string          `json:"status"`
	StatusDate     string          `json:"statusDate,omitempty"`
	LineItems      []OrderLineItem `json:"lineItems"`
	Fulfillment    string          `json:"fulfillment,omitempty"`
	VendorStoreIDs []string        `json:"vendorStoreIds"`
}

// Profile is accounts.profile.
type Profile struct {
	ID        string `json:"id"`
	AccountID string `json:"accountId"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
}

// Membership is accounts.membership.
type Membership struct {
	ID          string `json:"id"`
	UserID      string `json:"userId"`
	Title       string `json:"title"`
	SavedLabel  string `json:"savedLabel,omitempty"`
	SavedAmount int64  `json:"savedAmount,omitempty"`
}

// OrderStatus is accounts.order_status.
type OrderStatus struct {
	ID     string `json:"id"`
	UserID string `json:"userId"`
	Key    string `json:"key"`
	Label  string `json:"label"`
	Count  int64  `json:"count"`
}

// Nav is accounts.nav.
type Nav struct {
	UserID string          `json:"userId"`
	Key    string          `json:"key"`
	Rows   json.RawMessage `json:"rows"`
}

// Details is accounts.details.
type Details struct {
	UserID    string          `json:"userId"`
	AccountID string          `json:"accountId,omitempty"`
	Data      json.RawMessage `json:"data"`
}

// Repo reads/writes checkout + accounts.
type Repo struct {
	pool  *db.Pool
	cache *cache.Cache
}

// New returns a checkout repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// NewWithCache returns a checkout repo that also caches the auth_uid → user_id mapping.
func NewWithCache(pool *db.Pool, c *cache.Cache) *Repo { return &Repo{pool: pool, cache: c} }

// ResolveUserID maps a Supabase auth subject to the app user slug (auth.UserResolver). The mapping
// is immutable for a given subject, so it is read-through cached for 1 h — removing a query from
// every authenticated request. Invalidation (profile merge) deletes cache.AuthUser(subject).
func (r *Repo) ResolveUserID(ctx context.Context, authUID string) (string, error) {
	if r.pool == nil {
		return "", fmt.Errorf("checkout: database not configured")
	}
	cacheKey := ""
	if r.cache != nil && r.cache.Enabled() {
		cacheKey = cache.AuthUser(authUID)
		var cached string
		if r.cache.GetJSON(ctx, cacheKey, &cached) && cached != "" {
			return cached, nil
		}
	}
	var userID string
	err := r.pool.QueryRow(ctx, `select user_id from checkout.users where auth_uid = $1`, authUID).Scan(&userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	if cacheKey != "" && userID != "" {
		r.cache.SetJSON(ctx, cacheKey, userID, cache.TTLAuth)
	}
	return userID, nil
}

// OwnsAddress reports whether addressID belongs to userID (server-side ownership check).
func (r *Repo) OwnsAddress(ctx context.Context, userID, addressID string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("checkout: database not configured")
	}
	var one int
	err := r.pool.QueryRow(ctx, `select 1 from checkout.addresses where address_id = $1 and user_id = $2`, addressID, userID).Scan(&one)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// OrderByIdempotencyKey returns the order id previously recorded for (userID, key).
func (r *Repo) OrderByIdempotencyKey(ctx context.Context, userID, key string) (string, bool, error) {
	if r.pool == nil {
		return "", false, fmt.Errorf("checkout: database not configured")
	}
	var orderID string
	err := r.pool.QueryRow(ctx, `select order_id from checkout.idempotency_keys where user_id = $1 and key = $2`, userID, key).Scan(&orderID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", false, nil
		}
		return "", false, err
	}
	return orderID, true, nil
}

// OrdersByUser returns a user's orders with line items.
func (r *Repo) OrdersByUser(ctx context.Context, userID string) ([]Order, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select order_id, order_number, user_id, coalesce(address_id,''), placed_at, status::text,
		       status_date, coalesce(fulfillment::text,''), vendor_store_ids
		  from checkout.orders where user_id = $1 order by placed_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []Order{}
	index := map[string]int{}
	for rows.Next() {
		var (
			o          Order
			placedAt   time.Time
			statusDate *time.Time
		)
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.UserID, &o.AddressID, &placedAt, &o.Status,
			&statusDate, &o.Fulfillment, &o.VendorStoreIDs); err != nil {
			return nil, err
		}
		o.PlacedAt = placedAt.UTC().Format(time.RFC3339)
		if statusDate != nil {
			o.StatusDate = statusDate.UTC().Format(time.RFC3339)
		}
		o.LineItems = []OrderLineItem{}
		index[o.ID] = len(orders)
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(orders) == 0 {
		return orders, nil
	}

	itemRows, err := r.pool.Query(ctx, `
		select line_id, order_id, coalesce(product_id,''), name, coalesce(variant,''), qty, unit_price_paisa
		  from checkout.order_items where order_id = any($1)`, orderIDs(orders))
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var (
			li      OrderLineItem
			orderID string
		)
		if err := itemRows.Scan(&li.LineID, &orderID, &li.ProductID, &li.Name, &li.Variant, &li.Qty, &li.UnitPrice); err != nil {
			return nil, err
		}
		li.UnitPrice = li.UnitPrice / 100
		if idx, ok := index[orderID]; ok {
			orders[idx].LineItems = append(orders[idx].LineItems, li)
		}
	}
	return orders, itemRows.Err()
}

// OrderByID returns one order with its line items.
func (r *Repo) OrderByID(ctx context.Context, orderID string) (Order, bool, error) {
	if r.pool == nil {
		return Order{}, false, fmt.Errorf("checkout: database not configured")
	}
	var (
		o          Order
		placedAt   time.Time
		statusDate *time.Time
	)
	err := r.pool.QueryRow(ctx, `
		select order_id, order_number, user_id, coalesce(address_id,''), placed_at, status::text,
		       status_date, coalesce(fulfillment::text,''), vendor_store_ids
		  from checkout.orders where order_id = $1`, orderID).
		Scan(&o.ID, &o.OrderNumber, &o.UserID, &o.AddressID, &placedAt, &o.Status,
			&statusDate, &o.Fulfillment, &o.VendorStoreIDs)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Order{}, false, nil
		}
		return Order{}, false, err
	}
	o.PlacedAt = placedAt.UTC().Format(time.RFC3339)
	if statusDate != nil {
		o.StatusDate = statusDate.UTC().Format(time.RFC3339)
	}
	o.LineItems = []OrderLineItem{}

	itemRows, err := r.pool.Query(ctx, `
		select line_id, coalesce(product_id,''), name, coalesce(variant,''), qty, unit_price_paisa
		  from checkout.order_items where order_id = $1`, orderID)
	if err != nil {
		return Order{}, false, err
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var li OrderLineItem
		if err := itemRows.Scan(&li.LineID, &li.ProductID, &li.Name, &li.Variant, &li.Qty, &li.UnitPrice); err != nil {
			return Order{}, false, err
		}
		li.UnitPrice = li.UnitPrice / 100
		o.LineItems = append(o.LineItems, li)
	}
	return o, true, itemRows.Err()
}

func orderIDs(orders []Order) []string {
	out := make([]string, 0, len(orders))
	for _, o := range orders {
		out = append(out, o.ID)
	}
	return out
}

// PurchaseProof derives the rating eligibility gate (never a stored flag).
func (r *Repo) PurchaseProof(ctx context.Context, userID, vendorID string) (bool, []string, error) {
	if r.pool == nil {
		return false, nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select order_id from checkout.orders
		 where user_id = $1 and status <> 'Cancelled' and vendor_store_ids @> array[$2]`, userID, vendorID)
	if err != nil {
		return false, nil, err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return false, nil, err
		}
		ids = append(ids, id)
	}
	return len(ids) > 0, ids, rows.Err()
}

// ProductSnapshot is the catalog data checkout needs to price an order line.
type ProductSnapshot struct {
	ID         string
	Name       string
	PricePaisa int64
	StoreID    *string
}

// ProductSnapshots reads catalog.products rows for the given ids.
func (r *Repo) ProductSnapshots(ctx context.Context, ids []string) (map[string]ProductSnapshot, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	out := map[string]ProductSnapshot{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `select id, name, price_paisa, store_id from catalog.products where id = any($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s ProductSnapshot
		if err := rows.Scan(&s.ID, &s.Name, &s.PricePaisa, &s.StoreID); err != nil {
			return nil, err
		}
		out[s.ID] = s
	}
	return out, rows.Err()
}

// InsertOrder writes an order, its line items, and (when idempotencyKey is set) the replay record
// in one transaction, so a retry can never observe an order without its idempotency key.
func (r *Repo) InsertOrder(ctx context.Context, o Order, lines []OrderLineItem, idempotencyKey string) error {
	if r.pool == nil {
		return fmt.Errorf("checkout: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var fulfillment any
	if o.Fulfillment == "PICKUP" || o.Fulfillment == "DELIVERY" {
		fulfillment = o.Fulfillment
	}
	if _, err := tx.Exec(ctx, `
		insert into checkout.orders
		  (order_id, order_number, user_id, address_id, placed_at, status, fulfillment, total_paisa, vendor_store_ids)
		values ($1,$2,$3,$4, now(), $5::order_status, $6::fulfillment_mode, $7, $8)`,
		o.ID, o.OrderNumber, o.UserID, nullIfEmpty(o.AddressID), o.Status, fulfillment, totalPaisa(lines), o.VendorStoreIDs); err != nil {
		return err
	}
	for _, li := range lines {
		if _, err := tx.Exec(ctx, `
			insert into checkout.order_items (line_id, order_id, product_id, name, variant, qty, unit_price_paisa)
			values ($1,$2,$3,$4,$5,$6,$7)`,
			li.LineID, o.ID, nullIfEmpty(li.ProductID), li.Name, nullIfEmpty(li.Variant), li.Qty, li.UnitPrice*100); err != nil {
			return err
		}
	}
	if idempotencyKey != "" {
		if _, err := tx.Exec(ctx, `
			insert into checkout.idempotency_keys (user_id, key, order_id)
			values ($1, $2, $3)
			on conflict (user_id, key) do nothing`,
			o.UserID, idempotencyKey, o.ID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func totalPaisa(lines []OrderLineItem) int64 {
	var total int64
	for _, li := range lines {
		total += li.Qty * li.UnitPrice * 100
	}
	return total
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}

// ProfileByUser returns accounts.profile.
func (r *Repo) ProfileByUser(ctx context.Context, userID string) (Profile, bool, error) {
	if r.pool == nil {
		return Profile{}, false, fmt.Errorf("checkout: database not configured")
	}
	var p Profile
	err := r.pool.QueryRow(ctx, `select id, account_id, name, email, phone from accounts.profile where id = $1`, userID).
		Scan(&p.ID, &p.AccountID, &p.Name, &p.Email, &p.Phone)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Profile{}, false, nil
		}
		return Profile{}, false, err
	}
	return p, true, nil
}

// MembershipByUser returns accounts.membership.
func (r *Repo) MembershipByUser(ctx context.Context, userID string) (Membership, bool, error) {
	if r.pool == nil {
		return Membership{}, false, fmt.Errorf("checkout: database not configured")
	}
	var m Membership
	err := r.pool.QueryRow(ctx, `select id, user_id, title, coalesce(saved_label,''), coalesce(saved_amount,0) from accounts.membership where user_id = $1`, userID).
		Scan(&m.ID, &m.UserID, &m.Title, &m.SavedLabel, &m.SavedAmount)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Membership{}, false, nil
		}
		return Membership{}, false, err
	}
	m.SavedAmount = m.SavedAmount / 100
	return m, true, nil
}

// OrderStatusByUser returns accounts.order_status rows.
func (r *Repo) OrderStatusByUser(ctx context.Context, userID string) ([]OrderStatus, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `select id, user_id, key, label, count from accounts.order_status where user_id = $1 order by id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []OrderStatus{}
	for rows.Next() {
		var s OrderStatus
		if err := rows.Scan(&s.ID, &s.UserID, &s.Key, &s.Label, &s.Count); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// NavByUser returns accounts.nav rows.
func (r *Repo) NavByUser(ctx context.Context, userID string) ([]Nav, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `select user_id, key, rows from accounts.nav where user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Nav{}
	for rows.Next() {
		var n Nav
		if err := rows.Scan(&n.UserID, &n.Key, &n.Rows); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// DetailsByUser returns accounts.details.
func (r *Repo) DetailsByUser(ctx context.Context, userID string) (Details, bool, error) {
	if r.pool == nil {
		return Details{}, false, fmt.Errorf("checkout: database not configured")
	}
	var d Details
	var accountID *string
	err := r.pool.QueryRow(ctx, `select user_id, account_id, data from accounts.details where user_id = $1`, userID).
		Scan(&d.UserID, &accountID, &d.Data)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Details{}, false, nil
		}
		return Details{}, false, err
	}
	if accountID != nil {
		d.AccountID = *accountID
	}
	return d, true, nil
}
