# WORKFLOW_SCRATCHPAD.md — Faazio End-to-End dtype-alignment

> **Status:** LIVE control surface (repo root). Supersedes ad-hoc notes.
> Plan: "Faazio End-to-End Plan v3 — Mobile → Web → DB → Go Chi Gateway".
> This file is the single live matrix; stop 6-doc drift. Update it as phases land.
> **v3 delta (0017 `partner_complete`):** closes the last web↔mobile gaps — customer-user
> monitoring (W17), food/menu seller editor (W18), rewards ledger + admin-tunable rates (W19),
> support state/super queue (W20) — plus web write-through (W21), mobile `@mock`→`@server` (W22),
> and auth/Storage/edge cutover (W23). Additive only; never rewrites `0001`–`0016`.

## 0. dtype freeze (the lean contract everything obeys)

### 0.1 SQL freeze (Postgres/Supabase — Cockroach-compatible), from 0004/0005/0006/0014

| Concern | Lean dtype (DB truth) | Rule |
|---|---|---|
| Money (`*_paisa`) | `INT8`, never FLOAT/DECIMAL/INT4 | INT4 paisa caps ₹21M. JSON wire = whole integer rupees |
| Ratings (`products.rating`, `stores.rating`, `menus.rating`) | `REAL` (float4), 1-dp, 0–5 | `rating::real` in 0005; wire = JS number rounded to 1dp |
| Counts (`reviews_count`) | `INT4` | was int8; 2B unreachable |
| Stock qty (`inventory.stock.in_stock_qty`) | `INT4` | was int8 |
| Line qty (`order_items.qty`, `stock_reservations.qty`, bookings `guests`, blood units/weight) | `SMALLINT` | `qty::smallint`, guests 1–30, units 1–20, weight 30–300 |
| Rewards coins/streak, vendor_summary stars | `INT4` | coins ≥0; per-star counters (not just avg) |
| IDs | `TEXT` stable slugs (`md-1`, `store-m3`, `ORD-001`, `user-1`); `slug_uid` dropped in 0005 | never selected by any repo; do not re-add |
| Time | `TIMESTAMPTZ`; JSON ISO-8601 | no epoch/ISO mixing |
| Enums | native ENUM: `app_brand(MART,FOOD,PHARMA)`, `order_status`, `fulfillment_mode`, `booking_status`, `prescription_status`, `reward_entry_type`, `match_status` | validated 1–4B |
| JSONB guards | pickup/pickups/card/dish ≤2048B, nav/details ≤8192B, carts.items ≤50 lines, idempotency key 1–128 chars, note ≤2000 chars, product_id 1–64 chars | TOAST protection (0004/0012/0008) |
| Derived aggregates | `reviews.vendor_summary` + trigger; `util.touch_updated_at()` on 10 mutable tables; pg_cron sweeps (carts 30d, reservations 5min, blood expiry, idempotency 7d) | O(1) reads, bounded tables |
| Search | `search_vec tsvector` GENERATED + GIN; `products_name_trgm_idx` dropped | FTS only; `%` fallback removed |

### 0.2 Mongo freeze (Atlas M0 — `sdui_layouts`, `user_events`, `recommendations`, `product_stats`)

| Field | BSON dtype | Rule |
|---|---|---|
| `_id` (layout `home`) + `productIds/storeIds[]` | string, max 64, ID-only refs | never embed product/store docs; gateway joins via Postgres |
| `version` | long/int | `ETag home-v{version}`, Valkey `sdui:home:{version}` |
| `userIdHash` | string sha256 hex, never raw `user_id` | PII rule. TTL 90d via `expiresAt` + `user_events_ttl` index |
| `event` | enum `view|cart_add|order|search` (gateway allowlist) | `validationAction:error` |
| `at`/`expiresAt`/`generatedAt`/`updatedAt` | BSON Date | not strings, not epoch ints |
| `score` double; `views/cartAdds/orders` long (int64) | per validator | JS Number safe-range note for counters |
| `recommendations.productIds` | array max 100 × string max 64 | bounded |

### 0.3 Gateway conversion boundary (already correct — web must copy it)

