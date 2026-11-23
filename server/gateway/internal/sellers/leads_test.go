package sellers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/testenv"
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
		`"latitude":10.9254,"longitude":79.8380,"platformFeePct":10}`

	cases := []struct {
		name string
		body string
		want int
		code string
	}{
		{"missing address", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","districtName":"Karaikal","platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"missing district", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"missing business name", `{"ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"bad category", `{"businessName":"S","ownerName":"O","category":"GROCERY","contactPhone":"9876543210","contactEmail":"a@b.com","platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"short phone", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"12345","contactEmail":"a@b.com","platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"bad email", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"nope","platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"half pin", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","latitude":10.9,"platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"out-of-range pin", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","latitude":120,"longitude":79,"platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"unknown district", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","districtCode":"ZZZ","businessAddress":"12 Bharathiar Street","platformFeePct":10}`, http.StatusBadRequest, "unknown_district"},
		{"missing platform fee", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal"}`, http.StatusBadRequest, "bad_request"},
		{"zero platform fee", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","platformFeePct":0}`, http.StatusBadRequest, "bad_request"},
		{"food fee too low", `{"businessName":"S","ownerName":"O","category":"FOOD","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","platformFeePct":2}`, http.StatusBadRequest, "bad_request"},
		{"malformed state code", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","stateCode":"TNX","platformFeePct":10}`, http.StatusBadRequest, "bad_request"},
		{"honeypot is accepted silently", `{"businessName":"S","ownerName":"O","category":"MART","contactPhone":"9876543210","contactEmail":"a@b.com","businessAddress":"12 Bharathiar Street","districtName":"Karaikal","platformFeePct":10,"website":"http://spam"}`, http.StatusCreated, ""},
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

	// Verbatim shape of the landing-page request: contact fields + pinned location + the resolved
	// master codes + the mandatory platform fee. `source` is not sent by the current client but stays
	// accepted for an older cached bundle.
	landingPage := `{"businessName":"Karaikal Spice Mart","ownerName":"Ravi Kumar","category":"MART",` +
		`"contactPhone":"9876543210","contactEmail":"ravi@example.com",` +
		`"businessAddress":"12 Bharathiar Street, Karaikal","districtName":"Karaikal",` +
		`"stateCode":"PY","districtCode":"PY1","latitude":10.9254,"longitude":79.838,` +
		`"platformFeePct":10,"notes":"","source":"web"}`

	cases := []struct {
		name string
		body string
		want int
		code string
	}{
		// Decode succeeds, so the request reaches the repo; the nil pool is what fails it here.
		{"landing page body with source", landingPage, http.StatusInternalServerError, "lead_unavailable"},
		{"body without source", strings.Replace(landingPage, `,"source":"web"`, "", 1), http.StatusInternalServerError, "lead_unavailable"},
		// An enquiry that omits the now-mandatory fee is a 400 before the repo.
		{"landing page body without fee", strings.Replace(landingPage, `,"platformFeePct":10`, "", 1), http.StatusBadRequest, "bad_request"},
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

// TestLeadDistrictsIsPublic pins the read the enquiry form calls before it submits: no auth, active
// rows only, and the same 3-field projection the picker uses. The form uses it to send canonical
// state/district codes, so a missing or login-gated route would silently fall back to name matching.
func TestLeadDistrictsIsPublic(t *testing.T) {
	h, _ := leadRouter(t)

	rec := do(t, h, http.MethodGet, "/seller-leads/districts", "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	var rows []struct {
		DistrictCode string `json:"districtCode"`
		Name         string `json:"name"`
		StateCode    string `json:"stateCode"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("decode: %v (body %s)", err, rec.Body.String())
	}
	if len(rows) == 0 {
		t.Fatal("expected the active district master, got an empty list")
	}
	// Only active rows, and the shape carries exactly the picker's fields.
	for _, row := range rows {
		if row.DistrictCode == "" || row.Name == "" || len(row.StateCode) != 2 {
			t.Fatalf("malformed district row: %+v", row)
		}
		if !geo.IsActive(row.DistrictCode) {
			t.Fatalf("inactive district %q leaked into the public read", row.DistrictCode)
		}
	}
	found := false
	for _, row := range rows {
		if row.DistrictCode == "PY1" && row.Name == "Karaikal" && row.StateCode == "PY" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected Karaikal (PY1) in the active district read")
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
		// A name Google could not spell-match still wins by a wrong-code + right-name pair: the
		// explicit code is invalid, so the name resolves.
		{createLeadRequest{DistrictCode: "ZZZ", DistrictPlaceID: "not-a-real-id", DistrictName: "Karaikal"}, "PY", "PY1", "Karaikal"},
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

// TestResolveLeadDistrictByPlaceID proves the durable join: a lead that sends only `districtPlaceId`
// (no code, no name) resolves to that district, and the master's canonical name replaces the raw
// submitted one. Needs a real DB (testenv.Pool skips without TEST_DATABASE_URL) because the place_id
// index is built from the master snapshot.
func TestResolveLeadDistrictByPlaceID(t *testing.T) {
	pool := testenv.Pool(t)
	ctx := context.Background()

	const code, placeID = "TZP", "ChIJleads-test-place"
	_, _ = pool.Exec(ctx, `delete from admins.district_master where district_code = $1`, code)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `delete from admins.district_master where district_code = $1`, code)
		_ = geo.Reload(context.Background(), pool)
	})
	if _, err := pool.Exec(ctx,
		`insert into admins.district_master (district_code, district_name, state_code, google_place_id)
		 values ($1,$2,'TN',$3)`, code, "Place ID Test", placeID); err != nil {
		t.Fatalf("insert: %v", err)
	}
	if err := geo.Reload(ctx, pool); err != nil {
		t.Fatalf("reload: %v", err)
	}

	// Only the place_id is supplied; the misspelled name must not matter.
	state, district, _, name := resolveLeadDistrict(createLeadRequest{
		DistrictPlaceID: placeID,
		DistrictName:    "Totally Wrong Spelling",
	})
	if state != "TN" || district != code || name != "Place ID Test" {
		t.Fatalf("got (%s,%s,%s), want (TN,%s,Place ID Test)", state, district, name, code)
	}

	// An unknown place_id must fall through to the name, never resolve to something arbitrary.
	state, district, _, _ = resolveLeadDistrict(createLeadRequest{
		DistrictPlaceID: "ChIJdoes-not-exist",
		DistrictName:    "Karaikal",
	})
	if state != "PY" || district != "PY1" {
		t.Fatalf("fallthrough got (%s,%s), want PY,PY1", state, district)
	}
}

func contains(haystack, needle string) bool { return strings.Contains(haystack, needle) }
