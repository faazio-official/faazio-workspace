package sellers

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/go-chi/chi/v5"
)

// leadRouter mounts the public lead intake without a DB. The validation paths under test all reject
// before the repo is touched, so a nil pool is enough (and the DB-backed happy path is covered by the
// integration suite when TEST_DATABASE_URL is set).
func leadRouter(t *testing.T) (http.Handler, *cache.Cache) {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	NewHandler(New(nil), c, nil, nil).Register(r)
	return r, c
}

func TestCreateLeadValidation(t *testing.T) {
	h, _ := leadRouter(t)
	valid := `{"businessName":"Shop","ownerName":"Owner","category":"FOOD",` +
		`"contactPhone":"9876543210","contactEmail":"owner@example.com",` +
		`"businessAddress":"12 Bharathiar Street, Karaikal","districtName":"Karaikal",` +
		`"latitude":10.9254,"longitude":79.8380}`

	cases := []struct {
		name string
		body string
		want int
		code string
	}{
		{"missing address", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","districtName":"Karaikal"}`, http.StatusBadRequest, "bad_request"},
		{"missing district", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street"}`, http.StatusBadRequest, "bad_request"},
		{"missing business name", `{"ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com"}`, http.StatusBadRequest, "bad_request"},
		{"bad category", `{"businessName":"S","ownerName":"O","category":"GROCERY","contactPhone":"9876543210","contactEmail":"a@b.com"}`, http.StatusBadRequest, "bad_request"},
		{"short phone", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"12345","contactEmail":"a@b.com"}`, http.StatusBadRequest, "bad_request"},
		{"bad email", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"nope"}`, http.StatusBadRequest, "bad_request"},
		{"half pin", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","latitude":10.9}`, http.StatusBadRequest, "bad_request"},
		{"out-of-range pin", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","latitude":120,"longitude":79}`, http.StatusBadRequest, "bad_request"},
		{"unknown district", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","districtCode":"ZZZ","businessAddress":"12 Bharathiar Street"}`, http.StatusBadRequest, "unknown_district"},
		{"food fee too low", `{"businessName":"S","ownerName":"O","category":"FOOD","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","platformFeePct":2}`, http.StatusBadRequest, "bad_request"},
		{"honeypot is accepted silently", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","website":"http://spam"}`, http.StatusCreated, ""},
		{"valid reaches the repo", valid, http.StatusInternalServerError, "lead_unavailable"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, "/seller-leads", tc.body, nil)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.want, rec.Body.String())
			}
			if tc.code != "" && !strings.Contains(rec.Body.String(), `"code":"`+tc.code+`"`) {
				t.Fatalf("body %s missing code %q", rec.Body.String(), tc.code)
			}
		})
	}
}

// TestCreateLeadAcceptsLandingPageBody pins the exact wire body the landing page sends. The landing
// page's server function (client/web/landingpage/src/lib/leads.ts) posts `{...payload, source:"web"}`
// and httpx.Decode rejects unknown fields, so a field the client sends but createLeadRequest omits
// 400s every real enquiry while every hand-written test body still passes. Both shapes must decode;
// a genuinely unknown field must still be refused.
func TestCreateLeadAcceptsLandingPageBody(t *testing.T) {
	h, _ := leadRouter(t)

	// Verbatim shape of the landing-page request: contact fields + optional pin + `source`.
	landingPage := `{"businessName":"Karaikal Spice Mart","ownerName":"Ravi Kumar","category":"MART",` +
		`"contactPhone":"9876543210","contactEmail":"ravi@example.com",` +
		`"businessAddress":"12 Bharathiar Street, Karaikal","districtName":"Karaikal",` +
		`"latitude":10.9254,"longitude":79.838,"notes":"","source":"web"}`

	cases := []struct {
		name string
		body string
		want int
		code string
	}{
		// Decode succeeds, so the request reaches the repo; the nil pool is what fails it here.
		{"landing page body with source", landingPage, http.StatusInternalServerError, "lead_unavailable"},
		{"body without source", strings.Replace(landingPage, `,"source":"web"`, "", 1), http.StatusInternalServerError, "lead_unavailable"},
		// The guard must stay: an unknown field is still a 400, not a silently ignored typo.
		{"unknown field still rejected", strings.Replace(landingPage, `"source":"web"`, `"soruce":"web"`, 1), http.StatusBadRequest, "bad_request"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, "/seller-leads", tc.body, nil)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.want, rec.Body.String())
			}
			if tc.code != "" && !strings.Contains(rec.Body.String(), `"code":"`+tc.code+`"`) {
				t.Fatalf("body %s missing code %q", rec.Body.String(), tc.code)
			}
		})
	}
}

func TestResolveLeadDistrict(t *testing.T) {
	cases := []struct {
		req        createLeadRequest
		state      string
		district   string
		districtNm string
	}{
		{createLeadRequest{DistrictCode: "PY1"}, "PY", "PY1", "Karaikal"},
		{createLeadRequest{DistrictName: "karaikal"}, "PY", "PY1", "Karaikal"},
		{createLeadRequest{DistrictName: "Nowhere", StateCode: "TN"}, "TN", "", "Nowhere"},
		{createLeadRequest{DistrictCode: "ZZZ", DistrictName: "Chennai"}, "TN", "TCH", "Chennai"},
	}
	for _, tc := range cases {
		t.Run(tc.req.DistrictCode+"/"+tc.req.DistrictName, func(t *testing.T) {
			state, district, _, name := resolveLeadDistrict(tc.req)
			if state != tc.state || district != tc.district || name != tc.districtNm {
				t.Fatalf("got (%s,%s,%s), want (%s,%s,%s)", state, district, name, tc.state, tc.district, tc.districtNm)
			}
		})
	}
}

func contains(haystack, needle string) bool { return strings.Contains(haystack, needle) }
