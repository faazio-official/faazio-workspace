package cache

import (
	"context"
	"errors"
	"os"
	"sync/atomic"
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
		{Venues("FOOD"), "faazio:v1:directory:venues:FOOD"},
		{Stock("md-1"), "faazio:v1:stock:md-1"},
		{VendorReviews("store-f1"), "faazio:v1:reviews:vendor:store-f1"},
		{ProductReviews("md-1"), "faazio:v1:reviews:product:md-1"},
		{Orders("user-1"), "faazio:v1:checkout:orders:user-1"},
		{Prescriptions("user-1"), "faazio:v1:pharma:prescriptions:user-1"},
		{Notifications("user-1"), "faazio:v1:notifications:inbox:user-1"},
		{SduiHome("en"), "faazio:v1:gateway:sdui:en:/home"},
		{SduiMart("en"), "faazio:v1:gateway:sdui:en:/mart"},
		{SduiFood("en"), "faazio:v1:gateway:sdui:en:/food"},
		{Idempotency("ORD-1"), "faazio:v1:checkout:idem:ORD-1"},
		{PromoCampaign("cmp-1"), "faazio:v1:promo:campaign:cmp-1"},
		{PromoActiveDiscount("md-1"), "faazio:v1:promo:active:md-1"},
		{AdSlot("ad-1"), "faazio:v1:ads:slot:ad-1"},
		{Settlement("sel-1", "2026-01"), "faazio:v1:settlement:sel-1:2026-01"},
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
		{TTLPrescriptions, 60 * time.Second},
		{TTLNotifications, 30 * time.Second},
		{TTLSdui, 300 * time.Second},
		{TTLPromo, 300 * time.Second},
		{TTLAds, 300 * time.Second},
		{TTLPromoActive, 300 * time.Second},
		{TTLSettlement, 600 * time.Second},
		{TTLNearby, 120 * time.Second},
		{TTLNearbyStale, 300 * time.Second},
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

// TestNearbyTilePrefixesFreeze pins the store-live-toggle purge patterns. Changing a key means
// bumping the v{N} prefix — update this test in the same PR.
func TestNearbyTilePrefixesFreeze(t *testing.T) {
	wantStores := []string{
		"faazio:v1:geo:nearby:stores:17.439:78.379:",
		"faazio:v1:geo:nearby:stores:17.439:78.380:",
		"faazio:v1:geo:nearby:stores:17.439:78.381:",
		"faazio:v1:geo:nearby:stores:17.440:78.379:",
		"faazio:v1:geo:nearby:stores:17.440:78.380:",
		"faazio:v1:geo:nearby:stores:17.440:78.381:",
		"faazio:v1:geo:nearby:stores:17.441:78.379:",
		"faazio:v1:geo:nearby:stores:17.441:78.380:",
		"faazio:v1:geo:nearby:stores:17.441:78.381:",
	}
	got := NearbyStoresTilePrefixes(17.4401, 78.3802)
	if len(got) != len(wantStores) {
		t.Fatalf("len = %d, want %d: %v", len(got), len(wantStores), got)
	}
	for i := range wantStores {
		if got[i] != wantStores[i] {
			t.Errorf("prefix[%d] = %q, want %q", i, got[i], wantStores[i])
		}
	}
	wantProducts := "faazio:v1:geo:nearby:products:17.440:78.380:"
	if gp := NearbyProductsTilePrefixes(17.4401, 78.3802); gp[4] != wantProducts {
		t.Errorf("products prefix[4] = %q, want %q", gp[4], wantProducts)
	}
}

// TestReadStaleDisabledCacheLoadsEveryTime verifies the cache-disabled fallback is a plain
// synchronous load (existing gateway degradation without Valkey).
func TestReadStaleDisabledCacheLoadsEveryTime(t *testing.T) {
	c, err := Connect(context.Background(), "")
	if err != nil {
		t.Fatalf("Connect(\"\") error: %v", err)
	}
	var calls int32
	load := func(context.Context) (any, error) {
		atomic.AddInt32(&calls, 1)
		return []string{"x"}, nil
	}
	for i := 0; i < 3; i++ {
		var dst []string
		if err := c.ReadStale(context.Background(), "k", &dst, time.Minute, time.Minute, load); err != nil {
			t.Fatalf("ReadStale disabled: %v", err)
		}
		if len(dst) != 1 || dst[0] != "x" {
			t.Fatalf("dst = %v", dst)
		}
	}
	if n := atomic.LoadInt32(&calls); n != 3 {
		t.Fatalf("calls = %d, want one per read", n)
	}
}

// testCache connects to the test Valkey (TEST_VALKEY_URL, then VALKEY_URL), skipping when
// unset/unreachable. In-package so cache_test.go avoids the cache→testenv import cycle.
func testCache(t *testing.T) *Cache {
	t.Helper()
	url := os.Getenv("TEST_VALKEY_URL")
	if url == "" {
		url = os.Getenv("VALKEY_URL")
	}
	if url == "" {
		t.Skip("TEST_VALKEY_URL/VALKEY_URL not set — skipping cache-dependent test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, err := Connect(ctx, url)
	if err != nil {
		t.Skipf("connect valkey: %v", err)
	}
	t.Cleanup(func() { _ = c.Close() })
	return c
}

func TestReadStaleLifecycle(t *testing.T) {
	c := testCache(t)
	ctx := context.Background()
	key := NearbyStores("17.440", "78.380", 25, "FOOD")
	c.Del(ctx, key, key+":fresh")

	var calls int32
	load := func(v string) func(context.Context) (any, error) {
		return func(context.Context) (any, error) {
			atomic.AddInt32(&calls, 1)
			return []string{v}, nil
		}
	}

	// True miss: synchronous load, value served, fresh marker armed.
	var dst []string
	if err := c.ReadStale(ctx, key, &dst, 10*time.Second, 30*time.Second, load("v1")); err != nil {
		t.Fatalf("miss load: %v", err)
	}
	if len(dst) != 1 || dst[0] != "v1" {
		t.Fatalf("miss dst = %v", dst)
	}
	if n := atomic.LoadInt32(&calls); n != 1 {
		t.Fatalf("miss calls = %d, want 1", n)
	}
	if !c.Exists(ctx, key+":fresh") {
		t.Fatal("fresh marker missing after miss load")
	}

	// Fresh hit: same value, no reload.
	dst = nil
	if err := c.ReadStale(ctx, key, &dst, 10*time.Second, 30*time.Second, load("v2")); err != nil {
		t.Fatalf("fresh read: %v", err)
	}
	if len(dst) != 1 || dst[0] != "v1" {
		t.Fatalf("fresh dst = %v, want v1", dst)
	}
	if n := atomic.LoadInt32(&calls); n != 1 {
		t.Fatalf("fresh calls = %d, want 1", n)
	}

	// Lapse freshness (drop the marker, keep the value): stale is served immediately and the
	// background refresh lands v2 + re-arms the marker.
	c.Del(ctx, key+":fresh")
	dst = nil
	if err := c.ReadStale(ctx, key, &dst, 10*time.Second, 30*time.Second, load("v2")); err != nil {
		t.Fatalf("stale read: %v", err)
	}
	if len(dst) != 1 || dst[0] != "v1" {
		t.Fatalf("stale dst = %v, want v1 served before refresh", dst)
	}
	deadline := time.Now().Add(5 * time.Second)
	for !c.Exists(ctx, key+":fresh") {
		if time.Now().After(deadline) {
			t.Fatalf("background refresh did not re-arm the marker (calls=%d)", atomic.LoadInt32(&calls))
		}
		time.Sleep(20 * time.Millisecond)
	}
	if n := atomic.LoadInt32(&calls); n != 2 {
		t.Fatalf("calls after background refresh = %d, want 2", n)
	}

	// Post-refresh read is fresh (no reload) and carries the new value.
	dst = nil
	if err := c.ReadStale(ctx, key, &dst, 10*time.Second, 30*time.Second, load("v3")); err != nil {
		t.Fatalf("post-refresh read: %v", err)
	}
	if len(dst) != 1 || dst[0] != "v2" {
		t.Fatalf("post-refresh dst = %v, want v2", dst)
	}
	if n := atomic.LoadInt32(&calls); n != 2 {
		t.Fatalf("post-refresh calls = %d, want 2", n)
	}
}

func TestReadStaleStaleIfError(t *testing.T) {
	c := testCache(t)
	ctx := context.Background()
	key := NearbyProducts("17.440", "78.380", 25, "MART")
	c.Del(ctx, key, key+":fresh")
	boom := errors.New("db down")

	// A true miss with a failing load surfaces the error (caller keeps its 500 path).
	var dst []string
	if err := c.ReadStale(ctx, key, &dst, time.Minute, time.Minute, func(context.Context) (any, error) {
		return nil, boom
	}); err != boom {
		t.Fatalf("miss with failing load: err = %v, want boom", err)
	}

	// Prime a value, lapse freshness, then fail every reload: the stale value must still serve
	// (a background refresh failure never hard-fails the read).
	if err := c.ReadStale(ctx, key, &dst, time.Minute, time.Minute, func(context.Context) (any, error) {
		return []string{"v1"}, nil
	}); err != nil {
		t.Fatalf("prime: %v", err)
	}
	c.Del(ctx, key+":fresh")
	dst = nil
	if err := c.ReadStale(ctx, key, &dst, 30*time.Second, 30*time.Second, func(context.Context) (any, error) {
		return nil, boom
	}); err != nil {
		t.Fatalf("stale read with failing refresh must not error: %v", err)
	}
	if len(dst) != 1 || dst[0] != "v1" {
		t.Fatalf("stale dst = %v, want v1", dst)
	}
}