`internal/contracts/contracts.go` + every `repo.go`: DB **INT8 paisa → JSON integer rupees**
(`/100` on read, `×100` on write). Repo layer is the only conversion point. No floats cross the
wire. Mobile `GatewayClient.ts` + `@data/*` already speak integer rupees — unchanged by 0005.

## 1. Mobile inventory (verify-only)

- Routes (`src/navigation/AppNavigator.tsx`): 28 root stack screens + 4 tabs.
- Stores (`src/state/`): `authStore`, `cartStore`, `bookingStore`, `foodBookingStore`,
  `pharmaStore`, `bloodDonorStore`, `favoriteStore`, `rewardsStore`, `ordersStore`, `uiStore`,
  `searchStore`, `languageStore`, `vendorRatingStore`, `foodFilterStore`, `store`.
- `@data/*` normalized tables consumed via `GatewayClient` fallback.

### 1.1 Mobile delta (Phase 6)

- [x] `GatewayClient.submitSellerApplication` (`POST /sellers`, mock fallback) + `SellWithUsScreen`
      real form (business/owner/category/GSTIN/PAN/address/phone/state) → PENDING_REVIEW
- [x] `SellWithUsScreen` field labels/placeholders still sourced from `@data/seller/sellerSetup.ts`
- [x] seed generator `assertLeanContract()` — integer rupees, rating 0–5/1dp, search token ≤64,
      no `slug_uid`/`quality_score` (fails the build if `@data` drifts)
- [x] verify-only: money stays integer rupees across `GatewayClient` (repo `/100` boundary);
      stores keep `userIdHash` off-device and stay within JSONB bounds (cart ≤50 lines,
      pickup/card/dish ≤2 KB) — no code change needed

## 2. Web inventory (`client/web`)

- 45 `page.tsx` + 45 `page.client.tsx` pairs under `app/` (seller 20, state admin 12, super admin 13).
- `src/data/types.ts` = the single record-type surface (all record interfaces live here).
- `src/lib/api/{index,store,hooks}.ts` = the only door; `store.ts` = Zustand + `localStorage`
  (`faazio.portal.v1`).
- `src/lib/{pricing/rules, auth/permissions, media/productImages, analytics/derive, format, config, seed}.ts`.

## 3. DB inventory

- Migrations `0001`–`0014` → `server/supabase/migrations/`.
- Seed: `seed/generate.mjs` → `seed/0001_seed.sql` + `seed/mongo/*` (generated; never hand-edit).
- Schemas: `catalog`, `directory`, `reviews`, `checkout`, `accounts`, `inventory`, `favourites`,
  `rewards`, `pharma`, `blood`, `bookings`, `util`.
- Docs authority: `docs/architecture/db-schema.md` (§1–§12), `mvp-backend.md`,
  `monolith-breakdown.md`, `caching-cloudflare-valkey.md`.

## 4. Gateway inventory (`server/gateway`)

- Contexts: `search`, `catalog`, `directory`, `cartstock`, `favourites`, `rewards`,
  `checkout`, `reviews`, `reco`, `sdui`, `pharma`, `blood`, `bookings`.
- Platform: `config`, `db`, `cache`, `mongo`, `auth`, `httpx`, `testenv`, `otel`.
- Composition root: `internal/server/router.go`. Contract interfaces: `internal/contracts`.
- Import boundary enforced by `tools/importlint`.

## 5. Gap matrix W1–W16

