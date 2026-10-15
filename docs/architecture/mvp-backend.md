# Faazio MVP Backend — Supabase + MongoDB + Aiven Valkey

> **Status:** MVP — ACTIVE (code). The MVP backend is a **Go Chi modular monolith**
> (`server/gateway`) over **Supabase (Postgres) + MongoDB Atlas M0 + Aiven Valkey**, with
> **Cloudflare** in front. It replaces the mocked `@mock` data per module (`@mock` → `@server`).
> The full microservices target — Rust/Tantivy search, CockroachDB, DynamoDB, per-service Postgres —
> is **Future Prod** and stays documented in `server/README.md`, `server-gateway-plan.md`, and
> `db-schema.md`.
> **Code is live:** migrations + seed under `server/supabase/`, contexts + HTTP handlers under
> `server/gateway/internal/`, and `GatewayClient` wired (remote with `@data/*` fallback). This doc is
> the single authority for "which DB for what in the MVP"; the deep-dives keep the Future Prod spec.
> Context → package → future-service mapping + extraction playbook:
> **`docs/architecture/monolith-breakdown.md`**.

---

## 1. MVP decision matrix

| Concern | MVP (now) | Future Prod (kept in docs) | Why |
|---|---|---|---|
| `catalog.products` master + search index | Supabase `catalog` schema + Postgres FTS (`tsvector` + `pg_trgm` GIN + `unaccent`, `search_tokens` generated col) | Cockroach `catalog.products` + Tantivy embedded | One Supabase project covers 4 DBs for MVP; Tantivy only pays off at high-QPS / flash-sale scale |
| `directory` / `accounts` / `checkout` / `reviews` | Supabase schemas `directory`, `accounts`, `checkout`, `reviews` in one project, RLS on | Cockroach (directory/accounts/checkout) + standalone Postgres (vendor_reviews) | The datatype policy (`db-schema.md` §2: INT8 paisa, slug IDs, TIMESTAMPTZ, ENUM) maps 1:1 to Postgres; split clusters later with zero contract change if slug IDs + `GatewayClient` shape stay stable |
| `stock` / `carts` / `reservations` / `pickup_points` | Supabase `inventory` schema + `SELECT … FOR UPDATE SKIP LOCKED`, `pg_cron` TTL sweep | DynamoDB / Firestore KV | Postgres locking is fine for MVP contention; Dynamo only at 1000s concurrent decrements |
| `user_events` / `recommendations` / `segments` / `product_stats` / `sdui_layouts` | Keep MongoDB Atlas M0 (ID-only, `userIdHash`, TTL 90d) | Same (no change) | Flexible doc shape + TTL; don't force into Postgres |
| Cache + edge | Keep **Aiven Valkey + Cloudflare** exactly per `caching-cloudflare-valkey.md` | Same | Supabase is origin, not cache; keys/TTLs unchanged (`faazio:v1:{service}:{entity}:{id}`, stock 30–60s, search 600s, product 24h, idempotency `NX EX 300`) |
| Gateway | Go Chi modular monolith (`server/gateway`): all 6 contexts, `/health`, `/search?q=`, `/sdui/home`, `/product/:id`, `/vendors/:id/reviews`, `/stores`, `/venues`, `/orders`, `/profile`, cart/order/rating/event writes → Supabase + Mongo + Valkey, Cloudflare in front | Full gateway + 5 gRPC microservices via `contracts/` | Monolith proves the `@mock` → `@server` seam; extracted per `monolith-breakdown.md`; `GatewayClient` signatures don't change |
| Auth | Supabase Auth phone OTP + RLS (replaces mocked `authStore.login()`) | Same, hardened | Server sessions + per-user orders/carts/rating scoping now |

**Product images (recommendation):** serve from **Supabase Storage** (same project) with Cloudflare
caching in front; image URLs stay stable so `expo-image` call sites don't change. No separate CDN
bucket for the MVP.

---

## 2. Supabase project (one project, many schemas)

