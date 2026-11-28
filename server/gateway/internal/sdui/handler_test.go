package sdui

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/authtest"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/go-chi/chi/v5"
)

func newAdminRouter(t *testing.T, layouts *fakeLayouts) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	svc := NewService(layouts, layouts, fakeProducts{}, fakeStores{}, c)
	NewHandler(svc, nil).Register(r)
	return r
}

func doPut(t *testing.T, layouts *fakeLayouts, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/admin/sdui/home", strings.NewReader(body))
	req.Header.Set("X-Dev-Role", auth.RoleSuperAdmin)
	newAdminRouter(t, layouts).ServeHTTP(rec, req)
	return rec
}

func TestAdminPutHomeValidatesSections(t *testing.T) {
	longRef := strings.Repeat("x", 65)
	cases := []struct {
		name string
		body string
		want int
	}{
		{"empty sections", `{"sections":[]}`, http.StatusBadRequest},
		{"missing id", `{"sections":[{"title":"x","productIds":[]}]}`, http.StatusBadRequest},
		{"overlong product id", `{"sections":[{"id":"deals","title":"Deals","accent":"#111","productIds":["` + longRef + `"]}]}`, http.StatusBadRequest},
		{"valid publishes", `{"sections":[{"id":"deals","title":"Deals","accent":"#111827","productIds":["md-1"]}]}`, http.StatusOK},
		{"valid banners publish", `{"sections":[{"id":"martHero","title":"Highlights","accent":"#F25C3D","productIds":[],"banners":[{"id":"hb-1","title":"Big Savings","subtitle":"UP TO 50% OFF","accent":"#FFF8D6","imageUrl":"https://img.example/hb1.jpg"}]}]}`, http.StatusOK},
		{"overlong banner image url", `{"sections":[{"id":"martHero","title":"Highlights","accent":"#F25C3D","productIds":[],"banners":[{"id":"hb-1","title":"Big Savings","imageUrl":"` + strings.Repeat("x", 513) + `"}]}]}`, http.StatusBadRequest},
		{"valid campaigns publish", `{"sections":[{"id":"hotBrandDeals","title":"Deals of the day","accent":"#1162D3","productIds":[],"campaigns":[{"id":"camp-a","storeId":"store-m1","productIds":["fm-m1"],"carousel":1}]}]}`, http.StatusOK},
		{"campaign bad carousel", `{"sections":[{"id":"hotBrandDeals","title":"Deals","accent":"#1162D3","productIds":[],"campaigns":[{"id":"camp-a","storeId":"store-m1","productIds":["fm-m1"],"carousel":3}]}]}`, http.StatusBadRequest},
		{"campaign missing store", `{"sections":[{"id":"hotBrandDeals","title":"Deals","accent":"#1162D3","productIds":[],"campaigns":[{"id":"camp-a","productIds":["fm-m1"],"carousel":1}]}]}`, http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			layouts := &fakeLayouts{version: 1}
			rec := doPut(t, layouts, tc.body)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.want, rec.Body.String())
			}
			if tc.want == http.StatusOK && len(layouts.saved) != 1 {
				t.Fatalf("valid publish did not reach the writer: %+v", layouts.saved)
			}
		})
	}
}

func TestMartServesOnlyMartSections(t *testing.T) {
	layouts := &fakeLayouts{version: 2, sections: []contracts.SduiSection{
		{ID: "martHero", Title: "Highlights"},
		{ID: "adBanner", Title: "Offers"},
		{ID: "martDeals", Title: "Deals", ProductIDs: []string{"md-1"}},
	}}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/sdui/mart", nil)
	newAdminRouter(t, layouts).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("ETag"); got != `"mart-v2"` {
		t.Fatalf("etag = %q, want \"mart-v2\"", got)
	}
	var out []contracts.SduiSection
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 || out[0].ID != "martHero" || out[1].ID != "martDeals" {
		t.Fatalf("sections = %+v, want [martHero martDeals]", out)
	}
}

