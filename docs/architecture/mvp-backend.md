# Faazio MVP Backend — Supabase + MongoDB + Aiven Valkey

> **Status:** MVP — ACTIVE (docs-first). The MVP backend is a **thin Go Chi gateway** over
> **Supabase (Postgres) + MongoDB Atlas M0 + Aiven Valkey**, with **Cloudflare** in front. It replaces
> the mocked `@mock` data per module (`@mock` → `@server`).
> The full microservices target — Rust/Tantivy search, CockroachDB, DynamoDB, per-service Postgres —
> is **Future Prod** and stays documented in `server/README.md`, `server-gateway-plan.md`, and
> `db-schema.md`.
> **No code yet.** This doc is the single authority for "which DB for what in the MVP"; the
> deep-dives keep the Future Prod spec.

---

## 1. MVP decision matrix

| Concern | MVP (now) | Future Prod (kept in docs) | Why |
|---|---|---|---|
| `catalog.products` master + search index | Supabase `catalog` schema + Postgres FTS (`tsvector` + `pg_trgm` GIN + `unaccent`, `search_tokens` generated col) | Cockroach `catalog.products` + Tantivy embedded | One Supabase project covers 4 DBs for MVP; Tantivy only pays off at high-QPS / flash-sale scale |
| `directory` / `accounts` / `checkout` / `reviews` | Supabase schemas `directory`, `accounts`, `checkout`, `reviews` in one project, RLS on | Cockroach (directory/accounts/checkout) + standalone Postgres (vendor_reviews) | The datatype policy (`db-schema.md` §2: INT8 paisa, slug IDs, TIMESTAMPTZ, ENUM) maps 1:1 to Postgres; split clusters later with zero contract change if slug IDs + `GatewayClient` shape stay stable |
| `stock` / `carts` / `reservations` / `pickup_points` | Supabase `inventory` schema + `SELECT … FOR UPDATE SKIP LOCKED`, `pg_cron` TTL sweep | DynamoDB / Firestore KV | Postgres locking is fine for MVP contention; Dynamo only at 1000s concurrent decrements |
| `user_events` / `recommendations` / `segments` / `product_stats` / `sdui_layouts` | Keep MongoDB Atlas M0 (ID-only, `userIdHash`, TTL 90d) | Same (no change) | Flexible doc shape + TTL; don't force into Postgres |
| Cache + edge | Keep **Aiven Valkey + Cloudflare** exactly per `caching-cloudflare-valkey.md` | Same | Supabase is origin, not cache; keys/TTLs unchanged (`faazio:v1:{service}:{entity}:{id}`, stock 30–60s, search 600s, product 24h, idempotency `NX EX 300`) |
| Gateway | Thin Go Chi: `GET /health`, `/search?q=`, `/sdui/home`, `/product/:id`, `/vendors/:id/reviews` → Supabase + Mongo + Valkey read-through, Cloudflare in front | Full gateway + 5 gRPC microservices via `contracts/` | Thin gateway proves the `@mock` → `@server` seam; `GatewayClient` method signatures don't change |
| Auth | Supabase Auth phone OTP + RLS (replaces mocked `authStore.login()`) | Same, hardened | Server sessions + per-user orders/carts/rating scoping now |

**Product images (recommendation):** serve from **Supabase Storage** (same project) with Cloudflare
caching in front; image URLs stay stable so `expo-image` call sites don't change. No separate CDN
bucket for the MVP.

---

## 2. Supabase project (one project, many schemas)

- **Schemas:** `catalog`, `directory`, `reviews`, `checkout`, `accounts`, `inventory`.
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
| **service-role only** | writes / stock mutations / admin | `inventory.stock` decrements, `checkout` writes, moderation |

- PII columns (`phone`/`email`/address/`user_id` linkage) are never exposed by anon/auth read policies.
- Never commit secrets; service-role key is server-side only.

---

## 3. Thin gateway (MVP) — endpoints

All read-through: Valkey → Supabase/Mongo → populate. Cloudflare caches public GETs.

| Method + path | Origin | `@data/*` mock twin | `GatewayClient` method |
|---|---|---|---|
| `GET /health` | — | — | — |
| `GET /search?q=&app=` | Supabase FTS `catalog.products_search` + `inventory.stock` | `data/catalog/products.ts` | `searchProducts` |
| `GET /sdui/home` | Mongo `sdui_layouts` + Supabase catalog/stores `getProductsByIds` | `data/home/sdui.ts` | `getHomeFeed` |
| `GET /product/:id` | Supabase `catalog.products` + `inventory.stock` + `reviews.reviews` | `data/catalog/products.ts` | `getProduct` |
| `GET /vendors/:id/reviews` | Supabase `reviews.vendor_reviews` (public columns only) | `data/reviews/vendorReviews.ts` | `getReviews` |
| `GET /stores`, `GET /store/:id` | Supabase `directory.stores` | `data/directory/stores.ts` | `getStores` / `getStore` |
| `GET /orders`, `GET /profile` | Supabase `checkout` / `accounts` (auth-scoped) | `data/checkout/orders.ts`, `data/accounts/profile.ts` | `getOrders` / `getProfile` |

No gRPC yet; `contracts/` stays a stub. Method signatures above keep the `@mock` → `@server` swap
call-site-compatible.

---

## 4. Cache + edge (unchanged)

Aiven Valkey + Cloudflare are **unchanged** — Supabase is the origin, not the cache. Key taxonomy,
TTL matrix, and invalidation event map stay in `caching-cloudflare-valkey.md`; that doc records the
MVP origin swap. No key/TTL change.

---

## 5. Tradeoffs (explicit)

- **FTS vs Tantivy:** Postgres FTS loses sub-ms + FAST ranking + fuzzy quality vs Tantivy; acceptable
  to ~100k–1M rows / few-hundred rps. Migration path: keep `id` slug, `searchTokens`, `price_paisa`
  INT8, `rating` stable → Tantivy becomes a pure index replica later.
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

## 7. Build order (when the build phase is approved — no code now)

1. `supabase/migrations/0001_mvp_schemas.sql` — schemas + extensions + tables ported from
   `db-schema.md` (slug public keys, INT8 paisa, `TIMESTAMPTZ`, ENUMs).
2. `supabase/migrations/0002_fts_search.sql` — `catalog.products_search` + GIN/btree indexes +
   `catalog.updated` refresh trigger.
3. `supabase/seed/` — import the `@data/*` twins (keep IDs identical for cache stability).
4. `server/gateway/` (thin Go Chi) — the endpoints in §3; `GET /health` first → Supabase/PostgREST/SQL
   + Mongo + Valkey read-through.
5. `client/mobile/src/services/api/GatewayClient.ts` — add `baseUrl` + flag; wire methods in the
   order in `data-layer-sdui.md`; keep `@data/*` fallback.
6. Verify from `client/mobile/`: `npm run ts:check`, `npm run check:boundaries`, `npm run check:drillin`.

---

## 8. Companion docs

- `server-gateway-plan.md` — future full microservices gateway plan (kept).
- `db-schema.md` — production table datatypes + sample rows (kept; MVP callouts per section).
- `caching-cloudflare-valkey.md` — cache layer (unchanged).
- `data-layer-sdui.md` — `@data/*` layer + `GatewayClient` wiring order.