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
| Auth | **Firebase phone OTP** (`@react-native-firebase/auth` native SDK) → Firebase ID token (RS256) verified by `platform/auth` against Google's certificate set; first login upserts `checkout.users.auth_uid`. **Portal users** (`SUPER_ADMIN`, `DISTRICT_ADMIN`, `SELLER`) use gateway-native Argon2id credentials + a short-lived HS256 access JWT (`iss=faazio-portal`) with seller/district (+ legacy parent-state) scope and rotating opaque refresh sessions (`admins.portal_*`, migrations `0032` + `0033` + `0034` + `0038` session lifetimes) | OIDC/IdP-agnostic verification; the same `auth_uid` link | Server sessions + per-user orders/carts/rating scoping now; portal token is verified locally and skip the checkout resolver |

**Product / media images (implemented, `0025`):** bytes live in **Cloudflare R2** (`faazio-public` +
`faazio-private`), identity in the SQL `media.assets` registry. The gateway (`internal/media` +
`internal/platform/r2`) is the only minter/signer; clients receive short-lived presigned PUT/GET URLs and
never hold R2 credentials. The public origin is optional: set `R2_CDN_BASE` to a custom domain
(`img.faazio.in`, immutable 1-year edge TTL) **or** leave it unset and set `PUBLIC_BASE_URL` — then
public objects resolve to the gateway's stable `/assets/{key}` path, which 302-redirects to a short-lived
presigned GET (no custom domain, no `r2.dev` needed; the URL stays stable so cached JSON and
`AppImage`/`<img>` call sites don't change). With neither set, `PublicURL` returns empty and readers
fall back to the legacy `image_url` column / `@data` fixtures. Supabase Storage remains only as the Rx
fallback when R2 is unset — no second public origin. A GC sweeper reclaims orphaned DRAFT uploads and a
CDN purge worker invalidates an image on moderation/delete (`0026`) when `CF_ZONE_ID`/`CF_API_TOKEN` are
set. See `db-schema.md` §12.16.

---

## 2. Supabase project (one project, many schemas)

- **Schemas:** `catalog`, `directory`, `reviews`, `checkout`, `accounts`, `inventory`, `favourites`,
  `rewards`, `pharma`, `blood`, `bookings`, `util`. The partner control plane (`0015`) adds `sellers`,
  `promo`, `ads`, `payments`, `admins`, `support` (see `db-schema.md` §12.9), `0018` adds
  `notifications` (outbox + push tokens; `db-schema.md` §12.12), and `0025` adds `media` (R2 image
  registry; `db-schema.md` §12.16) — all additive, so existing tables/rows are untouched.
- **Extensions:** `pg_trgm`, `unaccent`, `pg_cron` (`pgcrypto` ships enabled).
- **Datatypes:** unchanged from `db-schema.md` §2 — stable string slug public keys, INT8 paisa money,
  `TIMESTAMPTZ`, native ENUMs. The Cockroach DDL there is near-verbatim Postgres.
- **Search view:** `catalog.products_search` (`tsvector` over `name` + `search_tokens` + `category`,
  GIN index, `pg_trgm` for fuzzy/autocomplete), refreshed on `catalog.updated`.
- **Auth:** real **Firebase phone OTP** (`services/firebaseAuth.ts`, native
  `@react-native-firebase/auth`; public client config in `android/app/google-services.json` and
  `ios/Faazio/GoogleService-Info.plist`). `LoginScreen` sends the OTP on phone entry and exchanges
  the code for a Firebase **ID token (RS256 JWT)**; the token is stored in the Keychain (single owner:
  `secureSession.ts`) and sent as the bearer every `GatewayClient` call. The gateway verifies it with
  `platform/auth.FirebaseVerifier` (Google x509 certificate set + `iss`/`aud`/`exp`/`sub`), then
  resolves `sub → checkout.users.user_id`; on first call the checkout resolver **upserts** the link
  (`ProvisionUserID`, deterministic `u-<sha256 prefix>`, `auth_uid` unique) so a new OTP user works
  without a manual row. Migration `0031` widens `auth_uid` from `UUID` to `TEXT` (Firebase UIDs are
  strings); apply it in Supabase before deploying the Firebase verifier. `GatewayClient` forces one native ID-token refresh on 401 (`recoverSession`),
  then clears the session and returns to Login. `FIREBASE_PROJECT_ID` enables Firebase verification;
  the legacy GoTrue `SUPABASE_JWT_SECRET` HS256 path remains only for older partner tokens during
  the migration and is tried after Firebase fails. Portal tokens use a separate
  `auth.PortalVerifier` + `PORTAL_JWT_SECRET` and never fall through to either verifier. `render.yaml`
  declares `PORTAL_JWT_SECRET`, `PORTAL_PEPPER`, `DATABASE_URL`/`VALKEY_URL`/`MONGO_URI` with
  `sync: false` (values set in the Render dashboard, never git); an empty `PORTAL_JWT_SECRET` makes
  login return `503 portal_auth_unavailable` by design, and on boot the gateway logs
  `portal_auth=enabled|disabled` plus `portal_tables=ok|partial|missing` (a fail-loud hint to apply
  migrations `0032` + `0033` + `0034` + `0038`) without ever printing the secret. In dev the app may still send `X-Dev-User` (`DEV_USER`, dev builds only) against
  an `AUTH_DISABLED=true` gateway; production builds never send it and never embed a mock-login
  build (`configure.js` fails a release when `USE_GATEWAY=true` and the native Firebase config is
  missing). Setup + the outstanding anti-abuse step: `docs/RUNBOOKS/FIREBASE_AUTH.md`.

### RLS policy classes (least privilege)

| Class | Scope | Examples |
|---|---|---|
| **anon read** | public catalog / stores / public reviews | `catalog.products`, `directory.stores`, `reviews.vendor_reviews` (public columns only) |
| **auth-scoped** | own rows only (`auth.uid()`) | `checkout.orders`, `inventory.carts`, own `reviews.vendor_ratings` |
| **partner/role-scoped** (`0015`) | custom JWT claims `app_role`/`seller_id`/`district_code`/`state_code` | `sellers.*`, `promo.*`, `ads.*`, `payments.*`, `admins.*`, `support.tickets`, `checkout.returns` |
| **service-role only** | writes / stock mutations / admin | `inventory.stock` decrements, `checkout` writes, moderation, `payments.settlement_ledger`/`payouts` |

- PII columns (`phone`/`email`/address/`user_id` linkage) are never exposed by anon/auth read policies.
- **Mobile auth is Firebase**, so `auth.uid()` policies apply to the legacy portal/Supabase path. The
  Go gateway connects as the database owner and enforces ownership in SQL predicates (never trusts a
  client-supplied user id); `0031` widens `checkout.users.auth_uid` to `TEXT` for Firebase UIDs.
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
| `POST /auth/portal/{login,refresh,logout}`, `GET /auth/portal/me`, `PUT /auth/portal/password`; `GET|POST /admin/portal-users`, `PUT /admin/portal-users/{id}`, `PUT /admin/portal-users/{id}/password` | Supabase `admins.portal_users` + `admins.portal_sessions` (`0032` + `0033` + `0034` + `0038` session lifetimes); Valkey throttles/denylist | — (portal only) | `portalRequest` (portal auth). A `DISTRICT_ADMIN` login may alternatively be minted atomically with its roster via `POST /district-admins` (`issueLogin:true` — see the admins row below, `0036`/`0048`) |

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
| `GET/PUT /profile/addresses`, `DELETE /profile/addresses/{id}`, `GET /orders/{id}` | checkout | auth-scoped saved addresses (server-enforced ownership; upsert + delete) + order detail |
| `PUT /reviews/{id}/moderate`, `PUT /seller/products/{id}` | reviews/catalog | admin review HIDDEN flag (no hard delete); seller price/MRP/stock edit (writes catalog + inventory in lockstep) |
| `GET /notifications`, `POST /notifications/register`, `GET /admin/notifications` | notifications | auth inbox + push-token upsert; admin outbox view (`notifications.outbox`, enqueued by pharma/checkout via `contracts.Notifier`) |
| `GET/PUT /donors/me`, `GET /donors` | blood | donor profile + consented directory (`blood.donor_directory` view); auth-scoped. The app reads both through no-fallback `fetchDonorProfile`/`fetchBloodDonors` so it can tell a live, possibly-empty directory from the offline fixture (health-PII provenance) |
| `GET/POST /blood-requests`, `PUT/DELETE /blood-requests/{id}/interest` | blood | request board (public read, `contact`/`address` redacted for anon); interest/accept idempotent — `DELETE` removes the mark (un-interest), also idempotent; no board cache is touched (the public projection carries no interest data) |
| `POST/GET /donor-match-requests`, `GET /donor-match-requests/incoming`, `PUT /donor-match-requests/{id}/status` | blood | targeted donor request; outgoing (`requester_user_id = caller`) and **recipient-scoped incoming** (`donor_user_id = caller`, `0029`) reads; recipient-only pending→`accepted`/`declined` transition, enqueues a PII-free `MATCH_ACCEPTED`/`MATCH_DECLINED` notification to the requester (contact stays redacted) |
| `GET/POST /bookings`, `DELETE /bookings/{id}`, `POST /bookings/{id}/payment` | bookings | seat reservations (hold at request); ₹50/seat fee derived server-side, occupancy checked under a `FOR UPDATE` config lock, idempotent per `Idempotency-Key`; payment attaches the Razorpay authorized payment id |
| `GET /venues/{id}/booking-availability` | bookings | public, seat-count-free `{bookable, feePerSeat, timingLabel, openNow}` (never totals/remaining) |
| `GET/PUT /seller/booking-config`, `GET /seller/bookings`, `PUT /bookings/{id}/status`, `POST /bookings/{id}/vacate` | bookings | seller-private config (seats/timings/tracking/pause); accept captures / reject refunds; vacate frees occupancy; owner-scoped. `GET /seller/bookings` echoes the caller's `sellerId` on each row (bookings have no seller column; ownership is via the venue) |
| `POST /webhooks/razorpay` | bookings | HMAC-signature-verified Razorpay events → idempotent ledger update (`payment.authorized/captured/failed`, `refund.*`) |
| `GET/POST /orders` | checkout | `POST` uses `SET NX EX 300` idempotency + `SELECT … FOR UPDATE SKIP LOCKED` stock decrement; re-validates any `couponCode` via `contracts.CouponValidator` **before** the decrement and settles `paid = subtotal − couponDiscount − coins`, then attributes the last-clicked ad slot best-effort |
| `POST /checkout/validate-coupon` | checkout | authenticated coupon preview (`{code, app, state, subtotal}` → `{valid, reason, discount, …}`); delegates to `contracts.CouponValidator` (pure `DecideCoupon`), same rules as settlement |
| `POST /ads/events` | ads | authenticated impression/click (`RecordEvent`); impressions de-duped per user via `faazio:v1:ads:seen:{userId}:{slotId}` 300 s; `orders_attributed` bumped server-side at checkout (one round-trip covers the rail slot or the hero campaign row) |
| `GET /ads/hero` | ads | public anon LIVE hero projection for a `placement`/`app`/`category`/`storeId` context (cached 300 s, purged by prefix on publish/takedown); empty context dims = any, newest-first, ≤8 |
| `POST /ads/campaigns` | ads | seller/state/super: **self-serve publish** a hero campaign. Machine-checks the admin used to do — ownership resolved against `catalog.products`/`directory.menus`/`directory.stores`/`directory.dining_venues`, placement↔sub-app fit, R2-CDN-only poster, title/subtitle/CTA bounds, ≤90-day window, ≤3 LIVE rows per (seller, placement) and ≤10 publishes/seller/day — then inserts one `LIVE` row per placement sharing a `campaign_id`. A failed check returns 400/403/429 and writes nothing. Purges the hero cache namespace |
| `GET /ads/campaigns` | ads | seller/state/super: campaign rows scoped by `sellerId`/`state` (seller/admin consoles) |
| `PUT /ads/campaigns/{id}/status` | ads | state/super admin **takedown/restore only** (`REJECTED` + optional `reason` / `LIVE`); purges the hero cache namespace |
| `POST /ads/campaigns/{id}/report` | ads | authenticated user abuse report; de-duped per user via `faazio:v1:ads:report:{userId}:{placementId}` 24 h, increments `reports` and audits (`AD_CAMPAIGN_REPORT`) — no reporter identity stored |
| `PUT /vendors/{id}/rating` | reviews | derived eligibility gate (`hasPurchasedFromVendor`); never a stored flag |
| `GET/POST /district-admins`, `PUT/DELETE /district-admins/{id}` (legacy `/state-admins` alias) | admins | superadmin-only district-admin directory. `POST` validates `districtCode` against `admins.district_master` (`internal/platform/geo`, 42 TN/PY districts) and derives the parent `stateCode`; an unknown code returns 400 `unknown_district`. A legacy `stateCode` is accepted only when no district is supplied (non-TN/PY state-scoped admin). **Unified creator (`0036`, renamed in `0048`):** `issueLogin:true` mints the roster **and** a `DISTRICT_ADMIN` portal login in one tx (returns `{admin, credential, warnings?}`; `must_change` is locked `true`); `issueLogin:false` pre-provisions a roster-only row. Phone is normalized to 10 digits. Email is the hard one-person-one-role key — collision-gated before insert (portal-users email across any role, roster email) with the `district_admins_email_lower_uniq` / `portal_users_email_lower_uniq` indexes as the race-proof frontier. **Phone is a soft warning** — a phone already owned by a seller (`sellers.sellers`) or another roster row never blocks, it returns `201 warnings[]` (shared/SME lines are allowed). 409 codes: `email_used_by_super_admin` / `email_used_by_seller` / `email_has_district_login` / `email_has_district_roster` (portal logins carry no phone column, so a phone can only ever be a warning, never a 409). `PUT/DELETE` also deactivate/delete the linked portal login by `lower(email)` so a dead roster never leaves a live login |
| `POST /sellers/{id}/platform-fee-request`, `GET /sellers/{id}/platform-fee-requests`; `GET /seller/fee-change-requests`, `PATCH /seller/fee-change-requests/{id}/approve|reject` | sellers | seller-initiated platform-fee change requests (`0049`): the live fee is immutable for sellers, one `PENDING` row per seller (partial unique index), district admin reviews their district and super admin every district; approval copies `requested_fee_pct` onto `sellers.sellers.platform_fee_pct` in one tx. `PATCH /sellers/{id}/platform-fee` stays the admin direct override |
| `POST /events` | reco | ID-only `userIdHash`, 90-day Mongo TTL; event allowlist + `productId ≤ 64` chars |
| `GET /recommendations` | reco | per-user `recommendations` doc (else top `product_stats`), joined to catalog; `faazio:v1:reco:{userIdHash}:home` 1 h |

Every endpoint above now has a `GatewayClient` method (`getVendorReviews`, `rateVendor`,
`getCart`/`addToCart`/`updateCartItem`/`removeCartItem`, `placeOrder`, `trackEvent`,
`getDonorProfile`/`fetchDonorProfile`/`saveDonorProfile`/`getBloodDonors`/`fetchBloodDonors`/
`getBloodRequests`/`fetchBloodRequests`/`createBloodRequest`/`setBloodInterest`/`clearBloodInterest`/
`createDonorMatch`/`getDonorMatches`/`getIncomingDonorMatches`/`setDonorMatchStatus`,
`getBookings`/`createBooking`/`cancelBooking`/
`attachBookingPayment`/`getBookingAvailability`,
`getRecommendations`) with the `@data/*` fallback, so the per-module `@mock` →
`@server` migration proceeds on the existing **real phone-OTP login** (`firebaseAuth` →
`authStore.login()`).

No gRPC yet; `contracts/` holds Go interfaces that mirror the future `.proto` shape. Method
signatures above keep the `@mock` → `@server` swap call-site-compatible (`GatewayClient` adds a
`baseUrl`/flag and keeps the `@data/*` fallback). Local dev runs:
`AUTH_DISABLED=true` uses `DEV_USER_ID` / `X-Dev-User`, and role probing accepts `X-Dev-Role` /
`X-Dev-Seller` / `X-Dev-State` (all three are on the CORS allow-list so the local portal can exercise
role-gated routes; they are ignored whenever auth is enabled). The app mirrors the portal's dev guard:
`GatewayClient` attaches `X-Dev-User` only in dev builds when `DEV_USER` is set.

Under a production `AUTH_DISABLED=false` gateway a real OTP session now satisfies every
`auth.Require` write; `POST /ads/events` (closed-loop ad KPIs) and `PUT /vendors/{id}/rating`
(server-durable rating) remain auth-gated (no anon endpoint). W49 keeps both client paths honest +
observable (`recordAdEvent` returns a confirmed-only boolean; `submitVendorRating` resolves an
outcome and the screen surfaces a non-durable result) rather than opening them unauthenticated.

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
- **Cost:** Supabase free-tier + Atlas M0 + Aiven free → ~$60/mo; Render scale-to-zero keeps cost
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
6. ✅ `client/mobile/src/services/api/GatewayClient.ts` — `GATEWAY_URL` +
   `USE_GATEWAY` (+ `STRICT` to fail money/Rx/address writes loudly);
   wired in `data-layer-sdui.md` order; `@data/*` fallback per method.
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
    `db-schema.md` §12.4/§12.6. (Auth is no longer mocked — superseded by §1 and entry 19.)
17. ✅ **Shopper price + menu MRP (`0022`, W31):** `directory.menus.mrp_paisa` (additive, `mrp >= price`)
    so a Food discount is authored, never synthesized; anon `GET /promo/active-discounts?ids=` in
    `internal/promo` (LIVE campaign + APPROVED opt-in, clamp by the effective `sector_caps` row,
    cached `promo:active:{productId}` 300 s) is the shopper-price read side. The app overlays it
    (`services/pricing.ts`) and the Home daily-essentials rail joins the catalog (`getProductsByIds`).
    Owner: `db-schema.md` §12.4/§12.9.

18. ✅ **Server quench + Rx privacy (`0023`, W34):** four additive thin reads in existing contexts —
    `GET /venues/{id}` (directory), `GET /seller/prescriptions/{id}` (pharma), `GET /orders/tracking/{id}`
    (checkout), admin `POST /notifications/drain` (`contracts.Drainer`) — plus quote `price<=mrp` checks
    and idempotent repeated `READY` in pharma. `0023` adds the seller-queue index + quote CHECK
    constraints (`NOT VALID`). Owner: `db-schema.md` §12.12. Additive only.

19. ✅ **Real auth link + single-server hardening (`0030`, W23):** `checkout.users.last_login_at`
    (additive) + `checkout.Repo.ProvisionUserID` upsert on first authenticated call (`auth.UserProvisioner`),
    so phone-OTP users are linked without a manual row. Mobile: `services/firebaseAuth.ts`
    (native Firebase phone auth), Keychain-backed session with silent 401 refresh, and strict money/Rx/address/
    cart/favourite/booking writes. Gateway: CORS default-deny (wildcard only in dev), per-route
    throttle (10) + 256 KiB media body cap, and a dependency-probing `/health` (db/cache/mongo).
    Owner: `db-schema.md` §7.1, `caching-cloudflare-valkey.md` §5, `mobile-app.md` Services.
20. ✅ **Audit-log retention (`0037`):** `admins.audit_logs` becomes a **rolling 7-day window** for all
    roles — `admins.purge_audit_logs(max_age DEFAULT '7 days')` is a SECURITY DEFINER batched delete
    (2000-row ctid chunks), scheduled by a **gateway worker** (`internal/admins/purger.go`, 00:00 IST
    daily, `nextMidnightIST` unit-tested — deliberately **not** pg_cron so only one scheduler fires) +
    a SUPER_ADMIN-only manual `POST /audit-logs/purge` (parity with `POST /media/gc`). No new RLS
    delete policy, so the portal stays read-only; every pass records a surviving `AUDIT_PURGE` row.
    No archive — first-run mass delete of pre-existing >7d rows is irreversible (check
    `SELECT count(*) WHERE created_at < now() - interval '7 days'` before deploy).
    Owner: `db-schema.md` §12.9/§12.20, `web-portal.md` (copy), `caching-cloudflare-valkey.md` §8.

21. ✅ **Seller onboarding + Razorpay Route split (`0039`):** `sellers.sellers` gains
    `platform_fee_pct` (admin-editable, FOOD floor 5%), `razorpay_linked_account_id`,
    `contact_email`, FSSAI fields, OTP-signature fields and rejection reason/history;
    `bank_accounts.bank_name`, `kyc_documents.asset_id`, and new append-only
    `sellers.kyc_verification_log` + `sellers.seller_request_history`. `payments.payouts` gains
    `razorpay_transfer_id`/`release_after`/`released_at`. Mobile replaces the old `SellWithUsScreen`
    with `SellerRegistrationScreen` (location state, private-bucket passbook/FSSAI, OTP signature);
    the portal state/super seller detail performs fee edits, per-document verification, rejection and
    **Verify KYC** (Route linked account + activation). `internal/platform/razorpayroute` is the
    domain-free Route client (accounts, held transfers, release/reverse, webhook HMAC); a settlement
    worker releases due holds after the 14-day window. Full account numbers are forwarded to Razorpay
    in memory and never stored. Owner: `db-schema.md` §12.21, `mobile-app.md`, `web-portal.md`,
    `server-gateway-plan.md`, `monolith-breakdown.md` §1.

---

## 8. Companion docs

- `server-gateway-plan.md` — future full microservices gateway plan (kept).
- `db-schema.md` — production table datatypes + sample rows (kept; MVP callouts per section).
- `caching-cloudflare-valkey.md` — cache layer (unchanged).
- `data-layer-sdui.md` — `@data/*` layer + `GatewayClient` wiring order.