# Faazio Caching — Cloudflare Edge + Aiven Valkey

> **Status:** MVP code active / edge config planned. The Valkey read-through layer ships in
> `server/gateway/internal/platform/cache` (search/product/store/reviews/orders/sdui keys + checkout
> idempotency lock). The Cloudflare edge rules + `pg_cron`/Pub-Sub invalidation remain ops setup.
> Referenced by every table in `docs/architecture/db-schema.md` for cache-key → TTL → invalidation
> without re-explaining mechanics here.
> **Decision:** this plan supersedes the older **Upstash Redis** mentions in `server/README.md` /
> `docs/architecture/server-gateway-plan.md` — Aiven Valkey + Cloudflare is now the choice.

---

## 1. Two-layer architecture

| Layer | Where | What it caches | Who |
|---|---|---|---|
| **Edge (Cloudflare)** | CDN | public / anonymous GETs: compiled SDUI trees, search results, product images | HTTP(S) LB + CDN in front |
| **App cache (Aiven Valkey)** | origin side | per-key app cache: stock, sessions, idempotency, locks, precomputed recommendations | all services via gateway |

- The **gateway is the only public surface**; Cloudflare sits in front of it (WAF + DDoS + image
  caching, per AGENTS.md security posture — backend firewall accepts traffic only from Cloudflare IP
  ranges).
- Valkey is the **origin-side** per-key store (replaces Upstash Redis).

---

## 2. Cloudflare edge config

- **Cache-Control headers** (research-verified combinations):
  - `Cache-Control: public, max-age=300, stale-while-revalidate=60, stale-if-error=86400` — SDUI home
    (serve stale while revalidating; serve stale up to 24 h on origin error).
  - Search results: `public, max-age=600, stale-while-revalidate=60`.
  - Product detail: `public, max-age=86400, immutable` (24 h) with purge on edit.
- **Media images (R2 public bucket):** with a custom domain (`img.faazio.in`), the object Cache Rule is
  `public, max-age=31536000, immutable` — keys are content-addressed (sha256), so the bytes at a URL never
  change; versioning is a new key. Without a custom domain, public objects use the gateway's stable
  `/assets/{key}` path, which 302-redirects to a 300 s presigned GET (`Cache-Control: public, max-age=300`
  on the redirect); cached JSON still holds a non-expiring URL. Cloudflare does compression/Polish at the
  edge (zero origin CPU); purge is by exact R2 key on `confirm`/status change/delete (`caching doc §5`,
  migration `0025`).
- **Edge Cache TTL rules:** match on path/content-type; keep the negotiated format (JPEG `fm=jpg`,
  gzip/zstd) so Cloudflare does the compression — **no origin CPU cost**.
- **Never cache** responses with `Set-Cookie` or auth-scoped content (carts, orders, payments, PII).
- **Purge strategy:** by URL/prefix (e.g. `/sdui/home`, `/search?*`) + **event-triggered purge** from
  services (Pub/Sub → purge the affected keys).

---

## 3. Aiven Valkey config

| Concern | Config |
|---|---|
| Eviction | `allkeys-lfu` + `maxmemory 80%` — eviction is the cache's **compression-free substitute for size** |
| TTL | every key gets a TTL (see matrix §5); no unbounded keys |
| Values | **plain JSON**, no app-layer compression/encryption (CPU-cheap reads) |
| Security | TLS + ACL + private network only (AGENTS.md posture); PII keys ACL-scoped; no PII at edge |
| HA | replica + 99.99% SLA |
| Cost | Aiven free tier → Startup ~$60/mo (research-verified, scales with needs) |

---

## 4. Key taxonomy

```
faazio:v{N}:{service}:{entity}:{id}
```

- `v{N}` = **version prefix** → bump the number to instantly invalidate a whole class of keys without
  scanning.
- `{service}` = `gateway` · `search` · `cart` · `stock` · `checkout` · `reco` · `directory` · `reviews`
  · `accounts`.