| # | Gap | Phase | Status |
|---|---|---|---|
| W1 | Missing `seller` gateway context | 2 | **done** (list/get/onboard/kyc/bank/status + tests) |
| W2 | Missing `promo` gateway context | 3 | **done** (caps/campaigns/optins/coupons + tests) |
| W3 | Missing `ads` gateway context | 3 | **done** (slots list/get/request/status + tests) |
| W4 | Missing `settlement`/payouts gateway context | 3 | **done** (ledger + payouts + tests) |
| W5 | Missing `support`/returns gateway context | 3 | **done** (tickets + returns + tests) |
| W6 | Missing `admins` audit/state-admin context | 3 | **done** (audit + state-admins + tests) |
| W7 | Web seller prescriptions page + endpoint | 4 | **done** (`/seller/prescriptions`) |
| W8 | Web seller bookings page + endpoint | 4 | **done** (`/seller/bookings`) |
| W9 | Web state blood moderation page + endpoint | 4 | **done** (`/admin/state/blood`) |
| W10 | Web super SDUI publish page + endpoint | 4 | **done** (`/admin/super/sdui`) |
| W11 | `catalog.products` seller scope + status column | 1/2 | **done** (`/seller/products` + status route) |
| W12 | `directory.stores` seller_id + state_code | 1/2 | **done** (+ `is_live` via 0016; live route) |
| W13 | `checkout.orders` NEW→PACKED→SHIPPED→DELIVERED lifecycle | 1/2 | **done** (`/seller/orders` + status route) |
| W14 | Real settlement ledger (no client-computed money) | 3 | **done** (server-only write) |
| W15 | Audit log durability (admins.audit_logs) | 3 | **done** |
| W16 | Payout records (payments.payouts) | 3 | **done** (admin-scheduled, invalidates cache) |
| W17 | Customer-user monitoring page (PII-safe per-user view, block/suspend) | 1/2/4 | **done** (0017 view + `internal/admins` customers list + `/admin/state/customers` + `/admin/super/users`) |
| W18 | Food menu seller editor (directory.menus seller-scoped CRUD) | 1/2/4 | **done** (0017 seller_id/status + `/seller/menus` + `internal/directory` menu writes) |
| W19 | Rewards admin knobs (ledger view + admin-tunable rates) | 1/2/4 | **done** (0017 `rewards.rates` + `/admin/super/rewards` + `internal/rewards` rates/ledger read) |
| W20 | Support state/super ticket queue | 1/2/4 | **done** (0017 `tickets.state_code` + `/admin/state/support` + state filter in `internal/support`) |
| W21 | Web write-through (mutations → gateway, keep seed fallback) | 3/4 | **done** (`http.ts` toSnake/₹↔paisa `writeBehind`, `index.ts` mutators call `remote.*`) |
| W22 | Mobile `@mock`→`@server` per-module migration | 4 | **in progress** — mart feed, catalog vendor detail, favourites, product search + home SDUI registry done; dining blocked (venues not in `directory.stores`); cart-checkout pending |
| W23 | Auth cutover (Supabase JWT + RequireRole) + Storage object-key uploads + edge purge | 5 | **pending** (mobile `authStore`, product/KYC buckets, Cloudflare rules) |
| W24 | Pharma quote → READY reveal → notify + durable notification outbox | 1/2/4 | **done** (`0018` + `internal/pharma` quote/reveal + `internal/notifications` + gap PUTs; owner `db-schema.md` §12.12) |

## 6. dtype-gap matrix D1–D15

| # | Web today | DB truth | Fix |
|---|---|---|---|
| D1 | `pricePaisa`/`mrpPaisa`/`amountPaisa`: float64 | INT8 paisa integer-only | integer guards; `/100` at repo |
| D2 | `rating` unclamped | REAL 0–5, 1dp | clamp+round guard |
| D3 | `discountPercent` stored per product | derived `(mrp-price)/mrp` | drop field; derive fn |
| D4 | `qualityScore` stored | no column | **decision: drop** |
| D5 | `quantity` unbounded | SMALLINT/INT4 + CHECKs | bounded qty guard |
| D6 | `galleryUrls?` unbounded | single `image_url` + Storage keys; JSONB ≤2–8KB | bounded gallery |
| D7 | `imageUrl`/`fileUrl` `mock://` | Storage object keys, signed URLs | Storage key flow |
| D8 | OrderStatus NEW/PACKED/… | order_status enum | **decision: Option A** |
| D9 | Product/Seller/Ad/Campaign status | no columns (0015) | 0015 columns |
| D10 | ISO strings no TZ enforcement | TIMESTAMPTZ | TZ-aware ISO type |
| D11 | flat `customerName`/`sellerId` | joins + JSONB pickup | DB-shape map |
| D12 | seeded analytics ints | Mongo user_events/product_stats | real pipeline (Phase 5) |
| D13 | plaintext `demo1234` + localStorage | Supabase Auth JWT + RLS | auth cutover (Phase 5) |
| D14 | client-computed settlement | payments.settlement_ledger | server-only write |
| D15 | camelCase everywhere | snake_case DB | single mapper |
| D16 | no customer-user projection | checkout.users (PII) + orders | **0017** `checkout.users_admin` view (redacted: no phone/address/email) |
| D17 | `directory.menus` has no owner/status | menu edits seller-scoped like products | **0017** `menus.seller_id` + `status` (nullable, backfilled) |
| D18 | rewards rates as static constants (`data/rewards/rewards.ts`, `config.ts`) | admin-editable row | **0017** `rewards.rates` (single row) + gateway read; server stays sole ledger writer |
| D19 | `support.tickets` has no state scope | state queue filter | **0017** `tickets.state_code` (nullable) + gateway filter |