- **Schemas:** `catalog`, `directory`, `reviews`, `checkout`, `accounts`, `inventory`, `favourites`,
  `rewards`, `pharma`, `blood`, `bookings`, `util`. The partner control plane (`0015`) adds `sellers`,
  `promo`, `ads`, `payments`, `admins`, `support` (see `db-schema.md` §12.9) and `0018` adds
  `notifications` (outbox + push tokens; `db-schema.md` §12.12) — all additive, so existing
  tables/rows are untouched.
- **Extensions:** `pg_trgm`, `unaccent`, `pg_cron` (`pgcrypto` ships enabled).
- **Datatypes:** unchanged from `db-schema.md` §2 — stable string slug public keys, INT8 paisa money,
  `TIMESTAMPTZ`, native ENUMs. The Cockroach DDL there is near-verbatim Postgres.
- **Search view:** `catalog.products_search` (`tsvector` over `name` + `search_tokens` + `category`,
  GIN index, `pg_trgm` for fuzzy/autocomplete), refreshed on `catalog.updated`.
- **Auth:** Supabase Auth phone OTP; `auth.uid()` is the user key for RLS.

### RLS policy classes (least privilege)

| Class | Scope | Examples |
|---|---|---|
| **anon read** | public catalog / stores / public reviews | `catalog.products`, `directory.stores`, `reviews.vendor_reviews` (public columns only) |
| **auth-scoped** | own rows only (`auth.uid()`) | `checkout.orders`, `inventory.carts`, own `reviews.vendor_ratings` |
| **partner/role-scoped** (`0015`) | custom JWT claims `app_role`/`seller_id`/`state_code` | `sellers.*`, `promo.*`, `ads.*`, `payments.*`, `admins.*`, `support.tickets`, `checkout.returns` |
| **service-role only** | writes / stock mutations / admin | `inventory.stock` decrements, `checkout` writes, moderation, `payments.settlement_ledger`/`payouts` |

- PII columns (`phone`/`email`/address/`user_id` linkage) are never exposed by anon/auth read policies.
- Never commit secrets; service-role key is server-side only.

---

## 3. Gateway (MVP) — endpoints

All read-through: Valkey → Supabase/Mongo → populate. Cloudflare caches public GETs.

| Method + path | Origin | `@data/*` mock twin | `GatewayClient` method |
|---|---|---|---|
| `GET /health` | — | — | — |
| `GET /search?q=&app=` | Supabase FTS `catalog.products_search` + `inventory.stock` | `data/catalog/products.ts` | `searchProducts` |
| `GET /sdui/home` | Mongo `sdui_layouts` + Supabase catalog/stores `getProductsByIds` | `data/home/sdui.ts` | `getHomeFeed` |
| `GET /product/:id` | Supabase `catalog.products` + `inventory.stock` + `reviews.reviews` | `data/catalog/products.ts` | `getProduct` |
| `GET /vendors/:id/reviews` | Supabase `reviews.vendor_reviews` (public columns only) | `data/reviews/vendorReviews.ts` | `getReviews` |
| `GET /stores`, `GET /store/:id`, `GET /venues?app=` | Supabase `directory.stores` / `directory.dining_venues` | `data/directory/stores.ts`, `data/food/diningVenues.ts` | `getStores` / `getStore` / `getVenues` |
| `GET /orders`, `GET /profile` | Supabase `checkout` / `accounts` (auth-scoped) | `data/checkout/orders.ts`, `data/accounts/profile.ts` | `getOrders` / `getProfile` |

**Write endpoints (MVP, win chosen over the original read-only list):**