- `{entity}` = `sdui` · `q` (query) · `product` · `store` · `venues` · `stock` · `orders` · `reco` · `segment`.
- `{id}` = the stable slug / userIdHash / locale / path.

Examples: `faazio:v1:stock:fm-f1`, `faazio:v1:search:q:hoodie`, `faazio:v1:sdui:home:en`,
`faazio:v1:reco:<sha256>:home`.

---

## 5. TTL matrix

| Endpoint / entity | Valkey TTL | Edge TTL | Invalidation |
|---|---|---|---|
| SDUI home tree | 300 s | `public, max-age=300, swr=60` | `layout.updated` / version bump |
| SDUI Mart projection (`/sdui/mart`) | 300 s | `public, max-age=300, swr=60` | `layout.updated` / version bump (purged with home) |
| SDUI Food projection (`/sdui/food`) | 300 s | `public, max-age=300, swr=60` | `layout.updated` / version bump (purged with home) |
| SDUI Pharma projection (`/sdui/pharma`) | 300 s | `public, max-age=300, swr=60` | `layout.updated` / version bump (purged with home) |
| Editorial campaigns (`/home/campaigns(/{id})`) | 600 s | `public, max-age=600, swr=60` | `layout.updated` / version bump (namespace purged by prefix on publish) |
| Search top-query results | 600 s | `public, max-age=600` | `catalog.updated` |
| Product detail | 86400 s (24 h) | `public, max-age=86400, immutable` | `catalog.updated` |
| Stock (per product) | 30–60 s | — | stock decrement / reservation commit |
| Orders (per user, auth-scoped) | 60 s | **never** | order write |
| Favourites (per user, auth-scoped) | 60 s | **never** | favourite add/remove |
| Pickup points (public) | 86400 s (24 h) | — | pickup_point edit |
| Rewards (per user, auth-scoped) | 60 s | **never** | order earn / redeem |
| Venue menus (public, `directory:menu:{venueId}`, `cache.TTLStore`) | 86400 s (24 h) | — | menu edit |
| Dining venues list (public) | 86400 s (24 h) | — | venue edit |
| Prescriptions (per user, auth-scoped) | 60 s | **never** | Rx create / quote / READY (PII/health data) |
| Notifications inbox (per user, auth-scoped) | 30 s | **never** | `RX_READY` / order-status enqueue |
| Blood requests board (public, redacted; auth callers bypass) | 60 s | **never** | request post / expiry sweep (contact/address stripped for anon) |
| Bookings — tables + food orders (per user, auth-scoped) | 60 s | **never** | booking create / cancel |
| Booking availability (public, seat-count-free `{bookable,fee,timing}`) | 30 s | **never** | booking-config write / accept / reject / vacate / cancel (seller config row itself is never cached) |
| Recommendations (per userHash) | 3600 s (1 h) | — | `user_events` flush |
| Store directory / reviews | 86400 s (24 h) | — | edit event |
| Store products (anon `GET /stores/{id}/products`, ACTIVE first page) | 300 s | — | product edit / status change (purges `catalog:store-products:{storeId}`; later pages are not cached) |
| Single dining venue (anon `GET /venues/{id}`, PII-redacted) | 86400 s (24 h) | — | venue edit / store live toggle (authed reads bypass the cache) |
| Media asset (public `GET /media/resolve?ids=`, per asset identity) | 86400 s (24 h) | `public, max-age=31536000, immutable` via `img.faazio.in`; no CDN → stable `/assets/{key}` 302 with `max-age=300` | confirm / status change / delete (purges `faazio:v1:media:asset:{id}` + the exact CDN key) |
| Promo campaigns / coupons (partner) | 300 s | **never** | campaign/coupon write |
| Public coupons (anon `GET /coupons?app=&state=`) | 600 s | — | coupon write (TTL-bounded) |
| Active festival discounts (anon `GET /promo/active-discounts?ids=`, per product) | 300 s | — | opt-in approve/reject or campaign status change (invalidated per product; `none` sentinel cached) |
| Ad slots (partner) | 300 s | **never** | ad status/stat write |
| Live ads (anon `GET /ads/live?slot=`) | 600 s | — | ad status write (invalidated on `LIVE`) |
| Live hero campaigns (anon `GET /ads/hero?placement=&app=&category=&storeId=`, `faazio:v1:ads:hero:{placement}:{app}:{category}:{store}`) | 300 s | — | publish or takedown/restore write (whole `faazio:v1:ads:hero:` namespace purged by prefix) |
| Ad impression de-dupe lock (`faazio:v1:ads:seen:{userId}:{slotId}`, `POST /ads/events`) | 300 s (`NX EX`) | **never** | auto-expire (one impression per user per slot) |
| Ad abuse-report de-dupe lock (`faazio:v1:ads:report:{userId}:{placementId}`, `POST /ads/campaigns/{id}/report`) | 86400 s (`NX EX`) | **never** | auto-expire (one report per user per placement) |
| Self-serve publish rate counter (`faazio:v1:ads:publish:{sellerId}:{yyyymmdd}`, `POST /ads/campaigns`) | 86400 s (`INCR`+`EXPIRE`) | **never** | auto-expire (≤10 publishes/seller/UTC day; fail-open when Valkey is off) |
| Settlement cycles (per seller) | 600 s | **never** | settlement/payout write |
| Idempotency locks (checkout) | 300 s | — | auto-expire |
| Auth subject → app user_id | 3600 s (1 h) | — | delete on profile merge (mapping is otherwise immutable) |

