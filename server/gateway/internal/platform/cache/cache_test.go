package cache

import (
	"context"
	"testing"
	"time"
)

// TestKeyBuildersFreeze pins the cache key taxonomy (monolith-breakdown.md §4).
// Changing a key means bumping the v{N} prefix — update this test in the same PR.
func TestKeyBuildersFreeze(t *testing.T) {
	cases := []struct {
		got, want string
	}{
		{SearchQuery("coffee"), "faazio:v1:search:q:coffee"},
		{Product("md-1"), "faazio:v1:catalog:product:md-1"},
		{Store("store-m3"), "faazio:v1:directory:store:store-m3"},
		{Stock("md-1"), "faazio:v1:stock:md-1"},
		{VendorReviews("store-f1"), "faazio:v1:reviews:vendor:store-f1"},
		{ProductReviews("md-1"), "faazio:v1:reviews:product:md-1"},
		{Orders("user-1"), "faazio:v1:checkout:orders:user-1"},
		{SduiHome("en"), "faazio:v1:gateway:sdui:en:/home"},
		{Idempotency("ORD-1"), "faazio:v1:checkout:idem:ORD-1"},
	}
	for _, tc := range cases {
		if tc.got != tc.want {
			t.Errorf("key = %q, want %q", tc.got, tc.want)
		}
	}
}

func TestTTLMatrixFreeze(t *testing.T) {
	cases := []struct {
		got, want time.Duration
	}{
		{TTLSearch, 600 * time.Second},
		{TTLProduct, 24 * time.Hour},
		{TTLStore, 24 * time.Hour},
		{TTLStock, 45 * time.Second},
		{TTLReviews, 24 * time.Hour},
		{TTLOrders, 60 * time.Second},
		{TTLSdui, 300 * time.Second},
	}
	for _, tc := range cases {
		if tc.got != tc.want {
			t.Errorf("ttl = %s, want %s", tc.got, tc.want)
		}
	}
}

func TestDisabledCacheIsNoOp(t *testing.T) {
	c, err := Connect(context.Background(), "")
	if err != nil {
		t.Fatalf("Connect(\"\") error: %v", err)
	}
	if c.Enabled() {
		t.Fatal("empty URL must yield a disabled cache")
	}
	var dst []string
	if c.GetJSON(context.Background(), "k", &dst) {
		t.Fatal("disabled GetJSON must miss")
	}
	c.SetJSON(context.Background(), "k", []string{"x"}, time.Minute) // must not panic
	c.Del(context.Background(), "k")
	if err := c.AcquireLock(context.Background(), "k", time.Minute); err != nil {
		t.Fatalf("disabled AcquireLock must succeed, got %v", err)
	}
}