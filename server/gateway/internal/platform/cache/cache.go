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
func Venue(id string) string         { return fmt.Sprintf("faazio:v1:directory:venue:%s", id) }
func Prescriptions(userID string) string {
	return fmt.Sprintf("faazio:v1:pharma:prescriptions:%s", userID)
}
func Notifications(userID string) string {
	return fmt.Sprintf("faazio:v1:notifications:inbox:%s", userID)
}
func Stock(id string) string { return fmt.Sprintf("faazio:v1:stock:%s", id) }
func StoreProducts(storeID string) string {
	return fmt.Sprintf("faazio:v1:catalog:store-products:%s", storeID)
}
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

// NearbyStores/NearbyProducts cache one geo read. Coordinates are rounded to 3 decimals (~110 m)
// by the handler so a still user keeps a warm key while walking; radius in km, app may be empty.
func NearbyStores(lat, lng string, radius int, app string) string {
	return fmt.Sprintf("faazio:v1:geo:nearby:stores:%s:%s:%d:%s", lat, lng, radius, app)
}
func NearbyProducts(lat, lng string, radius int, app string) string {
	return fmt.Sprintf("faazio:v1:geo:nearby:products:%s:%s:%d:%s", lat, lng, radius, app)
}

func SduiHome(locale string) string { return fmt.Sprintf("faazio:v1:gateway:sdui:%s:/home", locale) }

// SduiMart caches the compiled Mart-only SDUI projection (martHero/martDeals/martEssentials) so the
// Mart screen never downloads or couples to the full Home feed. Same TTL as the Home feed; purged
// on layout publish (write-around).
func SduiMart(locale string) string { return fmt.Sprintf("faazio:v1:gateway:sdui:%s:/mart", locale) }

// SduiFood caches the compiled Food-only SDUI projection (foodHero/foodSpecials/mostRatedDining)
// so the Food screen never downloads or couples to the full Home feed. Same TTL as the Home feed;
// purged on layout publish (write-around).
func SduiFood(locale string) string { return fmt.Sprintf("faazio:v1:gateway:sdui:%s:/food", locale) }

// SduiPharma caches the compiled Pharma-only SDUI projection (pharmaHero/pharmaPopular/
// pharmaEssentials) so the Pharma screen never downloads or couples to the full Home feed. Same TTL
// as the other feeds; purged on layout publish (write-around).
func SduiPharma(locale string) string {
	return fmt.Sprintf("faazio:v1:gateway:sdui:%s:/pharma", locale)
}

// HomeCampaigns caches the compiled anon editorial-campaign list (Home "Deals of the day" drill-in).
// HomeCampaign caches one campaign by id. Both are purged write-around on layout publish via
// HomeCampaignsPrefix (the list is also the single-campaign source).
func HomeCampaigns(locale string) string {
	return fmt.Sprintf("faazio:v1:home:campaigns:%s", locale)
}
func HomeCampaign(locale, id string) string {
	return fmt.Sprintf("faazio:v1:home:campaigns:%s:%s", locale, id)
}
func HomeCampaignsPrefix() string { return "faazio:v1:home:campaigns:" }
func Reco(userIDHash, context string) string {
	return fmt.Sprintf("faazio:v1:reco:%s:%s", userIDHash, context)
}
func Idempotency(ref string) string  { return fmt.Sprintf("faazio:v1:checkout:idem:%s", ref) }
func PromoCampaign(id string) string { return fmt.Sprintf("faazio:v1:promo:campaign:%s", id) }
func AdSlot(id string) string        { return fmt.Sprintf("faazio:v1:ads:slot:%s", id) }
func MediaAsset(id string) string    { return fmt.Sprintf("faazio:v1:media:asset:%s", id) }

// PromoPublicCoupons caches the anon-visible active-coupon projection for (app, state) — non-PII
// business data (caching doc §5). AdsLive caches the anon-visible LIVE ad projection per placement.
func PromoPublicCoupons(app, state string) string {
	return fmt.Sprintf("faazio:v1:promo:coupons:public:%s:%s", app, state)
}
func AdsLive(placement string) string { return fmt.Sprintf("faazio:v1:ads:live:%s", placement) }

