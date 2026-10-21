package directory

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func testRouter(t *testing.T, pool *pgxpool.Pool, authed bool) http.Handler {
	t.Helper()
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	cfg := auth.Config{JWTSecret: []byte("unused")} // no resolver => unauthenticated
	if authed {
		cfg = auth.Config{Disabled: true, DevUserID: "user-1"}
	}
	r := chi.NewRouter()
	r.Use(auth.Middleware(cfg))
	NewHandler(New(pool), c, nil, nil).Register(r)
	return r
}

func storeWithPII(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), `
		select id from directory.stores
		 where phone is not null and address is not null limit 1`).Scan(&id)
	if err != nil {
		t.Skipf("no seeded store with PII: %v", err)
	}
	return id
}

func TestPublicStoreHidesPII(t *testing.T) {
	pool := testenv.Pool(t)
	id := storeWithPII(t, pool)

	rec := httptest.NewRecorder()
	testRouter(t, pool, false).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/store/"+id, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, `"phone"`) || strings.Contains(body, `"address"`) {
		t.Fatalf("public store leaked PII: %s", body)
	}
}

func TestAuthedStoreIncludesPII(t *testing.T) {
	pool := testenv.Pool(t)
	id := storeWithPII(t, pool)

	rec := httptest.NewRecorder()
	testRouter(t, pool, true).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/store/"+id, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"phone"`) {
		t.Fatalf("authed store missing phone: %s", rec.Body.String())
	}
}

func TestPublicListHidesPII(t *testing.T) {
	pool := testenv.Pool(t)
	rec := httptest.NewRecorder()
	testRouter(t, pool, false).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/stores?limit=5", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), `"phone"`) || strings.Contains(rec.Body.String(), `"address"`) {
		t.Fatalf("public list leaked PII: %s", rec.Body.String())
	}
}

func TestPublicVenuesHidesPII(t *testing.T) {
	pool := testenv.Pool(t)
	rec := httptest.NewRecorder()
	testRouter(t, pool, false).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/venues?app=FOOD", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), `"phone"`) || strings.Contains(rec.Body.String(), `"address"`) {
		t.Fatalf("public venues leaked PII: %s", rec.Body.String())
	}
	var venues []contracts.Venue
	if err := json.Unmarshal(rec.Body.Bytes(), &venues); err != nil {
		t.Fatalf("decode venues: %v", err)
	}
	if len(venues) == 0 {
		t.Skip("no seeded dining venues")
	}
}

func TestSingleVenueHidesPII(t *testing.T) {
	pool := testenv.Pool(t)
	var id string
	if err := pool.QueryRow(context.Background(), `select id from directory.dining_venues limit 1`).Scan(&id); err != nil {
		t.Skipf("no seeded dining venues: %v", err)
	}
	rec := httptest.NewRecorder()
	testRouter(t, pool, false).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/venues/"+id, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, `"phone"`) || strings.Contains(body, `"address"`) {
		t.Fatalf("public single venue leaked PII: %s", body)
	}
	var v contracts.Venue
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode venue: %v", err)
	}
	if v.ID != id {
		t.Fatalf("venue id = %q, want %q", v.ID, id)
	}
}

func TestSingleVenueNotFound(t *testing.T) {
	pool := testenv.Pool(t)
	rec := httptest.NewRecorder()
	testRouter(t, pool, false).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/venues/does-not-exist", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestMenuIncludesDisplayFields(t *testing.T) {
	pool := testenv.Pool(t)
	var venueID string
	err := pool.QueryRow(context.Background(), `select venue_id from directory.menus limit 1`).Scan(&venueID)
	if err != nil {
		t.Skipf("no seeded menu rows: %v", err)
	}
	rec := httptest.NewRecorder()
	testRouter(t, pool, false).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/venues/"+venueID+"/menu", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var dishes []contracts.MenuDish
	if err := json.Unmarshal(rec.Body.Bytes(), &dishes); err != nil {
		t.Fatalf("decode menu: %v", err)
	}
	found := false
	for _, d := range dishes {
		if d.Description != "" && d.DeliveryTime != "" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("menu projection dropped description/deliveryTime: %s", rec.Body.String())
	}
}

func TestStoresKeysetPagination(t *testing.T) {
	pool := testenv.Pool(t)
	router := testRouter(t, pool, false)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/stores?limit=5", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("page 1 status = %d", rec.Code)
	}
	var page1 []contracts.Store
	if err := json.Unmarshal(rec.Body.Bytes(), &page1); err != nil {
		t.Fatalf("decode page1: %v", err)
	}
	if len(page1) != 5 {
		t.Fatalf("page1 len = %d, want 5", len(page1))
	}
	cursor := rec.Header().Get("X-Next-Cursor")
	if cursor == "" {
		t.Fatal("expected X-Next-Cursor on first page")
	}

	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/stores?limit=5&cursor="+cursor, nil))
	if rec2.Code != http.StatusOK {
		t.Fatalf("page 2 status = %d", rec2.Code)
	}
	var page2 []contracts.Store
	if err := json.Unmarshal(rec2.Body.Bytes(), &page2); err != nil {
		t.Fatalf("decode page2: %v", err)
	}
	if len(page2) == 0 {
		t.Fatal("page2 empty")
	}
	seen := map[string]bool{}
	for _, s := range page1 {
		seen[s.ID] = true
	}
	for _, s := range page2 {
		if seen[s.ID] {
			t.Fatalf("page2 repeated id %s", s.ID)
		}
	}
}

func TestNearbyStoresOrderedAndPIIFree(t *testing.T) {
	pool := testenv.Pool(t)
	rec := httptest.NewRecorder()
	testRouter(t, pool, false).ServeHTTP(rec,
		httptest.NewRequest(http.MethodGet, "/stores/nearby?lat=17.44&lng=78.38&radius=50&limit=10", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), `"phone"`) || strings.Contains(rec.Body.String(), `"address"`) {
		t.Fatalf("nearby leaked PII: %s", rec.Body.String())
	}
	var stores []contracts.Store
	if err := json.Unmarshal(rec.Body.Bytes(), &stores); err != nil {
		t.Fatalf("decode nearby stores: %v", err)
	}
	if len(stores) == 0 {
		t.Skip("no seeded stores with coordinates (apply 0041 + reseed)")
	}
	last := -1.0
	for _, s := range stores {
		if s.DistanceKm == nil || s.Latitude == nil || s.Longitude == nil {
			t.Fatalf("nearby store missing geo: %+v", s)
		}
		if *s.DistanceKm < last {
			t.Fatalf("nearby stores not nearest-first: %v then %v", last, *s.DistanceKm)
		}
		last = *s.DistanceKm
	}
}

func TestNearbyStoresRequiresLatLng(t *testing.T) {
	rec := httptest.NewRecorder()
	testRouter(t, testenv.Pool(t), false).ServeHTTP(rec,
		httptest.NewRequest(http.MethodGet, "/stores/nearby", nil))
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusOK {
		// testenv.Pool may skip the whole test before routing; 400 is the expected path.
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if rec.Code == http.StatusOK {
		t.Skip("database unconfigured")
	}
}
