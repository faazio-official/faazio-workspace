package checkout

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/cartstock"
	"github.com/faazio/server/gateway/internal/platform/authtest"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ---------------------------------------------------------------------------
// Workflow 1 — customer places a COD order (transaction + idempotency) and pays.
//
// These tests drive the real checkout HTTP handler against a real Postgres
// (testenv.Pool skips cleanly when no DB is configured) with the identity
// injected by authtest. External collaborators that place-order does not need
// (rewards, promo, ads, surge, weather, festivals, notifier, razorpay, signer)
// are intentionally nil so the test exercises the transaction/lock/gate paths.
// ---------------------------------------------------------------------------

func newCheckoutRouter(t *testing.T) (http.Handler, *pgxpool.Pool, *cache.Cache) {
	t.Helper()
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	repo := NewWithCache(pool, c)
	svc := NewService(repo, cartstock.New(pool), c, nil, nil, nil, nil, nil, nil, nil)
	h := NewHandler(repo, svc, c, nil, nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	h.Register(r)
	return r, pool, c
}

func callAPI(t *testing.T, h http.Handler, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// pickStockedProduct returns a product with a store and at least minQty in stock.
func pickStockedProduct(t *testing.T, pool *pgxpool.Pool, minQty int64) (productID, storeID string, qty int64) {
	t.Helper()
	err := pool.QueryRow(context.Background(), `
		select p.id, p.store_id, st.in_stock_qty
		  from catalog.products p join inventory.stock st on st.product_id = p.id
		 where p.store_id is not null and st.available and st.in_stock_qty >= $1
		 order by st.in_stock_qty desc limit 1`, minQty).Scan(&productID, &storeID, &qty)
	if err != nil {
		t.Skipf("no stocked product with a store: %v", err)
	}
	return productID, storeID, qty
}

func stockQty(t *testing.T, pool *pgxpool.Pool, productID string) int64 {
	t.Helper()
	var q int64
	if err := pool.QueryRow(context.Background(),
		`select in_stock_qty from inventory.stock where product_id = $1`, productID).Scan(&q); err != nil {
		t.Fatalf("read stock: %v", err)
	}
	return q
}

// cleanupOrder reverses a placed order + its stock movement.
func cleanupOrder(pool *pgxpool.Pool, c *cache.Cache, orderID, productID string, n int64) func() {
	return func() {
		ctx := context.Background()
		_, _ = pool.Exec(ctx, `delete from checkout.payments where order_id = $1`, orderID)
		_, _ = pool.Exec(ctx, `delete from checkout.order_items where order_id = $1`, orderID)
		_, _ = pool.Exec(ctx, `delete from checkout.idempotency_keys where order_id = $1`, orderID)
		_, _ = pool.Exec(ctx, `delete from checkout.orders where order_id = $1`, orderID)
		_, _ = pool.Exec(ctx, `update inventory.stock set in_stock_qty = in_stock_qty + $2 where product_id = $1`, productID, n)
		c.Del(ctx, cache.Stock(productID))
	}
}

func TestPlaceOrderCODHappyPathTransaction(t *testing.T) {
	h, pool, c := newCheckoutRouter(t)
	ctx := context.Background()
	productID, _, _ := pickStockedProduct(t, pool, 2)
	before := stockQty(t, pool, productID)

	key := fmt.Sprintf("it-cod-%d", time.Now().UnixNano())
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"idempotencyKey":%q,"paymentMethod":"COD","fulfillment":"PICKUP"}`, productID, key)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var order struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &order); err != nil || order.ID == "" {
		t.Fatalf("decode order: %v (%s)", err, rec.Body.String())
	}
	t.Cleanup(cleanupOrder(pool, c, order.ID, productID, 1))

	// All four rows land in one transaction.
	var orders, items, payments, idem int
	pool.QueryRow(ctx, `select count(*) from checkout.orders where order_id=$1`, order.ID).Scan(&orders)
	pool.QueryRow(ctx, `select count(*) from checkout.order_items where order_id=$1`, order.ID).Scan(&items)
	pool.QueryRow(ctx, `select count(*) from checkout.payments where order_id=$1`, order.ID).Scan(&payments)
	pool.QueryRow(ctx, `select count(*) from checkout.idempotency_keys where "key"=$1`, key).Scan(&idem)
	if orders != 1 || items < 1 || payments != 1 || idem != 1 {
		t.Fatalf("rows: order=%d items=%d payments=%d idem=%d (want 1,>=1,1,1)", orders, items, payments, idem)
	}
	var method, status string
	pool.QueryRow(ctx, `select method, status from checkout.payments where order_id=$1`, order.ID).Scan(&method, &status)
	if method != "COD" || status != "PAID" {
		t.Fatalf("payment = (%s,%s), want (COD,PAID)", method, status)
	}
	if got := stockQty(t, pool, productID); got != before-1 {
		t.Fatalf("stock = %d, want %d (one decrement)", got, before-1)
	}
}

func TestPlaceOrderIdempotencyReplay(t *testing.T) {
	h, pool, c := newCheckoutRouter(t)
	ctx := context.Background()
	productID, _, _ := pickStockedProduct(t, pool, 3)
	before := stockQty(t, pool, productID)

	key := fmt.Sprintf("it-replay-%d", time.Now().UnixNano())
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"idempotencyKey":%q,"paymentMethod":"COD","fulfillment":"PICKUP"}`, productID, key)

	first := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if first.Code != http.StatusCreated {
		t.Fatalf("first status = %d body=%s", first.Code, first.Body.String())
	}
	var o1, o2 struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(first.Body.Bytes(), &o1)
	t.Cleanup(cleanupOrder(pool, c, o1.ID, productID, 1))

	second := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if second.Code != http.StatusCreated {
		t.Fatalf("replay status = %d body=%s", second.Code, second.Body.String())
	}
	_ = json.Unmarshal(second.Body.Bytes(), &o2)
	if o1.ID == "" || o2.ID != o1.ID {
		t.Fatalf("replay order id %q != original %q (duplicate order!)", o2.ID, o1.ID)
	}

	var orders int
	pool.QueryRow(ctx, `select count(*) from checkout.orders where order_id=$1`, o1.ID).Scan(&orders)
	if orders != 1 {
		t.Fatalf("orders = %d, want 1", orders)
	}
	if got := stockQty(t, pool, productID); got != before-1 {
		t.Fatalf("stock = %d, want %d (single decrement on replay)", got, before-1)
	}
}

