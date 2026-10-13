package search

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/go-chi/chi/v5"
)

type fakeReader struct {
	called bool
	q, app string
}

func (f *fakeReader) ByID(context.Context, string) (contracts.Product, bool, error) {
	return contracts.Product{}, false, nil
}
func (f *fakeReader) ByIDs(context.Context, []string) ([]contracts.Product, error) { return nil, nil }
func (f *fakeReader) Search(_ context.Context, q, app string, _ int) ([]contracts.Product, error) {
	f.called, f.q, f.app = true, q, app
	return []contracts.Product{}, nil
}

func testRouter(t *testing.T, reader contracts.ProductReader) http.Handler {
	t.Helper()
	c, err := cache.Connect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	r := chi.NewRouter()
	NewHandler(reader, c).Register(r)
	return r
}

func TestEmptyQuerySkipsReader(t *testing.T) {
	reader := &fakeReader{}
	rec := httptest.NewRecorder()
	testRouter(t, reader).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/search", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if reader.called {
		t.Fatal("empty q must not hit the reader")
	}
	if got := strings.TrimSpace(rec.Body.String()); got != "[]" {
		t.Fatalf("body = %q, want []", got)
	}
}

func TestAppWhitelist(t *testing.T) {
	cases := map[string]string{
		"":        "",
		"EVIL":    "",
		"mart":    "MART",
		" PHARMA": "PHARMA",
	}
	for in, want := range cases {
		reader := &fakeReader{}
		rec := httptest.NewRecorder()
		target := "/search?" + url.Values{"q": {"coffee"}, "app": {in}}.Encode()
		testRouter(t, reader).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
		if reader.app != want {
			t.Fatalf("app=%q normalized to %q, want %q", in, reader.app, want)
		}
	}
}
