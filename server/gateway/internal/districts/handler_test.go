package districts

import (
	"context"
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
	h := NewHandler(NewRepo(nil))
	req := httptest.NewRequest(http.MethodGet, "/geo/districts?state=abc", nil)
	rec := httptest.NewRecorder()
	h.districts(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", rec.Code)
	}
}

func TestHandlerUnavailableWithoutPool(t *testing.T) {
	h := NewHandler(NewRepo(nil))
	req := httptest.NewRequest(http.MethodGet, "/geo/districts?state=TN", nil)
	rec := httptest.NewRecorder()
	h.districts(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500", rec.Code)
	}
}