func TestPlaceOrderIdempotencyLockHeld(t *testing.T) {
	h, pool, c := newCheckoutRouter(t)
	testenv.RequireCache(t, c)
	productID, _, _ := pickStockedProduct(t, pool, 1)

	ctx := context.Background()
	key := fmt.Sprintf("it-lock-%d", time.Now().UnixNano())
	if err := c.AcquireLock(ctx, cache.Idempotency(key), 300*time.Second); err != nil {
		t.Fatalf("pre-acquire lock: %v", err)
	}
	t.Cleanup(func() { c.ReleaseLock(ctx, cache.Idempotency(key)) })

	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"idempotencyKey":%q,"fulfillment":"PICKUP"}`, productID, key)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 for held idempotency lock (%s)", rec.Code, rec.Body.String())
	}
}

func TestPlaceOrderEmptyItems(t *testing.T) {
	h, _, _ := newCheckoutRouter(t)
	rec := callAPI(t, h, http.MethodPost, "/orders", `{"items":[],"fulfillment":"PICKUP"}`, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "empty_items") {
		t.Fatalf("body = %s, want empty_items", rec.Body.String())
	}
}

func TestPlaceOrderOutOfStockRollsBack(t *testing.T) {
	h, pool, _ := newCheckoutRouter(t)
	ctx := context.Background()
	var productID string
	if err := pool.QueryRow(ctx, `
		select product_id from inventory.stock
		 where available and in_stock_qty >= 1 and in_stock_qty < 99
		 order by in_stock_qty limit 1`).Scan(&productID); err != nil {
		t.Skipf("no low-stock product: %v", err)
	}
	before := stockQty(t, pool, productID)

	key := fmt.Sprintf("it-oos-%d", time.Now().UnixNano())
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":99}],"idempotencyKey":%q,"fulfillment":"PICKUP"}`, productID, key)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 out_of_stock (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "out_of_stock") {
		t.Fatalf("body = %s, want out_of_stock", rec.Body.String())
	}
	// Atomic rollback: no order/idempotency row, stock untouched.
	var idem int
	pool.QueryRow(ctx, `select count(*) from checkout.idempotency_keys where "key"=$1`, key).Scan(&idem)
	if idem != 0 {
		t.Fatalf("idempotency rows = %d, want 0 (tx must roll back)", idem)
	}
	if got := stockQty(t, pool, productID); got != before {
		t.Fatalf("stock = %d, want unchanged %d", got, before)
	}
}

func TestPlaceOrderAddressNotOwned(t *testing.T) {
	h, pool, _ := newCheckoutRouter(t)
	productID, _, _ := pickStockedProduct(t, pool, 1)
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"addressId":"addr-not-mine-xyz","fulfillment":"DELIVERY"}`, productID)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 invalid_address (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "invalid_address") {
		t.Fatalf("body = %s, want invalid_address", rec.Body.String())
	}
}

func TestPlaceOrderInvalidDiscountCard(t *testing.T) {
	h, pool, _ := newCheckoutRouter(t)
	productID, _, _ := pickStockedProduct(t, pool, 1)
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"useDiscountCard":true,"fulfillment":"PICKUP"}`, productID)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "invalid_discount_card") {
		t.Fatalf("status = %d body=%s, want 400 invalid_discount_card", rec.Code, rec.Body.String())
	}
	_ = pool
}

