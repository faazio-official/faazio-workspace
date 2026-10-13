package sdui

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/go-chi/chi/v5"
)

func TestHomeETagAnd304(t *testing.T) {
	ctx := context.Background()
	c, err := cache.Connect(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(
		fakeLayouts{
			version: 7,
			sections: []contracts.SduiSection{
				{ID: "deals", Title: "Deals", ProductIDs: []string{"md-1"}},
			},
		},
		fakeProducts{byID: map[string]contracts.Product{"md-1": {ID: "md-1", Name: "Milk"}}},
		fakeStores{},
		c,
	)
	r := chi.NewRouter()
	NewHandler(svc).Register(r)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/sdui/home", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	etag := rec.Header().Get("ETag")
	if etag != `"home-v7"` {
		t.Fatalf("etag = %q, want %q", etag, `"home-v7"`)
	}

	req := httptest.NewRequest(http.MethodGet, "/sdui/home", nil)
	req.Header.Set("If-None-Match", etag)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req)
	if rec2.Code != http.StatusNotModified {
		t.Fatalf("conditional status = %d, want 304", rec2.Code)
	}
}
