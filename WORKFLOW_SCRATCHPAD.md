# WORKFLOW_SCRATCHPAD.md — Faazio End-to-End dtype-alignment

> **Status:** LIVE control surface (repo root). Supersedes ad-hoc notes.
> Plan: "Faazio End-to-End Plan v2 — Mobile → Lean DB → Web → Go Chi Gateway".
> This file is the single live matrix; stop 6-doc drift. Update it as phases land.

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
| W7 | Web seller prescriptions page + endpoint | 4 | pending |
| W8 | Web seller bookings page + endpoint | 4 | pending |
| W9 | Web state blood moderation page + endpoint | 4 | pending |
| W10 | Web super SDUI publish page + endpoint | 4 | pending |
| W11 | `catalog.products` seller scope + status column | 1/2 | DB done (0015); gateway routes pending |
| W12 | `directory.stores` seller_id + state_code | 1/2 | DB done (0015); gateway routes pending |
| W13 | `checkout.orders` NEW→PACKED→SHIPPED→DELIVERED lifecycle | 1/2 | DB enum done (0015); gateway mapping pending |
| W14 | Real settlement ledger (no client-computed money) | 3 | **done** (server-only write) |
| W15 | Audit log durability (admins.audit_logs) | 3 | **done** |
| W16 | Payout records (payments.payouts) | 3 | **done** (admin-scheduled, invalidates cache) |

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

## 8. Web delta checklist

- [ ] `src/data/types.ts` dtype contract (guards, drop discountPercent/qualityScore)
- [ ] `src/lib/pricing/rules.ts` paisa-int math only
- [ ] `src/lib/media/productImages.ts` Storage-key flow
- [ ] `src/lib/api/store.ts` fetch-backed seam + snake↔camel mapper + auth header
- [ ] `src/lib/auth/permissions.ts` Supabase Auth + role claims
- [ ] 5 thin pages (prescriptions, bookings, blood, state bookings, sdui)

## 9. Gateway delta checklist

- [x] new contexts `sellers`, `promo`, `ads`, `settlement`, `support` (+ `admins` audit)
- [ ] extend `catalog` (status transitions + seller scope), `directory` (live flag + seller scope),
      `checkout` (NEW→PACKED→SHIPPED→DELIVERED + returns), `pharma` (fulfill), `blood`/`bookings`
      (moderate)
- [x] `platform/auth` role middleware (seller→own, state→state_code, super→all)
- [x] new cache keys/TTLs (`sellers`, `promo`, `ads`, `settlement`) + cache_test freeze
- [ ] tests: paisa roundtrip, rating clamp, qty/smallint reject, JSONB-size reject, RLS, idempotency

## 10. Decisions (approved)

- **qualityScore** → **DROP** from web (duplicates rating + reviews). No `quality_score` column.
- **order_status enum** → **Option A**: add `'NEW'`, `'PACKED'`, `'RETURNED'`; gateway maps mobile
  `Processing↔NEW/PACKED`. One lifecycle both apps read.
- **Scope** → approved: 5 new gateway contexts + 5 new web pages + additive `0015`.

## 11. Verify commands (run every phase)

```bash
# DB
docker compose up -d   # supabase local; apply 0001–0015 in order; seed 421 products/32 stores/32 orders
# Gateway
cd server/gateway && go build ./... && go vet ./... && go test ./... && go run ./tools/importlint
# Mobile + web
cd client/mobile && npm run ts:check && npm run check:boundaries
cd client/web    && npm run ts:check && npm run build
```

Dtype spot-checks: INSERT rating 4.666 → stored 4.7; qty 99999 → CHECK fail; `discountPercent`
column absent; `mock://` insert rejected; settlement client-write rejected; raw `user_id` in
`user_events` rejected by validator.