### 5a. Ad placement → surface map

One closed-loop pipeline (`GET /ads/live?slot=` fill → `POST /ads/events` impression/click →
last-click attribution at checkout) serves every paid shelf. The shared
`components/shared/SponsoredRail` renders it; each sub-app supplies its own card.

| Placement | Surface | Mobile entry |
|---|---|---|
| `HOME_TOP` | Home sponsored rail | `home/sections/SponsoredRailSection` → `SponsoredRail` |
| `SPONSORED_SHOWCASE` | Mart home feed (below the hero) | `ecommerce/FaMartScreen` |
| `SECTOR_RAIL` | Vendor "Discounted Products" landing | `ecommerce/DealsLandingScreen` (`discounts` mode) |

Hero campaigns (`0027`, self-serve since `0028`) are the second, separately-labelled pipeline
(`GET /ads/hero` → catalog/store target resolver → `POST /ads/events` impression/click → last-click
attribution at checkout). Publish is instant (`LIVE`) after machine checks; a human admin only takes a
bad ad down (`REJECTED`) or restores it. The shared `components/shared/CampaignHero` renders them (thin
wrapper over `AdBannerCarousel`, AD pill always on, `accessibilityLabel="Sponsored"`):

| Hero placement | Surface | Mobile entry |
|---|---|---|
| `MART_HERO` | Mart home feed hero (above Sponsored picks) | `ecommerce/FaMartScreen` (`CampaignHero`) |
| `CATEGORY_TOP` | Category drill-in top banner (scoped by `category` = `MASTER_CATEGORIES` tab id) | `catalog/components/CategoryDrillInPanel` |
| `STORE_TOP` | Store / medical-shop / restaurant header banner (scoped by `storeId`) | `catalog/VendorDetailScreen`, `pharma/MedicalShopDetailsScreen`, `food/screens/RestaurantProfileScreen` |
| `HOME_HERO` | Main Home hub top hero (retired the static `topAdSlides` fixture) | `home/sections/AdBannerSection` |
| `FOOD_HERO` | Food feed hero band | `food/screens/FoodHomeScreen` |
| `PHARMA_HERO` | Pharma home top band | `pharma/PharmaScreen` |

Seed (`0001_seed.sql`) carries one LIVE demo slot per rail placement (`ad-demo-home-*`,
`ad-demo-showcase-1`, `ad-demo-sector-1`) and one LIVE demo hero per new hero placement
(`ad-cmp-demo-mart-1`, `ad-cmp-demo-cat-1`, `ad-cmp-demo-store-1`) so a fresh deploy exercises both
pipelines; a placement with no LIVE fill collapses the surface to `null` (never a fabricated ad).