## 7. DB delta 0015 checklist

- [x] `directory.stores` ADD `seller_id TEXT`, `state_code CHAR(2)` + indexes
- [x] `catalog.products` ADD `seller_id TEXT`, `status TEXT DEFAULT 'DRAFT' CHECK(...)` + indexes
- [x] `sellers` schema: `sellers`, `kyc_documents` (`file_key`), `bank_accounts` + RLS
- [x] `promo` schema: `festival_campaigns`, `festival_optins`, `sector_caps`, `coupons` + RLS
- [x] `ads.sponsored_slots` + RLS
- [x] `payments.settlement_ledger` + `payments.payouts` (append-only) + RLS
- [x] `admins.state_admins` + `admins.audit_logs` + `support.tickets` + `checkout.returns`
- [x] enum alignment Option A: `ALTER TYPE order_status ADD VALUE 'NEW'/'PACKED'/'RETURNED'`
- [x] same-change docs (`db-schema.md` §12.9, `mvp-backend.md` §2, `monolith-breakdown.md` §1,
      `caching-cloudflare-valkey.md`)
- [x] **(0016)** `directory.stores.is_live BOOLEAN NOT NULL DEFAULT true` + `(state_code,is_live)`
      index; docs `db-schema.md` §12.10, `mvp-backend.md` §7

## 8. Web delta checklist

- [x] `src/data/types.ts` dtype contract (drop discountPercent/qualityScore; derive)
- [x] `src/lib/pricing/rules.ts` paisa-int math only (`isIntPaisa` guard)
- [x] `src/lib/media/productImages.ts` Storage-key flow (`resolveImage` + `uploadProductImage`)
- [x] `src/lib/api/{http,sync}.ts` fetch seam + rupee↔paisa mapper + bearer auth
- [x] `src/lib/supabase/auth.ts` Supabase Auth (GoTrue REST, no SDK) + role claims
- [x] 5 thin pages (prescriptions, bookings, blood, state bookings, sdui) + seed records/hooks/nav
- [x] env-gated (`NEXT_PUBLIC_GATEWAY_URL`/`SUPABASE_*`); `.env.example`; degrades to seed mode
- [x] `.gitignore` `coverage/`→`/coverage/` (un-hid `app/admin/super/coverage`)

## 9. Gateway delta checklist

- [x] new contexts `sellers`, `promo`, `ads`, `settlement`, `support` (+ `admins` audit)
- [x] extend `catalog` (status transitions + seller scope), `directory` (live flag + seller scope),
      `checkout` (NEW→PACKED→SHIPPED→DELIVERED + returns), `pharma` (fulfill), `blood`/`bookings`
      (moderate) — all role-scoped + audited
- [x] `platform/auth` role middleware (seller→own, state→state_code, super→all)
- [x] new cache keys/TTLs (`sellers`, `promo`, `ads`, `settlement`) + cache_test freeze
- [x] tests: paisa roundtrip, cross-seller denial, seller order/booking/rx transitions, live flag, blood delete
- [x] **(v3, 0017)** `internal/admins` `GET /customers` (redacted `checkout.users_admin`, state-scoped);
      `internal/directory` `GET/POST/PUT /seller/menus` + `/status` + `DELETE` (seller-scoped, purges
      `directory:menu:{venueId}`); `internal/rewards` `GET /rewards/ledger` + `GET`/`PUT /rewards/rates`
      (Earn reads the rates row, defaults on absence) + `REWARDS_RATES_UPDATE` audit;
      `internal/support` `?state=` ticket filter (state claim / super query)
