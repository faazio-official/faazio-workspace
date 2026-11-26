package categories

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestValidApp(t *testing.T) {
	for _, a := range []string{"MART", "FOOD", "PHARMA", "MAIN_APP_HEADER"} {
		if !validApp(a) {
			t.Errorf("validApp(%q) = false, want true", a)
		}
	}
	for _, a := range []string{"", "GROCERY", "mart", "ALL"} {
		if validApp(a) {
			t.Errorf("validApp(%q) = true, want false", a)
		}
	}
}

func TestIsUniqueViolation(t *testing.T) {
	if !isUniqueViolation(&pgconn.PgError{Code: "23505"}) {
		t.Fatal("SQLSTATE 23505 must be treated as a duplicate")
	}
	if isUniqueViolation(&pgconn.PgError{Code: "23503"}) {
		t.Fatal("SQLSTATE 23503 (FK violation) is not a duplicate")
	}
	if isUniqueViolation(nil) || isUniqueViolation(errors.New("boom")) {
		t.Fatal("non-pg errors are not duplicates")
	}
}

func TestValidID(t *testing.T) {
	for _, id := range []string{"cat-north-indian", "sub_bt_head", "a1"} {
		if !validID(id) {
			t.Errorf("validID(%q) = false, want true", id)
		}
	}
	for _, id := range []string{"bad id", "a/b", "x!", strings.Repeat("a", 81)} {
		if validID(id) {
			t.Errorf("validID(%q) = true, want false", id)
		}
	}
}

func TestHomeRailError(t *testing.T) {
	yes, no := true, false
	for _, tt := range []struct {
		name string
		app  string
		show *bool
		want string
	}{
		{"unset", "MART", nil, ""},
		{"off", "MART", &no, ""},
		{"mart", "MART", &yes, ""},
		{"pharma", "PHARMA", &yes, ""},
		{"food rejected", "FOOD", &yes, "FOOD categories cannot appear on the home rail"},
		{"food off allowed", "FOOD", &no, ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := homeRailError(tt.app, tt.show); got != tt.want {
				t.Fatalf("homeRailError(%q, %v) = %q, want %q", tt.app, tt.show, got, tt.want)
			}
		})
	}
}

// TestHomeRailIsUnbounded pins the locked decisions: no slot cap and no tree-level restriction. The
// signature is the proof of the latter — homeRailError takes no parent id, so a child row cannot be
// rejected by the rail rule. Child rows are additionally covered end-to-end by TestHomeRailList.
func TestHomeRailIsUnbounded(t *testing.T) {
	yes := true
	for _, app := range []string{"MART", "PHARMA"} {
		if msg := homeRailError(app, &yes); msg != "" {
			t.Fatalf("homeRailError(%q, true) = %q, want accepted", app, msg)
		}
	}
}

// TestCreateValidation pins the 400s that run before any DB access: with a nil pool every accepted
// body would 500, so a 400 proves the validator rejected it first. A child rail row is absent here on
// purpose — it is valid now (TestHomeRailList proves the tree level reaches the rail).
func TestCreateValidation(t *testing.T) {
	h := NewHandler(NewRepo(nil))
	for _, tt := range []struct{ name, body string }{
		{"unknown app", `{"app":"GROCERY","name":"X","gstRateCategoryId":"gst-mart-packaged"}`},
		{"empty name", `{"app":"MART","name":"   ","gstRateCategoryId":"gst-mart-packaged"}`},
		{"name too long", `{"app":"MART","name":"` + strings.Repeat("a", 121) + `","gstRateCategoryId":"gst-mart-packaged"}`},
		{"bad id", `{"app":"MART","name":"X","id":"bad id!","gstRateCategoryId":"gst-mart-packaged"}`},
		{"body not json", `{`},
		{"food rail", `{"app":"FOOD","name":"X","showOnHomeRail":true}`},
		{"missing gst", `{"app":"MART","name":"X"}`},
		{"missing sub gst", `{"app":"MART","name":"X","gstRateCategoryId":"gst-mart-packaged","subCategories":[{"name":"Y","nameTa":"ஒய்"}]}`},
		{"missing sub tamil name", `{"app":"MART","name":"X","gstRateCategoryId":"gst-mart-packaged","subCategories":[{"name":"Y","gstRateCategoryId":"gst-mart-packaged"}]}`},
		{"tamil name latin", `{"app":"MART","name":"X","gstRateCategoryId":"gst-mart-packaged","nameTa":"Milk"}`},
		{"tamil name too long", `{"app":"MART","name":"X","gstRateCategoryId":"gst-mart-packaged","nameTa":"` + strings.Repeat("ண", 121) + `"}`},
		{"unknown header", `{"app":"MART","name":"X","gstRateCategoryId":"gst-mart-packaged","headerLabels":["BANNER"]}`},
		{"foreign app header", `{"app":"MART","name":"X","gstRateCategoryId":"gst-mart-packaged","headerLabels":["PHARMA"]}`},
		{"food main header", `{"app":"FOOD","name":"X","headerLabels":["MAIN_APP_HEADER"]}`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/categories", strings.NewReader(tt.body))
			rr := httptest.NewRecorder()
			h.create(rr, req)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("POST /categories body=%q → status %d, want 400", tt.body, rr.Code)
			}
		})
	}
}

