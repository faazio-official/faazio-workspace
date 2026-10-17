package cloudflare

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewDisabledWithoutCredentials(t *testing.T) {
	if New(Config{ZoneID: "z"}) != nil {
		t.Fatal("expected nil purger when token unset")
	}
	if New(Config{APIToken: "t"}) != nil {
		t.Fatal("expected nil purger when zone unset")
	}
	var nilPurger *Purger
	if nilPurger.Enabled() {
		t.Fatal("nil purger must be disabled")
	}
	if err := nilPurger.PurgeURLs(context.Background(), []string{"https://img.faazio.in/x.jpg"}); err != nil {
		t.Fatalf("disabled PurgeURLs err = %v, want nil", err)
	}
}

func TestPurgeURLsSendsFiles(t *testing.T) {
	var gotAuth, gotPath string
	var gotBody struct {
		Files []string `json:"files"`
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"errors":[]}`))
	}))
	defer srv.Close()

	p := New(Config{ZoneID: "zone1", APIToken: "tok"})
	p.baseURL = srv.URL
	if err := p.PurgeURLs(context.Background(), []string{"https://img.faazio.in/a.jpg", " ", "https://img.faazio.in/a.jpg", "https://img.faazio.in/b.jpg"}); err != nil {
		t.Fatalf("PurgeURLs: %v", err)
	}
	if gotAuth != "Bearer tok" {
		t.Fatalf("auth header = %q", gotAuth)
	}
	if gotPath != "/zones/zone1/purge_cache" {
		t.Fatalf("path = %q", gotPath)
	}
	if len(gotBody.Files) != 2 {
		t.Fatalf("files = %v, want 2 deduped non-empty", gotBody.Files)
	}
}

func TestPurgeURLsFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"success":false,"errors":[{"code":10000,"message":"nope"}]}`))
	}))
	defer srv.Close()

	p := New(Config{ZoneID: "zone1", APIToken: "tok"})
	p.baseURL = srv.URL
	if err := p.PurgeURLs(context.Background(), []string{"https://img.faazio.in/a.jpg"}); err == nil {
		t.Fatal("expected error on non-2xx")
	}
}