| Method + path | Context | Notes |
|---|---|---|
| `GET/POST/PUT/DELETE /cart…` | cartstock | auth-scoped; `inventory.carts` JSONB, never edge-cached |
| `GET/PUT/DELETE /favourites…` | favourites | auth-scoped durable shelf (`favourites.items`), never edge-cached |
| `POST /orders/{id}/payments`, `GET /payments` | checkout | real-money ledger (`checkout.payments`); amount derived server-side, never edge-cached |
| `GET /pickup-points` | directory | durable `inventory.pickup_points` (public business locations, cached 24 h) |
| `GET /rewards` | rewards | server-authoritative coins/streak/ledger; earn runs inside `POST /orders` via `contracts.RewardsWriter` (never client-forgeable) |
| `GET /venues/{id}/menu` | directory | durable `directory.menus` (public catalog data, cached 24 h); menu rows carry `description`/`emoji`/`delivery_time` (`0019`) |
| `POST /prescriptions`, `GET /prescriptions`, `POST /prescriptions/upload-url`, `GET /prescriptions/{id}/images` | pharma | durable Rx; images in private Supabase Storage (object keys), signed upload/download URLs env-gated (owner/vendor/admin only) |
| `POST /seller/prescriptions/{id}/quotes`, `PUT /prescriptions/{id}/status` (incl. `READY`) | pharma | seller-scoped quote lines + `QUOTED`/`READY`; vendor projection is name-only until READY/FULFILLED (contact blanked by query), reveal audited + `status_history`, READY enqueues a notification |
| `GET/PUT /profile/addresses`, `GET /orders/{id}` | checkout | auth-scoped saved addresses (server-enforced ownership) + order detail |
| `PUT /reviews/{id}/moderate`, `PUT /seller/products/{id}` | reviews/catalog | admin review HIDDEN flag (no hard delete); seller price/MRP/stock edit (writes catalog + inventory in lockstep) |
| `GET /notifications`, `POST /notifications/register`, `GET /admin/notifications` | notifications | auth inbox + Expo push-token upsert; admin outbox view (`notifications.outbox`, enqueued by pharma/checkout via `contracts.Notifier`) |
| `GET/PUT /donors/me`, `GET /donors` | blood | donor profile + consented directory (`blood.donor_directory` view); auth-scoped |
| `GET/POST /blood-requests`, `PUT /blood-requests/{id}/interest` | blood | request board (public read, `contact`/`address` redacted for anon); interest/accept idempotent |
| `POST/GET /donor-match-requests` | blood | targeted donor request (own rows) |
| `GET/POST /bookings`, `DELETE /bookings/{id}` | bookings | table reservations; partial unique index rejects live double-books (409 `slot_taken`) |
| `GET/POST /food-bookings` | bookings | durable food order bookings (dish snapshot JSONB) |
| `GET/POST /orders` | checkout | `POST` uses `SET NX EX 300` idempotency + `SELECT … FOR UPDATE SKIP LOCKED` stock decrement |
| `PUT /vendors/{id}/rating` | reviews | derived eligibility gate (`hasPurchasedFromVendor`); never a stored flag |
| `POST /events` | reco | ID-only `userIdHash`, 90-day Mongo TTL; event allowlist + `productId ≤ 64` chars |
| `GET /recommendations` | reco | per-user `recommendations` doc (else top `product_stats`), joined to catalog; `faazio:v1:reco:{userIdHash}:home` 1 h |

Every endpoint above now has a `GatewayClient` method (`getVendorReviews`, `rateVendor`,
`getCart`/`addToCart`/`updateCartItem`/`removeCartItem`, `placeOrder`, `trackEvent`,
`getDonorProfile`/`saveDonorProfile`/`getBloodDonors`/`getBloodRequests`/`createBloodRequest`/
`setBloodInterest`/`createDonorMatch`/`getDonorMatches`, `getBookings`/`createBooking`/`cancelBooking`/
`getFoodBookings`/`createFoodBooking`, `getRecommendations`) with the `@data/*` fallback, so the per-module `@mock` →
`@server` migration can begin once Supabase phone OTP replaces `authStore.login()`.

No gRPC yet; `contracts/` holds Go interfaces that mirror the future `.proto` shape. Method
signatures above keep the `@mock` → `@server` swap call-site-compatible (`GatewayClient` adds a
`baseUrl`/flag and keeps the `@data/*` fallback). Phased onboarding skips phone OTP for local dev:
`AUTH_DISABLED=true` uses `DEV_USER_ID` / `X-Dev-User`.

---

## 4. Cache + edge (unchanged)

