# Faazio Monolith Breakdown — Modular Monolith → Microservices

> **Status:** MVP — ACTIVE (code). This is the **single authority** for how the MVP
> `server/gateway` modular monolith maps to the future per-service split. Every context
> below is a package in **one Go binary** (`server/gateway`) with hard internal boundaries;
> extraction to a real service is a packaging change, not a rewrite.
> Companion / referenced from: `docs/architecture/mvp-backend.md` (MVP authority),
> `docs/architecture/db-schema.md` (table authority), `docs/architecture/server-gateway-plan.md`
> (future gateway), `docs/architecture/caching-cloudflare-valkey.md` (cache authority).

## 0. Why one monolith (not Go + Rust for MVP)

Ship **one Go Chi modular monolith now**, extract Rust/Go services later. Evidence:

- **Modular monolith → microservices without rewrite** is the proven path: bounded contexts in one
  binary behind hard `internal/<context>/` boundaries, extracted per-context when a scale trigger
  hits (Shopify strangler-fig guide; AWS strangler-fig prescriptive guidance; "one binary, many
  boundaries" Go pattern).
- **Prime Video** collapsed distributed microservices back into a modular monolith for cost/perf —
  keeping module boundaries so extraction stays possible (not a return to a ball of mud).
- **Postgres FTS is good enough for the MVP**: `tsvector` + `pg_trgm` + `unaccent` handles
  ~100k–1M rows / few-hundred rps. Tantivy only pays off at high-QPS flash-sale scale.
- **A second Rust toolchain now costs 2 CI builds, 2 cold-starts, inter-service auth/gRPC + OTel
  across stacks, for zero MVP gain** — violates `AGENTS.md` (lightweight / fast / secure; justify size).

The refactor risk ("build Go, refactor to Rust later") is neutralized by the **contract freeze in §4**:
slug IDs, INT8 paisa, `TIMESTAMPTZ`, `GatewayClient` signatures, and cache keys/TTLs stay stable, so
search extraction is a pure index-replica swap.

## 1. Context → package → schema → cache → future-service ownership

1:1 with `db-schema.md` §1–§8 and `data/DATA_CONTROL.md`. **This table is the ownership authority for
`server/gateway/internal/*`.**

| Context (future service) | MVP package | Schema(s) | Cache keys / TTL | `GatewayClient` method(s) | Future Prod |
|---|---|---|---|---|---|
| search → Rust/Tantivy | `internal/search` | `catalog` (read: `products_search`) | `faazio:v1:search:q:{query}` 600 s | `searchProducts` | Rust Axum + Tantivy |
| catalog/directory → Go | `internal/catalog`, `internal/directory` | `catalog`, `directory` (+ `inventory.pickup_points`, `directory.dining_venues`, `directory.menus` incl. `seller_id`/`status`/`mrp_paisa`) | `faazio:v1:catalog:product:{id}` 24 h · `faazio:v1:directory:store:{id}` 24 h · `faazio:v1:directory:pickup:{key}` 24 h · `faazio:v1:directory:menu:{venueId}` 24 h (invalidated on menu edit) · `faazio:v1:directory:venues:{app}` 24 h · `faazio:v1:directory:venue:{id}` 24 h | `getProduct`, `getProductsByIds`, `getStores`, `getStore`, `getVenues`, `getVenue` (`GET /venues/{id}`), `getPickupPoints`, `getMenu`; portal menu CRUD (`/seller/menus`) | CockroachDB + Postgres |
| pharma (prescriptions) → Go | `internal/pharma` | `pharma` (+ `pharma.quote_items`, `pharma.status_history`) | `faazio:v1:pharma:prescriptions:{userId}` 60 s; never edge-cached | `createPrescription`, `uploadPrescriptionImage`, `getPrescriptions`/`getPrescription` (owner-scoped `GET /prescriptions/{id}`); portal quote/reveal (`GET /seller/prescriptions`, `GET /seller/prescriptions/{id}`, `POST /seller/prescriptions/{id}/quotes`, `PUT /prescriptions/{id}/status`) | Go + Postgres + Supabase Storage |
| notifications → Go+worker | `internal/notifications` | `notifications` (+ `outbox`, `push_tokens`) | `faazio:v1:notifications:inbox:{userId}` 30 s; never edge-cached | — (enqueue via `contracts.Notifier`; `POST /notifications/register`, `GET /notifications`; portal `GET /admin/notifications` + admin `POST /notifications/drain` (`contracts.Drainer` one-shot); outbox **drain worker** → `PENDING`→`SENT`/`FAILED`, provider-agnostic `WebhookSender`, 30 s polling SLA, enabled by `PUSH_WEBHOOK_URL`) | Go + queue worker |
| blood → Go+Postgres | `internal/blood` | `blood` (+ `blood.donor_directory` view, pg_cron expiry) | `faazio:v1:blood:requests:{bloodGroup};{city}` 60 s (public/redacted); never edge-cached | `getDonorProfile`, `saveDonorProfile`, `getBloodDonors`, `getBloodRequests`, `createBloodRequest`, `setBloodInterest`, `createDonorMatch`, `getDonorMatches` | Go + Postgres |
| bookings → Go+Postgres | `internal/bookings` | `bookings` (+ `venue_configs` seller-private, `payments` ledger); `food_orders` reserved/unused, `directory.dining_venues.seller_id` | `faazio:v1:bookings:tables:{userId}` 60 s · `faazio:v1:bookings:avail:{vendorId}` 30 s (public seat-count-free projection; invalidated on config write + decision); never edge-cached | `getBookings`, `createBooking` (seats + idempotency), `cancelBooking`, `attachBookingPayment`, `getBookingAvailability`; seller web `GET/PUT /seller/booking-config`, `PUT /bookings/{id}/status` (accept/reject), `POST /bookings/{id}/vacate`; `POST /webhooks/razorpay` | CockroachDB + Razorpay |
| cart/stock → Go+Dynamo | `internal/cartstock` | `inventory` | `faazio:v1:stock:{productId}` 30–60 s; **never** carts | `getStock`, `getCart`, `addToCart`, `updateCartItem`, `removeCartItem` | DynamoDB / Firestore |
| favourites → Go+Postgres | `internal/favourites` | `favourites` | `faazio:v1:favourites:items:{userId}` 60 s; never edge-cached | `getFavourites`, `addFavourite`, `removeFavourite` | CockroachDB |
| checkout → Go+Cockroach | `internal/checkout` | `checkout` (+ `checkout.idempotency_keys`, `checkout.payments`, `checkout.users_admin` read view), `accounts` | `faazio:v1:checkout:orders:{userId}` 60 s · idem `NX EX 300` · `faazio:v1:auth:uid:{sha256}` 3600 s | `getOrders`, `placeOrder` (settles coupon via `contracts.CouponValidator`, coins, then best-effort `contracts.AdAttributor`), `validateCoupon` (`POST /checkout/validate-coupon`), `payForOrder`, `getPayments`, `getProfile`, `getMembership`, `getOrderStatus`, `getAccountNav`, `getDetails`, `getAddresses`, `saveAddress` (`PUT /profile/addresses`), `deleteAddress` (`DELETE /profile/addresses/{id}`), order tracking (`GET /orders/tracking/{id}`, owner-scoped status poll) | CockroachDB |
| rewards → Go+Postgres | `internal/rewards` | `rewards` (+ `rewards.rates`) | `faazio:v1:rewards:view:{userId}` 60 s; never edge-cached | `getRewards` (earn happens in-process via `contracts.RewardsWriter`); portal reads ledger + rates | CockroachDB |
| reviews → Go+Postgres | `internal/reviews` | `reviews` (+ `reviews.vendor_summary` counter/trigger) | `faazio:v1:reviews:vendor:{id}` 24 h · `faazio:v1:reviews:product:{id}` 24 h | `getReviews` (product), `getVendorReviews`, `rateVendor` | standalone Postgres |
| sellers → Go+Postgres | `internal/sellers` | `sellers` (+ `sellers.sellers`, `kyc_documents`, `bank_accounts`; `directory.stores`/`catalog.products` `seller_id`) | **none** — seller records carry PII (caching doc §8) | `submitSellerApplication` (`POST /sellers`, any authenticated applicant); reads/moderation are portal-only | Go + Postgres |
| admins → Go | `internal/admins` | `admins` (+ `state_admins`, `audit_logs`); reads `checkout.users_admin` | none (append-only audit); customer list auth-scoped, never cached | portal-only (`GET /customers`, customer monitoring) | CockroachDB |
| promo → Go+Postgres | `internal/promo` | `promo` (+ `festival_campaigns`, `seller_optins`, `coupons` incl. `title`/`min_order_paisa`/`free_delivery`, `sector_caps`) | `faazio:v1:promo:campaign:{id}` 300 s · `faazio:v1:promo:coupons:public:{app}:{state}` 600 s · `faazio:v1:promo:active:{productId}` 300 s (LIVE+APPROVED, sector-capped; invalidated on opt-in/campaign change) | portal control + public `GET /coupons?app=&state=` (anon, active/unexpired projection) + `GET /promo/active-discounts?ids=` (anon shopper-price projection the app overlays on base prices); implements `contracts.CouponValidator` (`ValidateCoupon`, pure `DecideCoupon`) so checkout settles coupons server-side | Go + Postgres |
| ads → Go+Postgres | `internal/ads` | `ads` (+ `sponsored_slots`) | `faazio:v1:ads:slot:{id}` 300 s · `faazio:v1:ads:live:{placement}` 600 s (invalidated on status change) · `faazio:v1:ads:seen:{userId}:{slotId}` 300 s (impression dedupe) | portal control + public `GET /ads/live?slot=` (anon, LIVE projection); authenticated `POST /ads/events` records impression/click (`RecordEvent`); `contracts.AdAttributor` `AttributeOrder` bumps `orders_attributed` best-effort at checkout; `GatewayClient.getLiveAds`/`getSponsoredProducts`/`recordAdEvent` feed the shared sponsored rail (HOME_TOP/SPONSORED_SHOWCASE/SECTOR_RAIL) | Go + Postgres |
| settlement → Go+Cockroach | `internal/settlement` | `payments` (+ `settlement_ledger`, `payouts`) | `faazio:v1:settlement:{sellerId}:{cycle}` 600 s (invalidated on payout create) | portal-only | CockroachDB |
| support → Go+Postgres | `internal/support` | `support` (+ `tickets` incl. `state_code`), `checkout.returns` | none (auth-scoped, never edge-cached) | portal-only (state/super ticket queue) | Go + Postgres |
| recommendations → Python+Mongo | `internal/reco`, `internal/sdui` | MongoDB `sdui_layouts`, `user_events`, `recommendations`, `product_stats`; `sdui` composes `catalog` + `directory` (`HomeSection` joins each section's `productIds` **and** `storeIds` via `contracts.ProductReader`/`contracts.StoreReader` — `directory.Repo.ByIDs`, PII-free projection) | `faazio:v1:reco:{userIdHash}:{context}` 1 h · `faazio:v1:gateway:sdui:{locale}:{path}` 300 s (same key now carries the store join; purged on publish) | `getHomeFeed`, `trackEvent` (app) + `getRecommendations`; portal monitoring `GET /admin/user-trail?userId=&limit=` (admin-only, ID-only `user_events` read); super-admin Home-layout editor `GET`/`PUT /admin/sdui/home` (raw ID-only sections, `contracts.LayoutWriter` → `reco.Repo.SaveHome` `$inc version` + purges the compiled-feed cache; audited `SDUI_PUBLISH`) | Python FastAPI |
| shared | `internal/platform/{db,cache,auth,config,otel,testenv}`, `internal/contracts` | — | — | — | gRPC via `contracts/` |

Mongo `user_events` stores **ID-only** `{ userIdHash, productId, event, at }` with a 90-day TTL; the
raw user id is never stored (hash only). **Nothing rating-related is ever logged.**

All `GatewayClient` methods in the table are now implemented (reads + writes; `getVendorReviews`,
`rateVendor`, `getCart`/`addToCart`/`updateCartItem`/`removeCartItem`, `placeOrder`, `trackEvent`
included). Cache behaviour is built per the TTL matrix: `GET /stock/:id` is read-through and every
order decrement invalidates `stock:{id}`.

**App-gap deltas (W25, `0019`)** add the `getVenues`/`getNotifications` client methods to the
catalog/directory row: `GET /venues?app=` reads the PII-free `directory.dining_venues` projection
(cached `directory:venues:{app}` 24 h), and `directory.menus` gains `description`/`emoji`/
`delivery_time` so the Food restaurant screens can leave the fixture. The blood board is unchanged —
it stays redacted (no PII widening).

**Portal-only management endpoints** (role-scoped, audited via `admins`; no `GatewayClient` method):
`GET /seller/products` + `PUT /seller/products/{id}/status` (catalog), `GET /seller/stores` +
`PUT /seller/stores/{id}/live` (directory), `GET /seller/orders` + `PUT /orders/{id}/status`
(checkout, maps mobile `Processing ↔ NEW/PACKED`), `GET /seller/prescriptions` +
`PUT /prescriptions/{id}/status` (pharma), `GET /seller/bookings` + `PUT /bookings/{id}/status`
(bookings), `DELETE /blood-requests/{id}` (blood moderation), plus the sellers/promo/ads/settlement/
support/admin contexts above. Every write is scoped to the caller's `seller_id` unless the role is
`STATE_ADMIN`/`SUPER_ADMIN`. The one sellers-context write exposed to the mobile client is
`POST /sellers` (partner onboarding, `GatewayClient.submitSellerApplication`) — any authenticated
applicant may create a `PENDING_REVIEW` seller; KYC/bank writes stay portal-only. The Home
SDUI editor is super-admin-only: `GET`/`PUT /admin/sdui/home` (`internal/sdui`) reads/writes the
raw ID-only `sdui_layouts` doc and publishes a version bump the app picks up on its next poll.

**Partner completion (v3, `0017`)** adds four portal-only control surfaces: customer monitoring
(`GET /customers` in `internal/admins`, reads the redacted `checkout.users_admin` view — state/super
only, never cached), food-menu editing (`GET /seller/menus` + `POST /seller/menus` /
`PUT /seller/menus/{venueId}/{dishId}` in `internal/directory`, seller-scoped, invalidates
`directory:menu:{venueId}`), rewards administration
(`GET /rewards/ledger` + `GET`/`PUT /rewards/rates` in `internal/rewards`; the server stays the sole
`rewards.ledger`/`balances` writer), and a state-scoped support queue (`GET /support/tickets?state=`
in `internal/support`). All are role-gated (`STATE_ADMIN`/`SUPER_ADMIN`, or the owning seller) and
audited via `admins.audit_logs`.

**Pharma quote → READY reveal → notify (W24, `0018`)** adds the partner quote workflow. The seller
projection (`GET /seller/prescriptions`) is **name-only until READY/FULFILLED** (contact columns are
blanked by the query's `CASE`); `POST /seller/prescriptions/{id}/quotes` replaces the priced lines
(`pharma.quote_items`), recomputes `quoted_total_paisa` and advances to `QUOTED`; `PUT
/prescriptions/{id}/status READY` requires ≥1 line, stamps `revealed_at`/`revealed_by`, appends
`pharma.status_history` + an `RX_READY` audit row, and enqueues `notifications.outbox`. The new
`internal/notifications` context is the single writer of the outbox/push-token registry and exposes
`contracts.Notifier`; checkout order-status changes also enqueue through it. `GET
/prescriptions/{id}` returns one **owner-scoped** prescription (quote/total/status/history) so the
app polls a single row instead of the whole list; a non-owner id is a 404. `GET
/prescriptions/{id}/images` mints short-lived signed download URLs for the private bucket (owner,
assigned vendor or admin only). Repo wiring per `db-schema.md` §12.12.

**Public promo/ads reads, user trail + outbox worker (W29, `0021`).** The app's promotional surfaces
had no anon-readable contract: `promo.coupons` gained `title`/`min_order_paisa`/`free_delivery`
(`0021`) and a public `GET /coupons?app=&state=` projection (`internal/promo`), and `ads` gained a
public `GET /ads/live?slot=` LIVE projection. The app consumes coupons through
`GatewayClient.getCoupons` (cart coupon sheet; `@data/cart/coupons` fallback) and LIVE ads through
`GatewayClient.getLiveAds`/`getSponsoredProducts` (Home `SponsoredRailSection`, `HOME_TOP`; paid
placements have **no** fixture fallback — empty collapses the rail). Seed: `sel-3` (ACTIVE MART
seller) + three LIVE `HOME_TOP` slots (`ad-demo-home-*`) in `0001_seed.sql`. Monitoring:
`internal/reco` exposes admin-only `GET /admin/user-trail?userId=&limit=` reading the same ID-only
`user_events` (hash match; no raw user id), surfaced as an activity-trail panel on the portal
customers page. Delivery: `internal/notifications` gained a provider-agnostic outbox **drain worker**
(`WebhookSender`; start with `PUSH_WEBHOOK_URL`) that moves `PENDING`→`SENT`/`FAILED` — the app's
inbox stays poll-based until it is configured. Prod auth is unchanged in code (dev `X-Dev-*` headers
are only honoured when `AUTH_DISABLED=true`, which now logs a loud warning).

**Shopper price authority + discount integrity (W31, `0022`).** Festival opt-ins were control-plane
only: an approved `discount_percent` never reached the app, and two surfaces fabricated discounts
on-device. `internal/promo` now exposes an anon `GET /promo/active-discounts?ids=` projection
(`ActiveDiscounts`, best-wins per product, capped by the effective `sector_caps` row in SQL) cached
per product (`faazio:v1:promo:active:{productId}` 300 s, invalidated on opt-in/campaign status
change). Base catalog prices stay pure — the app overlays the projection (`GatewayClient.
getActiveDiscounts` → `services/pricing.ts` `applyActiveDiscount[s]`/`useActiveDiscounts`) in the
Mart vendor rail and `DealsLanding` (`discounts` mode); no discount means base price. `directory.
menus` gained `mrp_paisa` (`0022`) so the Food "Recommended & Offers" rail shows an authored MRP
(`mrp > price`) instead of the removed `price × 1.2` synthesis; the Home `Daily Essentials` rail now
resolves its `md-*` ids through the catalog (`getProductsByIds`) with the authored fixture only as
the offline fallback (the `md-*` rows were already seeded via `generate.mjs`).

**Coupon settlement + closed-loop ads (W32).** The coupon sheet was display-only and paid placements
had no event trail. `internal/promo` now implements `contracts.CouponValidator`
(`ValidateCoupon`/pure `DecideCoupon`: not-found/inactive/expired/wrong-sector/wrong-state/min-order),
exposed to the cart via authenticated `POST /checkout/validate-coupon` (`{code, app, state, subtotal}`
in whole rupees → `{valid, reason, discount, …}`). `checkout.CreateOrder` re-validates the coupon
**before** the stock decrement and settles `paid = subtotal − couponDiscount − coins`, so a stale
display can never discount an order the server didn't sanction (`ErrInvalidCoupon` → 400
`invalid_coupon`). Ads became closed-loop: authenticated `POST /ads/events` records impression/click
(`internal/ads.RecordEvent`, impressions de-duped per user via `faazio:v1:ads:seen:{userId}:{slotId}`
300 s), and `contracts.AdAttributor.AttributeOrder` bumps `orders_attributed` best-effort after the
order commits using the shopper's last-clicked slot (`services/adsAttribution.ts`). The paid shelf
moved to a boundary-safe shared `components/shared/SponsoredRail` (ad-server fill + events +
disclosure) so Home (`HOME_TOP`), the Mart showcase (`SPONSORED_SHOWCASE`) and the vendor-deals rail
(`SECTOR_RAIL`) share one pipeline; the seed adds demo `SPONSORED_SHOWCASE`/`SECTOR_RAIL` slots. The
partner portal's promo/ads writes now await the gateway and roll back with a toast on failure
(`writeAwaited`, Phase 5) instead of fire-and-forget. No schema change (settlement reuses
`promo.coupons` + the existing `ads.sponsored_slots` counters).

**Server quench + Rx privacy (W34, `0023`).** Closes the last app-quench/monitoring thin reads with
additive handlers in existing contexts (no new service): `internal/directory` `GET /venues/{id}`
(single dining venue, PII-redacted for anon, cached `faazio:v1:directory:venue:{id}` 24 h),
`internal/pharma` `GET /seller/prescriptions/{id}` (one Rx in the same name-only-until-READY seller
projection; cross-seller id is a 404), `internal/checkout` `GET /orders/tracking/{id}` (owner-scoped
lightweight status projection — no line items/PII; status mapped to the mobile vocabulary), and
`internal/notifications` `POST /notifications/drain` (admin-only one-shot outbox drain via
`contracts.Drainer`; 503 when no push provider). Pharma quote integrity tightens: `price <= mrp`
(when mrp authored) is rejected at the handler and by `0023` CHECK constraints (`NOT VALID`), and a
repeated `READY` is idempotent (no duplicate `status_history` row, no duplicate `RX_READY` notify).
`0023` also adds `prescriptions_vendor_status_idx (vendor_id, status, created_at desc)` for the seller
queue/deep-link. Additive only.

## 2. Boundary rules (enforced)

1. A context lives **only** under `internal/<context>/{handler,service,repo}.go` (handler = HTTP,
   service = logic, repo = SQL). No other package may import `internal/<context>/repo`.
2. **Cross-context calls go through a Go interface declared in `internal/contracts`** (e.g.
   `contracts.CatalogReader`, `contracts.StockWriter`) — the exact shape a future `.proto` will take.
   Contexts receive dependencies as interfaces, never as concrete sibling repos.
3. No context imports another context's package directly, except `internal/contracts` and
   `internal/platform/*`. `internal/sdui` composes via `contracts` interfaces only.
4. `internal/platform/*` (db/cache/auth/config/otel) has no domain knowledge — no context imports.
5. Enforcement: `go vet ./...` + a CI **import-lint** step (`go run ./tools/importlint` or `go list`
   based check, see `server/gateway/README.md`) that fails if a forbidden cross-context import exists.

## 3. Per-service extraction playbook

Extract the **first** context (search) as the reference. The others repeat the same steps.

1. **Contract freeze check** — confirm the context's rows in §4 are unchanged for the release.
2. **Dual-run** — stand the new service up behind the same `contracts` interface; the monolith gets a
   `SEARCH_SERVICE_URL` env override. Both paths serve traffic (shadow or %-split).
3. **Strangler cutover** — flip the flag to the new service for one app/module at a time; Cloudflare
   keeps caching public GETs, so keys/TTLs are unchanged and the app is unaware.
4. **Rollback** — unset the env flag (interface falls back to the in-process context). No app release.
5. **Delete the in-process context** only after the promotion trigger stays green.

| Promotion trigger (§6 `mvp-backend.md`) | Extract |
|---|---|
| FTS latency/ranking or search QPS is a bottleneck | search → Rust/Tantivy |
| relational write scale / multi-region consistency outgrows one Postgres | checkout → CockroachDB |
| stock/cart contention reaches 1000s of concurrent decrements | cart/stock → DynamoDB/Firestore |
| vendor-reviews traffic / cluster ownership must split | reviews → standalone Postgres |

## 4. Contract freeze (change any row here → update this doc in the same PR)

| Contract | Frozen value | Reason it must not drift |
|---|---|---|
| Public IDs | stable string slugs (`md-1`, `store-m3`, `user-1`, `ORD-001`) | CDN URLs, Valkey keys, `GatewayClient` args |
| Money | DB: **INT8 paisa** (₹1 = 100). JSON: whole **integer rupees** (`price`/`mrp`, no paisa, no float). Repo layer is the only conversion boundary (paisa → rupees on read, ×100 on write) | no float drift; `@data/*`/`GatewayClient` already use integer rupees, so the client shape is unchanged; Tantivy/Cockroach parity. **Money is never narrowed** — `INT4` paisa caps at ₹21M |
| Non-money column types | MVP `0005`: `rating` REAL, counts/qty `INT4`/`SMALLINT`, `slug_uid` and `products_name_trgm_idx` dropped | byte diet only — JSON DTOs/`GatewayClient` are type-agnostic, so the wire shape is unchanged |
| Time | `TIMESTAMPTZ`; JSON ISO-8601 | fixed width; no epoch/ISO mixing |
| Enums | `app_brand`, `order_status`, `fulfillment_mode` (Postgres ENUM) | validated, 1–4 B |
| Partner enums (`0015`) | `seller_status`, `product_status`, `kyc_doc_type`, `campaign_status`, `campaign_scope`, `optin_status`, `ad_placement`, `ad_status`, `payout_status`, `ticket_status`, `return_status`; `order_status` gains `NEW`/`PACKED`/`RETURNED` (Option A, mobile `Processing` ⇄ `NEW`/`PACKED`) | one lifecycle both apps read; validated at the DB |
| Partner roles | JWT claims `app_role` (`SELLER`/`STATE_ADMIN`/`SUPER_ADMIN`) + `seller_id`/`state_code`; `auth.RequireRole` | role checks in Go (`service_role` bypasses RLS); never trust a request-body actor |
| `GatewayClient` | method names + signatures in `client/mobile/src/services/api/GatewayClient.ts` | screens swap `@mock` → `@server` without call-site edits |
| Cache | `faazio:v1:{service}:{entity}:{id}` + TTL matrix (`caching-cloudflare-valkey.md` §4–§5). Includes `faazio:v1:auth:uid:{sha256}` (3600 s), `faazio:v1:pharma:prescriptions:{userId}` (60 s), `faazio:v1:notifications:inbox:{userId}` (30 s) | Cloudflare purge + Valkey invalidation map |
| Cache `v{N}` | bump to invalidate a key class | no scan needed |
| Idempotency | `SET faazio:v1:checkout:idem:{orderRef} 1 NX EX 300` | prevents double-place |

## 5. Where the MVP differs from Future Prod (kept documented)

- **Transport:** MVP contexts are in-process Go interfaces; Future Prod is gRPC through `contracts/`.
  The interface names/shapes mirror the intended proto messages.
- **DB split:** MVP = one Supabase project (schemas `catalog`/`directory`/`reviews`/`checkout`/
  `accounts`/`inventory`) + MongoDB Atlas M0 + Aiven Valkey. Future Prod = CockroachDB, Tantivy,
  DynamoDB, standalone Postgres — same datatypes, so the swap is invisible.
- **Auth:** MVP = Supabase Auth phone OTP + RLS; the gateway resolves `user_id` from the JWT and
  scopes every auth-scoped query by it. Never trust a client-supplied user id.
- **Observability:** OTel hooks live in `internal/platform/otel`; exporters are env-gated (no-op when
  unset) so local dev adds no cost.

## 6. Honest limitations

- The Future Prod services (Rust/Tantivy, CockroachDB, DynamoDB, Python) are **not built** — the
  monolith is the only running backend. `contracts/` is Go interfaces, not `.proto` yet.
- The extraction playbook is **documented, not rehearsed** — no shadow deployment exists.
- Boundary enforcement is by `go vet` + import-lint; it is not a compiler-enforced module system.