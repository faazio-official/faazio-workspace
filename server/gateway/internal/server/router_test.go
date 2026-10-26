package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/config"
	"github.com/faazio/server/gateway/internal/platform/r2"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newTestServer(t *testing.T) (http.Handler, *pgxpool.Pool, *cache.Cache) {
	t.Helper()
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	cfg := config.Config{
		AuthDisabled:   true,
		DevUserID:      "user-1",
		AllowedOrigins: []string{"http://localhost:3000"},
	}
	return NewRouter(Deps{Config: cfg, Pool: pool, Cache: c}), pool, c
}

func do(t *testing.T, h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("Content-Type", "application/json")
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

// TestRouterRegistersWithDeps exercises every route registration (chi panics on conflicts) using a
// dependency-free router, so a new/duplicated pattern fails fast without a database.
func TestRouterRegistersWithDeps(t *testing.T) {
	if NewRouter(Deps{Config: config.Config{AuthDisabled: true}}) == nil {
		t.Fatal("nil router")
	}
}

// TestAssetsRedirectWithoutOrigin covers the no-CDN public-media route with media disabled/nil signer:
// the stable /assets/{key} path must 404 rather than mint an unsigned URL.
func TestAssetsRedirectWithoutOrigin(t *testing.T) {
	h := NewRouter(Deps{Config: config.Config{AuthDisabled: true}})
	rec := do(t, h, http.MethodGet, "/assets/media/ab/x.jpg", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

// TestAssetsRedirectPresigns covers the no-CDN public-media route with a signer: /assets/{key} must 302
// to a short-lived presigned GET on the public bucket so cached JSON can hold a stable URL.
func TestAssetsRedirectPresigns(t *testing.T) {
	signer := r2.New(r2.Config{
		AccountID: "acct123", AccessKeyID: "AKIAEXAMPLE", SecretKey: "secret",
		PublicBase: "https://gateway.faazio.com",
	})
	h := NewRouter(Deps{Config: config.Config{AuthDisabled: true}, Signer: signer})
	rec := do(t, h, http.MethodGet, "/assets/media/ab/x.jpg", nil)
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if !strings.HasPrefix(loc, "https://acct123.r2.cloudflarestorage.com/faazio-public/media/ab/x.jpg?") {
		t.Fatalf("Location = %q", loc)
	}
	if !strings.Contains(loc, "X-Amz-Signature=") {
		t.Fatalf("Location not presigned: %q", loc)
	}
}

// TestCORSWildcardReflectsOrigin covers the temporary `ALLOWED_ORIGINS=*` posture: any Origin is
// reflected (not "*") so bearer/credentialed calls behave and Vary stays correct.
func TestCORSWildcardReflectsOrigin(t *testing.T) {
	h := NewRouter(Deps{Config: config.Config{AuthDisabled: true, AllowedOrigins: []string{"*"}}})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://anything.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://anything.example" {
		t.Fatalf("Allow-Origin = %q", got)
	}
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("Vary = %q", got)
	}
}

// TestCORSWildcardIgnoredInProd covers the enterprise posture: `ALLOWED_ORIGINS=*` no longer
// reflects an arbitrary origin when auth is enabled (AUTH_DISABLED=false).
func TestCORSWildcardIgnoredInProd(t *testing.T) {
	h := NewRouter(Deps{Config: config.Config{AuthDisabled: false, AllowedOrigins: []string{"*"}}})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Allow-Origin = %q, want empty in prod", got)
	}
}