func TestFoodServesOnlyFoodSections(t *testing.T) {
	layouts := &fakeLayouts{version: 5, sections: []contracts.SduiSection{
		{ID: "foodHero", Title: "Highlights"},
		{ID: "adBanner", Title: "Offers"},
		{ID: "foodSpecials", Title: "Specials", ProductIDs: []string{"sp-1"}},
		{ID: "martDeals", Title: "Deals", ProductIDs: []string{"md-1"}},
		{ID: "mostRatedDining", Title: "Dining", StoreIDs: []string{"store-f1"}},
		{ID: "mostRatedVenues", Title: "Top Rated", StoreIDs: []string{"tr-1"}},
	}}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/sdui/food", nil)
	newAdminRouter(t, layouts).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("ETag"); got != `"food-v5"` {
		t.Fatalf("etag = %q, want \"food-v5\"", got)
	}
	var out []contracts.SduiSection
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 3 || out[0].ID != "foodHero" || out[1].ID != "foodSpecials" || out[2].ID != "mostRatedVenues" {
		t.Fatalf("sections = %+v, want [foodHero foodSpecials mostRatedVenues]", out)
	}
}

func TestAdminPutHomeRequiresSuperAdmin(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/admin/sdui/home", strings.NewReader(`{"sections":[{"id":"deals","title":"D","accent":"#111","productIds":["md-1"]}]}`))
	req.Header.Set("X-Dev-Role", auth.RoleSeller)
	newAdminRouter(t, &fakeLayouts{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func newFeedRouter(t *testing.T, layouts *fakeLayouts, products fakeProducts, stores fakeStores) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	svc := NewService(layouts, layouts, products, stores, c)
	NewHandler(svc, nil).Register(r)
	return r
}

func TestPharmaServesOnlyPharmaSections(t *testing.T) {
	layouts := &fakeLayouts{version: 7, sections: []contracts.SduiSection{
		{ID: "pharmaHero", Title: "Highlights", Banners: []contracts.SduiBanner{{ID: "phb-1", Title: "Health Essentials"}}},
		{ID: "adBanner", Title: "Offers"},
		{ID: "martDeals", Title: "Deals", ProductIDs: []string{"md-1"}},
		{ID: "pharmaPopular", Title: "Popular Medicines", ProductIDs: []string{"ph-t1"}},
		{ID: "pharmaEssentials", Title: "Health Essentials", ProductIDs: []string{"ph-om1"}},
	}}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/sdui/pharma", nil)
	newFeedRouter(t, layouts, fakeProducts{}, fakeStores{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("ETag"); got != `"pharma-v7"` {
		t.Fatalf("etag = %q, want \"pharma-v7\"", got)
	}
	var out []contracts.SduiSection
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 3 || out[0].ID != "pharmaHero" || out[1].ID != "pharmaPopular" || out[2].ID != "pharmaEssentials" {
		t.Fatalf("sections = %+v, want [pharmaHero pharmaPopular pharmaEssentials]", out)
	}
}

func TestCampaignsEndpointServesCompiledList(t *testing.T) {
	layouts := &fakeLayouts{version: 4, sections: []contracts.SduiSection{
		{ID: "hotBrandDeals", Title: "Deals of the day", Campaigns: []contracts.SduiCampaign{
			{ID: "camp-a", StoreID: "store-m1", ProductIDs: []string{"fm-m1"}, Carousel: 1},
		}},
	}}
	products := fakeProducts{byID: map[string]contracts.Product{"fm-m1": {ID: "fm-m1", Name: "Phone", Price: 89999}}}
	stores := fakeStores{byID: map[string]contracts.Store{"store-m1": {ID: "store-m1", Name: "Darling Mobiles"}}}
	r := newFeedRouter(t, layouts, products, stores)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/home/campaigns", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("list status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	var list []contracts.CampaignView
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != "camp-a" || list[0].Store == nil || len(list[0].Products) != 1 {
		t.Fatalf("campaigns = %+v", list)
	}

	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/home/campaigns/camp-a", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("single status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("ETag"); got != `"home-campaign-v4"` {
		t.Fatalf("etag = %q, want \"home-campaign-v4\"", got)
	}

	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/home/campaigns/unknown", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unknown status = %d, want 404", rec.Code)
	}
}

const seedLayoutJSON = `{
  "schema_version": "1.2",
  "header_theme": {
    "background_hex": "#2B0909",
    "search_bar_bg_hex": "#421414",
    "status_bar_style": "light"
  },
  "widgets": [
    {
      "widget_id": "hero_rush_091",
      "type": "HERO_PROMO_BANNER",
      "slot": "hero_banner",
      "priority": 1,
      "copy": {"eyebrow": "ROYAL FEAST", "headline": "Flat 40% OFF", "accent_headline": "40%", "code_label": "CODE:", "code": "FESTIVE40", "cta": "Order Now"},
      "schedule": {"starts_at_utc": "2026-11-28T10:40:00Z", "expires_at_utc": "2026-11-28T10:50:00Z", "on_expire_action": "SWAP_TO_FALLBACK", "fallback_widget_id": "hero_default_001"},
      "action": {"type": "DEEP_LINK", "route": "faazio://food/offers/FESTIVE40", "auto_apply_coupon": "FESTIVE40"}
    },
    {
      "widget_id": "hero_default_001",
      "type": "HERO_PROMO_BANNER",
      "slot": "hero_banner",
      "priority": 2,
      "copy": {"eyebrow": "FAAZIO DELIVERS", "headline": "Hot meals, 30 minutes", "cta": "Browse restaurants"},
      "action": {"type": "NONE"}
    }
  ]
}`

func TestDecodePayloadAcceptsSeedLayout(t *testing.T) {
	p, verr := DecodePayload([]byte(seedLayoutJSON))
	if verr != nil {
		t.Fatalf("seed layout rejected: %v", verr.Errors)
	}
	if p.SchemaVersion != SchemaVersion || len(p.Widgets) != 2 {
		t.Fatalf("unexpected payload %+v", p)
	}
	if p.Widgets[0].Schedule == nil || p.Widgets[0].Schedule.FallbackWidgetID != "hero_default_001" {
		t.Fatalf("schedule lost in decode: %+v", p.Widgets[0])
	}
}

func TestDecodePayloadRejectsMalformedLayouts(t *testing.T) {
	base := func(mutate func(map[string]any)) string {
		var m map[string]any
		if err := json.Unmarshal([]byte(seedLayoutJSON), &m); err != nil {
			t.Fatal(err)
		}
		mutate(m)
		b, err := json.Marshal(m)
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	widget := func(m map[string]any) map[string]any {
		return m["widgets"].([]any)[0].(map[string]any)
	}

	cases := []struct {
		name string
		raw  string
		path string
	}{
		{"wrong schema version", base(func(m map[string]any) { m["schema_version"] = "1.1" }), "schema_version"},
		{"bad header hex", base(func(m map[string]any) {
			m["header_theme"].(map[string]any)["background_hex"] = "maroon"
		}), "header_theme.background_hex"},
		{"unknown widget type", base(func(m map[string]any) { widget(m)["type"] = "CAROUSEL_X" }), "widgets[0].type"},
		{"duplicate priority", base(func(m map[string]any) {
			m["widgets"].([]any)[1].(map[string]any)["priority"] = float64(1)
		}), "widgets[1].priority"},
		{"missing fallback widget", base(func(m map[string]any) {
			widget(m)["schedule"].(map[string]any)["fallback_widget_id"] = "nope_001"
		}), "widgets[0].schedule.fallback_widget_id"},
		{"expiry before start", base(func(m map[string]any) {
			widget(m)["schedule"].(map[string]any)["expires_at_utc"] = "2026-11-28T10:39:00Z"
		}), "widgets[0].schedule.expires_at_utc"},
		{"unknown root field", base(func(m map[string]any) { m["surprise"] = true }), "$"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, verr := DecodePayload([]byte(tc.raw))
			if verr == nil {
				t.Fatal("payload was accepted")
			}
			for _, fe := range verr.Errors {
				if fe.Path == tc.path {
					return
				}
			}
			t.Fatalf("want an error at %s, got %+v", tc.path, verr.Errors)
		})
	}

	if _, verr := DecodePayload([]byte(`{"schema_version":`)); verr == nil || verr.Errors[0].Path != "$" {
		t.Fatalf("syntax error should be reported at $: %+v", verr)
	}
}

// fakeControlStore implements ControlStore without a database.
type fakeControlStore struct {
	live      LiveLayout
	epoch     int64
	published []PublishInput
	rollback  string
	versions  []VersionRow
}

func (f *fakeControlStore) Resolve(context.Context, string, string, string) (LiveLayout, error) {
	if f.live.VersionID == "" {
		return LiveLayout{}, ErrVersionNotFound
	}
	return f.live, nil
}

func (f *fakeControlStore) Epoch(context.Context, string, string, string) (int64, error) {
	return f.epoch, nil
}

func (f *fakeControlStore) Pointers(context.Context, string, string) ([]PointerRow, error) {
	return nil, nil
}

func (f *fakeControlStore) Versions(context.Context, string, string, string, int) ([]VersionRow, error) {
	return f.versions, nil
}

func (f *fakeControlStore) Publish(_ context.Context, in PublishInput) (VersionRow, error) {
	f.published = append(f.published, in)
	return VersionRow{ID: "v-new", VersionNum: 2, SchemaVersion: in.Payload.SchemaVersion, IsLive: true}, nil
}

func (f *fakeControlStore) Rollback(_ context.Context, _, _, _, versionID, _ string) (PointerRow, error) {
	if versionID != "v-1" {
		return PointerRow{}, ErrVersionNotFound
	}
	f.rollback = versionID
	return PointerRow{VersionID: versionID, Epoch: 4}, nil
}

func (f *fakeControlStore) Districts(context.Context) ([]District, error) { return nil, nil }

func newControlRouter(store ControlStore) http.Handler {
	r := chi.NewRouter()
	r.Use(authtest.Middleware())
	NewControlHandler(store, nil, nil, nil).Register(r)
	return r
}

func TestControlPublicLayoutServesCompiledPayload(t *testing.T) {
	store := &fakeControlStore{live: LiveLayout{
		VersionID: "v-1", VersionNum: 3, Epoch: 2, DistrictID: "",
		Payload: json.RawMessage(seedLayoutJSON),
	}}
	rec := httptest.NewRecorder()
	newControlRouter(store).ServeHTTP(rec,
		httptest.NewRequest(http.MethodGet, "/sdui/layout?vertical=food&screen=home&district_id=CHN", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	var got LayoutResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.SchemaVersion != "1.2" || got.HeaderTheme.BackgroundHex != "#2B0909" || len(got.Widgets) != 2 {
		t.Fatalf("payload did not round-trip: %+v", got)
	}
	if got.ServerTimestampUTC == "" || got.TTLSeconds != LayoutTTLSeconds || got.VersionNum != 3 || got.SduiEpoch != 2 {
		t.Fatalf("envelope incomplete: %+v", got)
	}
}

func TestControlPublicLayoutUnknownScopeIs404(t *testing.T) {
	rec := httptest.NewRecorder()
	newControlRouter(&fakeControlStore{}).ServeHTTP(rec,
		httptest.NewRequest(http.MethodGet, "/sdui/layout?vertical=food", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	rec = httptest.NewRecorder()
	newControlRouter(&fakeControlStore{}).ServeHTTP(rec,
		httptest.NewRequest(http.MethodGet, "/sdui/layout?vertical=food&district_id=bad!", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid district status = %d, want 400", rec.Code)
	}
}

func TestControlPublishValidatesThenStores(t *testing.T) {
	store := &fakeControlStore{}
	bad := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/admin/sdui/layouts/publish",
		strings.NewReader(`{"vertical":"food","payload":{"schema_version":"1.0"}}`))
	req.Header.Set("X-Dev-Role", auth.RoleSuperAdmin)
	newControlRouter(store).ServeHTTP(bad, req)
	if bad.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid publish status = %d, want 422 (%s)", bad.Code, bad.Body.String())
	}
	if len(store.published) != 0 {
		t.Fatal("invalid payload reached the store")
	}

	body := `{"vertical":"food","screen":"home","district_id":"","note":"festive","payload":` + seedLayoutJSON + `}`
	ok := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/admin/sdui/layouts/publish", strings.NewReader(body))
	req.Header.Set("X-Dev-Role", auth.RoleSuperAdmin)
	newControlRouter(store).ServeHTTP(ok, req)
	if ok.Code != http.StatusCreated {
		t.Fatalf("valid publish status = %d (%s)", ok.Code, ok.Body.String())
	}
	if len(store.published) != 1 || store.published[0].Note != "festive" {
		t.Fatalf("publish did not reach the store: %+v", store.published)
	}
}

func TestControlRollbackRejectsForeignVersion(t *testing.T) {
	store := &fakeControlStore{}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/admin/sdui/layouts/rollback",
		strings.NewReader(`{"vertical":"food","version_id":"v-999"}`))
	req.Header.Set("X-Dev-Role", auth.RoleSuperAdmin)
	newControlRouter(store).ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/admin/sdui/layouts/rollback",
		strings.NewReader(`{"vertical":"food","version_id":"v-1"}`))
	req.Header.Set("X-Dev-Role", auth.RoleSuperAdmin)
	newControlRouter(store).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || store.rollback != "v-1" {
		t.Fatalf("rollback status = %d (%s)", rec.Code, rec.Body.String())
	}
}

// TestControlStorePublishResolveRollback exercises the real Postgres tables (migration 0148). It is
// skipped unless DATABASE_URL is set, so `go test ./...` stays hermetic.
func TestControlStorePublishResolveRollback(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url)
	if err != nil || pool == nil {
		t.Fatalf("connect: %v", err)
	}

	const vertical, screen = "pharma", "category_landing"
	store := NewStore(pool)
	// Cleanups run LIFO after the test body, so the close must be registered first: a deferred
	// pool.Close() would run before these deletes and silently leave the scope populated, making
	// the version_num assertions below fail on every run after the first.
	clearScope := func(when string) {
		if _, err := pool.Exec(ctx, `delete from admins.sdui_layout_pointers where vertical = $1 and screen = $2`, vertical, screen); err != nil {
			t.Errorf("%s: delete pointers: %v", when, err)
		}
		if _, err := pool.Exec(ctx, `delete from admins.sdui_layout_versions where vertical = $1 and screen = $2`, vertical, screen); err != nil {
			t.Errorf("%s: delete versions: %v", when, err)
		}
	}
	t.Cleanup(func() { pool.Close() })
	t.Cleanup(func() { clearScope("cleanup") })
	clearScope("setup")

	payload, verr := DecodePayload([]byte(seedLayoutJSON))
	if verr != nil {
		t.Fatalf("seed payload rejected: %v", verr.Errors)
	}

	v1, err := store.Publish(ctx, PublishInput{Vertical: vertical, Screen: screen, Payload: payload, Note: "first", Actor: "test"})
	if err != nil {
		t.Fatalf("publish v1: %v", err)
	}
	if v1.VersionNum != 1 {
		t.Fatalf("version_num = %d, want 1", v1.VersionNum)
	}
	live, err := store.Resolve(ctx, vertical, screen, "")
	if err != nil {
		t.Fatalf("resolve after publish: %v", err)
	}
	if live.VersionID != v1.ID || live.Epoch != 1 {
		t.Fatalf("pointer did not move to v1: %+v", live)
	}

	v2, err := store.Publish(ctx, PublishInput{Vertical: vertical, Screen: screen, Payload: payload, Note: "second", Actor: "test"})
	if err != nil {
		t.Fatalf("publish v2: %v", err)
	}
	if v2.VersionNum != 2 {
		t.Fatalf("version_num = %d, want 2", v2.VersionNum)
	}
	// A district with no override must still answer from the PAN_INDIA row.
	var code string
	if err := pool.QueryRow(ctx, `select district_code from admins.district_master where is_active limit 1`).Scan(&code); err == nil {
		fallback, ferr := store.Resolve(ctx, vertical, screen, code)
		if ferr != nil {
			t.Fatalf("district fallback: %v", ferr)
		}
		if fallback.VersionID != v2.ID || fallback.DistrictSet {
			t.Fatalf("district %s should fall back to PAN_INDIA v2: %+v", code, fallback)
		}
	}

	versions, err := store.Versions(ctx, vertical, screen, "", 10)
	if err != nil || len(versions) != 2 || !versions[0].IsLive || versions[0].VersionNum != 2 {
		t.Fatalf("history wrong: %+v (%v)", versions, err)
	}

	ptr, err := store.Rollback(ctx, vertical, screen, "", v1.ID, "test")
	if err != nil {
		t.Fatalf("rollback: %v", err)
	}
	if ptr.VersionID != v1.ID || ptr.Epoch != 3 {
		t.Fatalf("rollback pointer wrong: %+v", ptr)
	}
	live, err = store.Resolve(ctx, vertical, screen, "")
	if err != nil || live.VersionID != v1.ID || live.VersionNum != 1 {
		t.Fatalf("rollback did not take effect: %+v (%v)", live, err)
	}
	if _, err := store.Rollback(ctx, vertical, screen, "", "00000000-0000-0000-0000-000000000000", "test"); err != ErrVersionNotFound {
		t.Fatalf("foreign rollback err = %v, want ErrVersionNotFound", err)
	}
}