---

## 6. Invalidation event map (Pub/Sub)

| Event | Valkey keys affected | Cloudflare purge |
|---|---|---|
| `catalog.updated` | `search:q:*`, `product:{id}` | `/search?*`, product URL |
| `stock.updated` | `stock:{productId}` | — |
| `order.placed` | `checkout:orders:{userId}`, `reco:{userIdHash}` | — |
| `layout.updated` | `sdui:home:{version}` | `/sdui/home` |
| `user_events.flush` | `reco:{userIdHash}` | — |
| `store.updated` / `review.moderated` | `directory:store:{id}`, `reviews:product:{id}` | store/review URLs |
| profile merge | `auth:uid:{sha256}` (delete) | — |

---

## 7. Per-service read/write patterns

- **Read-through:** gateway/search/recommendations read through Valkey (miss → origin → populate).
- **Write-through / write-around:** stock decrements update origin and invalidate the key.
- **Single-flight locks (checkout idempotency):** `SET faazio:v1:checkout:idem:{orderRef} 1 NX EX 300`
  prevents double-place of the same order; release on completion.

### 7a. MVP implementation notes (built)

- **Stock read-through is live** (`GET /stock/:id` → `faazio:v1:stock:{id}`, TTL 45 s); every order
  decrement (`internal/checkout/service.go`) calls `Del(stock:{id})` after the `FOR UPDATE SKIP LOCKED`
  update, so the next read reflects the sale (write-around).
- **Orders** are cached per user for 60 s and invalidated on `POST /orders` (`Del(orders:{userId})`).
  The recurrence/recommendation key `faazio:v1:reco:{userIdHash}` is **not** invalidated on order for
  the MVP — a ≤1 h staleness window on recommendations is accepted (recompute on the Future Prod
  Python service / `user_events` flush).