Aiven Valkey + Cloudflare are **unchanged** — Supabase is the origin, not the cache. Key taxonomy,
TTL matrix, and invalidation event map stay in `caching-cloudflare-valkey.md`; that doc records the
MVP origin swap. No key/TTL change.

---

## 5. Tradeoffs (explicit)

- **FTS vs Tantivy:** Postgres FTS loses sub-ms + FAST ranking + fuzzy quality vs Tantivy; acceptable
  to ~100k–1M rows / few-hundred rps. Migration path: keep `id` slug, `searchTokens`, `price_paisa`
  INT8, `rating` stable → Tantivy becomes a pure index replica later. The `pg_trgm` fuzzy fallback was
  dropped (`0005`) so the planner stays on the FTS GIN index; re-add it (index + query `OR`) if typo
  analytics demand it.
- **Rating counters:** `reviews.vendor_summary` trades one trigger write per rating for O(1) summary
  reads; `directory.stores.rating` is untouched (it is the catalog rating used for the `/stores` sort).
- **Single Supabase project** = single failure domain + RLS misconfig risk; mitigate with per-schema
  ownership notes, never committing secrets, Valkey ACL, Cloudflare-only firewall (existing posture).
- **Cost:** Supabase free-tier + Atlas M0 + Aiven free → ~$60/mo; Cloud Run scale-to-zero keeps cost
  ~$0 at idle (same as existing cost notes).

---

## 6. Scale limits + promotion checklist

Promote a concern to its Future Prod service when the limit below is hit (keep the slug IDs + gateway
contract stable so the swap is invisible to the app):

- **Tantivy / Rust search** — when FTS latency/ranking quality or search QPS becomes a bottleneck.
- **CockroachDB** — when relational write scale / multi-region consistency outgrows one Postgres.
- **DynamoDB / Firestore** — when stock/cart contention reaches 1000s of concurrent decrements.
- **Per-service Postgres** — when vendor-reviews traffic or cluster ownership must split.

---

## 7. Build order

1. ✅ `server/supabase/migrations/0001_mvp_schemas.sql` — schemas + extensions + tables ported from
   `db-schema.md` (slug public keys, INT8 paisa, `TIMESTAMPTZ`, ENUMs).
2. ✅ `server/supabase/migrations/0002_fts_search.sql` — `catalog.products_search` view + generated
   `search_vec` + GIN/btree indexes + `catalog.touch_updated_at` (`pg_notify('catalog_updated')`).
3. ✅ `server/supabase/migrations/0003_inventory_ttl_rls.sql` — `pg_cron` TTL sweeps + RLS (Supabase-only,
   guarded) + reservation release.
4. ✅ `server/supabase/seed/` — generator (`generate.mjs`) compiles `@data/*` and emits
   `0001_seed.sql` + `mongo/seed.js` (IDs identical for cache stability).
5. ✅ `server/gateway/` (Go Chi) — all 6 contexts in one binary; `GET /health` + the §3 endpoints;
   Supabase + Mongo + Valkey read-through; `contracts/` interfaces; `tools/importlint` boundary gate.
6. ✅ `client/mobile/src/services/api/GatewayClient.ts` — `EXPO_PUBLIC_GATEWAY_URL` +
   `EXPO_PUBLIC_USE_GATEWAY`; wired in `data-layer-sdui.md` order; `@data/*` fallback per method.
7. ✅ Verify: `go build/vet/test ./...` + `go run ./tools/importlint`; `npm run ts:check`,
   `check:boundaries`, `check:drillin`.
8. ✅ **DB layer verified locally** (`docker compose up`): 421 products / 32 stores / 32 orders seeded,
   Postgres FTS returns `coffee` hits, no orphan `store_id`s, Mongo `sdui_layouts` v1 (14 sections) +
   `user_events_ttl` index, `/health` reports `db:true cache:true mongo:true`.
9. ✅ **Hardening (Phase 2):** directory PII redaction (public vs authed), global 1 MiB body limit,
   `Timeout(10s)` + `Throttle(100)`, keyset pagination (`/stores`, `/vendors/:id/reviews`) bounded
   `limit` (`/search`), `/events` allowlist, opt-in `slog` request logs, stock read-through + decrement
   invalidation. Money freeze clarified: DB paisa, JSON integer rupees (`monolith-breakdown.md` §4).
