// Package cache is the Aiven Valkey (Redis-compatible) read-through layer.
// Key taxonomy + TTLs: docs/architecture/caching-cloudflare-valkey.md §4–§5.
// All values are plain JSON. A nil client is a no-op cache (cache disabled).
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Key builders — the frozen taxonomy (contract-freeze §4).
func SearchQuery(q string) string     { return fmt.Sprintf("faazio:v1:search:q:%s", q) }
func Product(id string) string        { return fmt.Sprintf("faazio:v1:catalog:product:%s", id) }
func Store(id string) string          { return fmt.Sprintf("faazio:v1:directory:store:%s", id) }
func Stock(id string) string          { return fmt.Sprintf("faazio:v1:stock:%s", id) }
func VendorReviews(id string) string  { return fmt.Sprintf("faazio:v1:reviews:vendor:%s", id) }
func ProductReviews(id string) string { return fmt.Sprintf("faazio:v1:reviews:product:%s", id) }
func Orders(userID string) string     { return fmt.Sprintf("faazio:v1:checkout:orders:%s", userID) }
func SduiHome(locale string) string   { return fmt.Sprintf("faazio:v1:gateway:sdui:%s:/home", locale) }
func Idempotency(ref string) string   { return fmt.Sprintf("faazio:v1:checkout:idem:%s", ref) }

// TTL helpers.
const (
	TTLSearch  = 600 * time.Second
	TTLProduct = 24 * time.Hour
	TTLStore   = 24 * time.Hour
	TTLStock   = 45 * time.Second
	TTLReviews = 24 * time.Hour
	TTLOrders  = 60 * time.Second
	TTLSdui    = 300 * time.Second
)

// Cache is a JSON read-through cache. A nil *Client (disabled) is safe to call.
type Cache struct {
	rdb *redis.Client
}

// Connect opens Valkey. Returns a no-op cache when url is empty.
func Connect(ctx context.Context, url string) (*Cache, error) {
	if url == "" {
		return &Cache{}, nil
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse VALKEY_URL: %w", err)
	}
	rdb := redis.NewClient(opts)
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("ping valkey: %w", err)
	}
	return &Cache{rdb: rdb}, nil
}

// Enabled reports whether a Valkey client is attached.
func (c *Cache) Enabled() bool { return c != nil && c.rdb != nil }

// Close releases the client.
func (c *Cache) Close() error {
	if c == nil || c.rdb == nil {
		return nil
	}
	return c.rdb.Close()
}

// GetJSON unmarshals a cached value into dst. Returns false on miss/disabled/error.
func (c *Cache) GetJSON(ctx context.Context, key string, dst any) bool {
	if !c.Enabled() {
		return false
	}
	b, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(b, dst) == nil
}

// SetJSON caches v under key for ttl (plain JSON, no compression).
func (c *Cache) SetJSON(ctx context.Context, key string, v any, ttl time.Duration) {
	if !c.Enabled() {
		return
	}
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	_ = c.rdb.Set(ctx, key, b, ttl).Err()
}

// Del invalidates keys (write-around).
func (c *Cache) Del(ctx context.Context, keys ...string) {
	if !c.Enabled() || len(keys) == 0 {
		return
	}
	_ = c.rdb.Del(ctx, keys...).Err()
}

// ErrLockHeld is returned when an idempotency lock is already held.
var ErrLockHeld = errors.New("lock already held")

// AcquireLock sets key NX EX ttl (checkout idempotency, caching doc §7).
// Returns ErrLockHeld if the lock exists. If cache is disabled, it always succeeds
// (single-flight is unavailable without Valkey — documented limitation).
func (c *Cache) AcquireLock(ctx context.Context, key string, ttl time.Duration) error {
	if !c.Enabled() {
		return nil
	}
	ok, err := c.rdb.SetNX(ctx, key, "1", ttl).Result()
	if err != nil {
		return err
	}
	if !ok {
		return ErrLockHeld
	}
	return nil
}

// ReleaseLock removes an idempotency lock.
func (c *Cache) ReleaseLock(ctx context.Context, key string) {
	c.Del(ctx, key)
}
