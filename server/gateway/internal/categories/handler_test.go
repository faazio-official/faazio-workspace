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
	for _, a := range []string{"MART", "FOOD", "PHARMA"} {
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

// TestCreateValidation pins the 400s that run before any DB access: with a nil pool every accepted
// body would 500, so a 400 proves the validator rejected it first.
func TestCreateValidation(t *testing.T) {
	h := NewHandler(NewRepo(nil))
	for _, tt := range []struct{ name, body string }{
		{"unknown app", `{"app":"GROCERY","name":"X"}`},
		{"empty name", `{"app":"MART","name":"   "}`},
		{"name too long", `{"app":"MART","name":"` + strings.Repeat("a", 121) + `"}`},
		{"bad id", `{"app":"MART","name":"X","id":"bad id!"}`},
		{"body not json", `{`},
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
