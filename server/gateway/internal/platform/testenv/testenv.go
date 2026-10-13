// Package testenv provides shared integration-test helpers. It lives under
// platform/ (domain-free) so any context's _test.go may import it without breaking
// the boundary rules in docs/architecture/monolith-breakdown.md §2.
//
// Tests skip (never fail) when the backing service is not configured, so the unit
// suite stays green without Docker. Point the env at the local compose stack:
//
//	TEST_DATABASE_URL=postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable
//	TEST_VALKEY_URL=redis://localhost:6379/0
package testenv

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/jackc/pgx/v5/pgxpool"
)

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

// DBURL resolves the test Postgres URL (TEST_DATABASE_URL, then DATABASE_URL).
func DBURL() string { return envOr("TEST_DATABASE_URL", os.Getenv("DATABASE_URL")) }

// Pool connects to the test Postgres, skipping the test when unconfigured or unreachable.
func Pool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := DBURL()
	if url == "" {
		t.Skip("TEST_DATABASE_URL/DATABASE_URL not set — skipping DB integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Skipf("connect postgres: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("ping postgres: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// Cache connects to the test Valkey (TEST_VALKEY_URL, then VALKEY_URL). Returns a
// disabled no-op cache when unset. Use RequireCache to skip tests that need real locks.
func Cache(t *testing.T) *cache.Cache {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, err := cache.Connect(ctx, envOr("TEST_VALKEY_URL", os.Getenv("VALKEY_URL")))
	if err != nil {
		t.Skipf("connect valkey: %v", err)
	}
	t.Cleanup(func() { _ = c.Close() })
	return c
}

// RequireCache skips unless a real Valkey client is attached.
func RequireCache(t *testing.T, c *cache.Cache) {
	t.Helper()
	if !c.Enabled() {
		t.Skip("TEST_VALKEY_URL/VALKEY_URL not set — skipping cache-dependent test")
	}
}