- **SDUI layout publish (super-admin, implemented):** `PUT /admin/sdui/home` (`internal/sdui`)
  writes the ID-only sections to `sdui_layouts` with an atomic `$inc version` and calls
  `Del(faazio:v1:gateway:sdui:en:/home)`, so the next `GET /sdui/home` recompiles and the ETag
  changes (`home-v{version}` → the app's `If-None-Match` no longer 304s). A `pg_notify`/Pub/Sub
  automation is Future Prod; the reply-level TTL (300 s) still bounds staleness if a purge is missed.
- **PII never enters the cache:** `GET /store/:id` caches only the redacted projection; authenticated
  reads bypass the cache (see §8).
- **Slim values (no key/TTL change):** list/search reads cache the lean product projection
  (`productListSelect`), so `faazio:v1:search:q:*` values shrink ~5–6× versus shipping `desc_text` +
  `attributes` per row. `GET /sdui/home` emits `ETag: "home-v{version}"` and answers `If-None-Match`
  with `304`, turning repeat polls into ~50 B responses.
- **Auth subject cache:** the checkout resolver read-through caches `auth_uid → user_id` under
  `faazio:v1:auth:uid:{sha256}` for 1 h, removing one DB round-trip from every authenticated request.
  The key hashes the subject; the mapping is immutable, so only a profile merge (not yet implemented)
  would delete it. A first phone-OTP login (`ProvisionUserID` upsert, `0030`) writes the mapping and
  populates the same key — no new cache namespace/TTL.

---

## 8. What NOT to cache

- **Carts** — auth-scoped, per-user, mutable.
- **Payments / order PII** — never at the edge; only short-lived auth-scoped Valkey keys.
- **Seller records (`0015`)** — carry PII (phone/address) and are role-scoped, so `internal/sellers`
  reads bypass the cache entirely (no `faazio:v1:sellers:*` key exists).
- **Anything auth-scoped or PII-bearing** (addresses, phone, prescriptions, blood-donor health data).

> Partner management writes purge the affected public keys: a product status change invalidates
> `catalog:product:{id}`, a store live toggle invalidates `directory:store:{id}`, an order status change
> invalidates the owning user's `checkout:orders:{userId}`, and a prescription status change invalidates
> `pharma:prescriptions:{userId}`. Seller lists are never cached.
>
> **Mart vendor inventory (`0024`):** `GET /stores/{id}/products` caches the store's first ACTIVE page
> under `faazio:v1:catalog:store-products:{storeId}` (300 s); a price/MRP/stock edit
> (`PUT /seller/products/{id}`) or a status change (`PUT /seller/products/{id}/status`) purges that key
> alongside `catalog:product:{id}` / `stock:{id}`.
>
> **Media registry (`0025`):** public image identity is cached per asset under
> `faazio:v1:media:asset:{id}` (24 h) and read in batch by `GET /media/resolve?ids=`. `confirm`
> (DRAFT→ACTIVE), an admin status change, or a delete purges that key; the R2 object is served from the
> edge under an immutable 1-year TTL and is purged by exact key. PRIVATE assets (Rx/KYC) never carry a
> public URL and are **never** cached — they resolve only through a 300 s presigned GET
> (`GET /media/private/{id}`, creator/admin-scoped). A store cover change
> (`PUT /seller/stores/{id}/cover`) purges `directory:store:{id}`; a product image edit purges
> `catalog:product:{id}` + `catalog:store-products:{storeId}` (same path as a price edit).
>
> **Media GC + CDN purge (Phase 8, `0026`):** a **purge worker** `LISTEN`s on the `media_updated`
> `pg_notify` (emitted by `0025` on insert/update and by `0026` on delete) and invalidates the affected
> `faazio:v1:media:asset:{id}` + purges the exact CDN URL (`img.faazio.in/{key}`, when a CDN domain is
> configured) via the Cloudflare `purge_cache` API (`CF_ZONE_ID` + `CF_API_TOKEN`; ≤30 files/request;
> best-effort, disabled without creds). Without a CDN domain the `/assets/{key}` redirect simply
> re-presigns on the next request, so no purge is needed. This lets an immutable-key object still be
> invalidated on moderation/removal. A **GC sweeper**
> runs every 6 h (and on admin `POST /media/gc`) deleting orphaned DRAFT assets past the 24 h draft TTL
> (R2 object + row) — DRAFT assets are never cached, so no purge is needed for them.
>
> **Pharma quote + notify (W24, `0018`):** a quote save (`POST /seller/prescriptions/{id}/quotes`) or a
> `READY` status change invalidates the owning user's `pharma:prescriptions:{userId}`. The notification
> inbox key `faazio:v1:notifications:inbox:{userId}` (30 s) is invalidated when the outbox enqueues
> (`RX_READY`, order status); the vendor projection is never cached (auth-scoped + PII-gated), and
> `notifications.push_tokens` is never cached.
>
> **Partner completion (v3, `0017`):** a food-menu edit (`/seller/menus`) invalidates
> `directory:menu:{venueId}`. Customer monitoring (`/customers`) reads the redacted `checkout.users_admin`
> projection and is **never cached** (auth-scoped, join-heavy). `rewards.rates` is a single admin-editable
> row read live (no key); the rewards *view* keeps `faazio:v1:rewards:view:{userId}` 60 s and the ledger
> stays append-only under the server-only writer. The state support queue is auth-scoped, never cached.

---

## 9. Honest limitations

- **Valkey read-through is built** (`internal/platform/cache`, JSON values, TTL matrix §5);
  a nil client is a safe no-op. **Cloudflare edge rules + event-triggered purge are not wired** —
  they are ops configuration, not code.
- **TTLs are starting points** — tune from real traffic (hit ratio, origin load).
- **MVP unchanged:** Aiven Valkey + Cloudflare are kept exactly as specified; only the **origin**
  swaps from `@mock` fixtures to Supabase/Mongo (`docs/architecture/mvp-backend.md`) — **no key or TTL
  change**.
- The **Upstash Redis** supersession is recorded here and in `server/README.md` /
  `server-gateway-plan.md`; the old mentions stay as history notes, not active config.