// TestCORSDevHeadersAdvertisedInDev guards that every X-Dev-* header the middleware reads is also
// allowed through a dev preflight (a missing one silently blocks browser dev calls before the
// gateway can read the role/district override).
func TestCORSDevHeadersAdvertisedInDev(t *testing.T) {
	h := NewRouter(Deps{Config: config.Config{AuthDisabled: true, AllowedOrigins: []string{"http://localhost:3000"}}})
	req := httptest.NewRequest(http.MethodOptions, "/health", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	got := rec.Header().Get("Access-Control-Allow-Headers")
	for _, header := range []string{"X-Dev-User", "X-Dev-Role", "X-Dev-Seller", "X-Dev-State", "X-Dev-District"} {
		if !strings.Contains(got, header) {
			t.Fatalf("Allow-Headers = %q, want %s", got, header)
		}
	}
}

// TestCORSDevHeadersNotAdvertisedInProd guards that a prod preflight never invites the X-Dev-* headers.
func TestCORSDevHeadersNotAdvertisedInProd(t *testing.T) {
	h := NewRouter(Deps{Config: config.Config{AuthDisabled: false, AllowedOrigins: []string{"https://portal.example"}}})
	req := httptest.NewRequest(http.MethodOptions, "/health", nil)
	req.Header.Set("Origin", "https://portal.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Headers"); strings.Contains(got, "X-Dev-") {
		t.Fatalf("Allow-Headers = %q, want no dev headers", got)
	}
}

// TestHealthReportsDependencies covers the deeper /health probe shape used by Render's health-check.
func TestHealthReportsDependencies(t *testing.T) {
	h, _, _ := newTestServer(t)
	rec := do(t, h, http.MethodGet, "/health", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got struct {
		Status       string                    `json:"status"`
		Dependencies map[string]map[string]any `json:"dependencies"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Status != "ok" {
		t.Fatalf("status = %q", got.Status)
	}
	db, ok := got.Dependencies["db"]
	if !ok || db["ok"] != true {
		t.Fatalf("db dependency = %v", got.Dependencies["db"])
	}
	if _, ok := db["ms"]; !ok {
		t.Fatalf("db dependency missing latency: %v", db)
	}
}

// TestCORSRejectsUnlistedOrigin guards the allow-list path: an origin not configured gets no CORS
// headers (the pre-change behavior must keep working).
func TestCORSRejectsUnlistedOrigin(t *testing.T) {
	h := NewRouter(Deps{Config: config.Config{AuthDisabled: true, AllowedOrigins: []string{"https://portal.example"}}})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Allow-Origin = %q, want empty", got)
	}
}

func TestHealth(t *testing.T) {
	h, _, _ := newTestServer(t)
	rec := do(t, h, http.MethodGet, "/health", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var got map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["db"] != true {
		t.Fatalf("db = %v, want true", got["db"])
	}
}

func TestSearchEndpoint(t *testing.T) {
	h, _, _ := newTestServer(t)
	rec := do(t, h, http.MethodGet, "/search?q=coffee", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var hits []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &hits); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(hits) == 0 {
		t.Fatal("expected coffee hits")
	}
}

type stockResp struct {
	ProductID  string `json:"productId"`
	InStockQty int64  `json:"inStockQty"`
}

func TestCreateOrderDecrementsStockAndInvalidatesCache(t *testing.T) {
	h, pool, c := newTestServer(t)
	ctx := context.Background()
	productID, _, qty := pickStockedProduct(t, pool, 2)

	key := fmt.Sprintf("e2e-order-%d", time.Now().UnixNano())
	rec := do(t, h, http.MethodPost, "/orders", map[string]any{
		"items":          []map[string]any{{"productId": productID, "qty": 1}},
		"idempotencyKey": key,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("place order status = %d body=%s", rec.Code, rec.Body.String())
	}
	var order struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &order); err != nil || order.ID == "" {
		t.Fatalf("decode order: %v (%s)", err, rec.Body.String())
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `delete from checkout.order_items where order_id = $1`, order.ID)
		pool.Exec(ctx, `delete from checkout.orders where order_id = $1`, order.ID)
		pool.Exec(ctx, `update inventory.stock set in_stock_qty = in_stock_qty + 1 where product_id = $1`, productID)
		c.Del(ctx, cache.Stock(productID))
	})

	// Prime the cache, then confirm a fresh order keeps it consistent via the Del.
	rec = do(t, h, http.MethodGet, "/stock/"+productID, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("get stock status = %d", rec.Code)
	}
	var st stockResp
	if err := json.Unmarshal(rec.Body.Bytes(), &st); err != nil {
		t.Fatal(err)
	}
	if st.InStockQty != qty-1 {
		t.Fatalf("stock = %d, want %d", st.InStockQty, qty-1)
	}
}

func TestCreateOrderInsufficientStock(t *testing.T) {
	h, pool, _ := newTestServer(t)
	var productID string
	err := pool.QueryRow(context.Background(), `
		select product_id from inventory.stock
		 where available and in_stock_qty >= 1 and in_stock_qty < 99
		 order by in_stock_qty limit 1`).Scan(&productID)
	if err != nil {
		t.Skipf("no low-stock product: %v", err)
	}
	rec := do(t, h, http.MethodPost, "/orders", map[string]any{
		"items": []map[string]any{{"productId": productID, "qty": 99}},
	})
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateOrderIdempotencyLock(t *testing.T) {
	h, pool, c := newTestServer(t)
	testenv.RequireCache(t, c)
	productID, _, _ := pickStockedProduct(t, pool, 1)

	ctx := context.Background()
	key := fmt.Sprintf("e2e-lock-%d", time.Now().UnixNano())
	if err := c.AcquireLock(ctx, cache.Idempotency(key), 300*time.Second); err != nil {
		t.Fatalf("pre-acquire lock: %v", err)
	}
	t.Cleanup(func() { c.ReleaseLock(ctx, cache.Idempotency(key)) })

	rec := do(t, h, http.MethodPost, "/orders", map[string]any{
		"items":          []map[string]any{{"productId": productID, "qty": 1}},
		"idempotencyKey": key,
	})
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 for held lock (%s)", rec.Code, rec.Body.String())
	}
}

func TestVendorRatingGate(t *testing.T) {
	h, pool, c := newTestServer(t)
	ctx := context.Background()
	productID, storeID, _ := pickStockedProduct(t, pool, 1)

	// Establish purchase proof by ordering the product's store.
	rec := do(t, h, http.MethodPost, "/orders", map[string]any{
		"items":          []map[string]any{{"productId": productID, "qty": 1}},
		"idempotencyKey": fmt.Sprintf("e2e-rate-%d", time.Now().UnixNano()),
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("proof order status = %d (%s)", rec.Code, rec.Body.String())
	}
	var order struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &order)
	t.Cleanup(func() {
		pool.Exec(ctx, `delete from checkout.order_items where order_id = $1`, order.ID)
		pool.Exec(ctx, `delete from checkout.orders where order_id = $1`, order.ID)
		pool.Exec(ctx, `update inventory.stock set in_stock_qty = in_stock_qty + 1 where product_id = $1`, productID)
		pool.Exec(ctx, `delete from reviews.vendor_reviews where id = $1`, "vr-user-1-"+storeID)
		c.Del(ctx, cache.Stock(productID), cache.VendorReviews(storeID))
	})

	rec = do(t, h, http.MethodPut, "/vendors/"+storeID+"/rating", map[string]any{"rating": 5, "comment": "e2e"})
	if rec.Code != http.StatusOK {
		t.Fatalf("eligible rate status = %d (%s)", rec.Code, rec.Body.String())
	}

	// A vendor the user has never ordered from must be rejected.
	var ineligible string
	err := pool.QueryRow(ctx, `
		select id from directory.stores
		 where id <> all (select unnest(vendor_store_ids) from checkout.orders where user_id = 'user-1')
		 limit 1`).Scan(&ineligible)
	if err == nil {
		rec = do(t, h, http.MethodPut, "/vendors/"+ineligible+"/rating", map[string]any{"rating": 1})
		if rec.Code != http.StatusForbidden {
			t.Fatalf("ineligible rate status = %d, want 403 (%s)", rec.Code, rec.Body.String())
		}
	}

	rec = do(t, h, http.MethodPut, "/vendors/"+storeID+"/rating", map[string]any{"rating": 9})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid rating status = %d, want 400", rec.Code)
	}
}

func TestStoresEndpointPaginates(t *testing.T) {
	h, _, _ := newTestServer(t)
	rec := do(t, h, http.MethodGet, "/stores?limit=5", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if rec.Header().Get("X-Next-Cursor") == "" {
		t.Fatal("expected X-Next-Cursor")
	}
}

func TestStoreProductsEndpoint(t *testing.T) {
	h, pool, _ := newTestServer(t)
	ctx := context.Background()
	storeID := fmt.Sprintf("st-e2e-%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, rating)
		values ($1,'MART','Store Products E2E', 4.2)`, storeID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID) })

	pid := fmt.Sprintf("prod-e2e-%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, `
		insert into catalog.products (id, app, category, name, price_paisa, store_id, rating, status)
		values ($1,'MART','Test','E2E Active', 10000, $2, 4.2, 'ACTIVE')`, pid, storeID); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from catalog.products where id=$1`, pid) })

	rec := do(t, h, http.MethodGet, "/stores/"+storeID+"/products", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var got []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got) != 1 || got[0]["id"] != pid {
		t.Fatalf("products = %+v, want the seeded ACTIVE row", got)
	}

	// Unknown store → 200 with an empty list (not a 404), so the drill-in renders "no products".
	rec = do(t, h, http.MethodGet, "/stores/does-not-exist/products", nil)
	if rec.Code != http.StatusOK || rec.Body.String() != "[]\n" {
		t.Fatalf("unknown store = %d %q, want 200 []", rec.Code, rec.Body.String())
	}
}
