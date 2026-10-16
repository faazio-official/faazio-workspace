// Package cache is the Aiven Valkey (Redis-compatible) read-through layer.
// Key taxonomy + TTLs: docs/architecture/caching-cloudflare-valkey.md §4–§5.
// All values are plain JSON. A nil client is a no-op cache (cache disabled).
package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Key builders — the frozen taxonomy (contract-freeze §4). AuthUser hashes the Supabase
// auth subject so no raw identifier is used as a key.
func SearchQuery(q string) string    { return fmt.Sprintf("faazio:v1:search:q:%s", q) }
func Product(id string) string       { return fmt.Sprintf("faazio:v1:catalog:product:%s", id) }
func Store(id string) string         { return fmt.Sprintf("faazio:v1:directory:store:%s", id) }
func PickupPoints(key string) string { return fmt.Sprintf("faazio:v1:directory:pickup:%s", key) }
func Menu(venueID string) string     { return fmt.Sprintf("faazio:v1:directory:menu:%s", venueID) }
func Venues(key string) string       { return fmt.Sprintf("faazio:v1:directory:venues:%s", key) }
func Prescriptions(userID string) string {
	return fmt.Sprintf("faazio:v1:pharma:prescriptions:%s", userID)
}
func Notifications(userID string) string {
	return fmt.Sprintf("faazio:v1:notifications:inbox:%s", userID)
}
func Stock(id string) string          { return fmt.Sprintf("faazio:v1:stock:%s", id) }
func VendorReviews(id string) string  { return fmt.Sprintf("faazio:v1:reviews:vendor:%s", id) }
func ProductReviews(id string) string { return fmt.Sprintf("faazio:v1:reviews:product:%s", id) }
func Orders(userID string) string     { return fmt.Sprintf("faazio:v1:checkout:orders:%s", userID) }
func Favourites(userID string) string { return fmt.Sprintf("faazio:v1:favourites:items:%s", userID) }
func Rewards(userID string) string    { return fmt.Sprintf("faazio:v1:rewards:view:%s", userID) }
func BloodRequests(key string) string { return fmt.Sprintf("faazio:v1:blood:requests:%s", key) }
func Bookings(userID string) string   { return fmt.Sprintf("faazio:v1:bookings:tables:%s", userID) }

// BookingAvail caches the public, seat-count-free availability projection for a vendor. The
// seller-private config row itself is never cached (PII/internal rules, caching doc §6).
func BookingAvail(vendorID string) string {
	return fmt.Sprintf("faazio:v1:bookings:avail:%s", vendorID)
}
func SduiHome(locale string) string { return fmt.Sprintf("faazio:v1:gateway:sdui:%s:/home", locale) }
func Reco(userIDHash, context string) string {
	return fmt.Sprintf("faazio:v1:reco:%s:%s", userIDHash, context)
}
func Idempotency(ref string) string  { return fmt.Sprintf("faazio:v1:checkout:idem:%s", ref) }
func PromoCampaign(id string) string { return fmt.Sprintf("faazio:v1:promo:campaign:%s", id) }
func AdSlot(id string) string        { return fmt.Sprintf("faazio:v1:ads:slot:%s", id) }

// PromoPublicCoupons caches the anon-visible active-coupon projection for (app, state) — non-PII
// business data (caching doc §5). AdsLive caches the anon-visible LIVE ad projection per placement.
func PromoPublicCoupons(app, state string) string {
	return fmt.Sprintf("faazio:v1:promo:coupons:public:%s:%s", app, state)
}
func AdsLive(placement string) string { return fmt.Sprintf("faazio:v1:ads:live:%s", placement) }

// PromoActiveDiscount caches one product's active festival discount (LIVE campaign + APPROVED
// opt-in, sector-capped). A cached `none` sentinel means "checked, no active discount" so a
// catalog batch never re-queries absent products. Invalidated on opt-in/campaign status change
// (caching doc §5).
func PromoActiveDiscount(productID string) string {
	return fmt.Sprintf("faazio:v1:promo:active:%s", productID)
}
func Settlement(sellerID, cycle string) string {
	return fmt.Sprintf("faazio:v1:settlement:%s:%s", sellerID, cycle)
}
func AuthUser(authUID string) string {
	sum := sha256.Sum256([]byte(authUID))
	return "faazio:v1:auth:uid:" + hex.EncodeToString(sum[:])
}

// TTL helpers.
const (
	TTLSearch  = 600 * time.Second
	TTLProduct = 24 * time.Hour
	TTLStore   = 24 * time.Hour
	TTLStock   = 45 * time.Second
	TTLReviews = 24 * time.Hour
	TTLOrders  = 60 * time.Second
	TTLSdui    = 300 * time.Second
	TTLAuth    = 3600 * time.Second

	// TTLFavourites bounds the auth-scoped favourites projection (mutable; invalidated on write).
	TTLFavourites = 60 * time.Second

	// TTLRewards bounds the auth-scoped rewards view (mutable; invalidated on earn/redeem).
	TTLRewards = 60 * time.Second

	// TTLPrescriptions bounds the auth-scoped Rx list (mutable; invalidated on create).
	TTLPrescriptions = 60 * time.Second

	// TTLNotifications bounds the auth-scoped notification inbox (mutable; invalidated on enqueue).
	TTLNotifications = 30 * time.Second

	// TTLBloodRequests bounds the public (redacted) blood-requests board; auth callers bypass it.
	TTLBloodRequests = 60 * time.Second

	// TTLBookings bounds the auth-scoped booking lists (mutable; invalidated on write).
	TTLBookings = 60 * time.Second

	// TTLBookingAvail bounds the public vendor availability projection (bookable/fee/timing only;
	// invalidated on config write and on every accept/reject so long holds free up promptly).
	TTLBookingAvail = 30 * time.Second

	// TTLReco bounds the per-userHash recommendation projection (caching doc §5).
	TTLReco = 3600 * time.Second

	// Partner control plane (0015). Seller records carry PII and are never cached; these keys
	// cover non-PII business data (campaigns, ad slots, settlement cycles).
	TTLPromo      = 300 * time.Second
	TTLAds        = 300 * time.Second
	TTLSettlement = 600 * time.Second

	// TTLPublicPromo bounds the anon-visible active-coupon projection (caching doc §5).
	TTLPublicPromo = 600 * time.Second

	// TTLPromoActive bounds the anon-visible active festival discount projection per product
	// (LIVE campaign + APPROVED opt-in, sector-capped); invalidated on opt-in/campaign change.
	TTLPromoActive = 300 * time.Second
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