- [x] tests (v3): customers projection + state filter, menu lifecycle cross-seller denial, rates-tuned earn + ledger, ticket state filter
- [x] **(W24, 0018)** `internal/pharma`: `pharma.quote_items` CRUD (`POST /seller/prescriptions/{id}/quotes`) +
      `READY` reveal (requires ≥1 line, sets `revealed_at/by`, appends `status_history`, enqueues outbox) +
      redacted `GET /seller/prescriptions` (name-only until READY/FULFILLED) + `GET /prescriptions/{id}/images`
      (signed download); `internal/notifications` (`contracts.Notifier`, outbox + push tokens, inbox/register +
      admin outbox); gap writes `GET/PUT /profile/addresses` + `GET /orders/{id}` (checkout),
      `PUT /reviews/{id}/moderate` (reviews HIDDEN flag), `PUT /seller/products/{id}` (catalog price/stock edit);
      pharma repo test covers quote total + cross-seller denial + READY-without-quote + reveal + history

## 10. Decisions (approved)

- **qualityScore** → **DROP** from web (duplicates rating + reviews). No `quality_score` column.
- **order_status enum** → **Option A**: add `'NEW'`, `'PACKED'`, `'RETURNED'`; gateway maps mobile
  `Processing↔NEW/PACKED`. One lifecycle both apps read.
- **Scope** → approved: 5 new gateway contexts + 5 new web pages + additive `0015`.

## 11. Verify commands (run every phase)

```bash
# DB
docker compose up -d   # supabase local; apply 0001–0016 in order; seed 421 products/32 stores/32 orders
# Gateway
cd server/gateway && go build ./... && go vet ./... && go test ./... && go run ./tools/importlint
# Mobile + web
cd client/mobile && npm run ts:check && npm run check:boundaries
cd client/web    && npm run ts:check && npm run build
```

Dtype spot-checks: INSERT rating 4.666 → stored 4.7; qty 99999 → CHECK fail; `discountPercent`
column absent; `mock://` insert rejected; settlement client-write rejected; raw `user_id` in
`user_events` rejected by validator.

## 12. E2E slices (v3) — one workflow at a time, mobile → web → DB → gateway

Each slice is closed only when the mobile screen, the web control, the DB row, and the gateway
endpoint all agree. Fallback stays in place until the slice is green end-to-end.

| Slice | Mobile (read/write) | Web control | DB (0017) | Gateway |
|---|---|---|---|---|
| S1 Customers | checkout.orders/returns | `/admin/state/customers` (PII-safe) | `checkout.users_admin` view | `GET /customers` (state/super, redacted) |
| S2 Food menu | `getMenu` / seller edits | `/seller/menus` | `directory.menus.seller_id/status` | `GET/POST/PUT /seller/menus/{id}` + invalidation |
| S3 Rewards | `getRewards` | `/admin/super/rewards` | `rewards.rates` (read policy for admin) | `GET /rewards/ledger`, `GET/PUT /rewards/rates` |
| S4 Support | create ticket/return | `/admin/state/support` | `support.tickets.state_code` | `GET /tickets?state=`, `PUT /tickets/{id}/status` |
| S5 Write-through | — | all portal mutators | existing rows | `remote.post/put/delete` + audit + cache purge |
| S6 Auth/media | `authStore` JWT | Supabase GoTrue session | RLS claims | `RequireRole`; Storage object keys |
| S7 Pharma quote (W24) | Rx upload → quote view (poll) | `/seller/prescriptions` quote editor + READY reveal | `pharma.quote_items`/`status_history`, `notifications.outbox` | `POST quotes`, `PUT READY`, `GET images`, `GET /notifications` |

Status: **S1–S5 closed** (web control + DB + gateway all shipped; every portal mutator
now calls `writeBehind`). **S6 pending** (W23: mobile `authStore` cutover, product/KYC
Storage buckets, Cloudflare edge rules). **S7 gateway/DB shipped** (`0018` + pharma
quote/reveal + notifications + gap PUTs); the web quote editor and mobile Rx/cart cutover
are the next slices. Mobile `@mock`→`@server` (W22) is in progress; the seam
(`GatewayClient` + per-feature fallback) is ready to flip per module.