// AdsHero caches the anon-visible LIVE hero projection for a (placement, app, category, store) context.
// Empty dimensions are sentinels meaning "any" (matches the query). The whole namespace is purged
// write-around via AdsHeroPrefix on any moderation/status change.
func AdsHero(placement, app, category, store string) string {
	return fmt.Sprintf("faazio:v1:ads:hero:%s:%s:%s:%s", placement, app, category, store)
}

// AdsHeroPrefix is the purge prefix for every cached hero context (see Cache.DelPrefix).
func AdsHeroPrefix() string { return "faazio:v1:ads:hero:" }

// AdsSeen de-dupes an impression for (user, slot) within TTLAdSeen so a card re-render never
// inflates the count (set NX). Clicks are always counted, so this key is impressions-only.
func AdsSeen(userID, slotID string) string {
	return fmt.Sprintf("faazio:v1:ads:seen:%s:%s", userID, slotID)
}

// AdsReport de-dupes a user "Report ad" per (user, placement) within TTLAdReport so one user cannot
// inflate a campaign's report counter (set NX). No PII: the user id is a stable slug, never an email.
func AdsReport(userID, placementID string) string {
	return fmt.Sprintf("faazio:v1:ads:report:%s:%s", userID, placementID)
}

// AdsPublishRate is the per-seller self-serve publish counter key for a UTC day (rate limit). The
// counter is created with TTLAdsPublishRate on first INCR (see Cache.Incr).
func AdsPublishRate(sellerID, day string) string {
	return fmt.Sprintf("faazio:v1:ads:publish:%s:%s", sellerID, day)
}

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

// DeliveryRiderLocation is the live rider coordinate (delivery:rider:{id}:location). It is the
// authoritative dispatch source and expires after TTLDeliveryRiderLocation, so a stopped heartbeat
// removes the rider from candidates. DeliveryRouteLeg caches one Routes API matrix leg for 5
// minutes; coordinates are rounded to ~11 m so nearby retries share the cached call.
func DeliveryRiderLocation(riderID string) string {
	return fmt.Sprintf("delivery:rider:%s:location", riderID)
}
func DeliveryRiderLocationPrefix() string { return "delivery:rider:" }
func DeliveryRouteLeg(fromLat, fromLng, toLat, toLng float64) string {
	return fmt.Sprintf("delivery:route:%.4f,%.4f:%.4f,%.4f", fromLat, fromLng, toLat, toLng)
}

func AuthUser(authUID string) string {
	sum := sha256.Sum256([]byte(authUID))
	return "faazio:v1:auth:uid:" + hex.EncodeToString(sum[:])
}

// Portal login throttles are keyed by a short hash of the IP / email so no raw identifier (and no
// email PII) is stored in Valkey. The cache is shared by every Render instance, so the counters
// hold across the rolling deploy (DB lockout is the durable fallback).
func PortalLoginIP(ipHash string) string {
	return "faazio:v1:auth:login:ip:" + ipHash
}
func PortalLoginEmail(emailHash string) string {
	return "faazio:v1:auth:login:email:" + emailHash
}

// PortalDeny is the access-token jti denylist (logout/password change). The TTL is the token's
// remaining lifetime, so the key never outlives the token it blocks.
func PortalDeny(jti string) string { return "faazio:v1:auth:deny:" + jti }

