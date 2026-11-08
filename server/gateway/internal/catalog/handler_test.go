package catalog

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/authtest"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// handlerRouter builds the real catalog Handler over a real Postgres pool, with the in-process
// identity injector so table-driven tests can act as a seller/admin without minting JWTs. media may
// be nil (no image-linking) or a fake MediaReader.
func handlerRouter(t *testing.T, pool *pgxpool.Pool, c *cache.Cache, media contracts.MediaReader) http.Handler {
	t.Helper()
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	NewHandler(New(pool), c, nil, media, nil).Register(r)
	return r
}

func call(t *testing.T, h http.Handler, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
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

// seedSellerAndStore inserts a seller + a live store it owns, returning both ids. Cleanup removes the
// store's products/stock first so FKs never block teardown.
func seedSellerAndStore(t *testing.T, pool *pgxpool.Pool, district string) (sellerID, storeID string) {
	t.Helper()
	ctx := context.Background()
	sellerID = "sel-cth-" + manageID("")
	storeID = "store-cth-" + manageID("")
	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, state_code, district_code)
		values ($1,'Handler Test','O','TN',$2)`, sellerID, district); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into directory.stores (id, app, name, seller_id, state_code, is_live, latitude, longitude)
		values ($1,'MART','Handler Store',$2,'TN',true,17.44,78.38)`, storeID, sellerID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `delete from inventory.stock where product_id in (
			select id from catalog.products where store_id=$1)`, storeID)
		_, _ = pool.Exec(ctx, `delete from catalog.products where store_id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from directory.stores where id=$1`, storeID)
		_, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id=$1`, sellerID)
	})
	return sellerID, storeID
}

func sellerHeaders(sellerID string) map[string]string {
	return map[string]string{"X-Dev-Role": "SELLER", "X-Dev-Seller": sellerID, "X-Dev-User": sellerID}
}

// fakeMedia is an in-memory contracts.MediaReader so the handler's image-link resolution can be
// exercised without importing the media context (boundary rule §2).
type fakeMedia struct {
	assets map[string]contracts.MediaAsset
}

func (f fakeMedia) ByID(_ context.Context, id string) (contracts.MediaAsset, bool, error) {
	a, ok := f.assets[id]
	return a, ok, nil
}

func (f fakeMedia) ByKey(_ context.Context, key string) (contracts.MediaAsset, bool, error) {
	for _, a := range f.assets {
		if a.Key == key {
			return a, true, nil
		}
	}
	return contracts.MediaAsset{}, false, nil
}

func TestCreateProductHandlerHappyPath(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	h := handlerRouter(t, pool, c, nil)
	sellerA, storeA := seedSellerAndStore(t, pool, "TCH")

	rec := call(t, h, http.MethodPost, "/seller/products",
		`{"storeId":"`+storeA+`","name":"New Listing","category":"Test","description":"A test listing","price":199,"unit":"1 pc"}`,
		sellerHeaders(sellerA))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	var p SellerProduct
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("decode: %v (%s)", err, rec.Body.String())
	}
	if p.Status != "PENDING_REVIEW" || p.Price != 199 || p.StoreID != storeA {
		t.Fatalf("projection mismatch: %+v", p)
	}

	// catalog.products row: PENDING_REVIEW + price stored in paisa.
	var (
		status string
		paisa  int64
		imgURL string
	)
	if err := pool.QueryRow(context.Background(),
		`select status::text, price_paisa, coalesce(image_url,'') from catalog.products where id=$1`, p.ID).
		Scan(&status, &paisa, &imgURL); err != nil {
		t.Fatalf("product row missing: %v", err)
	}
	if status != "PENDING_REVIEW" || paisa != 19900 || imgURL != "" {
		t.Fatalf("product row = status %q paisa %d imageURL %q", status, paisa, imgURL)
	}

	// inventory.stock row: available, qty 0, matching price.
	var (
		qty        int64
		stockPaisa int64
		available  bool
	)
	if err := pool.QueryRow(context.Background(),
		`select in_stock_qty, price_paisa, available from inventory.stock where product_id=$1`, p.ID).
		Scan(&qty, &stockPaisa, &available); err != nil {
		t.Fatalf("stock row missing: %v", err)
	}
	if qty != 0 || stockPaisa != 19900 || !available {
		t.Fatalf("stock = qty %d paisa %d available %v", qty, stockPaisa, available)
	}
}

func TestCreateProductHandlerValidation(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	h := handlerRouter(t, pool, c, nil)
	sellerA, storeA := seedSellerAndStore(t, pool, "TCH")
	hdr := sellerHeaders(sellerA)

	longName := strings.Repeat("x", 201)
	cases := []struct {
		name string
		body string
	}{
		{"missing storeId", `{"name":"N","category":"C","price":10}`},
		{"missing name", `{"storeId":"` + storeA + `","category":"C","price":10}`},
		{"missing category", `{"storeId":"` + storeA + `","name":"N","price":10}`},
		{"negative price", `{"storeId":"` + storeA + `","name":"N","category":"C","price":-1}`},
		{"price over cap", `{"storeId":"` + storeA + `","name":"N","category":"C","price":10000001}`},
		{"name too long", `{"storeId":"` + storeA + `","name":"` + longName + `","category":"C","price":10}`},
		{"non-http(s) imageUrl", `{"storeId":"` + storeA + `","name":"N","category":"C","price":10,"imageUrl":"ftp://x/y.jpg"}`},
		{"unknown field", `{"storeId":"` + storeA + `","name":"N","category":"C","price":10,"bogus":true}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := call(t, h, http.MethodPost, "/seller/products", tc.body, hdr)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestCreateProductHandlerAuthZ(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	h := handlerRouter(t, pool, c, nil)
	_, storeA := seedSellerAndStore(t, pool, "TCH")
	sellerB, _ := seedSellerAndStore(t, pool, "TCH")

	body := `{"storeId":"` + storeA + `","name":"N","category":"C","price":10}`

	// A seller cannot create under another seller's store.
	if rec := call(t, h, http.MethodPost, "/seller/products", body, sellerHeaders(sellerB)); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-seller status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}

	// A district admin cannot create in a foreign district.
	foreign := map[string]string{"X-Dev-Role": "DISTRICT_ADMIN", "X-Dev-State": "TN", "X-Dev-District": "TCO"}
	if rec := call(t, h, http.MethodPost, "/seller/products", body, foreign); rec.Code != http.StatusNotFound {
		t.Fatalf("cross-district status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}

	// A super admin may create under any existing store.
	super := map[string]string{"X-Dev-Role": "SUPER_ADMIN"}
	if rec := call(t, h, http.MethodPost, "/seller/products", body, super); rec.Code != http.StatusCreated {
		t.Fatalf("super-admin status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
}

func TestCreateProductHandlerImageR2Resolution(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	sellerA, storeA := seedSellerAndStore(t, pool, "TCH")

	// The r2: reference must resolve to an ACTIVE PUBLIC asset created by the caller.
	media := fakeMedia{assets: map[string]contracts.MediaAsset{
		"media/ab/" + strings.Repeat("ab", 32) + ".jpg": {
			ID: "img_owner", Kind: "PUBLIC", Status: "ACTIVE",
			Key: "media/ab/" + strings.Repeat("ab", 32) + ".jpg", CreatedBy: sellerA,
		},
	}}
	h := handlerRouter(t, pool, c, media)

	key := "media/ab/" + strings.Repeat("ab", 32) + ".jpg"
	body := `{"storeId":"` + storeA + `","name":"With Image","category":"Test","price":50,"imageUrl":"r2:` + key + `"}`
	rec := call(t, h, http.MethodPost, "/seller/products", body, sellerHeaders(sellerA))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	var p SellerProduct
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("decode: %v", err)
	}

	var imageKey, imageURL string
	if err := pool.QueryRow(context.Background(),
		`select coalesce(image_key,''), coalesce(image_url,'') from catalog.products where id=$1`, p.ID).
		Scan(&imageKey, &imageURL); err != nil {
		t.Fatalf("read image columns: %v", err)
	}
	if imageKey != key || imageURL != "" {
		t.Fatalf("image columns = key %q url %q, want %q / empty", imageKey, imageURL, key)
	}

	// An r2: key the registry does not know is rejected.
	unknown := `{"storeId":"` + storeA + `","name":"Bad Image","category":"Test","price":50,"imageUrl":"r2:media/zz/unknown.jpg"}`
	if rec := call(t, h, http.MethodPost, "/seller/products", unknown, sellerHeaders(sellerA)); rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown asset status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

func TestCreateProductHandlerCachePurge(t *testing.T) {
	pool := testenv.Pool(t)
	c := testenv.Cache(t)
	testenv.RequireCache(t, c)
	h := handlerRouter(t, pool, c, nil)
	sellerA, storeA := seedSellerAndStore(t, pool, "TCH")

	ctx := context.Background()
	// The store-products list is the one purge key knowable before the server mints the product id
	// (product/stock keys use the just-minted id). The handler issues all three in one Del call.
	c.SetJSON(ctx, cache.StoreProducts(storeA), []SellerProduct{{ID: "stale"}}, cache.TTLStoreProducts)
	var cached []SellerProduct
	if !c.GetJSON(ctx, cache.StoreProducts(storeA), &cached) {
		t.Fatal("precondition: store-products key should be cached")
	}

	rec := call(t, h, http.MethodPost, "/seller/products",
		`{"storeId":"`+storeA+`","name":"Purge","category":"Test","price":10}`, sellerHeaders(sellerA))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if c.GetJSON(ctx, cache.StoreProducts(storeA), &cached) {
		t.Fatal("store-products cache key survived createProduct — purge did not run")
	}
}
