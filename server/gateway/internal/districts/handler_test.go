package districts

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListWithoutPool(t *testing.T) {
	if _, err := NewRepo(nil).List(context.Background(), "TN"); err == nil {
		t.Fatal("expected an error when the pool is nil")
	}
}

func TestHandlerRejectsLongState(t *testing.T) {
	h := NewHandler(NewRepo(nil), nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/geo/districts?state=abc", nil)
	rec := httptest.NewRecorder()
	h.districts(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", rec.Code)
	}
}

func TestHandlerUnavailableWithoutPool(t *testing.T) {
	h := NewHandler(NewRepo(nil), nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/geo/districts?state=TN", nil)
	rec := httptest.NewRecorder()
	h.districts(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500", rec.Code)
	}
}

func TestValidateShape(t *testing.T) {
	cases := []struct {
		code, name, state string
		ok                bool
	}{
		{"TCH", "Chennai", "TN", true},
		{"PY0", "Puducherry", "PY", true},
		{"TZ9", "Alnum", "TN", true},
		{"tch", "lower", "TN", false},
		{"TC", "short", "TN", false},
		{"TCHH", "long", "TN", false},
		{"T-H", "symbol", "TN", false},
		{"TCH", "", "TN", false},
		{"TCH", "Name", "T", false},
		{"TCH", "Name", "tn", false},
	}
	for _, c := range cases {
		if _, ok := validateShape(c.code, c.name, c.state); ok != c.ok {
			t.Errorf("validateShape(%q,%q,%q) = %v, want %v", c.code, c.name, c.state, ok, c.ok)
		}
	}
}

func TestCreateRejectsBadPayload(t *testing.T) {
	called := false
	h := NewHandler(NewRepo(nil), nil, func() error { called = true; return nil })
	// A lowercase code is normalised (not rejected); a bad shape is rejected before any write.
	body, _ := json.Marshal(Input{Code: "T-H", Name: "Chennai", StateCode: "TN"})
	req := httptest.NewRequest(http.MethodPost, "/admin/districts", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.create(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400 for a malformed code", rec.Code)
	}
	if called {
		t.Fatal("the geo mirror must not reload on a rejected request")
	}
}

func TestToggleRequiresFlag(t *testing.T) {
	h := NewHandler(NewRepo(nil), nil, nil)
	body, _ := json.Marshal(map[string]any{})
	req := httptest.NewRequest(http.MethodPatch, "/admin/districts/TCH/toggle", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.toggle(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400 when isActive is missing", rec.Code)
	}
}