10. ✅ **Tests + CI:** unit tests plus Docker-backed integration tests (FTS, order lock/decrement,
    rating gate, PII redaction, keyset pagination) skip cleanly without services; `.github/workflows/server-gateway.yml`
    runs build/vet/test/importlint with Postgres + Valkey service containers.
11. ✅ **Sweetspot (DB + read-path optimization):** `0004` lean indexes + JSONB guards +
    `reviews.vendor_summary` trigger, `0005` non-money type byte diet (money stays INT8), `0006`
    checkout idempotency table; slim product/store projections, one-batch SDUI join, auth
    `auth_uid → user_id` cache, bounded product reviews, `/sdui/home` ETag. Keys/TTLs and the
    `GatewayClient` wire shape are unchanged — see `monolith-breakdown.md` §4 and
    `caching-cloudflare-valkey.md` §5/§7a.
12. ✅ **Partner control plane (`0015`):** additive schemas `sellers`/`promo`/`ads`/`payments`/`admins`/
    `support`, seller scoping on `directory.stores`/`catalog.products`, `order_status` gains
    `NEW`/`PACKED`/`RETURNED` (Option A), `directory.stores.rating` narrowed to REAL. Owner:
    `db-schema.md` §12.9. Gateway contexts + Portal cutover are the next phases (see
    `WORKFLOW_SCRATCHPAD.md`).
13. ✅ **Store live flag (`0016`):** `directory.stores.is_live BOOLEAN NOT NULL DEFAULT true` + a
    `(state_code, is_live)` index (0015's comment assumed the flag existed but it did not). Owner:
    `db-schema.md` §12.10. The gateway now exposes role-scoped partner management endpoints over
    `catalog`/`directory`/`checkout`/`pharma`/`bookings`/`blood` (see `monolith-breakdown.md` §1).
14. ✅ **Partner completion (`0017`, v3):** `checkout.users_admin` redacted view (customer monitoring),
    `directory.menus.seller_id/status` (food-menu editing), admin-tunable `rewards.rates`, and
    `support.tickets.state_code` (state queue). Owner: `db-schema.md` §12.11. Closed the web↔mobile
    control-plane gaps (W17–W20), web write-through (W21) and mobile `@mock`→`@server` (W22, in
    progress); auth/Storage/edge (W23) stays pending. Additive only — mobile keeps running.
15. ✅ **Pharma quote + notify (`0018`, W24):** `pharma.quote_items`/`status_history`, `QUOTED`/`READY`
    enum values, `quoted_total_paisa`/`revealed_at`/`revealed_by`/`address_id`, `notifications.outbox` +
    `push_tokens`, `reviews.vendor_reviews.hidden`. Owner: `db-schema.md` §12.12. Gateway adds the
    pharma quote/reveal path + a new `internal/notifications` context (`contracts.Notifier`), and the
    gap writes `/profile/addresses`, `/reviews/{id}/moderate`, `/seller/products/{id}` price/stock.
    Mobile Rx/cart/web slice cutover follows (W22/D). Additive only.
16. ✅ **App-gap contract deltas (`0019`, W25):** `directory.menus.description/emoji/delivery_time`
    (additive) so the Food restaurant screens can leave the `@data` fixture; `GET /venues?app=` venue
    list (`internal/directory.Venues`, PII-free, cached 24 h) + `GatewayClient.getVenues`; inbox badge
    count via `getNotifications`. Blood board deliberately stays redacted (no PII widening). Owner:
    `db-schema.md` §12.4/§12.6. Auth stays mocked by product decision.

---

## 8. Companion docs

- `server-gateway-plan.md` — future full microservices gateway plan (kept).
- `db-schema.md` — production table datatypes + sample rows (kept; MVP callouts per section).
- `caching-cloudflare-valkey.md` — cache layer (unchanged).
- `data-layer-sdui.md` — `@data/*` layer + `GatewayClient` wiring order.