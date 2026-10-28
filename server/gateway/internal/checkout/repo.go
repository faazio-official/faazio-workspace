// Package checkout serves the checkout/orders + accounts context. Future service: Go
// + CockroachDB (monolith-breakdown §1). Owns the derived rating-eligibility gate.
package checkout

import (
	"context"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/faazio/server/gateway/internal/platform/taxmath"
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
	Pickup         json.RawMessage `json:"pickup,omitempty"`
	Pickups        json.RawMessage `json:"pickups,omitempty"`
	// DeliveryLatitude/Longitude are the customer's live drop fix captured at placement. Internal
	// only (never serialized to the app): auto-dispatch at PACKED and admin assignment use them.
	DeliveryLatitude  *float64 `json:"-"`
	DeliveryLongitude *float64 `json:"-"`

	// Tax/invoice snapshot. Amounts are server-derived at placement and immutable afterwards.
	InvoiceID         string `json:"invoiceId,omitempty"`
	InvoiceNumber     string `json:"invoiceNumber,omitempty"`
	InvoiceURL        string `json:"invoiceUrl,omitempty"`
	TaxableValuePaisa int64  `json:"taxableValuePaisa,omitempty"`
	ProductTaxPaisa   int64  `json:"productTaxPaisa,omitempty"`
	PlatformFeePaisa  int64  `json:"platformFeePaisa,omitempty"`
	PlatformGSTPaisa  int64  `json:"platformGstPaisa,omitempty"`
	DeliveryFeePaisa  int64  `json:"deliveryFeePaisa,omitempty"`
	TCSPaisa          int64  `json:"tcsPaisa,omitempty"`
	TDSPaisa          int64  `json:"tdsPaisa,omitempty"`
	TotalChargedPaisa int64  `json:"totalChargedPaisa,omitempty"`

	// Server-computed delivery basis persisted at placement; payout reuses these surges 1:1.
	DeliveryZoneID       string          `json:"deliveryZoneId,omitempty"`
	DeliveryDistanceKm   float64         `json:"deliveryDistanceKm,omitempty"`
	DeliverySurgePaisa   int64           `json:"deliverySurgePaisa,omitempty"`
	DeliverySurgeReason  string          `json:"deliverySurgeReason,omitempty"`
	DeliveryBillingBasis json.RawMessage `json:"deliveryBillingBasis,omitempty"`

	// RefundedPaisa is set on a seller rejection response so the app can show the customer refund
	// amount. It is never stored on checkout.orders (the payment ledger owns money state).
	RefundedPaisa int64 `json:"refundedPaisa,omitempty"`
	// RejectionReason is the seller's NEW → REJECTED reason (bounded to 500 bytes server-side).
	RejectionReason string `json:"rejectionReason,omitempty"`
}

// SellerScope is the caller's order-visibility scope. A seller sees orders touching their own
// stores; a district admin sees sellers in their district (legacy district-less sellers fall back
// to the parent state); a super admin sees every order. At least one of the fields must be set or
// the SQL predicate matches nothing.
type SellerScope struct {
	SellerID     string
	StateCode    string
	DistrictCode string
	SuperAdmin   bool
}

// OrderTracking is the lightweight owner-scoped status projection (polling/monitoring): no line
// items, addresses or payments. Status is already mapped to the mobile vocabulary.
type OrderTracking struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	StatusDate string `json:"statusDate,omitempty"`
	PlacedAt   string `json:"placedAt"`
}

// Payment is one checkout.payments row, JSON shaped for PaymentRow (amount in rupees).
type Payment struct {
	ID            string `json:"id"`
	OrderID       string `json:"orderId"`
	UserID        string `json:"userId"`
	Method        string `json:"method"`
	Amount        int64  `json:"amount"`
	CoinsRedeemed int64  `json:"coinsRedeemed"`
	Status        string `json:"status"`
	CreatedAt     string `json:"createdAt"`
	// AmountPaisa is the exact ledger amount (json-hidden). Fractional-km delivery fees mean the
	// whole-rupee wire Amount can lose paise, so the DB write must use this when set.
	AmountPaisa int64 `json:"-"`
}

