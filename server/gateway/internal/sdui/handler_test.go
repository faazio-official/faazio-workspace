package sdui

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
	"github.com/go-chi/chi/v5"
)

func newAdminRouter(t *testing.T, layouts *fakeLayouts) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(auth.Middleware(auth.Config{Disabled: true, DevUserID: "user-1"}))
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
	if len(out) != 3 || out[0].ID != "foodHero" || out[1].ID != "foodSpecials" || out[2].ID != "mostRatedDining" {
		t.Fatalf("sections = %+v, want [foodHero foodSpecials mostRatedDining]", out)
	}
}

func TestAdminPutHomeRequiresSuperAdmin(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/admin/sdui/home", strings.NewReader(`{"sections":[{"id":"deals","title":"D","accent":"#111","productIds":["md-1"]}]}`))
	req.Header.Set("X-Dev-Role", auth.RoleSeller)
	newAdminRouter(t, &fakeLayouts{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func newFeedRouter(t *testing.T, layouts *fakeLayouts, products fakeProducts, stores fakeStores) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	r.Use(auth.Middleware(auth.Config{Disabled: true, DevUserID: "user-1"}))
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