// TTL helpers.
const (
	TTLSearch = 600 * time.Second
	// TTLNearby bounds public geo reads; short enough to pick up store/pin changes quickly.
	TTLNearby  = 120 * time.Second
	TTLProduct = 24 * time.Hour
	TTLStore   = 24 * time.Hour
	TTLStock   = 45 * time.Second
	TTLReviews = 24 * time.Hour
	TTLOrders  = 60 * time.Second
	TTLSdui    = 300 * time.Second
	TTLAuth    = 3600 * time.Second

	// TTLHomeCampaign bounds the anon editorial-campaign projection (Home "Deals of the day"
	// drill-in). Slower-moving merchandising than the SDUI feed, so 600s; purged on layout publish.
	TTLHomeCampaign = 600 * time.Second

	// TTLStoreProducts bounds the anon-visible first page of a store's ACTIVE product list
	// (vendor drill-in). Purged on product edit/status change (caching doc §4).
	TTLStoreProducts = 300 * time.Second

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

	// TTLAdsHero bounds the anon-visible LIVE hero projection per context (placement/app/category/
	// store); purged on moderation/status change (caching doc §5).
	TTLAdsHero = 300 * time.Second

	// TTLAdSeen de-dupes a sponsored impression per (user, slot) — longer than any realistic
	// re-render storm, short enough to count a genuine re-view on a later session.
	TTLAdSeen = 300 * time.Second

	// TTLAdReport de-dupes a user "Report ad" per (user, placement) so one user cannot inflate a
	// campaign's report counter.
	TTLAdReport = 24 * time.Hour

	// TTLAdsPublishRate bounds the per-seller self-serve publish rate counter (publishes/UTC day).
	TTLAdsPublishRate = 24 * time.Hour

	// TTLPromoActive bounds the anon-visible active festival discount projection per product
	// (LIVE campaign + APPROVED opt-in, sector-capped); invalidated on opt-in/campaign change.
	TTLPromoActive = 300 * time.Second

	// TTLMediaAsset bounds one media.assets registry row (public identity + CDN URL). Long, because
	// keys are immutable; purged on confirm/status/delete (caching-cloudflare-valkey.md §5).
	TTLMediaAsset = 24 * time.Hour

	// Portal auth. Login counters are a rolling 60 s window; the access-token denylist only needs to
	// outlive the 15-minute access token; refresh sessions live in Postgres for 30 days.
	// Delivery: a rider heartbeat is authoritative for 5 minutes; the Routes matrix cache shares
	// the same window to cap Google API spend.
	TTLDeliveryRiderLocation = 300 * time.Second
	TTLDeliveryRoute         = 300 * time.Second

	TTLPortalLoginWindow = 60 * time.Second
	TTLPortalDeny        = 15 * time.Minute
	TTLPortalRefresh     = 30 * 24 * time.Hour
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

// Ping is the /health dependency probe. Returns nil for a disabled cache (not a failure — the
// gateway is designed to run without Valkey; it just skips read-through).
func (c *Cache) Ping(ctx context.Context) error {
	if c == nil || c.rdb == nil {
		return nil
	}
	return c.rdb.Ping(ctx).Err()
}

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

// DelPrefix invalidates every key under a namespace using SCAN (never KEYS). Bounded by a small
// keyspace (hero contexts); used write-around on moderation changes.
func (c *Cache) DelPrefix(ctx context.Context, prefix string) {
	if !c.Enabled() || prefix == "" {
		return
	}
	var cursor uint64
	for {
		keys, next, err := c.rdb.Scan(ctx, cursor, prefix+"*", 100).Result()
		if err != nil {
			return
		}
		if len(keys) > 0 {
			_ = c.rdb.Del(ctx, keys...).Err()
		}
		cursor = next
		if cursor == 0 {
			return
		}
	}
}

// Set stores a small value under key with ttl. Used for the portal access-token denylist.
func (c *Cache) Set(ctx context.Context, key, value string, ttl time.Duration) {
	if !c.Enabled() || key == "" {
		return
	}
	_ = c.rdb.Set(ctx, key, value, ttl).Err()
}

// Exists reports whether key is present. A disabled cache always reports false (the documented
// degradation: a logout cannot revoke an already-issued access token without Valkey).
func (c *Cache) Exists(ctx context.Context, key string) bool {
	if !c.Enabled() || key == "" {
		return false
	}
	n, err := c.rdb.Exists(ctx, key).Result()
	return err == nil && n > 0
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

// Incr increments a counter key and returns the new value. The TTL is applied only when the counter
// is first created (so a rolling window expires). If cache is disabled it returns 0, which callers
// treat as "unlimited" — the same documented single-node limitation as AcquireLock.
func (c *Cache) Incr(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	if !c.Enabled() {
		return 0, nil
	}
	n, err := c.rdb.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if n == 1 && ttl > 0 {
		_ = c.rdb.Expire(ctx, key, ttl).Err()
	}
	return n, nil
}