func TestNormalizeHeaderLabels(t *testing.T) {
	if got := normalizeHeaderLabels(nil); got != nil {
		t.Fatalf("nil stays nil (unchanged), got %v", got)
	}
	blank := []string{}
	if got := normalizeHeaderLabels(&blank); got == nil || len(*got) != 0 {
		t.Fatalf("empty array means clear, got %v", got)
	}
	in := []string{" mart", "MART", "main_app_header", " "}
	got := normalizeHeaderLabels(&in)
	if got == nil || len(*got) != 2 || (*got)[0] != "MART" || (*got)[1] != "MAIN_APP_HEADER" {
		t.Fatalf("normalizeHeaderLabels = %v, want [MART MAIN_APP_HEADER]", got)
	}
}

func TestHeaderLabelError(t *testing.T) {
	yes := []string{"MAIN_APP_HEADER"}
	for _, tt := range []struct {
		name   string
		app    string
		labels *[]string
		want   string
	}{
		{"unchanged", "MART", nil, ""},
		{"mart shared", "MART", &yes, ""},
		{"pharma shared", "PHARMA", &yes, ""},
		{"header only", "MAIN_APP_HEADER", &yes, ""},
		{"header only with vendor label", "MAIN_APP_HEADER", &[]string{"MAIN_APP_HEADER", "MART"},
			"a category can only be listed under its own app: MART"},
		{"food shared", "FOOD", &yes, "FOOD categories cannot be tagged MAIN_APP_HEADER"},
		{"own app", "MART", &[]string{"MART"}, ""},
		{"foreign app", "MART", &[]string{"FOOD"}, "a category can only be listed under its own app: FOOD"},
		{"unknown", "MART", &[]string{"BANNER"}, "unknown header label: BANNER"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := headerLabelError(tt.app, tt.labels); got != tt.want {
				t.Fatalf("headerLabelError(%q, %v) = %q, want %q", tt.app, tt.labels, got, tt.want)
			}
		})
	}
}

// TestGSTValidation pins the mandatory GST pick: a vendor-sub-app or header-only row must name a slab,
// while FOOD is exempt (the gateway pins every FOOD row to the 5% food slab).
func TestGSTValidation(t *testing.T) {
	for _, tt := range []struct {
		name string
		app  string
		rate string
		want string
	}{
		{"mart missing", "MART", "", "a GST rate category is required"},
		{"mart present", "MART", "gst-mart-packaged", ""},
		{"header only missing", "MAIN_APP_HEADER", " ", "a GST rate category is required"},
		{"header only present", "MAIN_APP_HEADER", "gst-mart-household", ""},
		{"food exempt", "FOOD", "", ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := gstError(tt.app, tt.rate); got != tt.want {
				t.Fatalf("gstError(%q, %q) = %q, want %q", tt.app, tt.rate, got, tt.want)
			}
		})
	}
}

// TestSubCategoryValidation pins Option B: every inline sub-category carries its own mandatory GST
// rate pick (FOOD children are exempt) and a mandatory Tamil name.
func TestSubCategoryValidation(t *testing.T) {
	withRate := func(name, app, rate string) SubCategoryInput {
		return SubCategoryInput{
			Name: name, App: app, GSTRateCategoryID: rate,
			NameTA: "ஆண்ட்ராய்டு",
		}
	}
	for _, tt := range []struct {
		name string
		app  string
		subs *[]SubCategoryInput
		want string
	}{
		{"nil unchanged", "MART", nil, ""},
		{
			"missing name", "MART",
			&[]SubCategoryInput{withRate("", "MART", "gst-mart-packaged")},
			"every sub-category needs a name",
		},
		{
			"missing tamil name", "MART",
			&[]SubCategoryInput{{
				Name: "Android", App: "MART", GSTRateCategoryID: "gst-mart-packaged",
			}},
			"every sub-category needs a Tamil name",
		},
		{
			"latin tamil name", "MART",
			&[]SubCategoryInput{{
				Name: "Android", App: "MART", GSTRateCategoryID: "gst-mart-packaged",
				NameTA: "Android",
			}},
			"sub-category Tamil name accepts Tamil letters only",
		},
		{
			"tamil name too long", "MART",
			&[]SubCategoryInput{{
				Name: "Android", App: "MART", GSTRateCategoryID: "gst-mart-packaged",
				NameTA: strings.Repeat("ண", 121),
			}},
			"sub-category Tamil name accepts Tamil letters only",
		},
		{
			"missing rate", "MART",
			&[]SubCategoryInput{withRate("Android", "MART", "")},
			"every sub-category needs a GST rate category",
		},
		{
			"inherits parent app for rate check", "MAIN_APP_HEADER",
			&[]SubCategoryInput{withRate("iPhone", "", "")},
			"every sub-category needs a GST rate category",
		},
		{
			"food child exempt", "FOOD",
			&[]SubCategoryInput{withRate("Biryani", "FOOD", "")},
			"",
		},
		{
			"valid", "MAIN_APP_HEADER",
			&[]SubCategoryInput{withRate("Android", "MAIN_APP_HEADER", "gst-mart-household")},
			"",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := subCategoryError(tt.app, tt.subs); got != tt.want {
				t.Fatalf("subCategoryError(%q, %v) = %q, want %q", tt.app, tt.subs, got, tt.want)
			}
		})
	}
}