// ledgerPaisa is the exact amount to persist: the paisa field when the caller set it, otherwise
// the whole-rupee wire figure (migrations pre-dating fractional delivery fees).
func (p Payment) ledgerPaisa() int64 {
	if p.AmountPaisa > 0 {
		return p.AmountPaisa
	}
	return p.Amount * 100
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

// ResolveUserID maps a verified auth subject (Firebase UID) to the app user slug (auth.UserResolver). The mapping
// is immutable for a given subject, so it is read-through cached for 1 h — removing a query from
// every authenticated request. Invalidation (profile merge) deletes cache.AuthUser(subject).
//
// Read-only: a subject with no checkout.users row resolves to "" (the caller is then treated as
// unauthenticated by auth.Require). New phone-OTP users are provisioned by ProvisionUserID, which
// auth.Middleware prefers when the resolver implements it.
func (r *Repo) ResolveUserID(ctx context.Context, authUID string) (string, error) {
	if r.pool == nil {
		return "", fmt.Errorf("checkout: database not configured")
	}
	if cached, ok := r.cachedUserID(ctx, authUID); ok {
		return cached, nil
	}
	var userID string
	err := r.pool.QueryRow(ctx, `select user_id from checkout.users where auth_uid = $1`, authUID).Scan(&userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	r.cacheUserID(ctx, authUID, userID)
	return userID, nil
}

// ProvisionUserID implements auth.UserProvisioner: it resolves the auth subject, inserting a
// checkout.users row on first login so a Firebase phone-OTP user works without a portal/manual row.
// The user slug is deterministic from the subject (`u-<sha256 prefix>`), so a concurrent first
// login converges on one row via `on conflict (auth_uid)`. Phone/email are optional (empty when the
// token omits them) and only forward-filled — never overwritten with blank values.
func (r *Repo) ProvisionUserID(ctx context.Context, authUID, phone, email string) (string, error) {
	if authUID == "" {
		return "", nil
	}
	if r.pool == nil {
		return "", fmt.Errorf("checkout: database not configured")
	}
	if cached, ok := r.cachedUserID(ctx, authUID); ok {
		return cached, nil
	}
	sum := sha256.Sum256([]byte(authUID))
	userID := "u-" + hex.EncodeToString(sum[:8])
	var linked bool
	lookupErr := r.pool.QueryRow(ctx,
		`select coalesce(auth_uid = $2, false) from checkout.users where user_id = $1`,
		userID, authUID).Scan(&linked)
	if lookupErr != nil && lookupErr != pgx.ErrNoRows {
		return "", lookupErr
	}
	if lookupErr == nil && !linked {
		userID = userID + "-" + shortAddrID()
	}
	var (
		resolved      string
		resolvedEmail string
		resolvedPhone string
	)
	err := r.pool.QueryRow(ctx, `
		insert into checkout.users (user_id, auth_uid, name, email, phone, last_login_at)
		values ($1, $2, 'Faazio User', $3, $4, now())
		on conflict (auth_uid) do update
		   set email = coalesce(nullif(excluded.email, ''), checkout.users.email),
		       phone = coalesce(nullif(excluded.phone, ''), checkout.users.phone),
		       last_login_at = now()
		returning user_id, email, phone`, userID, authUID, email, phone).Scan(&resolved, &resolvedEmail, &resolvedPhone)
	if err != nil {
		return "", err
	}
	// The account screens read accounts.profile; without this row a brand-new user would see the
	// @data fixture (a fabricated name/phone) instead of their own (possibly empty) details. The
	// upsert only forward-fills non-empty values so it never erases a profile the user has edited.
	if _, err := r.pool.Exec(ctx, `
		insert into accounts.profile (id, account_id, name, email, phone)
		values ($1, $1, 'Faazio User', $2, $3)
		on conflict (id) do update
		   set email = coalesce(nullif(excluded.email, ''), accounts.profile.email),
		       phone = coalesce(nullif(excluded.phone, ''), accounts.profile.phone),
		       updated_at = now()`, resolved, resolvedEmail, resolvedPhone); err != nil {
		return "", err
	}
	r.cacheUserID(ctx, authUID, resolved)
	return resolved, nil
}

// cachedUserID returns the read-through cached auth_uid → user_id mapping when present.
func (r *Repo) cachedUserID(ctx context.Context, authUID string) (string, bool) {
	if r.cache == nil || !r.cache.Enabled() {
		return "", false
	}
	var cached string
	if r.cache.GetJSON(ctx, cache.AuthUser(authUID), &cached) && cached != "" {
		return cached, true
	}
	return "", false
}

func (r *Repo) cacheUserID(ctx context.Context, authUID, userID string) {
	if userID == "" || r.cache == nil || !r.cache.Enabled() {
		return
	}
	r.cache.SetJSON(ctx, cache.AuthUser(authUID), userID, cache.TTLAuth)
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
	rows, err := r.pool.Query(ctx, orderHeaderSelect+` where user_id = $1 order by placed_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	orders, err := scanOrderHeaders(rows)
	if err != nil {
		return nil, err
	}
	return r.attachOrderItems(ctx, orders)
}

const orderHeaderSelect = `
select order_id, order_number, user_id, coalesce(address_id,''), placed_at, status::text,
       status_date, coalesce(fulfillment::text,''), vendor_store_ids, pickup, pickups,
       coalesce(invoice_id,''), coalesce(taxable_value_paisa,0), coalesce(product_tax_paisa,0),
       coalesce(platform_fee_paisa,0), coalesce(platform_gst_paisa,0), coalesce(delivery_fee_paisa,0),
       coalesce(tcs_paisa,0), coalesce(tds_paisa,0), coalesce(total_charged_paisa,0),
       coalesce(delivery_zone_id,''), coalesce(delivery_distance_km,0)::float8,
       coalesce(delivery_surge_paisa,0), coalesce(delivery_surge_reason,''), delivery_billing_basis,
       coalesce(rejection_reason,'')
  from checkout.orders`

func scanOrderHeaders(rows pgx.Rows) ([]Order, error) {
	orders := []Order{}
	for rows.Next() {
		var (
			o          Order
			placedAt   time.Time
			statusDate *time.Time
			pickup     []byte
			pickups    []byte
			basis      []byte
		)
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.UserID, &o.AddressID, &placedAt, &o.Status,
			&statusDate, &o.Fulfillment, &o.VendorStoreIDs, &pickup, &pickups,
			&o.InvoiceID, &o.TaxableValuePaisa, &o.ProductTaxPaisa, &o.PlatformFeePaisa,
			&o.PlatformGSTPaisa, &o.DeliveryFeePaisa, &o.TCSPaisa, &o.TDSPaisa,
			&o.TotalChargedPaisa, &o.DeliveryZoneID, &o.DeliveryDistanceKm,
			&o.DeliverySurgePaisa, &o.DeliverySurgeReason, &basis, &o.RejectionReason); err != nil {
			return nil, err
		}
		o.Pickup = json.RawMessage(pickup)
		o.Pickups = json.RawMessage(pickups)
		o.DeliveryBillingBasis = json.RawMessage(basis)
		o.PlacedAt = placedAt.UTC().Format(time.RFC3339)
		if statusDate != nil {
			o.StatusDate = statusDate.UTC().Format(time.RFC3339)
		}
		o.LineItems = []OrderLineItem{}
		orders = append(orders, o)
	}
	return orders, rows.Err()
}

func (r *Repo) attachOrderItems(ctx context.Context, orders []Order) ([]Order, error) {
	if len(orders) == 0 {
		return orders, nil
	}
	index := make(map[string]int, len(orders))
	for i, o := range orders {
		index[o.ID] = i
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

// sellerScopePredicate is the shared order-authorization predicate. Parameters:
// $1 superAdmin, $2 sellerID, $3 districtCode, $4 stateCode. The district branch joins the seller
// row so an admin can never broaden their view by passing a sellerId query parameter.
const sellerScopePredicate = `(
	$1
	or ($2 <> '' and exists (
	      select 1 from directory.stores s
	       where s.seller_id = $2 and s.id = any(vendor_store_ids)))
	or ($2 = '' and ($3 <> '' or $4 <> '') and exists (
	      select 1 from directory.stores s
	        join sellers.sellers sl on sl.seller_id = s.seller_id
	       where s.id = any(vendor_store_ids)
	         and (($3 <> '' and sl.district_code = $3)
	              or ((sl.district_code is null or sl.district_code = '' or $3 = '')
	                  and sl.state_code = $4))))
)`

// SellerOrders returns orders in the caller's scope, newest first. status filters the stored enum
// label (legacy TitleCase or upper-case) when set; filterSellerID narrows an admin to one seller.
func (r *Repo) SellerOrders(ctx context.Context, scope SellerScope, status, filterSellerID string) ([]Order, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, orderHeaderSelect+`
		where `+sellerScopePredicate+`
		  and ($5 = '' or status::text = $5)
		  and ($6 = '' or exists (
		        select 1 from directory.stores fs
		         where fs.seller_id = $6 and fs.id = any(vendor_store_ids)))
		order by placed_at desc`,
		scope.SuperAdmin, scope.SellerID, scope.DistrictCode, scope.StateCode, status, filterSellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	orders, err := scanOrderHeaders(rows)
	if err != nil {
		return nil, err
	}
	return r.attachOrderItems(ctx, orders)
}

// SetOrderStatus transitions an order inside the caller's scope.
func (r *Repo) SetOrderStatus(ctx context.Context, orderID string, scope SellerScope, status string) (Order, bool, error) {
	if r.pool == nil {
		return Order{}, false, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, orderHeaderSelect+`
		where order_id = $5 and `+sellerScopePredicate,
		scope.SuperAdmin, scope.SellerID, scope.DistrictCode, scope.StateCode, orderID)
	if err != nil {
		return Order{}, false, err
	}
	orders, err := scanOrderHeaders(rows)
	rows.Close()
	if err != nil {
		return Order{}, false, err
	}
	if len(orders) == 0 {
		return Order{}, false, nil
	}
	var (
		statusDate time.Time
		newStatus  string
	)
	if err := r.pool.QueryRow(ctx, `
		update checkout.orders set status = $2::order_status, status_date = now()
		 where order_id = $1
		 returning status::text, status_date`, orderID, status).Scan(&newStatus, &statusDate); err != nil {
		return Order{}, false, err
	}
	o := orders[0]
	o.Status = newStatus
	o.StatusDate = statusDate.UTC().Format(time.RFC3339)
	return o, true, nil
}

// SellerOrderByID returns one order with its line items when it is inside the caller's scope. It
// is the read gate for seller accept/reject/detail.
func (r *Repo) SellerOrderByID(ctx context.Context, orderID string, scope SellerScope) (Order, bool, error) {
	if r.pool == nil {
		return Order{}, false, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, orderHeaderSelect+`
		where order_id = $5 and `+sellerScopePredicate,
		scope.SuperAdmin, scope.SellerID, scope.DistrictCode, scope.StateCode, orderID)
	if err != nil {
		return Order{}, false, err
	}
	orders, err := scanOrderHeaders(rows)
	rows.Close()
	if err != nil {
		return Order{}, false, err
	}
	if len(orders) == 0 {
		return Order{}, false, nil
	}
	withItems, err := r.attachOrderItems(ctx, orders)
	if err != nil {
		return Order{}, false, err
	}
	if err := r.pool.QueryRow(ctx, `
		select coalesce(sum(amount_paisa), 0)
		  from checkout.payments
		 where order_id = $1 and status = 'REFUNDED'`, orderID).Scan(&withItems[0].RefundedPaisa); err != nil {
		return Order{}, false, err
	}
	return withItems[0], true, nil
}

// TransitionSellerOrder atomically moves an order from one status to another inside the caller's
// scope. It returns false when the row is missing, out of scope, or no longer in the expected
// status (the caller maps that to a 409 conflict).
func (r *Repo) TransitionSellerOrder(ctx context.Context, orderID string, scope SellerScope, from, to, reason string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("checkout: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update checkout.orders o
		   set status = $5::order_status,
		       status_date = now(),
		       rejection_reason = case when $5 = 'REJECTED' then nullif($6,'') else o.rejection_reason end
		 where o.order_id = $7
		   and o.status::text = $8
		   and `+sellerScopePredicate,
		scope.SuperAdmin, scope.SellerID, scope.DistrictCode, scope.StateCode,
		to, reason, orderID, from)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// RejectSellerOrder atomically moves a NEW order to REJECTED and marks every captured payment row
// REFUNDED in one transaction, returning the refunded amount in paisa. A concurrent decision or an
// out-of-scope caller returns changed=false and nothing is written. A missing payment row (cash on
// delivery) is an honest zero, not an error. Money state never diverges from order state.
func (r *Repo) RejectSellerOrder(ctx context.Context, orderID string, scope SellerScope, from, reason string) (refunded int64, changed bool, err error) {
	if r.pool == nil {
		return 0, false, fmt.Errorf("checkout: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		update checkout.orders o
		   set status = 'REJECTED'::order_status,
		       status_date = now(),
		       rejection_reason = nullif($5,'')
		 where o.order_id = $6
		   and o.status::text = $7
		   and `+sellerScopePredicate,
		scope.SuperAdmin, scope.SellerID, scope.DistrictCode, scope.StateCode,
		reason, orderID, from)
	if err != nil {
		return 0, false, err
	}
	if tag.RowsAffected() == 0 {
		return 0, false, nil
	}
	if err := tx.QueryRow(ctx, `
		with updated as (
		  update checkout.payments set status = 'REFUNDED'
		   where order_id = $1 and status = 'PAID'
		   returning amount_paisa
		)
		select coalesce(sum(amount_paisa), 0) from updated`, orderID).Scan(&refunded); err != nil {
		return 0, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, false, err
	}
	return refunded, true, nil
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
		pickup     []byte
		pickups    []byte
		basis      []byte
	)
	err := r.pool.QueryRow(ctx, `
		select order_id, order_number, user_id, coalesce(address_id,''), placed_at, status::text,
		       status_date, coalesce(fulfillment::text,''), vendor_store_ids, pickup, pickups,
		       coalesce(invoice_id,''), coalesce(taxable_value_paisa,0), coalesce(product_tax_paisa,0),
		       coalesce(platform_fee_paisa,0), coalesce(platform_gst_paisa,0), coalesce(delivery_fee_paisa,0),
		       coalesce(tcs_paisa,0), coalesce(tds_paisa,0), coalesce(total_charged_paisa,0),
		       coalesce(delivery_zone_id,''), coalesce(delivery_distance_km,0)::float8,
		       coalesce(delivery_surge_paisa,0), coalesce(delivery_surge_reason,''), delivery_billing_basis
		  from checkout.orders where order_id = $1`, orderID).
		Scan(&o.ID, &o.OrderNumber, &o.UserID, &o.AddressID, &placedAt, &o.Status,
			&statusDate, &o.Fulfillment, &o.VendorStoreIDs, &pickup, &pickups,
			&o.InvoiceID, &o.TaxableValuePaisa, &o.ProductTaxPaisa, &o.PlatformFeePaisa,
			&o.PlatformGSTPaisa, &o.DeliveryFeePaisa, &o.TCSPaisa, &o.TDSPaisa,
			&o.TotalChargedPaisa, &o.DeliveryZoneID, &o.DeliveryDistanceKm,
			&o.DeliverySurgePaisa, &o.DeliverySurgeReason, &basis)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Order{}, false, nil
		}
		return Order{}, false, err
	}
	o.Pickup = json.RawMessage(pickup)
	o.Pickups = json.RawMessage(pickups)
	o.DeliveryBillingBasis = json.RawMessage(basis)
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
	App        string
	Category   string
	PricePaisa int64
	SellerID   string
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
	rows, err := r.pool.Query(ctx, `
		select p.id, p.name, p.app::text, p.category, p.price_paisa,
		       coalesce(p.seller_id, s.seller_id, ''), p.store_id
		  from catalog.products p
		  left join directory.stores s on s.id = p.store_id
		 where p.id = any($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s ProductSnapshot
		if err := rows.Scan(&s.ID, &s.Name, &s.App, &s.Category, &s.PricePaisa, &s.SellerID, &s.StoreID); err != nil {
			return nil, err
		}
		out[s.ID] = s
	}
	return out, rows.Err()
}

// SellerTaxProfile is the seller identity + commission settings needed for tax and invoicing.
type SellerTaxProfile struct {
	SellerID       string
	BusinessName   string
	GSTIN          string
	PlatformFeePct int
}

// TaxRates returns the active category GST rates keyed by "SECTOR|lower(category)".
func (r *Repo) TaxRates(ctx context.Context) (map[string]int, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select sector::text, lower(category), gst_rate_pct
		  from tax.tax_rates where is_active`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var sector, category string
		var rate int
		if err := rows.Scan(&sector, &category, &rate); err != nil {
			return nil, err
		}
		out[sector+"|"+category] = rate
	}
	return out, rows.Err()
}

// PlatformRates reads the singleton tax rate card (falls back to statutory defaults).
func (r *Repo) PlatformRates(ctx context.Context) (taxmath.Rates, error) {
	if r.pool == nil {
		return taxmath.DefaultRates(), nil
	}
	var (
		gst float64
		tcs float64
		tds float64
		fee int64
	)
	err := r.pool.QueryRow(ctx, `
		select platform_gst_pct::float8, tcs_pct::float8, tds_pct::float8, delivery_fee_paisa
		  from tax.platform_settings where id = 1`).Scan(&gst, &tcs, &tds, &fee)
	if err != nil {
		if err == pgx.ErrNoRows {
			return taxmath.DefaultRates(), nil
		}
		return taxmath.DefaultRates(), err
	}
	return taxmath.Rates{PlatformGSTPct: gst, TCSPct: tcs, TDSPct: tds, DeliveryFeePaisa: fee}, nil
}

// DeliveryFeeSettings reads the singleton dynamic delivery-fee rate card
// (tax.delivery_fee_settings). Falls back to 3 km / ₹35 / ₹7-per-extra-km when the row is absent.
func (r *Repo) DeliveryFeeSettings(ctx context.Context) (DeliveryFeeSettings, error) {
	if r.pool == nil {
		return DefaultDeliveryFeeSettings(), nil
	}
	var (
		baseKm   float64
		baseFee  int64
		perExtra int64
	)
	err := r.pool.QueryRow(ctx, `
		select base_distance_km::float8, base_fee_paisa, per_extra_km_paisa
		  from tax.delivery_fee_settings where id = 1`).Scan(&baseKm, &baseFee, &perExtra)
	if err != nil {
		if err == pgx.ErrNoRows {
			return DefaultDeliveryFeeSettings(), nil
		}
		return DefaultDeliveryFeeSettings(), err
	}
	return DeliveryFeeSettings{BaseDistanceKm: baseKm, BaseFeePaisa: baseFee, PerExtraKmPaisa: perExtra}, nil
}

// StoreCoordinate is a pinned directory.stores location used for delivery-fee math.
type StoreCoordinate struct {
	Latitude  float64
	Longitude float64
}

// StoreCoordinates returns pinned coordinates for the given store ids; stores without a pin are
// simply absent from the map (the caller falls back to the rate card's base fee for the order).
func (r *Repo) StoreCoordinates(ctx context.Context, storeIDs []string) (map[string]StoreCoordinate, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	out := map[string]StoreCoordinate{}
	if len(storeIDs) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		select id, latitude, longitude
		  from directory.stores
		 where id = any($1) and latitude is not null and longitude is not null`, storeIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c StoreCoordinate
		var id string
		if err := rows.Scan(&id, &c.Latitude, &c.Longitude); err != nil {
			return nil, err
		}
		out[id] = c
	}
	return out, rows.Err()
}

// SellerTaxProfiles returns commission/GST identity for the given sellers.
func (r *Repo) SellerTaxProfiles(ctx context.Context, sellerIDs []string) (map[string]SellerTaxProfile, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	out := map[string]SellerTaxProfile{}
	if len(sellerIDs) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		select seller_id, business_name, coalesce(gstin,''), platform_fee_pct
		  from sellers.sellers where seller_id = any($1)`, sellerIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var p SellerTaxProfile
		if err := rows.Scan(&p.SellerID, &p.BusinessName, &p.GSTIN, &p.PlatformFeePct); err != nil {
			return nil, err
		}
		out[p.SellerID] = p
	}
	return out, rows.Err()
}

// InsertInvoice writes the immutable tax invoice for an order (idempotent on order_id).
func (r *Repo) InsertInvoice(ctx context.Context, inv taxmath.Invoice) error {
	if r.pool == nil {
		return fmt.Errorf("checkout: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		insert into tax.tax_invoices
		  (invoice_id, invoice_number, order_id, order_number, customer_id, seller_id, seller_name,
		   seller_gstin, tax_rate_pct, taxable_value_paisa, product_tax_paisa, platform_fee_paisa,
		   platform_gst_paisa, delivery_fee_paisa, tcs_paisa, tds_paisa, coupon_discount_paisa,
		   total_paisa, seller_net_paisa, pdf_key)
		values ($1,$2,$3,$4,$5,nullif($6,''),$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,nullif($20,''))
		on conflict (order_id) do nothing`,
		inv.InvoiceID, inv.InvoiceNumber, inv.OrderID, inv.OrderNumber, inv.CustomerID,
		inv.SellerID, inv.SellerName, inv.SellerGSTIN, inv.TaxRatePct, inv.TaxableValuePaisa,
		inv.ProductTaxPaisa, inv.PlatformFeePaisa, inv.PlatformGSTPaisa, inv.DeliveryFeePaisa,
		inv.TCSPaisa, inv.TDSPaisa, inv.CouponDiscountPaisa, inv.TotalPaisa, inv.SellerNetPaisa,
		inv.PDFKey)
	return err
}

// InvoiceForUser returns the invoice for one of the caller's own orders.
func (r *Repo) InvoiceForUser(ctx context.Context, orderID, userID string) (taxmath.Invoice, bool, error) {
	if r.pool == nil {
		return taxmath.Invoice{}, false, fmt.Errorf("checkout: database not configured")
	}
	var inv taxmath.Invoice
	err := r.pool.QueryRow(ctx, `
		select invoice_id, invoice_number, order_id, order_number, customer_id, coalesce(seller_id,''),
		       seller_name, seller_gstin, tax_rate_pct, taxable_value_paisa, product_tax_paisa,
		       platform_fee_paisa, platform_gst_paisa, delivery_fee_paisa, tcs_paisa, tds_paisa,
		       coupon_discount_paisa, total_paisa, seller_net_paisa, coalesce(pdf_key,'')
		  from tax.tax_invoices where order_id = $1 and customer_id = $2`, orderID, userID).
		Scan(&inv.InvoiceID, &inv.InvoiceNumber, &inv.OrderID, &inv.OrderNumber, &inv.CustomerID, &inv.SellerID,
			&inv.SellerName, &inv.SellerGSTIN, &inv.TaxRatePct, &inv.TaxableValuePaisa,
			&inv.ProductTaxPaisa, &inv.PlatformFeePaisa, &inv.PlatformGSTPaisa,
			&inv.DeliveryFeePaisa, &inv.TCSPaisa, &inv.TDSPaisa, &inv.CouponDiscountPaisa,
			&inv.TotalPaisa, &inv.SellerNetPaisa, &inv.PDFKey)
	if err != nil {
		if err == pgx.ErrNoRows {
			return taxmath.Invoice{}, false, nil
		}
		return taxmath.Invoice{}, false, err
	}
	return inv, true, nil
}

// WithTx runs fn inside one DB transaction, committing when it returns nil and rolling back
// otherwise. Used by CreateOrder so the stock decrements and the order insert (plus idempotency
// key, invoice and payment) commit or roll back together — a failed insert never leaves stock
// drained without an order.
func (r *Repo) WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	if r.pool == nil {
		return fmt.Errorf("checkout: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// InsertOrder writes an order, its line items, an optional payment row, and (when idempotencyKey is
// set) the replay record in one transaction, so a retry can never observe an order without its
// idempotency key. The optional payment is passed as a variadic to keep existing callers source-stable.
func (r *Repo) InsertOrder(ctx context.Context, o Order, lines []OrderLineItem, idempotencyKey string, invoices []taxmath.Invoice, payments ...Payment) error {
	if r.pool == nil {
		return fmt.Errorf("checkout: database not configured")
	}
	return r.WithTx(ctx, func(tx pgx.Tx) error {
		return r.InsertOrderTx(ctx, tx, o, lines, idempotencyKey, invoices, payments...)
	})
}

// InsertOrderTx writes the order + lines + invoice + payment + idempotency record on a caller-owned
// transaction (no commit — the caller controls the boundary, e.g. to include stock decrements).
func (r *Repo) InsertOrderTx(ctx context.Context, tx pgx.Tx, o Order, lines []OrderLineItem, idempotencyKey string, invoices []taxmath.Invoice, payments ...Payment) error {
	var fulfillment any
	if o.Fulfillment == "PICKUP" || o.Fulfillment == "DELIVERY" {
		fulfillment = o.Fulfillment
	}
	if _, err := tx.Exec(ctx, `
		insert into checkout.orders
		  (order_id, order_number, user_id, address_id, placed_at, status, fulfillment, total_paisa, vendor_store_ids, pickup, pickups,
		   delivery_latitude, delivery_longitude, invoice_id, taxable_value_paisa, product_tax_paisa,
		   platform_fee_paisa, platform_gst_paisa, delivery_fee_paisa, tcs_paisa, tds_paisa, total_charged_paisa,
		   delivery_zone_id, delivery_distance_km, delivery_surge_paisa, delivery_surge_reason, delivery_billing_basis)
		values ($1,$2,$3,$4, now(), $5::order_status, $6::fulfillment_mode, $7, $8, $9::jsonb, $10::jsonb, $11, $12,
		        nullif($13,''), $14, $15, $16, $17, $18, $19, $20, $21,
		        nullif($22,''), $23, $24, $25, $26::jsonb)`,
		o.ID, o.OrderNumber, o.UserID, nullIfEmpty(o.AddressID), o.Status, fulfillment, totalPaisa(lines), o.VendorStoreIDs,
		nullIfEmptyJSON(o.Pickup), nullIfEmptyJSON(o.Pickups), o.DeliveryLatitude, o.DeliveryLongitude,
		o.InvoiceID, o.TaxableValuePaisa, o.ProductTaxPaisa, o.PlatformFeePaisa, o.PlatformGSTPaisa,
		o.DeliveryFeePaisa, o.TCSPaisa, o.TDSPaisa, o.TotalChargedPaisa,
		o.DeliveryZoneID, o.DeliveryDistanceKm, o.DeliverySurgePaisa, o.DeliverySurgeReason,
		nullIfEmptyJSON(o.DeliveryBillingBasis)); err != nil {
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
	for _, inv := range invoices {
		if _, err := tx.Exec(ctx, `
			insert into tax.tax_invoices
			  (invoice_id, invoice_number, order_id, order_number, customer_id, seller_id, seller_name,
			   seller_gstin, tax_rate_pct, taxable_value_paisa, product_tax_paisa, platform_fee_paisa,
			   platform_gst_paisa, delivery_fee_paisa, tcs_paisa, tds_paisa, coupon_discount_paisa,
			   total_paisa, seller_net_paisa, pdf_key)
			values ($1,$2,$3,$4,$5,nullif($6,''),$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,nullif($20,''))
			on conflict (order_id) do nothing`,
			inv.InvoiceID, inv.InvoiceNumber, inv.OrderID, inv.OrderNumber, inv.CustomerID,
			inv.SellerID, inv.SellerName, inv.SellerGSTIN, inv.TaxRatePct, inv.TaxableValuePaisa,
			inv.ProductTaxPaisa, inv.PlatformFeePaisa, inv.PlatformGSTPaisa, inv.DeliveryFeePaisa,
			inv.TCSPaisa, inv.TDSPaisa, inv.CouponDiscountPaisa, inv.TotalPaisa, inv.SellerNetPaisa,
			inv.PDFKey); err != nil {
			return err
		}
	}
	if len(payments) > 0 {
		p := payments[0]
		if _, err := tx.Exec(ctx, `
			insert into checkout.payments (id, order_id, user_id, method, amount_paisa, coins_redeemed, status)
			values ($1,$2,$3,$4,$5,$6,$7)`,
			p.ID, o.ID, o.UserID, p.Method, p.ledgerPaisa(), p.CoinsRedeemed, p.Status); err != nil {
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
	return nil
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

func nullIfEmptyJSON(v json.RawMessage) any {
	if len(v) == 0 {
		return nil
	}
	return string(v)
}

// OrderTotalForUser returns an order's stored total (paisa) when it belongs to userID.
func (r *Repo) OrderTotalForUser(ctx context.Context, orderID, userID string) (int64, bool, error) {
	if r.pool == nil {
		return 0, false, fmt.Errorf("checkout: database not configured")
	}
	var total int64
	err := r.pool.QueryRow(ctx, `
		select coalesce(nullif(total_charged_paisa,0), total_paisa)
		  from checkout.orders where order_id = $1 and user_id = $2`, orderID, userID).Scan(&total)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return total, true, nil
}

// InsertPayment records a payment for an order the caller owns (server derives the order link).
func (r *Repo) InsertPayment(ctx context.Context, p Payment) error {
	if r.pool == nil {
		return fmt.Errorf("checkout: database not configured")
	}
	_, err := r.pool.Exec(ctx, `
		insert into checkout.payments (id, order_id, user_id, method, amount_paisa, coins_redeemed, status)
		values ($1,$2,$3,$4,$5,$6,$7)`,
		p.ID, p.OrderID, p.UserID, p.Method, p.ledgerPaisa(), p.CoinsRedeemed, p.Status)
	return err
}

// PaymentsByUser returns the caller's payment rows, newest first.
func (r *Repo) PaymentsByUser(ctx context.Context, userID string) ([]Payment, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select id, order_id, user_id, method, amount_paisa, coins_redeemed, status, created_at
		  from checkout.payments where user_id = $1 order by created_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Payment{}
	for rows.Next() {
		var (
			p         Payment
			createdAt time.Time
		)
		if err := rows.Scan(&p.ID, &p.OrderID, &p.UserID, &p.Method, &p.Amount, &p.CoinsRedeemed, &p.Status, &createdAt); err != nil {
			return nil, err
		}
		p.Amount = p.Amount / 100
		p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, p)
	}
	return out, rows.Err()
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
		if err != pgx.ErrNoRows {
			return Profile{}, false, err
		}
		// Legacy/first-login users may not have an accounts.profile row yet. Fall back to the
		// checkout.users identity (real, possibly empty contact fields) instead of returning 404 and
		// letting the app render the @data fixture as if it were the signed-in user.
		var name, email, phone string
		if err := r.pool.QueryRow(ctx, `select name, email, phone from checkout.users where user_id = $1`, userID).
			Scan(&name, &email, &phone); err != nil {
			if err == pgx.ErrNoRows {
				return Profile{}, false, nil
			}
			return Profile{}, false, err
		}
		return Profile{ID: userID, AccountID: userID, Name: name, Email: email, Phone: phone}, true, nil
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

// Address is one checkout.addresses row (delivery PII — auth-scoped only).
type Address struct {
	AddressID string `json:"addressId"`
	Label     string `json:"label,omitempty"`
	Name      string `json:"name,omitempty"`
	Phone     string `json:"phone,omitempty"`
	Address   string `json:"address"`
	IsDefault bool   `json:"isDefault"`
}

// AddressesByUser returns the caller's saved addresses (default first).
func (r *Repo) AddressesByUser(ctx context.Context, userID string) ([]Address, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select coalesce(address_id,''), coalesce(label,''), coalesce(name,''), coalesce(phone,''), address, is_default
		  from checkout.addresses where user_id = $1 order by is_default desc, address_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Address{}
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.AddressID, &a.Label, &a.Name, &a.Phone, &a.Address, &a.IsDefault); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// UpsertAddress inserts or updates an address owned by userID. When the supplied id does not belong
// to the caller the write is refused (ok=false). Setting isDefault clears the caller's other defaults.
func (r *Repo) UpsertAddress(ctx context.Context, userID string, a Address) (Address, bool, error) {
	if r.pool == nil {
		return Address{}, false, fmt.Errorf("checkout: database not configured")
	}
	if a.Address == "" || len(a.Address) > 512 {
		return Address{}, false, fmt.Errorf("checkout: invalid address")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Address{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if a.AddressID == "" {
		a.AddressID = "addr-" + shortAddrID()
	} else {
		var owner string
		err := tx.QueryRow(ctx, `select user_id from checkout.addresses where address_id = $1`, a.AddressID).Scan(&owner)
		if err != nil {
			if err != pgx.ErrNoRows {
				return Address{}, false, err
			}
		} else if owner != userID {
			return Address{}, false, nil
		}
	}
	if a.IsDefault {
		if _, err := tx.Exec(ctx, `update checkout.addresses set is_default = false where user_id = $1`, userID); err != nil {
			return Address{}, false, err
		}
	}
	if _, err := tx.Exec(ctx, `
		insert into checkout.addresses (address_id, user_id, label, name, phone, address, is_default)
		values ($1,$2,$3,$4,$5,$6,$7)
		on conflict (address_id) do update
		  set label = excluded.label, name = excluded.name, phone = excluded.phone,
		      address = excluded.address, is_default = excluded.is_default`,
		a.AddressID, userID, a.Label, nullIfEmpty(a.Name), nullIfEmpty(a.Phone), a.Address, a.IsDefault); err != nil {
		return Address{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Address{}, false, err
	}
	return a, true, nil
}

// DeleteAddress removes an address owned by userID. It returns ok=false when the address does not
// exist or belongs to a different caller, so a cross-user delete is a no-op, never an error.
func (r *Repo) DeleteAddress(ctx context.Context, userID, addressID string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("checkout: database not configured")
	}
	if addressID == "" {
		return false, nil
	}
	tag, err := r.pool.Exec(ctx, `delete from checkout.addresses where address_id = $1 and user_id = $2`, addressID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// DeleteAccount erases a customer's personal data and anonymises their checkout.users row. The row
// is kept because checkout.orders, checkout.payments and tax.tax_invoices reference it for
// tax/accounting/dispute-resolution retention; those financial rows survive but are no longer
// linked to a name, email or phone. auth_uid is unlinked so a stale Firebase token can never
// resolve (or re-provision) the deleted identity. It returns the previous auth_uid for cache
// invalidation and ok=false when the user does not exist. Repeated calls are idempotent.
func (r *Repo) DeleteAccount(ctx context.Context, userID string) (authUID string, ok bool, err error) {
	if r.pool == nil {
		return "", false, fmt.Errorf("checkout: database not configured")
	}
	if userID == "" {
		return "", false, nil
	}
	var alreadyDeleted bool
	err = r.pool.QueryRow(ctx, `select coalesce(auth_uid, ''), deleted_at is not null
		from checkout.users where user_id = $1`, userID).Scan(&authUID, &alreadyDeleted)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if alreadyDeleted {
		return authUID, true, nil
	}

	// Order matters only for readability: every statement is scoped to this user (or to the user's
	// own delivery orders) and the whole set commits atomically.
	statements := []string{
		`delete from checkout.addresses where user_id = $1`,
		`delete from inventory.carts where user_id = $1`,
		// Stock reservations are left to the existing expiry sweep: deleting them here would
		// release the row without restoring the stock it holds.
		`delete from favourites.items where user_id = $1`,
		`delete from rewards.ledger where user_id = $1`,
		`delete from rewards.balances where user_id = $1`,
		`delete from pharma.prescriptions where user_id = $1`,
		`delete from blood.interests where donor_user_id = $1`,
		`delete from blood.match_requests where requester_user_id = $1 or donor_user_id = $1`,
		`delete from blood.donors where user_id = $1`,
		// The author's own posted requests carry contact/address PII; interests on them cascade.
		`delete from blood.requests where created_by = $1`,
		`delete from notifications.outbox where user_id = $1`,
		`delete from notifications.push_tokens where user_id = $1`,
		`delete from delivery.delivery_ratings where customer_id = $1`,
		`delete from accounts.profile where id = $1 or account_id = $1`,
		`delete from accounts.membership where user_id = $1`,
		`delete from accounts.order_status where user_id = $1`,
		`delete from accounts.nav where user_id = $1`,
		`delete from accounts.details where user_id = $1`,
		`update support.tickets set user_id = null, subject = '', body = '' where user_id = $1`,
		`update checkout.returns set reason = '' where user_id = $1`,
		`update reviews.vendor_reviews set user_name = 'Deleted user', comment = null where user_id = $1`,
		`update media.assets set created_by = '' where created_by = $1`,
		`update checkout.orders
		    set delivery_latitude = null, delivery_longitude = null
		  where user_id = $1`,
		`update delivery.delivery_stops s
		    set label = '', address = '', latitude = null, longitude = null,
		        customer_name = '', customer_phone = '', customer_otp_hash = null,
		        otp_expires_at = null, failure_reason = null
		   from delivery.delivery_orders o
		  where s.delivery_order_id = o.order_id
		    and s.stop_type = 'DROP'
		    and o.customer_order_id in (select order_id from checkout.orders where user_id = $1)`,
		// route_sequence lists the drop stop ids carried by a rider; when a rider's linked
		// checkout.users row is deleted, reset it so no retained route can point at PII coords
		// (rider_id is a delivery_boys slug, so scope through delivery_boys.user_id).
		`update delivery.delivery_orders o
		    set route_sequence = '[]'::jsonb
		   where o.rider_id in (select rider_id from delivery.delivery_boys where user_id = $1)`,
	}
	err = r.WithTx(ctx, func(tx pgx.Tx) error {
		for _, q := range statements {
			if _, execErr := tx.Exec(ctx, q, userID); execErr != nil {
				return execErr
			}
		}
		_, execErr := tx.Exec(ctx, `
			update checkout.users
			   set name = 'Deleted user',
			       email = $2,
			       phone = '',
			       default_address_id = null,
			       state_code = null,
			       last_login_at = null,
			       auth_uid = null,
			       deleted_at = now()
			 where user_id = $1`, userID, deletedAccountEmail(userID))
		return execErr
	})
	if err != nil {
		return "", false, err
	}
	return authUID, true, nil
}

// ReviewedVendorIDs lists the vendors whose public review pages include this user's display name.
// The account-deletion handler purges those caches after anonymising the review rows.
func (r *Repo) ReviewedVendorIDs(ctx context.Context, userID string) ([]string, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx,
		`select vendor_id from reviews.vendor_reviews where user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// PrescriptionImagePaths returns the private object keys referenced by the user's prescriptions.
// Callers read them before deleting the rows so the blobs can be removed from object storage too.
func (r *Repo) PrescriptionImagePaths(ctx context.Context, userID string) ([]string, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select distinct p
		  from pharma.prescriptions, unnest(image_paths) as p
		 where user_id = $1 and p <> ''`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}
	return paths, rows.Err()
}

// DeleteUserData erases the selected categories of personal data while keeping the account active.
// Order/payment/tax records are intentionally not a category: they are retained for legal reasons.
func (r *Repo) DeleteUserData(ctx context.Context, userID string, categories []string) ([]string, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("checkout: database not configured")
	}
	if userID == "" || len(categories) == 0 {
		return nil, nil
	}
	allowed := map[string]string{
		"addresses":     `delete from checkout.addresses where user_id = $1`,
		"favourites":    `delete from favourites.items where user_id = $1`,
		"prescriptions": `delete from pharma.prescriptions where user_id = $1`,
	}
	done := make([]string, 0, len(categories))
	seen := make(map[string]bool, len(categories))
	err := r.WithTx(ctx, func(tx pgx.Tx) error {
		for _, category := range categories {
			q, ok := allowed[category]
			if !ok || seen[category] {
				continue
			}
			seen[category] = true
			if _, execErr := tx.Exec(ctx, q, userID); execErr != nil {
				return execErr
			}
			if category == "addresses" {
				if _, execErr := tx.Exec(ctx,
					`update checkout.users set default_address_id = null
					  where user_id = $1 and default_address_id is not null`, userID); execErr != nil {
					return execErr
				}
			}
			done = append(done, category)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return done, nil
}

// deletedAccountEmail is deterministic and non-routable (.invalid) so the retained, anonymised row
// still satisfies the NOT NULL email column without keeping the customer's real address.
func deletedAccountEmail(userID string) string {
	return "deleted+" + userID + "@deleted.invalid"
}

// OrderOwnedBy reports whether the order belongs to userID (contracts.OrderOwnership). It is a
// single indexed lookup so sibling contexts (delivery ratings) can enforce ownership without
// loading the full order.
func (r *Repo) OrderOwnedBy(ctx context.Context, orderID, userID string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("checkout: database not configured")
	}
	var owner string
	err := r.pool.QueryRow(ctx, `select user_id from checkout.orders where order_id = $1`, orderID).Scan(&owner)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return owner == userID, nil
}

// OrderDetail returns one order with line items when it belongs to userID.
func (r *Repo) OrderDetail(ctx context.Context, orderID, userID string) (Order, bool, error) {
	if r.pool == nil {
		return Order{}, false, fmt.Errorf("checkout: database not configured")
	}
	var owner string
	if err := r.pool.QueryRow(ctx, `select user_id from checkout.orders where order_id = $1`, orderID).Scan(&owner); err != nil {
		if err == pgx.ErrNoRows {
			return Order{}, false, nil
		}
		return Order{}, false, err
	}
	if owner != userID {
		return Order{}, false, nil
	}
	return r.OrderByID(ctx, orderID)
}

// DeliveryContext is the minimal order + customer drop projection auto-dispatch needs. It is
// internal-only (PII never leaves the gateway; no JSON tags needed for a client response).
type DeliveryContext struct {
	OrderID       string
	UserID        string
	AddressID     string
	Fulfillment   string
	StoreIDs      []string
	CustomerName  string
	CustomerPhone string
	CustomerAddr  string
	Latitude      *float64
	Longitude     *float64
}

// DeliveryContextForOrder reads the sender drop snapshot for one order (no ownership scope: the
// caller is the order-status transition, already authorized). Missing rows return ok=false.
func (r *Repo) DeliveryContextForOrder(ctx context.Context, orderID string) (DeliveryContext, bool, error) {
	if r.pool == nil {
		return DeliveryContext{}, false, fmt.Errorf("checkout: database not configured")
	}
	var dc DeliveryContext
	var fulfillment *string
	err := r.pool.QueryRow(ctx, `
		select o.order_id, o.user_id, coalesce(o.address_id,''), o.fulfillment::text,
		       vendor_store_ids, coalesce(a.name,''), coalesce(a.phone,''), coalesce(a.address,''),
		       o.delivery_latitude, o.delivery_longitude
		  from checkout.orders o
		  left join checkout.addresses a on a.address_id = o.address_id
		 where o.order_id = $1`, orderID).
		Scan(&dc.OrderID, &dc.UserID, &dc.AddressID, &fulfillment, &dc.StoreIDs,
			&dc.CustomerName, &dc.CustomerPhone, &dc.CustomerAddr, &dc.Latitude, &dc.Longitude)
	if err == pgx.ErrNoRows {
		return DeliveryContext{}, false, nil
	}
	if err != nil {
		return DeliveryContext{}, false, err
	}
	if fulfillment != nil {
		dc.Fulfillment = *fulfillment
	}
	return dc, true, nil
}

// OrderTrackingForUser returns the lightweight status projection for one of the caller's own orders
// (never cross-user). Used by the app's order-tracking poll so it does not refetch full orders.
func (r *Repo) OrderTrackingForUser(ctx context.Context, orderID, userID string) (OrderTracking, bool, error) {
	if r.pool == nil {
		return OrderTracking{}, false, fmt.Errorf("checkout: database not configured")
	}
	var (
		t          OrderTracking
		placedAt   time.Time
		statusDate *time.Time
	)
	err := r.pool.QueryRow(ctx, `
		select order_id, status::text, status_date, placed_at
		  from checkout.orders where order_id = $1 and user_id = $2`, orderID, userID).
		Scan(&t.ID, &t.Status, &statusDate, &placedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return OrderTracking{}, false, nil
		}
		return OrderTracking{}, false, err
	}
	t.PlacedAt = placedAt.UTC().Format(time.RFC3339)
	if statusDate != nil {
		t.StatusDate = statusDate.UTC().Format(time.RFC3339)
	}
	t.Status = mobileStatus(t.Status)
	return t, true, nil
}

func shortAddrID() string {
	b := make([]byte, 5)
	_, _ = crand.Read(b)
	return hex.EncodeToString(b)
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