func TestPlaceOrderInvalidCoupon(t *testing.T) {
	h, pool, _ := newCheckoutRouter(t)
	productID, _, _ := pickStockedProduct(t, pool, 1)
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"couponCode":"NOPE-CODE","fulfillment":"PICKUP"}`, productID)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "invalid_coupon") {
		t.Fatalf("status = %d body=%s, want 400 invalid_coupon", rec.Code, rec.Body.String())
	}
}

func TestPayOrderCODCreatesReceiptAndInvalidatesCache(t *testing.T) {
	h, pool, c := newCheckoutRouter(t)
	ctx := context.Background()
	productID, _, _ := pickStockedProduct(t, pool, 2)

	key := fmt.Sprintf("it-pay-%d", time.Now().UnixNano())
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"idempotencyKey":%q,"paymentMethod":"UPI","fulfillment":"PICKUP"}`, productID, key)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("place status = %d body=%s", rec.Code, rec.Body.String())
	}
	var order struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &order)
	t.Cleanup(cleanupOrder(pool, c, order.ID, productID, 1))

	// Prime the orders cache, then switch-to-COD: a recorded payment must purge it.
	c.SetJSON(ctx, cache.Orders("user-1"), []Order{{ID: order.ID}}, time.Minute)

	pay := callAPI(t, h, http.MethodPost, "/orders/"+order.ID+"/payments", `{"method":"COD"}`, nil)
	if pay.Code != http.StatusCreated {
		t.Fatalf("payment status = %d body=%s", pay.Code, pay.Body.String())
	}
	var p struct {
		Method string `json:"method"`
		Status string `json:"status"`
	}
	_ = json.Unmarshal(pay.Body.Bytes(), &p)
	if p.Method != "COD" || p.Status != "PAID" {
		t.Fatalf("payment = (%s,%s), want (COD,PAID)", p.Method, p.Status)
	}
	var cached []Order
	if c.GetJSON(ctx, cache.Orders("user-1"), &cached) {
		t.Fatal("orders cache was not invalidated by payOrder")
	}
	// The UPI gate is cleared by the recorded payment.
	var payStatus string
	pool.QueryRow(ctx, `select payment_status from checkout.orders where order_id=$1`, order.ID).Scan(&payStatus)
	if payStatus != "PAID" {
		t.Fatalf("payment_status = %q, want PAID", payStatus)
	}
}

// TestPayOrderRepeatedRecordsSecondPayment_KNOWN_GAP documents a real flaw found by
// flaw-detection: POST /orders/{id}/payments is NOT idempotent. A retry (double-tap, network
// re-send, switch-to-COD after a partial UPI attempt) inserts a SECOND payment ledger row instead
// of returning the existing one, unlike placeOrder which is guarded by an idempotency key.
// The test deliberately asserts the current (buggy) behaviour so it is captured, not hidden; when
// payOrder gains idempotency this test must be updated to assert a single row.
func TestPayOrderRepeatedRecordsSecondPayment_KNOWN_GAP(t *testing.T) {
	h, pool, c := newCheckoutRouter(t)
	ctx := context.Background()
	productID, _, _ := pickStockedProduct(t, pool, 2)

	key := fmt.Sprintf("it-pay2-%d", time.Now().UnixNano())
	body := fmt.Sprintf(`{"items":[{"productId":%q,"qty":1}],"idempotencyKey":%q,"paymentMethod":"COD","fulfillment":"PICKUP"}`, productID, key)
	rec := callAPI(t, h, http.MethodPost, "/orders", body, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("place status = %d body=%s", rec.Code, rec.Body.String())
	}
	var order struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &order)
	t.Cleanup(cleanupOrder(pool, c, order.ID, productID, 1))

	// Placement already records one COD payment row (paymentMethod != "").
	var before int
	pool.QueryRow(ctx, `select count(*) from checkout.payments where order_id=$1`, order.ID).Scan(&before)
	if before != 1 {
		t.Fatalf("payments after placement = %d, want 1", before)
	}

	for i := 0; i < 2; i++ {
		r := callAPI(t, h, http.MethodPost, "/orders/"+order.ID+"/payments", `{"method":"COD"}`, nil)
		if r.Code != http.StatusCreated {
			t.Fatalf("payment #%d status = %d body=%s", i+1, r.Code, r.Body.String())
		}
	}
	var after int
	pool.QueryRow(ctx, `select count(*) from checkout.payments where order_id=$1`, order.ID).Scan(&after)
	if after != before+2 {
		t.Fatalf("payments = %d; expected the known-gap behaviour of %d (a fix should keep this at %d)", after, before+2, before)
	}
	t.Log("KNOWN GAP: payOrder is not idempotent — each retry inserts another checkout.payments row")
}