func TestResolveHeaderLabels(t *testing.T) {
	on, off := true, false
	labels, rail := resolveHeaderLabels("MART", nil, nil, nil)
	if rail || !containsLabel(labels, "MART") || containsLabel(labels, "MAIN_APP_HEADER") {
		t.Fatalf("create mart = %v rail=%v, want primary label only, no shared header", labels, rail)
	}

	explicit := []string{"MAIN_APP_HEADER", "MART"}
	labels, rail = resolveHeaderLabels("MART", &explicit, nil, nil)
	if !rail || !containsLabel(labels, "MART") || !containsLabel(labels, "MAIN_APP_HEADER") {
		t.Fatalf("explicit shared mart = %v rail=%v", labels, rail)
	}

	labels, rail = resolveHeaderLabels("MART", nil, &off, []string{"MART", "MAIN_APP_HEADER"})
	if rail || containsLabel(labels, "MAIN_APP_HEADER") || !containsLabel(labels, "MART") {
		t.Fatalf("legacy rail off = %v rail=%v, want shared header dropped", labels, rail)
	}

	labels, rail = resolveHeaderLabels("MART", nil, &on, []string{"MART"})
	if !rail || !containsLabel(labels, "MAIN_APP_HEADER") {
		t.Fatalf("legacy rail on = %v rail=%v, want shared header added", labels, rail)
	}

	// An explicit label list wins over a conflicting legacy rail flag.
	labels, rail = resolveHeaderLabels("MART", &explicit, &off, nil)
	if !rail || !containsLabel(labels, "MAIN_APP_HEADER") {
		t.Fatalf("explicit wins = %v rail=%v, want the explicit shared label kept", labels, rail)
	}

	foodExplicit := []string{"FOOD", "MAIN_APP_HEADER"}
	labels, rail = resolveHeaderLabels("FOOD", &foodExplicit, &on, nil)
	if rail || containsLabel(labels, "MAIN_APP_HEADER") || !containsLabel(labels, "FOOD") {
		t.Fatalf("food = %v rail=%v, want MAIN_APP_HEADER rejected", labels, rail)
	}

	// Switching app drops the old primary label but keeps an explicit shared header.
	labels, rail = resolveHeaderLabels("PHARMA", nil, nil, []string{"MART", "MAIN_APP_HEADER"})
	if !containsLabel(labels, "PHARMA") || containsLabel(labels, "MART") || !rail {
		t.Fatalf("app switch = %v rail=%v", labels, rail)
	}

	// A header-only row is its own primary: the MAIN_APP_HEADER label stands alone, no vendor label.
	labels, rail = resolveHeaderLabels("MAIN_APP_HEADER", nil, nil, nil)
	if !rail || len(labels) != 1 || labels[0] != "MAIN_APP_HEADER" {
		t.Fatalf("header only = %v rail=%v, want [MAIN_APP_HEADER]", labels, rail)
	}
}

func containsLabel(labels []string, want string) bool {
	for _, h := range labels {
		if h == want {
			return true
		}
	}
	return false
}

// TestReadListFilters pins the shared query parsing: `?header=` accepts the four curated labels (any
// case) and rejects anything else before any DB access.
func TestReadListFilters(t *testing.T) {
	h := NewHandler(NewRepo(nil))
	for _, tt := range []struct {
		name  string
		query string
		want  int
	}{
		{"header ok", "?header=main_app_header", http.StatusOK},
		{"header mart", "?header=MART&app=mart", http.StatusOK},
		{"header unknown", "?header=BANNER", http.StatusBadRequest},
		{"app unknown", "?app=GROCERY", http.StatusBadRequest},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/admin/categories"+tt.query, nil)
			rr := httptest.NewRecorder()
			h.adminList(rr, req)
			// A nil pool makes any accepted read 500; only the malformed cases 400 before that.
			if tt.want == http.StatusBadRequest && rr.Code != http.StatusBadRequest {
				t.Fatalf("GET %s → %d, want 400", tt.query, rr.Code)
			}
			if tt.want == http.StatusOK && rr.Code == http.StatusBadRequest {
				t.Fatalf("GET %s → 400, want the filter to be accepted", tt.query)
			}
		})
	}
}
