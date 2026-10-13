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
| catalog/directory → Go | `internal/catalog`, `internal/directory` | `catalog`, `directory` (+ `inventory.pickup_points`, `directory.menus`) | `faazio:v1:catalog:product:{id}` 24 h · `faazio:v1:directory:store:{id}` 24 h · `faazio:v1:directory:pickup:{key}` 24 h · `faazio:v1:directory:menu:{venueId}` 24 h | `getProduct`, `getProductsByIds`, `getStores`, `getStore`, `getPickupPoints`, `getMenu` | CockroachDB + Postgres |
| pharma (prescriptions) → Go | `internal/pharma` | `pharma` | `faazio:v1:pharma:prescriptions:{userId}` 60 s; never edge-cached | `createPrescription`, `getPrescriptions` | Go + Postgres + Supabase Storage |
| blood → Go+Postgres | `internal/blood` | `blood` (+ `blood.donor_directory` view, pg_cron expiry) | `faazio:v1:blood:requests:{bloodGroup};{city}` 60 s (public/redacted); never edge-cached | `getDonorProfile`, `saveDonorProfile`, `getBloodDonors`, `getBloodRequests`, `createBloodRequest`, `setBloodInterest`, `createDonorMatch`, `getDonorMatches` | Go + Postgres |
| bookings → Go+Postgres | `internal/bookings` | `bookings` | `faazio:v1:bookings:tables:{userId}` 60 s · `faazio:v1:bookings:food:{userId}` 60 s; never edge-cached | `getBookings`, `createBooking`, `cancelBooking`, `getFoodBookings`, `createFoodBooking` | CockroachDB |
| cart/stock → Go+Dynamo | `internal/cartstock` | `inventory` | `faazio:v1:stock:{productId}` 30–60 s; **never** carts | `getStock`, `getCart`, `addToCart`, `updateCartItem`, `removeCartItem` | DynamoDB / Firestore |
| favourites → Go+Postgres | `internal/favourites` | `favourites` | `faazio:v1:favourites:items:{userId}` 60 s; never edge-cached | `getFavourites`, `addFavourite`, `removeFavourite` | CockroachDB |
| rewards → Go+Postgres | `internal/rewards` | `rewards` | `faazio:v1:rewards:view:{userId}` 60 s; never edge-cached | `getRewards` (earn happens in-process via `contracts.RewardsWriter`) | CockroachDB |
| checkout → Go+Cockroach | `internal/checkout` | `checkout` (+ `checkout.idempotency_keys`, `checkout.payments`), `accounts` | `faazio:v1:checkout:orders:{userId}` 60 s · idem `NX EX 300` · `faazio:v1:auth:uid:{sha256}` 3600 s | `getOrders`, `placeOrder`, `payForOrder`, `getPayments`, `getProfile`, `getMembership`, `getOrderStatus`, `getAccountNav`, `getDetails` | CockroachDB |
| reviews → Go+Postgres | `internal/reviews` | `reviews` (+ `reviews.vendor_summary` counter/trigger) | `faazio:v1:reviews:vendor:{id}` 24 h · `faazio:v1:reviews:product:{id}` 24 h | `getReviews` (product), `getVendorReviews`, `rateVendor` | standalone Postgres |
| sellers → Go+Postgres | `internal/sellers` | `sellers` (+ `sellers.sellers`, `kyc_documents`, `bank_accounts`; `directory.stores`/`catalog.products` `seller_id`) | **none** — seller records carry PII (caching doc §8) | `submitSellerApplication` (`POST /sellers`, any authenticated applicant); reads/moderation are portal-only | Go + Postgres |
| admins → Go | `internal/admins` | `admins` (+ `state_admins`, `audit_logs`) | none (append-only audit) | portal-only | CockroachDB |
| promo → Go+Postgres | `internal/promo` | `promo` (+ `festival_campaigns`, `seller_optins`, `coupons`, `sector_caps`) | `faazio:v1:promo:campaign:{id}` 300 s (invalidated on status change) | portal-only | Go + Postgres |
| ads → Go+Postgres | `internal/ads` | `ads` (+ `sponsored_slots`) | `faazio:v1:ads:slot:{id}` 300 s (invalidated on status change) | portal-only | Go + Postgres |
| settlement → Go+Cockroach | `internal/settlement` | `payments` (+ `settlement_ledger`, `payouts`) | `faazio:v1:settlement:{sellerId}:{cycle}` 600 s (invalidated on payout create) | portal-only | CockroachDB |
| support → Go+Postgres | `internal/support` | `support` (+ `tickets`), `checkout.returns` | none (auth-scoped, never edge-cached) | portal-only | Go + Postgres |
| recommendations → Python+Mongo | `internal/reco`, `internal/sdui` | MongoDB `sdui_layouts`, `user_events`, `recommendations`, `product_stats` | `faazio:v1:reco:{userIdHash}:{context}` 1 h · `faazio:v1:gateway:sdui:{locale}:{path}` 300 s | `getHomeFeed`, `trackEvent`, `getRecommendations` | Python FastAPI |
| shared | `internal/platform/{db,cache,auth,config,otel,testenv}`, `internal/contracts` | — | — | — | gRPC via `contracts/` |

Mongo `user_events` stores **ID-only** `{ userIdHash, productId, event, at }` with a 90-day TTL; the
raw user id is never stored (hash only). **Nothing rating-related is ever logged.**

All `GatewayClient` methods in the table are now implemented (reads + writes; `getVendorReviews`,
`rateVendor`, `getCart`/`addToCart`/`updateCartItem`/`removeCartItem`, `placeOrder`, `trackEvent`
included). Cache behaviour is built per the TTL matrix: `GET /stock/:id` is read-through and every
order decrement invalidates `stock:{id}`.

**Portal-only management endpoints** (role-scoped, audited via `admins`; no `GatewayClient` method):
`GET /seller/products` + `PUT /seller/products/{id}/status` (catalog), `GET /seller/stores` +
`PUT /seller/stores/{id}/live` (directory), `GET /seller/orders` + `PUT /orders/{id}/status`
(checkout, maps mobile `Processing ↔ NEW/PACKED`), `GET /seller/prescriptions` +
`PUT /prescriptions/{id}/status` (pharma), `GET /seller/bookings` + `PUT /bookings/{id}/status`
(bookings), `DELETE /blood-requests/{id}` (blood moderation), plus the sellers/promo/ads/settlement/
support/admin contexts above. Every write is scoped to the caller's `seller_id` unless the role is
`STATE_ADMIN`/`SUPER_ADMIN`. The one sellers-context write exposed to the mobile client is
`POST /sellers` (partner onboarding, `GatewayClient.submitSellerApplication`) — any authenticated
applicant may create a `PENDING_REVIEW` seller; KYC/bank writes stay portal-only.

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
| Cache | `faazio:v1:{service}:{entity}:{id}` + TTL matrix (`caching-cloudflare-valkey.md` §4–§5). Includes `faazio:v1:auth:uid:{sha256}` (3600 s) | Cloudflare purge + Valkey invalidation map |
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