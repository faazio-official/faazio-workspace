# Faazio DB Schema Bible

> **Status:** REFERENCE — Production implemented, scaling stage planned. This is the canonical, LLM-greppable
> reference for the microservice databases behind `server/`. It answers, for every table: *which
> microservice → which DB → which language → which schema → which datatype → which cache key → which
> admin queries*. All sample rows are derived from the **real `@data/*` fixtures** (provenance noted
> per row) — nothing is invented.
> **Implemented (production):** the DDL in §5–§8 ships as Postgres migrations under
> `server/supabase/migrations/` (schemas, INT8 paisa, `TIMESTAMPTZ`, ENUMs verbatim) with seed under
> `server/supabase/seed/`. The CockroachDB / Tantivy / DynamoDB targets remain **scaling-stage targets**.
>
> **Production vs scaling stage:** **production** (single authority: `docs/architecture/mvp-backend.md`)
> runs on **one Supabase (Postgres) project + MongoDB Atlas M0 + Aiven Valkey**. The CockroachDB /
> Tantivy / DynamoDB / per-service Postgres targets in this doc are **scaling-stage targets**. See the
> production mapping in §0.
> The DDL below stays copy-paste-ready (CockroachDB → Postgres is near-verbatim; the datatype policy §2
> is Postgres-compatible).
>
> **Scope / companion docs:** `server/README.md` (microservices plan), `docs/architecture/server-gateway-plan.md`
> (gateway plan), `docs/architecture/data-layer-sdui.md` (data layer + SDUI), `docs/architecture/caching-cloudflare-valkey.md`
> (cross-cutting cache layer). This doc is the schema authority those docs point to.

---

## 0. How to read this doc

Every table uses one identical 9-part template:

1. **DDL / BSON / field-definition block** (copy-paste-ready but **not executed** — plan only).
2. **Column table** — `name | type | bytes | why this type | indexed by`.
3. **5 sample rows** — exact values pulled from `@data/*` fixtures, with provenance.
4. **Access patterns** — the read/write queries the service runs.
5. **Cache key + TTL + invalidation** — pointer to `caching-cloudflare-valkey.md`.
6. **Admin notes** — PII flags, safe admin queries, keyset pagination, audit columns.

### Global conventions (id / money / time)

| Concern | Rule |
|---|---|
| Public IDs | Stable **string slugs** from the fixtures (`md-1`, `ph-c1`, `store-m3`, `user-1`, `addr_1`, `ORD-001`). These are the public/cache/CDN keys — stable across reindexes. |
| Relational PKs | INT8 (bigserial) or UUID where joins need them, in addition to the stable slug column. |
| Money | **INT8 paisa** (₹1 = 100). Never `FLOAT`/`DECIMAL`. Mongo: `int64`. |
| Timestamps | **TIMESTAMPTZ** (Cockroach), epoch-seconds INT8 (DynamoDB), Mongo `Date` (BSON int64 millis). |
| Enum-ish fields | Cockroach native **ENUM**; DynamoDB/Mongo 1-char codes with a documented mapping. |
| Ratings | `f64` (Tantivy FAST) / int32 `0–50` = rating×10 in KV stores. |
| Long text | Tantivy: indexed-but-NOT-stored (fetch from store on detail open). |
| Attributes/facets | Tantivy `json` field + DynamoDB sparse attributes. |
| Compression | **None** at DB/app layer — Cloudflare does gzip/zstd at the edge; Valkey values are plain JSON. |
| PII | Never at the edge; Valkey ACL-scoped keys; app-layer hashing where required; never logged. |

### Production mapping (read this first)

**Production** runs each production table below on **one Supabase (Postgres) project** + **MongoDB
Atlas M0** + **Aiven Valkey**; the CockroachDB / Tantivy / DynamoDB / standalone Postgres targets
specified in this doc are **scaling-stage targets**. Datatypes (§2) are unchanged — the policy is
Postgres-compatible.

| Production table (§) | Production origin | Scaling-stage DB |
|---|---|---|
| `catalog.products` + search (§5) | Supabase `catalog` + Postgres FTS `catalog.products_search` (`tsvector`/`pg_trgm`/`unaccent`) | CockroachDB + Tantivy |
| `inventory.*` stock/carts/reservations/pickup_points (§6) | Supabase `inventory` + `SELECT … FOR UPDATE SKIP LOCKED` + `pg_cron` TTL | DynamoDB / Firestore |
| `checkout.*`, `directory.*`, `reviews.*`, `accounts.*` (§7) | Supabase schemas `checkout`/`directory`/`reviews`/`accounts`, RLS on | CockroachDB + standalone Postgres |
| `recommendations.*` (§8) | MongoDB Atlas M0 (unchanged) | Same (no change) |
| Gateway (§4) | Thin Go Chi over Supabase + Mongo + Valkey | Full gateway + gRPC microservices |

Full production matrix, RLS classes, and endpoints: `docs/architecture/mvp-backend.md`.

---

## 1. Service ⇄ Database ⇄ Language master matrix

| # | Service | Language | Database | DB role | Deploy spec | Talks to |
|---|---|---|---|---|---|---|
| 1 | Gateway | Go Chi | — (stateless) + Valkey/CDN cache | no durable DB | 0.25 vCPU / 256 MB | app ↔ all services |
| 2 | Search & Catalog | Rust (Axum + Tantivy) | Tantivy (embedded) + CockroachDB `catalog` master | index + sync source | 0.5 vCPU / 512 MB | gateway, checkout |
| 3 | Cart & Stock | Go | DynamoDB (Firestore alt) | KV store | 0.5 vCPU / 256 MB | gateway, checkout |
| 4 | Checkout & Orders | Go | CockroachDB | relational (orders + catalog master + accounts) | 0.25 vCPU / 256 MB | gateway, cart, search, recommendations, reviews |
| 5 | Reviews & Ratings | Go | PostgreSQL | relational (vendor reviews + eligibility) | 0.25 vCPU / 256 MB | gateway, checkout |
| 6 | Recommendations | Python (FastAPI) | MongoDB | doc store (events, layout) | 1 vCPU / 1 GB | gateway |

Communication is always **gRPC** service-to-service through `contracts/`; the gateway is the only
public HTTPS/JSON surface. Every `@mock` entry in `data/DATA_CONTROL.md` maps to a handler contract.

---

## 2. Global datatype policy

| Concern | Decision | Rationale (speed + space, no per-read CPU tax) |
|---|---|---|
| Money | INT8 paisa, never FLOAT/DECIMAL | 8 B vs DECIMAL(12,2)'s 12–16 B; no drift; no parse cost. Mongo: `int64`. |
| IDs | Stable string slugs (public/cache keys) + INT8/UUID numeric PKs where joins need them | Slugs keep CDN URLs + Valkey keys stable; UUID 16 B vs 36-char STRING. |
| Timestamps | TIMESTAMPTZ (Cockroach), epoch-seconds INT8 (DynamoDB), Mongo `Date`/int64 | Fixed width, no ISO-string bloat (24+ B → 8 B). |
| Enum-ish fields | Cockroach ENUM; DynamoDB/Mongo 1-char codes + mapping table | 1–4 B + free validation. |
| Ratings | `f64` (Tantivy FAST) / int32 0–50 (rating×10) in KV | FAST field for sort; ×10 int saves BSON bytes. |
| Long text | Indexed-but-NOT-stored in Tantivy | Inverted index stays small; detail is a separate cached request. |
| Attributes/facets | Tantivy `json` + DynamoDB sparse attributes | Faceting without a join table. |
| Compression | None at DB/app layer; Cloudflare gzip/zstd at edge; Valkey plain JSON | No decrypt/decompress tax per request. |
| PII | Never at edge; Valkey ACL-scoped keys; app-layer hashing; never logged | AGENTS.md security mandate. |

**Production narrowing (migrations `0004`–`0006`).** The Postgres production schema applies a byte diet on top of this
policy without changing any wire shape: `catalog.products.rating` → `real` (1-decimal), `rating`
counts/`reviews_count`/`in_stock_qty` → `int4`, `qty` on `checkout.order_items` /
`inventory.stock_reservations` → `smallint`, and the dead `catalog.products.slug_uid` column plus the
`products_name_trgm_idx` trigram index are dropped. **Money stays INT8** (`INT4` paisa caps at ₹21M —
unsafe for order/cart totals and breaks CockroachDB parity). `TIMESTAMPTZ`, ENUMs, slug PKs, and the
`search_vec` STORED column + FTS GIN are unchanged.

---

## 3. Data flow: `@data/*` mock tables ↔ production tables

The normalized microservice tables in `data/` are the **mock twins** of the production tables below.
Traceability is 1:1 — each production table documents its `@data/*` source.

| Production table (this doc) | `@data/*` mock twin | Production DB |
|---|---|---|
| `catalog.products` (master) | `data/catalog/products.ts` `catalogIndex` | CockroachDB |
| Tantivy index (search) | `data/catalog/products.ts` (tokenized) | Tantivy |
| `directory.stores` | `data/directory/stores.ts` `storeDirectory` | CockroachDB (PostgreSQL-shaped) |
| `reviews.reviews` / `reviews.specs` / `reviews.highlights` | `data/reviews/reviews.ts` | CockroachDB (PostgreSQL-shaped) |
| `directory.vendors` / `reviews.vendor_reviews` | `data/directory/vendors.ts`, `data/reviews/vendorReviews.ts` | PostgreSQL |
| `inventory.stock` / `carts` / `reservations` / `pickup_points` | `data/inventory/stock.ts`, `data/cart/*` | DynamoDB |
| `checkout.*` (users/addresses/coupons/orders/order_items/payments/events) | `data/checkout/orders.ts` | CockroachDB |
| `accounts.*` (profile/membership/order_status/nav/details) | `data/accounts/profile.ts` | CockroachDB (PostgreSQL-shaped) |
| `recommendations.*` (sdui_layouts/user_events/recommendations/product_stats; segments scaling-stage) | `data/home/sdui.ts` | MongoDB |

> **Ownership note:** `catalog.*`, `directory.*`, `reviews.*`, and `accounts.*` physically live in the
> same CockroachDB cluster as `checkout.*`, but each is owned by a distinct logical schema (documented
> per section). The Search service **reads** `catalog.products` and syncs it into Tantivy.

---

## 4. Service 1 — Gateway (Go Chi): stateless SDUI compiler

**Database:** none (by design). The gateway is a **stateless compiler**: it reads the SDUI render tree
definition (mirroring `data/schema.ts`), joins downstream services over gRPC, and emits compiled
`SDUINode` trees cached at the Cloudflare edge + Valkey. It holds **no durable state**; sessions are
stateless JWT (Valkey-scoped, see cache doc).

**Contract it serves:** the `SDUINode` union from `data/schema.ts` (`Rail`, `Section`, `ProductCard`,
`StoreCard`, `Banner`, `Portal`, `CategoryGrid`, `CategoryPill`, `SearchBar`, `EmptyState`,
`DetailHero`, `DetailBody`, `DetailFooter`, `StepperRow`, `ReviewRow`, `RatingBreakdown`,
`CheckoutStep`, `AdBanner`, `SponsoredCard`).

**Access patterns:** on request → compile → return; no DB reads/writes. Compiled-tree cache:
`faazio:v1:gateway:sdui:{locale}:{path}` (TTL 300 s + SWR 60 s at edge).

**Admin notes:** no PII, no durable rows. Invalidate the gateway/catalog SDUI keys on any
`catalog.updated` / `layout.updated` event.

---

## 5. Service 2 — Search & Catalog (Rust · Axum + Tantivy)

> **Production:** Supabase `catalog.products` + Postgres FTS `catalog.products_search` (`tsvector` +
> `pg_trgm` GIN + `unaccent`, `search_tokens` generated col) replace the Tantivy index. The Tantivy spec
> below is the **scaling stage**; the datatypes here stay.

### 5.1 CockroachDB master: `catalog.products` (owned by Checkout schema, read by Search)

DDL (plan — **not executed**):

```sql
CREATE TYPE app_brand AS ENUM ('MART','FOOD','PHARMA');

CREATE TABLE catalog.products (
  id            TEXT PRIMARY KEY,            -- stable slug, e.g. 'md-1'
  app           app_brand NOT NULL,
  category      TEXT NOT NULL,
  name          TEXT NOT NULL,
  search_tokens TEXT[] NOT NULL DEFAULT '{}',
  price_paisa   INT8 NOT NULL,               -- money as paisa (₹1 = 100)
  mrp_paisa     INT8,                        -- optional original price
  rating        REAL NOT NULL DEFAULT 0,     -- 0..5, 1-decimal (0005; scaling stage f64/FAST)
  reviews_count INT4 NOT NULL DEFAULT 0,
  emoji         TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  desc_text     TEXT NOT NULL,               -- indexed in Tantivy, not here
  badge         TEXT,
  shop          TEXT,
  unit          TEXT,
  attributes    JSONB,                        -- sparse facets
  store_id      TEXT REFERENCES directory.stores(id),
  is_prescription BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Bytes | Why this type | Indexed by |
|---|---|---|---|---|
| `id` | TEXT PK | ~4–8 | stable slug public key | PK, hash index |
| `app` | ENUM | 1–4 | validation + filtering | partial index `(app)` |
| `category` | TEXT | ~12 | grouping | btree |
| `name` | TEXT | ~24 | display | — |
| `search_tokens` | TEXT[] | var | Tantivy source | — |
| `price_paisa` | INT8 | 8 | money as paisa | btree (price sort/filter) |
| `mrp_paisa` | INT8 | 8 | optional original | — |
| `rating` | REAL | 4 | sort | btree desc |
| `reviews_count` | INT4 | 4 | sort | — |
| `emoji` / `image_url` | TEXT | var | display | — |
| `desc_text` | TEXT | var | detail page (Tantivy NOT-stored) — **not fetched by list/search reads** | — |
| `badge`/`shop`/`unit` | TEXT | var | display | — |
| `attributes` | JSONB | var | facets — **not fetched by list/search reads** | GIN |
| `store_id` | TEXT | ~8 | FK to stores | btree |
| `is_prescription` | BOOL | 1 | pharma gating | — |
| `created_at`/`updated_at` | TIMESTAMPTZ | 8 each | audit | — |

**Read projections:** product **detail** (`catalog/repo.go` `ByID`) selects the full row; **list,
search, and batch/SDUI** reads use a slim projection (`productListSelect`) that substitutes constant
placeholders for `desc_text`/`attributes`/`shop`, so those TOAST-able bytes never leave Postgres and
the Valkey `search:q:*` value shrinks with it.

**5 sample rows** (provenance: `data/catalog/products.ts` `catalogIndex` → `data/mart/products.ts`,
`data/pharma/products.ts`):

| id | app | category | name | price_paisa | mrp_paisa | rating | reviews_count | store_id |
|---|---|---|---|---|---|---|---|---|
| `fm-f1` | MART | Fashion | Premium Cotton Hoodie | 149900 | 199900 | 4.8 | 245 | store-m3 |
| `gr-p7` | MART | Beverages | Arabica Coffee Beans Medium | 45000 | 58000 | 4.9 | 360 | store-g1 |
| `fm-m1` | MART | Mobiles | Faazio Phone Pro Max | 8999900 | 10999900 | 4.9 | 1420 | store-m1 |
| `ph-c1` | PHARMA | (cough) | (see pharma fixture) | — | — | — | — | store-p1 |
| `sp-1` | FOOD | (biryani) | Hyderabadi Mutton Biryani | 49900 | — | — | — | (food store) |

> Provenance detail: `ph-c1`, `sp-1` map to `data/pharma/products.ts` / `data/food/products.ts`
> respectively — the doc samples `fm-f1`/`gr-p7`/`fm-m1` exactly; the remaining two are placeholders
> pointing to their fixture files (values stable there, not repeated here to avoid drift).

### 5.2 Tantivy index (the actual search engine)

Field-by-field schema with Tantivy flags:

| Field | Tantivy type | STORED | INDEXED | FAST | Why |
|---|---|---|---|---|---|
| `id` | text (raw) | ✅ | — | — | retrieve document → store lookup |
| `name` | text | ✅ | ✅ | — | display + prefix autocomplete |
| `search_tokens` | text (tokenized) | — | ✅ | — | full-text match |
| `category` | text (raw) | ✅ | ✅ | ✅ | facet + filter |
| `app` | text (raw) | — | ✅ | — | filter |
| `price_paisa` | u64 | ✅ | ✅ | ✅ | range filter + sort |
| `rating` | f64 | — | — | ✅ | sort (FAST for ranking) |
| `reviews_count` | u64 | — | — | ✅ | sort |
| `attributes` | json | — | ✅ | — | dynamic facets |
| `desc_text` | text | — | ✅ | — | indexed NOT stored; fetch from store |

**Access patterns:** search/autocomplete/suggest on `name`/`search_tokens`; facet counts via
`category`/`app`/`attributes`; sort by `rating`/`price`/`reviews_count`. **Not** used as source of
truth — the durable master is `catalog.products`.

**Rehydration contract:** on `catalog.updated` (Pub/Sub) → reindex the changed `id`; full rebuild via
`catalog.products` scan on deploy. Cache: `faazio:v1:search:q:{query}:{filters}` (TTL 600 s + SWR at edge).

**Admin notes:** no PII. Admin queries: `getCatalogEntryById`, facet counts per `category`, top-rated
(FAST `rating`). Tantivy has no per-doc audit — audit columns live in `catalog.products`.

---

## 6. Service 3 — Cart & Stock (Go · DynamoDB — Firestore mapping)

> **Production:** Supabase `inventory` schema; atomic decrement via `SELECT … FOR UPDATE SKIP LOCKED`,
> TTL sweep via `pg_cron` (replaces DynamoDB condition expressions + TTL). The DynamoDB/Firestore
> mapping below is the **scaling stage**.

**Tables:** `carts`, `stock`, `stock_reservations` (TTL), `pickup_points`. Key-value design.

### 6.1 `stock` — one row per catalog product id

DynamoDB item schema (`data/inventory/stock.ts` `stockTable`):

| Attribute | Type | Why | Index |
|---|---|---|---|
| `productId` (PK) | S | stable slug | partition key |
| `available` | BOOL | ~85% in stock | — |
| `inStockQty` | N | deterministic `hashSeed % 40 + 1` | — |
| `pricePaisa` | N | `price × (1 − discount)` | — |
| `mrpPaisa` | N | optional original | — |
| `eta` | S | `'25-30 min'`/`'45 min'`/`'1-2 days'` | — |
| `isPrescription` | BOOL (sparse) | pharma only | — |
| `updatedAt` | N (epoch s) | freshness | — |

**5 sample rows** — derived by applying the `hashSeed(id)` algorithm from `data/inventory/stock.ts`
(deterministic across reloads):

| productId | available | inStockQty | pricePaisa | mrpPaisa | eta | isPrescription |
|---|---|---|---|---|---|---|
| `fm-f1` | true | (hashSeed) | (computed) | 199900 | 1-2 days | — |
| `gr-p7` | true | (hashSeed) | (computed) | 58000 | 1-2 days | — |
| `fm-m1` | true | (hashSeed) | (computed) | 10999900 | 1-2 days | — |
| `sp-1` | true | (hashSeed) | (computed) | — | 25-30 min | — |
| `ph-c1` | (seed%7!=0) | (hashSeed) | (computed) | — | 45 min | — (category `cough` ∉ prescription set) |

> These values are **derived** (not hand-copied): `hashSeed` is `h = h*31 + charCode`, then
> `inStockQty = seed%40 + 1`, `available = seed%7 !== 0`, `discount = seed%30`, `price = round(price*(1-d/100))`.
> The exact numbers are reproducible at build time; the doc states the algorithm rather than 5
> hardcoded hashes to avoid drift.

### 6.2 `carts`

| Attribute | Type | Why |
|---|---|---|
| `cartId` (PK) | S | session/user-scoped |
| `userId` | S (GSI) | fetch all carts by user |
| `items` | L (list of `{productId, qty}`) | one doc per cart |
| `updatedAt` | N | TTL/expiry |

**Atomic decrement (stock)** — DynamoDB **condition expressions**: `SET inStockQty = inStockQty - :q
WHERE inStockQty >= :q` on `stock`, and an idempotency token on `carts` to prevent double-add.

### 6.3 `stock_reservations` (TTL)

| Attribute | Type | Why |
|---|---|---|
| `reservationId` (PK) | S | UUID |
| `cartId` | S | link |
| `productId` / `qty` | S / N | reserved units |
| `expiresAt` | N (epoch s) | DynamoDB **TTL** auto-delete (~15 min) |

### 6.4 `pickup_points`

Sources: `data/cart/pickup-resolver.ts` (`NEUTRAL_PICKUP` + per-store points from
`data/directory/stores.ts` `address`/`phone`/`hours`).

| Attribute | Type | Why |
|---|---|---|
| `pointId` (PK) | S | `store-*` or `pickup-neutral` |
| `storeId` | S | nullable (neutral hub has none) |
| `name` / `address` / `phone` / `hours` | S | display + contact |
| `isActive` | BOOL | availability |

**Firestore mapping column:** if Firestore (Datastore mode) is chosen instead of DynamoDB, each item
above maps to a Firestore document with the same fields; composite indexes replace GSIs.

**Access patterns:** `getStockByProductId`, `getStockByProductIds`, atomic decrement, TTL reservation
release, pickup resolution per store. **Cache:** `faazio:v1:stock:{productId}` (TTL 30–60 s);
**never cache** `carts` (auth-scoped). Invalidation: on stock decrement / reservation commit.

**Admin notes:** no PII in `stock`/`pickup_points`; `carts` carries user linkage (protect). Admin
queries: low-stock scan, pickup-point list.

---

## 7. Service 4 — Checkout & Orders (Go · CockroachDB)

> **Production:** the `checkout`, `directory`, `reviews`, and `accounts` schemas all live in the one
> Supabase project (RLS on); the CockroachDB + standalone Postgres split below is the **scaling stage**.
> DDL is Postgres-compatible.

**One DB, three logical schemas** (all ownership-annotated): `checkout` (primary owner), `catalog`
(documented in §5 — physical home), `accounts` (§8), `directory` (§7.5), `reviews` (§7.6).

### 7.1 `checkout.users` — source `data/checkout/orders.ts` `usersTable`, `data/accounts/profile.ts`

```sql
CREATE TYPE fulfillment_mode AS ENUM ('DELIVERY','PICKUP');
CREATE TYPE order_status   AS ENUM ('Processing','Shipped','Delivered','Cancelled');

CREATE TABLE checkout.users (
  user_id          TEXT PRIMARY KEY,        -- 'user-1'
  user_uid         UUID NOT NULL DEFAULT gen_random_uuid(),
  auth_uid         TEXT UNIQUE,             -- verified auth subject: Firebase UID (0031); legacy Supabase auth.uid()
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,           -- PII
  default_address_id TEXT REFERENCES checkout.addresses(address_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ,             -- set by the first authenticated OTP call (0030)
  deleted_at       TIMESTAMPTZ              -- set by DELETE /users/me; PII blanked, auth_uid unlinked (0060)
);
```

| Column | Type | Bytes | Why | Index |
|---|---|---|---|---|
| `user_id` | TEXT PK | 6 | stable slug (OTP users get `u-<sha256 prefix>`) | PK |
| `user_uid` | UUID | 16 | join key | btree |
| `auth_uid` | TEXT | 28 | verified auth subject (Firebase UID) → app user; upserted on first authenticated call (`0031` widens the original UUID column) | unique |
| `name` | TEXT | ~12 | display | — |
| `email` | TEXT | ~24 | contact (**PII**) | unique btree |
| `phone` | TEXT | ~14 | contact (**PII**) | unique btree |
| `default_address_id` | TEXT | 6 | FK | btree |
| `created_at` | TIMESTAMPTZ | 8 | audit | — |
| `last_login_at` | TIMESTAMPTZ | 8 | ops visibility of real sessions | — |
| `deleted_at` | TIMESTAMPTZ | 8 | account-deletion tombstone (`0060`); PII blanked + `auth_uid` unlinked, financial rows retained | partial (`deleted_at IS NOT NULL`) |

`ProvisionUserID` (first authenticated OTP call) upserts this row **and** forward-fills the matching
`accounts.profile` row (`id = account_id = user_id`, real phone/email only) so the app never renders
the `@data` profile fixture for a signed-in user. `GET /profile` also falls back to this row for
users provisioned before that write existed.

**Account deletion (`0060`):** `DELETE /users/me` does not hard-delete this row (the non-cascading
`checkout.addresses`/`orders`/`payments` FKs and the legal-retention requirement forbid it). It
erases the PII tables (addresses, carts, favourites, prescriptions, rewards, blood, notifications,
accounts.*), blanks free-text `support.tickets` subject/body, `checkout.returns.reason` and review
comments, clears retained `checkout.orders` delivery coordinates plus DROP-stop coordinates/OTP,
deletes prescription blobs from the active storage backend (R2 or Supabase Storage), sets `name` to
`Deleted user`, blanks `phone`, writes a non-routable
`deleted+<id>@deleted.invalid` email, nulls `auth_uid`/`last_login_at`, and stamps `deleted_at`.
Order/payment/tax rows survive, linked only to the anonymised row. A later login provisions a fresh
account under a new deterministic id with a random suffix, so the anonymised row is never revived.

**Sample row:** `user-1` · Rohit Sharma · rohit.sharma@gmail.com · +91 98765 43210 · addr_1
(provenance `data/checkout/orders.ts:20-22`).

### 7.2 `checkout.addresses` — source `data/checkout/orders.ts` `addressesTable` + `data/account/addresses.ts`

```sql
CREATE TABLE checkout.addresses (
  address_id TEXT PRIMARY KEY,       -- 'addr_1','addr_2','addr_3','addr-1','addr-2'
  user_id    TEXT NOT NULL REFERENCES checkout.users(user_id),
  label      TEXT NOT NULL,          -- 'HOME','WORK','OTHER','Greenwood',...
  name       TEXT,                   -- PII
  phone      TEXT,                   -- PII
  address    TEXT NOT NULL,          -- PII (full street)
  is_default BOOLEAN NOT NULL DEFAULT false
);
```

**Sample rows** (`data/account/addresses.ts:8-29`):

| address_id | user_id | label | name | phone | is_default |
|---|---|---|---|---|---|
| `addr_1` | user-1 | HOME | Rohit Sharma | +91 98765 43210 | true |
| `addr_2` | user-1 | WORK | Rohit Sharma | +91 98765 43210 | false |
| `addr_3` | user-1 | OTHER | Rohit Sharma | +91 98765 43210 | false |

**Admin notes:** **PII** — never log full address; keyset paginate by `address_id`; redact phone.

### 7.3 `checkout.coupons` — **legacy, unseeded** (superseded by `promo.coupons`, §12.13)

> **Superseded (`0021`/W29):** the app's public coupon read now targets `promo.coupons`
> (`GET /coupons`); no gateway repo reads `checkout.coupons`, so it is no longer seeded. The table and
> its `anon` read policy remain for the historical `0001` contract only. The coupon fixture
> (`data/cart/coupons.ts`) seeds `promo.coupons` via `seed/generate.mjs`.

```sql
CREATE TABLE checkout.coupons (
  code            TEXT PRIMARY KEY,      -- 'FAAZIO20'
  discount_percent INT8 NOT NULL DEFAULT 0,
  label           TEXT NOT NULL,
  min_order_paisa INT8,                  -- optional min order
  is_free_delivery BOOLEAN NOT NULL DEFAULT false
);
```

| code | discount_percent | label | min_order_paisa | is_free_delivery |
|---|---|---|---|---|
| `FAAZIO20` | 20 | FAAZIO20 | 49900 | false |
| `SUPER50` | 50 | SUPER50 | 99900 | false |
| `FREESHIP` | 0 | FREE Delivery | 50000 | true |
| `MART30` | 30 | MART30 | 79900 | false |
| `WELCOME15` | 15 | WELCOME15 | 29900 | false |

(provenance `data/cart/coupons.ts:8-12`).

### 7.4 `checkout.orders` + `checkout.order_items` — source `data/checkout/orders.ts` `ordersTable`

```sql
CREATE TABLE checkout.orders (
  order_id     TEXT PRIMARY KEY,       -- '1','2','ORD-001',...
  order_number TEXT NOT NULL,          -- '#ORD123456789'
  user_id      TEXT NOT NULL REFERENCES checkout.users(user_id),
  address_id   TEXT REFERENCES checkout.addresses(address_id),
  placed_at    TIMESTAMPTZ NOT NULL,   -- parsed from '06 May 2025 • 11:30 AM'
  status       order_status NOT NULL,
  status_date  TIMESTAMPTZ,
  fulfillment  fulfillment_mode,      -- NULL = delivery
  total_paisa  INT8 NOT NULL,          -- derived
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checkout.order_items (
  line_id      TEXT PRIMARY KEY,      -- '1-l1','past-0-l1'
  order_id     TEXT NOT NULL REFERENCES checkout.orders(order_id),
  product_id   TEXT,                  -- nullable, links to catalog
  name         TEXT NOT NULL,
  variant      TEXT,
  qty          SMALLINT NOT NULL,     -- app caps qty at 99 (0005)
  unit_price_paisa INT8 NOT NULL
);
```

**Drop coordinates (0044):** `checkout.orders` also carries nullable
`delivery_latitude` / `delivery_longitude` (float8, range-checked), filled from the app's live fix at
placement for `DELIVERY` orders. They are internal (never returned in the order projection) and feed
order-ready auto-dispatch; null means no fix and the order stays on the admin assignment path.
Self-pickup orders leave them null.

**Access patterns:** `getOrdersByUser(userId)`, My Orders list, order detail by `order_id`, status
filter. **Keyset pagination index:** `(user_id, placed_at DESC)` for cursor-based order history.
`POST /orders` is idempotent: a durable `checkout.idempotency_keys (user_id, key) → order_id` record
written in the same transaction lets a retry return the original order; the server also derives the
total from `catalog.products` snapshots and verifies the address belongs to the caller.

**Sample orders** (`data/account/orders.ts:22-35,123-137`):

| order_id | order_number | user_id | status | fulfillment | placed_at |
|---|---|---|---|---|---|
| `1` | #ORD123456789 | user-1 | Delivered | (delivery) | 06 May 2025 |
| `4` | #ORD123456786 | user-1 | Shipped | PICKUP | 05 May 2025 |
| `5` | #ORD123456785 | user-1 | Processing | (delivery) | 05 May 2025 |
| `7` | #ORD123456783 | user-1 | Cancelled | (delivery) | 03 May 2025 |
| `ORD-001` | (past) | user-1 | Delivered | (delivery) | 12 Jul 2026 |

**Line items** (`1` → Arabica Coffee Beans Medium · 250g · qty 1 · ₹450; `4` → Digital Touch Air
Fryer 5L · 5 L · qty 1 · ₹5499; `5` → Antiseptic Cream 30g · 30g · qty 2 · ₹120; `7` → Cooling Pain
Relief Balm · 30g · qty 1 · ₹135).

**Cache:** orders are **auth-scoped → never at edge**; short Valkey TTL (`faazio:v1:checkout:orders:{userId}`
TTL 60 s) invalidated on order write.

**Admin notes:** orders carry PII (user + address) — redact; audit `created_at`/`status_date`; financial
consistency via CockroachDB transactions + idempotency (see cache doc §7).

### 7.5 `directory.stores` — source `data/directory/stores.ts` `storeDirectory`

```sql
CREATE TABLE directory.stores (
  id            TEXT PRIMARY KEY,     -- 'store-m3','store-g1','store-p1'
  app           app_brand NOT NULL,
  name          TEXT NOT NULL,
  categories    TEXT[] NOT NULL,
  rating        FLOAT8 NOT NULL,
  reviews_count INT4 NOT NULL DEFAULT 0,
  delivery_time TEXT NOT NULL,
  distance      TEXT NOT NULL,
  cover_image   TEXT NOT NULL,
  emoji         TEXT NOT NULL,
  desc_text     TEXT NOT NULL,
  offer_tag     TEXT,
  is_veg        BOOLEAN,
  address       TEXT,                 -- PII (physical)
  phone         TEXT,                 -- PII
  hours         TEXT,
  latitude      FLOAT8,               -- 0041 public store pin
  longitude     FLOAT8
);
-- 0041: partial geo indexes for the bounding-box prefilter.
CREATE INDEX stores_geo_idx ON directory.stores (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

**Sample rows** (`data/mart/stores.ts:8,18`):

| id | app | name | rating | reviews_count | distance | is_veg |
|---|---|---|---|---|---|---|
| `store-m1` | MART | Darling Mobiles | 4.9 | 1240 | 1.8 km | — |
| `store-m3` | MART | Thread Labs Studio | 4.9 | 2150 | 3.1 km | — |
| `store-g1` | MART | Faazio Mart Freshmart | 4.8 | 2200 | 1.1 km | true |
| `store-m7` | MART | SmartHome Emporium | 4.9 | 1120 | 4.5 km | — |
| `store-m13` | MART | Faazio Mart Freshmart Plus | 4.7 | 1340 | 2.7 km | true |

**Cache:** `faazio:v1:directory:store:{id}` (TTL 24 h). **Admin:** `address`/`phone` are PII —
redact. The **list** endpoint (`GET /stores`) reads a PII-free projection (`storeListSelect`, address
and phone never selected) and paginates by `(app, rating DESC, id ASC)` via
`stores_app_rating_id_idx`; only detail (`GET /store/:id`) reads the full row.
`GET /stores/nearby` reads the same PII-free projection, prefilters with `stores_geo_idx` and orders
by Haversine distance (server-computed `distanceKm`).

### 7.6 `reviews.reviews` / `reviews.specs` / `reviews.highlights` — source `data/reviews/reviews.ts`

```sql
CREATE TABLE reviews.reviews (
  id         TEXT PRIMARY KEY,      -- 'rev-1','rev-m1','rev-p1'
  product_id TEXT NOT NULL,
  app        app_brand NOT NULL,
  user       TEXT NOT NULL,          -- reviewer name (PII-ish)
  avatar     TEXT,
  rating     INT8 NOT NULL,          -- 0..5
  comment    TEXT NOT NULL,
  date       TEXT NOT NULL
);
```

**Sample rows** (`data/productMeta/reviews.ts:22-37` → attached to representative product ids
`rvf-1`/`rvm-1`/`rvp-1`):

| id | product_id | app | user | rating | comment |
|---|---|---|---|---|---|
| `rev-1` | rvf-1 | FOOD | Aarav Sharma | 5 | Absolutely delicious! … |
| `rev-m1` | rvm-1 | MART | Ananya Gupta | 5 | Amazing quality! … |
| `rev-p1` | rvp-1 | PHARMA | Dr. Sarah Alvi | 5 | Genuine pharmaceutical products … |

`reviews.specs`: `id, app, label, value` (`data/reviews/reviews.ts` `specsTable`);
`reviews.highlights`: `id, app, text`. **Cache:** `faazio:v1:reviews:product:{id}` (TTL 24 h).
**Pagination:** `GET /product/:id/reviews` is keyset-bounded (`limit` ≤ 200, default 50) over
`reviews_product_created_idx (product_id, created_at DESC, id ASC)` — no unbounded scan.
**Admin:** reviewer `user`/`avatar` — treat as PII; moderation queries by `product_id`.

### 7.7 `directory.vendors` / `reviews.vendor_reviews` — source `data/directory/vendors.ts`, `data/reviews/vendorReviews.ts`

A **vendor** is a ratable place: a Mart/Pharma store (`directory.stores`) or a Food
restaurant venue. `directory.vendors` is a derived identity view (ids + names only); the
full food venue-data migration is a separate task.

```sql
-- Derived view: stores + restaurant venues, identity only.
CREATE VIEW directory.vendors AS
  SELECT id, app, name FROM directory.stores
  UNION ALL
  SELECT id, 'FOOD'::app_brand, name FROM directory.dining_venues;

CREATE TABLE reviews.vendor_reviews (
  id          TEXT PRIMARY KEY,        -- 'vr-g1-1'
  vendor_id   TEXT NOT NULL,           -- → directory.vendors.id
  app         app_brand NOT NULL,
  user_id     TEXT NOT NULL,           -- author (PII linkage — never public)
  user_name   TEXT NOT NULL,           -- public display name only
  rating      INT8 NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,                    -- optional, <= 280 chars
  order_ids   TEXT[] NOT NULL DEFAULT '{}', -- verified-purchase provenance (never public)
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (vendor_id, user_id)          -- one live rating per (user, vendor), latest wins
);
```

**Eligibility — derived, never a stored flag** (the exact phase-1 gate; the server
later tightens `status <> 'Cancelled'` to `status = 'Delivered'`):

```sql
SELECT EXISTS (
  SELECT 1 FROM checkout.orders o
  WHERE o.user_id = $1
    AND o.status <> 'Cancelled'
    AND $2 = ANY (o.vendor_store_ids)   -- vendor identity snapshot taken at placement
);
```

`checkout.orders` carries `vendor_store_ids TEXT[]` (snapshot of
`PlacedOrder.storeIds` / `OrderRow.vendorStoreIds`), so old orders keep resolving to
the same vendor. The gate is permanently true for a `(user, vendor)` pair once it
exists ("old customer keeps the ability").

**O(1) rating aggregate (migration 0004).** `GET /vendors/:id/reviews/summary` reads a
trigger-maintained counter row instead of a per-request `GROUP BY`:

```sql
CREATE TABLE reviews.vendor_summary (
  vendor_id     TEXT PRIMARY KEY,
  rating_sum    INT8 NOT NULL DEFAULT 0,
  reviews_count INT8 NOT NULL DEFAULT 0,
  star1 INT4 NOT NULL DEFAULT 0, star2 INT4 NOT NULL DEFAULT 0, star3 INT4 NOT NULL DEFAULT 0,
  star4 INT4 NOT NULL DEFAULT 0, star5 INT4 NOT NULL DEFAULT 0
);
-- reviews.vendor_reviews AFTER INSERT/UPDATE/DELETE keeps it in sync (reviews.sync_vendor_summary).
```

The five `starN` counters exist because the client renders a 5-star distribution. This is kept
separate from `directory.stores.rating` (the fixture/catalog rating used by the `/stores` sort).
`VendorApp` resolves a vendor's brand with two indexed PK lookups (`directory.stores`, then
`directory.dining_venues`) instead of scanning the `directory.vendors` UNION ALL view.

**Sample rows** (provenance `data/reviews/vendorReviews.ts`):

| id | vendor_id | app | user_name | rating | comment |
|---|---|---|---|---|---|
| `vr-g1-1` | `store-g1` | MART | Pooja Nair | 5 | Fresh produce every single time… |
| `vr-p1-1` | `store-p1` | PHARMA | Dr. Sarah Alvi | 5 | Genuine medicines with clear expiry dates… |
| `vr-f3-1` | `store-f3` | FOOD | Aarav Sharma | 5 | Smash burgers were juicy… |
| `vr-dn12-1` | `dn-12` | FOOD | Priya Patel | 5 | Best Hyderabadi biryani in the city… |

**Cache:** `faazio:v1:reviews:vendor:{id}` (TTL 24 h) for the public list/summary;
the signed-in user's own rating is auth-scoped and **never** edge-cached.
**Admin:** `user_id`/`order_ids` are PII linkage and are never rendered publicly;
public output exposes `user_name`, `rating`, `comment` only. Moderation queries by
`vendor_id`. Nothing rating-related is ever logged.

---

## 8. Service 6 — Recommendations (Python · FastAPI + MongoDB)

> **Production:** MongoDB Atlas M0 is kept **as-is** (no change); the Python service is the scaling
> stage — the Go gateway reads `sdui_layouts` directly (ID-only) until then.

**Collections:** `user_events` (TTL), `recommendations`, `segments`, `product_stats`, `sdui_layouts`.

### 8.1 `sdui_layouts` — absorbs `data/home/sdui.ts` (ID-only doc tree)

The Home feed is stored as **ID-only** documents — every leaf references `catalog.products` /
`directory.stores` ids rather than embedding product data (exactly the `SduiSection` design in
`data/home/sdui.ts`). The Go gateway compiles these into `SDUINode` trees.

```js
// Mongo collection: sdui_layouts
{
  _id: 'home',                       // the single live layout (per locale/env)
  version: 7,                        // version prefix for cache keys + purge
  sections: [
    { id: 'martHero', title: 'Mart Highlights', accent: '#F25C3D', productIds: [],
      banners: [{ id: 'hb-1', title: 'Big Savings Everyday', subtitle: 'UP TO 50% OFF',
                  accent: '#FFF8D6', imageUrl: 'https://…/hb1.jpg' }] },   // Mart hero carousel
    { id: 'foodHero', title: 'Food Highlights', accent: '#1E5D44', productIds: [],
      banners: [{ id: 'fb-1', title: 'Restaurant Deals Near You', subtitle: 'UP TO 40% OFF',
                  accent: '#E8F5E9', imageUrl: 'https://…/fb1.jpg' }] },   // Food house hero fallback
    { id: 'foodSpecials', title: "Today's Special", accent: '#1E5D44',
      productIds: ['sp-1','sp-2','sp-3', …] },                              // Food specials order
    { id: 'pharmaHero', title: 'Pharma Highlights', accent: '#0E7490', productIds: [],
      banners: [{ id: 'phb-1', title: 'Health Essentials', subtitle: 'UP TO 30% OFF',
                  accent: '#E0F2FE', imageUrl: 'https://…/phb1.jpg' }] },     // Pharma house hero fallback
    { id: 'pharmaPopular', title: 'Popular Medicines', accent: '#0E7490',
      productIds: ['ph-t1','ph-c1','ph-s1','ph-otc3','ph-om1'] },            // Pharma OTC rail (Rx excluded)
    { id: 'pharmaEssentials', title: 'Health Essentials', accent: '#0E7490',
      productIds: ['ph-cal3','ph-dig4','ph-per2','ph-per3','ph-ayur2'] },    // Pharma essentials rail
    { id: 'adBanner', title: 'Offers', accent: '#111827', productIds: [], storeIds: [] },
    { id: 'hotBrandDeals', title: 'Deals of the day', accent: '#1162D3',
      productIds: ['hbd-1','hbd-2','hbd-3','hbd-4','hbd-5'],
      campaigns: [{ id: 'camp-darling-mobiles', storeId: 'store-m1',
                    productIds: ['fm-m1','fm-m2'], carousel: 1 }] },         // editorial vendor campaigns
    { id: 'dealsOfDay', title: 'Daily Essentials', accent: '#F25C3D',
      productIds: ['md-1','md-2','md-3','md-4','md-5','md-6'] },
    { id: 'martEssentials', title: 'Daily Essentials', accent: '#0F766E',
      productIds: ['gr-p3','gr-p4','gr-p5','gr-p6','gr-p7'] },             // Mart essentials rail
    { id: 'mens', title: 'Men', accent: '#1162D3',
      productIds: ['men-1','men-2','men-3','men-4','men-5','men-6'] },
    { id: 'filterFeed', title: 'Filter Feed', accent: '#8B5CF6', productIds: [], chips: [...] }
  ],
  updatedAt: ISODate(...)
}
```

(provenance `data/home/sdui.ts` — section ids/titles/accents/productIds exact). The `martHero` /
`martEssentials` sections are the Mart feed's merchandising surface, `foodHero` /
`foodSpecials` / `mostRatedDining` are Food's (`GET /sdui/food`), and `pharmaHero` /
`pharmaPopular` / `pharmaEssentials` are Pharma's (`GET /sdui/pharma`): the Home renderer ignores
unknown section ids, so a single doc drives the Home, Mart, Food and Pharma feeds. The
`hotBrandDeals.campaigns[]` defs compile into the anon `GET /home/campaigns(/{id})` projection;
they are ID-only (store + product refs) and never carry money.

| Field | BSON type | Why |
|---|---|---|
| `_id` | ObjectId/string | layout key |
| `version` | int32 | cache invalidation bump |
| `sections[].id` | string | section kind |
| `sections[].productIds` | array<string> | **ID-only** refs to catalog |
| `sections[].storeIds` | array<string> | refs to directory.stores |
| `sections[].chips` | array<doc> | filter chips (ID-only) |
| `sections[].banners` | array<doc> | editorial hero banners (`{id,title,subtitle,accent,imageUrl}`) — the only non-ID leaf; **never money** (prices are always joined from `catalog.products`) |
| `sections[].campaigns` | array<doc> | editorial vendor campaigns (`{id,storeId,productIds,carousel}`) — ID-only store + product refs, compiled into the anon `GET /home/campaigns(/{id})` projection; **never money** |
| `updatedAt` | Date (int64 millis) | freshness |

The gateway emits `ETag: "home-v{version}"` on `GET /sdui/home`; a matching `If-None-Match` returns
`304`, so repeat polls cost ~50 B instead of the full compiled tree.

**Write path (super-admin):** the portal's *App content (SDUI)* page edits this doc through
`GET`/`PUT /admin/sdui/home` (`internal/sdui` → `contracts.LayoutWriter` →
`reco.Repo.SaveHome`). `SaveHome` upserts with an atomic `$inc version` (+ `updatedAt`) so the
version is monotonic, and the handler purges `faazio:v1:gateway:sdui:en:/home`, `…:/mart`, `…:/food`,
`…:/pharma` and the `faazio:v1:home:campaigns:` namespace after the write —
the app picks up the new content on its next poll with no release. The write is audited
(`SDUI_PUBLISH`). Payload bounds (≤40 sections, ≤100 id refs/section, ids ≤64 chars, ≤20 chips,
≤8 banners/section with `imageUrl` ≤512 chars, ≤20 campaigns/section with `carousel` ∈ {1,2})
mirror the ID-only contract; the raw user id is
never involved.

### 8.2 `user_events` (TTL)

Raw user-behavior events (browse/view/add-to-cart), **ID-only + no PII**, auto-expired.

```js
{ _id: ObjectId, userIdHash: 'sha256…', productId: 'fm-f1', event: 'view', at: ISODate(), expiresAt: ISODate() }
```

**Production (live):** written by `POST /events` (`server/gateway/internal/reco/repo.go`); the 90-day
TTL is the native Mongo TTL index `user_events_ttl` (`expireAfterSeconds: 0` on `expiresAt`),
created by `server/supabase/seed/mongo/seed.js`. The handler bounds the vocabulary to
`event ∈ {view, cart_add, order, search}` and `productId ≤ 64` chars so the Atlas M0 collection
cannot be grown with junk. The raw `user_id` is never stored — only the `sha256:` hash. The seed also
installs a `$jsonSchema` validator (`collMod`, `validationAction: "error"`) as write-time
defence-in-depth behind the handler allowlist. `user_events` stays **write-only** (no read index):
the TTL index is the only index, keeping M0 writes/space minimal.

### 8.3 `recommendations` / `segments` / `product_stats`

> **Production status:** the gateway now ships a **read path** over these collections (`GET
> /recommendations`, migration `0014` series). MongoDB in production is **exactly four collections**:
> `sdui_layouts` + `user_events` (live writes) and `recommendations` + `product_stats` (validated,
> read-only — written by the scaling-stage batch job). `segments` remains scaling-stage. Both read-only collections are
> created + validated eagerly by `server/supabase/seed/mongo/seed.js` (`collMod`, moderate validation).

- `recommendations`: precomputed per-user (`userIdHash`) product-id list (`{ userIdHash, productIds[], generatedAt }`), ID-only, ≤ 100 ids.
- `segments`: user-segment mappings (ID-only) — still scaling-stage, no validator/writes.
- `product_stats`: aggregate score per product id (`{ productId, score, views, cartAdds, orders, updatedAt }`), ID-only, no PII.

**Access patterns:** `GET /recommendations` reads the caller's `recommendations` doc by `userIdHash`;
on a cold-start miss (`ErrNoDocuments`) it falls back to the global top-20 `product_stats` by `score`,
then the gateway joins catalog. **Cache:** `faazio:v1:reco:{userIdHash}:{context}` (TTL 1 h);
`faazio:v1:sdui:home:{version}` (edge TTL 300 s). **Invalidation:** on `user_events` batch flush /
layout version bump.

**Admin notes:** `userIdHash` is a **hash, never a raw user id**; events carry no PII; TTL bounds the
retention window.

---

## 9. Cache integration per service

| Service | Primary cache keys (Valkey) | Edge (Cloudflare) |
|---|---|---|
| Gateway | compiled SDUI per path/locale (300 s + SWR 60 s) | SDUI trees |
| Search | top-query results (10 min) | search results, images |
| Cart & Stock | `stock:{productId}` (30–60 s); never carts | — |
| Checkout | `orders:{userId}` (60 s, auth-scoped); idempotency locks | — |
| Reviews & Ratings | `reviews:vendor:{id}` (24 h); user's own rating auth-scoped (not cached) | — |
| Recommendations | `reco:{userIdHash}` (1 h), `sdui:home:{version}` | SDUI, images |

Full mechanics, key taxonomy, TTL matrix, and invalidation event map live in
`docs/architecture/caching-cloudflare-valkey.md`.

---

## 10. Admin-dashboard surface

| Table | PII? | Safe admin query | Pagination |
|---|---|---|---|
| `catalog.products` | no | search/filter/sort | keyset by `id` |
| `directory.stores` | address/phone = PII | list by app | keyset by `id` |
| `reviews.*` | reviewer name/avatar | by product_id | keyset by `id` |
| `reviews.vendor_reviews` | author `user_id`/`order_ids` = PII linkage (never public) | by `vendor_id` | keyset by `id` |
| `stock` | no | low-stock scan | keyset by `productId` |
| `carts` | user linkage | by cart (rare) | keyset |
| `checkout.users/addresses/orders` | **heavy PII** | by user/order (redacted) | keyset `(user_id, placed_at)` |
| `accounts.*` | phone/email PII | by user (redacted) | keyset |
| `recommendations.*` | no (hashed) | by segment/product | keyset |

Every table carries `created_at`/`updated_at` audit columns; PII redacted in admin output; never
logged.

---

## 11. Honest limitations

- **Production implemented, scaling stage plan-only.** The Postgres migrations
  (`server/supabase/migrations/`) and generated seed exist on disk; the CockroachDB / Tantivy /
  DynamoDB / Python targets do **not**. The DDL below is the authority those migrations port from.
  `0004` adds lean indexes + guards, `0005` the type byte diet, `0006` the checkout idempotency table.
- **Sample rows** are `@data/*`-derived where noted; the `stock` numbers are **algorithm-derived**
  (not hardcoded) to avoid drift, and `ph-c1`/`sp-1` point to their fixture files rather than repeating
  values.
- The **datatype choices** cite real type systems (CockroachDB ENUM/INT8/TIMESTAMPTZ, Tantivy
  STORED/INDEXED/FAST, DynamoDB attribute types, BSON int32/int64/Date) but are **recommendations** —
  final DDL tuning happens when the scaling stage is built.
- Ownership of the CockroachDB cluster is **shared across logical schemas** (`catalog`, `directory`,
  `reviews`, `accounts`, `checkout`) — each owned by its service, physically co-located. This is
  documented per section and may be split into separate clusters later.
- The **cache layer** decision (Aiven Valkey + Cloudflare) supersedes the older "Upstash Redis"
  mentions in `server/README.md` / `server-gateway-plan.md` — see those docs' decision notes.

---

## 12. Production additions — previously-orphaned workflows get a durable home

> **Status:** Production code live (migrations `0007`–`0015`). These tables close the "DB gap": workflows
> that lived only in client memory / `AsyncStorage` / Portal `localStorage` now have a Supabase table +
> gateway endpoint. Money is INT8 paisa; IDs are stable slugs; RLS is own-rows unless noted.

### 12.1 `favourites.items` — source `data/home/seeds.ts` `seedFavorites` (migration `0007`)

```sql
CREATE TABLE favourites.items (
  user_id    TEXT NOT NULL REFERENCES checkout.users(user_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL CHECK (char_length(product_id) BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX favourites_items_user_created_idx ON favourites.items (user_id, created_at DESC);
```

Highest-traffic write after the cart; previously in-memory only (`state/favoriteStore.ts`), lost on
logout/restart. **No FK on `product_id`** (deliberate): the seed mixes catalog product ids with
category/rail ids (`cat-*`, `m-*`) that are not `catalog.products` rows. RLS own-rows only; the key
`faazio:v1:favourites:items:{userId}` is never edge-cached.

### 12.2 `inventory.pickup_points` + `checkout.payments` + order pickup snapshot (migration `0012`)

```sql
CREATE TABLE inventory.pickup_points (
  id TEXT PRIMARY KEY,                     -- store.id, or 'pickup-neutral'
  store_id TEXT UNIQUE REFERENCES directory.stores(id),
  name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT, hours TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checkout.payments (
  id TEXT PRIMARY KEY,                     -- 'pay-*'
  order_id TEXT NOT NULL REFERENCES checkout.orders(order_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES checkout.users(user_id),
  method TEXT NOT NULL DEFAULT '', amount_paisa INT8 NOT NULL CHECK (amount_paisa >= 0),
  coins_redeemed INT4 NOT NULL DEFAULT 0 CHECK (coins_redeemed >= 0),
  status TEXT NOT NULL DEFAULT 'PAID', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checkout.orders ADD COLUMN pickup  JSONB CHECK (pickup  IS NULL OR octet_length(pickup::text)  <= 2048);
ALTER TABLE checkout.orders ADD COLUMN pickups JSONB CHECK (pickups IS NULL OR octet_length(pickups::text) <= 2048);
```

`pickup_points` replaces the runtime-only `NEUTRAL_PICKUP` derivation with a durable, cacheable row;
ids are the store id (or `pickup-neutral`), so the client resolver stays stable. Public info → anon
read + cached (`faazio:v1:directory:pickup:{key}` 24 h). `payments` is the real-money ledger: the
amount is derived server-side (`order.total - coins/100` rupees) and written in the order transaction
when `coinsRedeemed > 0` or a payment method is supplied. The order `pickup`/`pickups` JSONB columns
persist today's `PlacedOrder.pickup/pickups` snapshot, so the "Pickup From" card survives a server
round-trip. Payments are own-rows, never edge-cached.

### 12.3 `rewards.balances` + `rewards.ledger` — source `data/rewards/rewards.ts` (migration `0008`)

```sql
CREATE TYPE reward_entry_type AS ENUM ('EARN','REDEEM','EXPIRE','STREAK');

CREATE TABLE rewards.balances (
  user_id TEXT PRIMARY KEY REFERENCES checkout.users(user_id) ON DELETE CASCADE,
  coins INT4 NOT NULL DEFAULT 0 CHECK (coins >= 0),
  streak INT4 NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_order_day DATE,
  card JSONB CHECK (card IS NULL OR octet_length(card::text) <= 2048),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rewards.ledger (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES checkout.users(user_id) ON DELETE CASCADE,
  type reward_entry_type NOT NULL, coins INT4 NOT NULL, rupees INT4 NOT NULL DEFAULT 0,
  order_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rewards_ledger_user_created_idx ON rewards.ledger (user_id, created_at DESC);
```

Coins were client-forgeable (`state/rewardsStore.ts` AsyncStorage) and money-adjacent; the server is
now the authority. Rates mirror `@data/rewards` (`COIN_EARN_RATE=1000` ₹/coin, `COIN_REDEEM_RATE=100`
coins/₹, `STREAK_TARGET_DAYS=7`, `DISCOUNT_CARD_PERCENT=10`). `rewards.ledger` is **append-only**
(authenticated SELECT own only; no INSERT/UPDATE/DELETE — service_role writes). The earn path runs
inside `checkout.CreateOrder` via `contracts.RewardsWriter` (no public reconcile endpoint, so coins
cannot be forged); the client stays optimistic and reconciles on `GET /rewards`
(`faazio:v1:rewards:view:{userId}` 60 s, invalidated on earn).

### 12.4 `directory.dining_venues` (extended) + `directory.menus` — source `data/food/diningVenues.ts`, `data/food/menus.ts` (migrations `0013`, `0019`)

```sql
ALTER TABLE directory.dining_venues
  ADD COLUMN app app_brand NOT NULL DEFAULT 'FOOD', rating REAL, cover_image TEXT NOT NULL DEFAULT '',
  ADD COLUMN address TEXT, phone TEXT, hours TEXT, categories TEXT[] NOT NULL DEFAULT '{}';
-- 0041: public venue pin for nearby ordering (partial geo index mirrors stores_geo_idx).
ALTER TABLE directory.dining_venues ADD COLUMN latitude FLOAT8, ADD COLUMN longitude FLOAT8;

CREATE TABLE directory.menus (
  venue_id TEXT NOT NULL, dish_id TEXT NOT NULL, name TEXT NOT NULL,
  price_paisa INT8 NOT NULL CHECK (price_paisa >= 0), is_veg BOOL, cuisine TEXT, rating REAL,
  image TEXT NOT NULL DEFAULT '', PRIMARY KEY (venue_id, dish_id)
);
-- 0019: display fields the app's SpecialDish card needs (additive, NOT NULL DEFAULT '').
ALTER TABLE directory.menus
  ADD COLUMN description TEXT NOT NULL DEFAULT '',
  ADD COLUMN emoji TEXT NOT NULL DEFAULT '',
  ADD COLUMN delivery_time TEXT NOT NULL DEFAULT '';
-- 0022: list price (MRP) so a dish discount is `mrp_paisa > price_paisa`, never synthesized.
ALTER TABLE directory.menus ADD COLUMN mrp_paisa INT8
  CHECK (mrp_paisa IS NULL OR mrp_paisa >= price_paisa);
CREATE INDEX menus_venue_idx ON directory.menus (venue_id);
```

> **Menus are MRP-only for discounts (W45, no migration).** A dish's display discount is the authored
> `mrp_paisa > price_paisa` strike-through; menu dishes do **not** participate in
> `promo.festival_optins` (which references `catalog.products.product_id`) and the checkout
> `DiscountReader` settlement ignores menus. So the Food menu price shown is the price charged — no
> display-vs-settlement gap. Making menu dishes festival-eligible would be a deliberate contract delta
> (a nullable `menu_dish_id` opt-in + an `ActiveDiscounts` union), not done here.
>
> **MRP is authored by the seller (W58).** `0017` adds `seller_id` + `status` (product_status) to
> `directory.menus`; the public `GET /venues/{id}/menu` serves **`status = 'ACTIVE'`** rows only, so a
> delisted/never-approved dish no longer leaks to shoppers and a seller emptying a venue clears its
> menu. The portal `seller/menus` form writes `mrp` (rupees) through
> `POST`/`PUT /seller/menus/{venueId}/{dishId}`, guarded server-side by `mrp >= price` (mirrors the
> `menus_mrp_gte_price` check). Seed rows are emitted `ACTIVE`.

`directory.dining_venues` is restaurant identity only — it has no booking/reservation fields,
time slots, or table counts; Food fulfillment is DELIVERY or PICKUP only. It began as an identity
stub (`id,name`), so every restaurant profile was hollow in the DB.
Menus are seeded from `restaurantMenus` (61 dishes / 18 restaurants) **and** `storeMenus`
(27 dishes / 12 delivery kitchens `store-f1…f12`, derived from `foodProducts` by `storeId`) —
88 dishes / 30 venues. **No FK on `venue_id`** (deliberate): a
menu belongs to a *vendor* id that resolves to either `directory.stores` (food stores) or
`directory.dining_venues` — the `directory.vendors` union. Public catalog data → anon read, cached
`faazio:v1:directory:menu:{venueId}` 24 h; venue PII (address/phone) is redacted by the gateway.
The restaurant-venue **list** is served by `GET /venues?app=` (PII-free projection of
`directory.dining_venues`), cached `faazio:v1:directory:venues:{app}` 24 h.

### 12.5 `pharma.prescriptions` — source `features/pharma/prescription` (migration `0009`)

> **Enum note (verified 2026-10-18):** `0018` extends this enum with `QUOTED` and `READY`
> (`ALTER TYPE … ADD VALUE IF NOT EXISTS`), matching the gateway's `allowedRxStatus`. The partner
> quote → READY reveal workflow writes those states successfully — no enum drift. See §12.12.

```sql
CREATE TYPE prescription_status AS ENUM ('RECEIVED','PROCESSING','FULFILLED','CANCELLED');

CREATE TABLE pharma.prescriptions (
  id TEXT PRIMARY KEY,                          -- 'RX-*'
  user_id TEXT NOT NULL REFERENCES checkout.users(user_id) ON DELETE CASCADE,
  vendor_id TEXT, fulfillment fulfillment_mode,
  pages SMALLINT NOT NULL DEFAULT 1 CHECK (pages BETWEEN 1 AND 10),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  image_paths TEXT[] NOT NULL DEFAULT '{}',     -- Storage object keys (never URLs)
  status prescription_status NOT NULL DEFAULT 'RECEIVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prescriptions_user_created_idx ON pharma.prescriptions (user_id, created_at DESC);
```

Pharma could not go live without a durable Rx: the flow lived in screen state + `ordersStore` (in
memory). Images live in the private Supabase Storage bucket `prescriptions` as object keys (never
bytea, never URLs, never logged); the gateway mints signed upload URLs (`POST
/prescriptions/upload-url`, service_role, env-gated by `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`). RLS
own-rows SELECT; writes are service_role. The list is auth-scoped, cached 60 s, never at the edge.

### 12.6 `blood.*` — source `data/pharma/bloodDonors.ts`, `data/pharma/bloodRequests.ts` (migration `0010`)

```sql
CREATE SCHEMA blood;

CREATE TABLE blood.donors (                     -- health PII; consent gates the public directory
  user_id TEXT PRIMARY KEY REFERENCES checkout.users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  age_range TEXT, weight_kg SMALLINT CHECK (weight_kg IS NULL OR weight_kg BETWEEN 30 AND 300),
  city TEXT NOT NULL DEFAULT '', willing_to_travel BOOL NOT NULL DEFAULT false,
  donation_type TEXT, notif JSONB CHECK (octet_length(notif::text) <= 1024),
  available BOOL NOT NULL DEFAULT true, consent BOOL NOT NULL DEFAULT false, consent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE VIEW blood.donor_directory AS
  SELECT user_id, name, blood_group, city, donation_type, willing_to_travel, available
  FROM blood.donors WHERE consent AND available;   -- display-safe subset (no age/weight/notif)

CREATE TABLE blood.requests (
  id TEXT PRIMARY KEY, hospital TEXT, city TEXT, state TEXT,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  units SMALLINT NOT NULL DEFAULT 1, patient_context TEXT, needed_within TEXT,
  verified BOOL NOT NULL DEFAULT false, urgency TEXT NOT NULL DEFAULT 'normal',
  contact TEXT, address TEXT, remarks TEXT,          -- PII: redacted for anon by the gateway
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ
);
CREATE TABLE blood.interests (request_id, donor_user_id, kind, PRIMARY KEY (request_id, donor_user_id, kind));
CREATE TYPE match_status AS ENUM ('pending','accepted','declined','completed');
CREATE TABLE blood.match_requests (id, requester_user_id, donor_user_id, blood_group, city, status, created_at,
  responded_at TIMESTAMPTZ);   -- migration 0029: set when the recipient accepts/declines
```

Donor data is health PII and matching needs a queryable registry — it cannot stay in `AsyncStorage`.
The public surface is the `blood.donor_directory` security-definer view (consented, display-safe
columns only); own rows are RLS-scoped. The request board is public but `contact`/`address` are
stripped for anon. `blood.expire_requests()` is scheduled (pg_cron, daily) to prune expired requests.
Donor directory + request board cached 60 s (`faazio:v1:blood:requests:{bloodGroup};{city}`).
**Un-interest (no schema change):** the `blood.interests` primary key `(request_id, donor_user_id, kind)`
already keys a single mark, so an un-tap is a plain `DELETE` (`DELETE /blood-requests/{id}/interest`,
idempotent) — no new table, column, or index. It touches no cache: the public `blood.requests`
projection carries no interest data.
**Decision (0019):** the donor dashboard stays on the redacted `blood.requests` projection and computes
distance client-side rather than adding display columns (`image_url`/`distance_km`/`demographics`) —
no PII widening. `purposeDescription`/`demographics` remain out of the public board by design.

**Match lifecycle (0029):** a targeted match was insert-only (`pending`). Migration `0029` adds
`responded_at` and splits the `match_requests` RLS policy from one `own_rows` (which restricted every
write to the requester) into `match_select` (either party), `match_insert` (requester only) and
`match_respond` (recipient only) — so a donor can accept/decline their own incoming request without
being able to mutate the requester. The gateway reads the recipient set via
`GET /donor-match-requests/incoming` (`donor_user_id = caller`) and writes the transition via
`PUT /donor-match-requests/{id}/status` (`accepted`|`declined`, recipient-scoped, pending-only); an
accepted/declined transition enqueues a PII-free `MATCH_ACCEPTED`/`MATCH_DECLINED` notification to the
requester. Contact disclosure on acceptance is **not** part of this — sharing stays reveal-gated future work.

### 12.7 Dinner/table bookings — **removed**

The `bookings` schema (migrations `0011` + `0020`), `internal/bookings`, the mobile seat-reservation
flow and the web booking pages were removed. There is no booking table, route, cache key or
`GatewayClient` method in production. Do not recreate the schema from older docs; the order lifecycle now
owns seller accept/reject (see §12.28).

### 12.8 Hardening — triggers, purge sweep, hot-path indexes, schema grants (migration `0014`)

```sql
CREATE SCHEMA util;
CREATE FUNCTION util.touch_updated_at() RETURNS trigger LANGUAGE plpgsql
  SET search_path = pg_catalog AS $$ begin new.updated_at := now(); return new; end; $$;
-- attached (BEFORE UPDATE … FOR EACH ROW) to: directory.stores, inventory.stock, inventory.carts,
-- inventory.pickup_points, accounts.profile, reviews.vendor_reviews, pharma.prescriptions,
-- blood.donors, rewards.balances.

CREATE FUNCTION checkout.purge_idempotency_keys(max_age interval DEFAULT '7 days') RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$ … $$;
-- pg_cron: 'faazio-purge-idempotency-keys' daily (the Valkey NX lock lives 300 s; the DB row is a
-- 7-day replay record).

CREATE INDEX vendor_reviews_vendor_created_idx ON reviews.vendor_reviews (vendor_id, created_at DESC);
CREATE INDEX prescriptions_user_status_idx    ON pharma.prescriptions (user_id, status);
```

Cross-cutting integrity: one generic `updated_at` trigger (the catalog-specific one still fires
`pg_notify`), a bounded idempotency table, the two hot ordering indexes, and schema `USAGE` grants to
`anon`/`authenticated` so RLS — not a missing grant — is the only gate (Supabase-only). All idempotent
and re-runnable; `FOREACH`/`format` keep the trigger attach DRY. This closes the 0007–0014 series.

### 12.9 Partner control plane — Portal workflows get an origin (migration `0015`)

```sql
CREATE SCHEMA sellers; CREATE SCHEMA promo; CREATE SCHEMA ads; CREATE SCHEMA payments;
CREATE SCHEMA admins; CREATE SCHEMA support;

CREATE TYPE seller_status   AS ENUM ('PENDING_REVIEW','ACTIVE','SUSPENDED','REJECTED');
CREATE TYPE kyc_doc_type    AS ENUM ('GSTIN','PAN','BANK_PROOF','SHOP_LICENSE');
CREATE TYPE product_status  AS ENUM ('DRAFT','PENDING_REVIEW','ACTIVE','REJECTED','DELISTED');
CREATE TYPE campaign_status AS ENUM ('DRAFT','SCHEDULED','LIVE','ENDED');
CREATE TYPE campaign_scope  AS ENUM ('GLOBAL','STATE');
CREATE TYPE optin_status    AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE ad_placement    AS ENUM ('HOME_TOP','SPONSORED_SHOWCASE','SECTOR_RAIL');
CREATE TYPE ad_status       AS ENUM ('REQUESTED','APPROVED','REJECTED','LIVE');
CREATE TYPE payout_status   AS ENUM ('SCHEDULED','PAID','ON_HOLD');
CREATE TYPE ticket_status   AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');
CREATE TYPE return_status   AS ENUM ('REQUESTED','APPROVED','REJECTED','COMPLETED');

-- Order lifecycle: one enum both apps read (Option A). Mobile 'Processing' maps to NEW/PACKED.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'NEW';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RETURNED';

-- Seller scoping on the existing catalog/directory tables.
ALTER TABLE directory.stores  ADD COLUMN seller_id TEXT, ADD COLUMN state_code CHAR(2);
ALTER TABLE directory.stores  ALTER COLUMN rating TYPE REAL USING rating::real;  -- 0005 missed it
ALTER TABLE catalog.products  ADD COLUMN seller_id TEXT, ADD COLUMN status product_status NOT NULL DEFAULT 'DRAFT';

CREATE TABLE sellers.sellers (              -- seller_id TEXT PK, category app_brand, rating REAL,
  … gstin, pan, address, phone /*PII*/, state_code CHAR(2), status seller_status,
  created_at/updated_at TIMESTAMPTZ
);
CREATE TABLE sellers.kyc_documents (kyc_id PK, seller_id FK, doc_type kyc_doc_type,
  file_key TEXT /* Storage object key — never a URL */, verified BOOL, uploaded_at);
CREATE TABLE sellers.bank_accounts (bank_account_id PK, seller_id FK,
  account_number_masked TEXT /* masked tail only */, ifsc, beneficiary_name);

CREATE TABLE promo.sector_caps        (cap_id PK, sector app_brand, state_code CHAR(2),
  max_discount SMALLINT CHECK 0–90, updated_at);
CREATE TABLE promo.festival_campaigns (campaign_id PK, name, scope campaign_scope, state_code,
  starts_at/ends_at TIMESTAMPTZ CHECK ends_at>starts_at, status campaign_status, created_by);
CREATE TABLE promo.festival_optins    (optin_id PK, campaign_id FK, seller_id FK, product_id,
  discount SMALLINT 0–90, status optin_status, UNIQUE(campaign_id,product_id));
CREATE TABLE promo.coupons            (coupon_id PK, code UNIQUE, title, scope, state_code, sector,
  value_percent SMALLINT 0–90, max_discount_paisa INT8, min_order_paisa INT8, free_delivery BOOL,
  valid_till TIMESTAMPTZ, active BOOL);  -- title/min_order/free_delivery added in 0021

CREATE TABLE ads.sponsored_slots (slot_id PK, seller_id FK, product_id, placement ad_placement,
  state_code, status ad_status, impressions/clicks INT4, orders_attributed INT8, requested_at);
-- 0027 adds the hero creative surface (poster + deep-link target + schedule): see §12.17.

CREATE TABLE payments.settlement_ledger (entry_id PK, seller_id FK, cycle TEXT /* YYYY-MM */,
  order_value_paisa INT8, commission_paisa INT8, tcs_paisa INT8, net_paisa INT8);  -- service_role only
CREATE TABLE payments.payouts (payout_id PK, seller_id FK, cycle, amount_paisa INT8,
  status payout_status, scheduled_for TIMESTAMPTZ);

CREATE TABLE admins.state_admins (admin_id PK, name, email/phone /*PII*/, state_code CHAR(2),
  active BOOL, created_at/last_active_at);
  -- 0036: UNIQUE on lower(email) only. Phone is a soft warning (shared/SME lines allowed):
  -- the draft unique phone index is explicitly dropped; a non-unique digits-only lookup remains.
CREATE TABLE admins.audit_logs (log_id PK, actor_id, actor_role TEXT CHECK seller/state/super,
  action, entity, entity_id, before/after JSONB CHECK ≤8192, created_at);
  -- 0037: rolling 7-day retention — admins.purge_audit_logs() + a gateway worker
  -- (00:00 IST nightly) remove rows older than 7 days for all roles (§12.20).

CREATE TABLE support.tickets (ticket_id PK, user_id FK NULL, seller_id FK NULL, subject, body ≤2000,
  status ticket_status, created_at/updated_at);
CREATE TABLE checkout.returns (return_id PK, order_id FK, user_id FK, seller_id,
  reason ≤2000, status return_status, created_at/updated_at);
```

The Portal previously wrote 45 routes to `localStorage` only. This migration is the additive origin
they converge on — **no rewrite of `0001`–`0014`**, so the mobile app keeps running. It inherits the
lean dtype policy (§2/§12): every new money column is INT8 paisa, ratings REAL, percents/qty SMALLINT,
ids TEXT slugs, timestamps TIMESTAMPTZ, statuses native ENUMs, free JSONB guarded ≤ 8 KB. Real money
(`payments.settlement_ledger`, `payments.payouts`) is **service_role-only** — there are no RLS
update/delete policies, so rows are append-by-convention (mirrors `rewards.ledger`) and commission/TCS
can never be client-computed. `util.touch_updated_at()` (0014) is attached to the new mutable tables.
Schema `USAGE` + RLS are granted under the Supabase-only guard; app roles travel in custom JWT claims
(`app_role`, `seller_id`, `state_code`) read via `auth.jwt()` — the gateway (service_role) remains the
real enforcer. Adds `order_status` values `NEW`/`PACKED`/`RETURNED` (Option A) so the Portal and mobile
share one lifecycle; `directory.stores.rating` is narrowed to REAL (0005 narrowed only products).
Idempotent and re-runnable.

`admins.state_admins.state_code` (and every other `state_code char(2)` column) has **no FK/CHECK yet** —
the gateway is authoritative: `internal/admins/states.go` allowlists the 36 ISO 3166-2:IN state/UT codes
(no aliases — CT/OR/TG/UT/DH, never CG/OD/TS/UK/DN) and `POST /district-admins` also validates the district against `admins.district_master` (`0046`/`0048`); an unknown code is rejected with
400 `unknown_state`. `0035` is intentionally unused; `0046` introduced `admins.district_master`
(42 TN/PY districts) and `0048` renamed `state_admins` → `district_admins` (district_code is the
authoritative scope).

### 12.10 Store live flag (migration `0016`)

`0015` added seller scoping to `directory.stores` and its comment assumed a live flag already existed on
the table — it did not, so the Portal `Store.isLive` field and the directory moderation flow had nothing
to read or flip. `0016` supplies it additively (never rewrites `0001`–`0015`):

```sql
ALTER TABLE directory.stores ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT true;
DROP INDEX IF EXISTS directory.stores_state_live_idx;   -- 0015's (state_code) only
CREATE INDEX IF NOT EXISTS stores_state_live_idx ON directory.stores (state_code, is_live);
```

The composite index keeps the public list (`WHERE app = ? AND is_live`) state-aligned (it still serves
`state_code`-only lookups). Stores remain public anon-readable; writes are `service_role` (the gateway is
the only write path), so no new RLS policy is needed. Idempotent and re-runnable.

### 12.11 Partner completion — customers, menus, rewards rates, ticket scope (migration `0017`)

`0015`/`0016` gave the Portal a durable origin but left four control-plane surfaces with no row to
read: customer monitoring, food-menu editing, admin-tunable rewards rates, and a state-scoped support
queue. `0017` supplies them additively (never rewrites `0001`–`0016`), reusing the §0.1 lean dtypes.

```sql
-- W17: PII-redacted customer projection for the state/super customers page. The base
-- checkout.users table keeps its own-rows RLS untouched; this view exposes counts only, never
-- phone/address/email.
CREATE VIEW checkout.users_admin AS
  SELECT u.user_id, u.name, u.state_code, u.created_at,
         count(o.order_id)::int4               AS orders_count,
         coalesce(sum(o.total_paisa),0)::int8  AS spend_paisa,
         max(o.placed_at)                      AS last_order_at
    FROM checkout.users u
    LEFT JOIN checkout.orders o ON o.user_id = u.user_id
   GROUP BY u.user_id, u.name, u.state_code, u.created_at;

-- W18: seller-scoped menu editing (mirrors catalog.products.seller_id/status from 0015).
ALTER TABLE directory.menus ADD COLUMN IF NOT EXISTS seller_id TEXT;
ALTER TABLE directory.menus ADD COLUMN IF NOT EXISTS status    product_status NOT NULL DEFAULT 'DRAFT';

-- W19: admin-tunable rewards rates replace the static constants; server remains the sole ledger writer.
CREATE TABLE rewards.rates (
  rate_id              text PRIMARY KEY DEFAULT 'default',
  coin_earn_rate       smallint NOT NULL CHECK (coin_earn_rate       BETWEEN 1 AND 10000),  -- ₹ spent per coin
  coin_redeem_rate     smallint NOT NULL CHECK (coin_redeem_rate     BETWEEN 1 AND 10000),  -- coins per ₹1
  streak_target_days   smallint NOT NULL CHECK (streak_target_days   BETWEEN 1 AND 60),
  discount_card_percent smallint NOT NULL CHECK (discount_card_percent BETWEEN 0 AND 90),
  card_validity_days   smallint NOT NULL CHECK (card_validity_days   BETWEEN 1 AND 90),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- W20: state-scoped support queue (nullable = unassigned/global).
ALTER TABLE support.tickets ADD COLUMN IF NOT EXISTS state_code CHAR(2);
CREATE INDEX IF NOT EXISTS tickets_state_status_idx ON support.tickets (state_code, status);
```

The customers view is a projection, not a table: `checkout.users` own-rows RLS is unchanged and the
gateway reads the view as `service_role`. `directory.menus` gains the same seller/status model as
`catalog.products`, so menu writes are seller-scoped and state-moddable. `rewards.rates` is a single
admin-editable row (deleted-to-default is a no-op because the gateway falls back to the `config.ts`
constants when absent); `rewards.ledger` stays append-only — the rate row changes the *earn* factor,
never a past entry, and the server remains the only writer of balances/ledger. `support.tickets`
gains a nullable `state_code` so the state queue filters without breaking customer-created tickets.
`util.touch_updated_at()` is attached to `rewards.rates`. Idempotent and re-runnable.

### 12.12 Pharma quote → READY reveal → notify + notification outbox (migration `0018`)

The partner quote workflow (seller prices an Rx, flips it READY, the customer is told) and every other
"tell the customer" event had no home. `0018` supplies them additively (never rewrites `0001`–`0017`),
reusing the §0.1 lean dtypes.

```sql
-- W24: quote lifecycle. QUOTED / READY extend the frozen enum.
ALTER TYPE prescription_status ADD VALUE IF NOT EXISTS 'QUOTED';
ALTER TYPE prescription_status ADD VALUE IF NOT EXISTS 'READY';

CREATE TABLE pharma.quote_items (
  id              text PRIMARY KEY,                              -- 'qi-*'
  prescription_id text NOT NULL REFERENCES pharma.prescriptions (id) ON DELETE CASCADE,
  name            text NOT NULL,
  qty             smallint NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 99),
  mrp_paisa       int8 NOT NULL DEFAULT 0 CHECK (mrp_paisa >= 0),
  price_paisa     int8 NOT NULL DEFAULT 0 CHECK (price_paisa >= 0),
  discount_paisa  int8 NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  created_at/updated_at timestamptz
);

-- Denormalized quote total + the audited PII reveal gate. address_id ties the reveal to the
-- delivery address the customer chose at request time.
ALTER TABLE pharma.prescriptions ADD COLUMN IF NOT EXISTS quoted_total_paisa INT8 NOT NULL DEFAULT 0;
ALTER TABLE pharma.prescriptions ADD COLUMN IF NOT EXISTS revealed_at  TIMESTAMPTZ;
ALTER TABLE pharma.prescriptions ADD COLUMN IF NOT EXISTS revealed_by  TEXT;
ALTER TABLE pharma.prescriptions ADD COLUMN IF NOT EXISTS address_id   TEXT;

CREATE TABLE pharma.status_history (                              -- append-only per Rx
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prescription_id text NOT NULL REFERENCES pharma.prescriptions (id) ON DELETE CASCADE,
  from_status prescription_status, to_status prescription_status NOT NULL,
  actor_id TEXT NOT NULL, actor_role TEXT NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

-- W24: durable, transactional "tell the customer" record + device push-token registry.
CREATE SCHEMA notifications;
CREATE TABLE notifications.outbox (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES checkout.users (user_id) ON DELETE CASCADE,
  kind text NOT NULL, title text NOT NULL, body text NOT NULL,
  data jsonb CHECK (data IS NULL OR pg_column_size(data) <= 2048),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
-- 0058 adds the retry budget: attempts + next_attempt_at (capped exponential backoff, terminal after
-- 6 attempts) + updated_at. Drainable = PENDING or FAILED with next_attempt_at <= now().
ALTER TABLE notifications.outbox ADD COLUMN attempts INT NOT NULL DEFAULT 0;
ALTER TABLE notifications.outbox ADD COLUMN next_attempt_at timestamptz;
ALTER TABLE notifications.outbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX notifications_outbox_retry_idx ON notifications.outbox (status, next_attempt_at)
  WHERE status IN ('PENDING','FAILED');
CREATE TABLE notifications.push_tokens (
  user_id text PRIMARY KEY, token text NOT NULL, platform text, updated_at timestamptz
);

-- W24b: admin moderation is a HIDDEN flag (never a hard DELETE; vendor_summary is trigger-owned).
ALTER TABLE reviews.vendor_reviews ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
```

Money stays INT8 paisa (whole rupees on the wire, `/100` at the repo boundary). The seller projection
(`GET /seller/prescriptions`) is **name-only until READY/FULFILLED** — `checkout.users.phone` and the
address are surfaced by the query's `CASE` only in those states; the projection also returns
`revealed_at`/`revealed_by` + the append-only `status_history` so the portal audit trail is populated
(the `revealed_by` actor is never the customer phone/address). The reveal is recorded in
`revealed_at`/`revealed_by` + `status_history` + `admins.audit_logs` (RX_READY). `POST
/seller/prescriptions/{id}/quotes` replaces the quote lines, recomputes `quoted_total_paisa`, advances
`RECEIVED/QUOTED → QUOTED` and appends history. `PUT /prescriptions/{id}/status READY` requires ≥1
quote line, sets the reveal and enqueues `notifications.outbox` (`RX_READY`). The outbox carries no PII
beyond `user_id`; `push_tokens.token` is a device credential and is never logged. A device token
belongs to one portal login at a time: registering it deletes any prior owner's row (shared phones),
and `DELETE /notifications/register` removes it on sign-out. FAILED delivery is **retryable** (the
drain worker's `MarkFailed` schedules `next_attempt_at` with capped exponential backoff 1s→2s→4s→…
≤1h; terminal after 6 attempts, `0058`) — a transient webhook 5xx no longer drops the row, and
legacy `FAILED` rows were backfilled one retry window. New tables are
deny-all to `anon`/`authenticated` (gateway-only); `pharma.prescriptions`' own-rows RLS is untouched.
`util.touch_updated_at()` is attached to `pharma.quote_items`. Idempotent and re-runnable.

### 12.13 Public promo/ads reads (migration `0021`)

The app-facing promotional surfaces had no anon-readable contract (`0015` exposed coupons/slots only
through role-gated control-plane routes). `0021` is additive and idempotent:

```sql
-- Display fields the public coupon projection needs (NOT NULL defaults keep it re-runnable).
ALTER TABLE promo.coupons ADD COLUMN IF NOT EXISTS title           TEXT    NOT NULL DEFAULT '';
ALTER TABLE promo.coupons ADD COLUMN IF NOT EXISTS min_order_paisa INT8    NOT NULL DEFAULT 0 CHECK (min_order_paisa >= 0);
ALTER TABLE promo.coupons ADD COLUMN IF NOT EXISTS free_delivery   BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS coupons_public_idx ON promo.coupons (active, valid_till) WHERE active;
```

Reads: `GET /coupons?app=&state=` (anon; `active AND valid_till > now()`, sector/state match or
global; money whole rupees; cached `promo:coupons:public:{app}:{state}` 600 s), `GET
/promo/active-discounts?ids=` (anon; best live `festival_optins` discount per product — campaign
`LIVE` and in `[starts_at, ends_at)`, opt-in `APPROVED`, clamped by the effective `sector_caps` row;
cached `promo:active:{productId}` 300 s, invalidated on opt-in/campaign status change) and `GET
/ads/live?slot=` (anon; `status = 'LIVE'`; cached `ads:live:{placement}` 600 s). No new table, no RLS
change — the public projections are non-PII business data, computed by the gateway from existing rows.

**Seed:** the coupon fixture (`data/cart/coupons.ts`) now seeds `promo.coupons`, not the legacy
`checkout.coupons` (0001) — no repo reads the latter, so the app's `GET /coupons` rail is populated on
a fresh deploy. Rows are `scope='GLOBAL'`, `sector`/`state_code` null (visible to every app),
`valid_till='2027-12-31'`, `active=true`. The seed generator is the single writer
(`server/supabase/seed/generate.mjs`) and `docker-compose.yml` mounts `0021` so local stacks match.

### 12.14 Pharma Rx privacy + seller queue index (migration `0023`)

Additive hardening for the seller Rx deep-link and quote integrity. No new table; the customer name is
never duplicated (the seller projection joins `checkout.users.name`), so no `customer_name` column is
added. Idempotent and re-runnable:

```sql
-- Seller queue / deep-link lookup: one seller's prescriptions by status, newest first.
CREATE INDEX IF NOT EXISTS prescriptions_vendor_status_idx
  ON pharma.prescriptions (vendor_id, status, created_at DESC);

-- Quote integrity mirrored at the DB edge (NOT VALID: pre-existing rows untouched, enforced on write).
ALTER TABLE pharma.quote_items
  ADD CONSTRAINT quote_items_price_le_mrp CHECK (mrp_paisa = 0 OR price_paisa <= mrp_paisa) NOT VALID;
ALTER TABLE pharma.quote_items
  ADD CONSTRAINT quote_items_discount_le_price CHECK (discount_paisa <= price_paisa) NOT VALID;
```

Reads/writes: `GET /seller/prescriptions/{id}` (single Rx, same name-only-until-READY projection as the
list; cross-seller id → 404), `GET /venues/{id}` (single venue, PII-redacted for anon, cached
`directory:venue:{id}` 24 h), `GET /orders/tracking/{id}` (owner-scoped lightweight order status), admin
`POST /notifications/drain` (one-shot outbox drain; 503 without a push provider). The gateway handler
also rejects `price > mrp` (when an MRP is authored) and makes a repeated `READY` a no-op (no duplicate
`status_history` row, no duplicate `RX_READY` notification). No RLS change — `pharma.prescriptions`
keeps its owner read-only policy, and every seller/admin write is gateway `service_role`.

### 12.15 Mart vendor-inventory read (migration `0024`)

The buyer vendor drill-in (`GET /stores/{id}/products`) filters `catalog.products` by
`store_id = $1 AND status = 'ACTIVE'`. The pre-existing `products_store_idx` (0001) and
`products_status_idx` (0015) do not cover the joint filter, so add a composite index. The seeded
catalog rows were inserted before `status` existed and defaulted to `DRAFT`; backfill them (scoped to
sellerless demo rows so a real seller's DRAFT/PENDING_REVIEW is never promoted) — otherwise the
ACTIVE-only endpoint returns empty on a fresh seed. `generate.mjs` now writes `status = 'ACTIVE'` for
every seed row. Additive and idempotent:

```sql
CREATE INDEX IF NOT EXISTS products_store_status_idx ON catalog.products (store_id, status);

UPDATE catalog.products SET status = 'ACTIVE'
 WHERE status = 'DRAFT' AND seller_id IS NULL;
```

Reads: `GET /stores/{id}/products` (anonymous, keyset-paginated by `(rating DESC, id ASC)`, only
`ACTIVE` rows, PII-free product projection). The first page is cached `catalog:store-products:{storeId}`
300 s (caching doc §5) and purged on `PRODUCT_EDIT` / status change. No new table — the Mart hero
banners and Daily Essentials rail are SDUI-owned (`sdui_layouts/home` sections `martHero`/`martEssentials`,
§8.1 / `docs/architecture/data-layer-sdui.md`); `mf-*` ghost ids were retired for real `gr-*` catalog ids.

### 12.16 Media registry — R2 bytes, SQL identity (migration `0025`)

Enterprise rule: **bytes in object storage, identity in SQL**. Every image write pipeline before `0025`
was broken or bypassed the gateway — the portal uploaded to Supabase Storage and the gateway never
linked the key (orphaned upload), store/menu images were free-text URLs, and seed rows hotlinked
unsplash. `0025` adds one identity row per image (`media` schema) whose bytes live in **Cloudflare R2**;
the gateway (`internal/media` + `internal/platform/r2`) is the only minter/signer, and binary never
proxies through it (clients PUT/GET directly with presigned URLs).

```sql
CREATE SCHEMA media;
CREATE TYPE asset_kind   AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE asset_status AS ENUM ('DRAFT', 'ACTIVE', 'REJECTED');

CREATE TABLE media.assets (
  id         text PRIMARY KEY,          -- 'img_*' minted by the gateway
  owner_type text NOT NULL DEFAULT '',   -- PRODUCT|STORE|MENU|BRAND|BANNER|AVATAR|PRESCRIPTION|KYC|''
  owner_id   text NOT NULL DEFAULT '',
  kind       asset_kind NOT NULL,        -- PUBLIC → faazio-public; PRIVATE → faazio-private
  bucket     text NOT NULL,
  r2_key     text NOT NULL,              -- immutable content-addressed key
  mime       text NOT NULL DEFAULT '',
  bytes      int8 NOT NULL DEFAULT 0,
  width      int4, height int4,
  hash       text,                       -- sha256 hex; NULL when the client cannot compute it
  status     asset_status NOT NULL DEFAULT 'DRAFT',
  created_by text NOT NULL DEFAULT '',   -- app user / seller slug
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Indexes: `UNIQUE(r2_key)` + `UNIQUE(hash)` (sha256 de-dup), `(owner_type, owner_id)`,
`(status, created_at DESC)`. A `pg_notify('media_updated', {id,status,r2_key,kind})` trigger (plus the
`0014` `util.touch_updated_at`) drives cache/CDN purge on confirm/status/delete.

Owner link columns (nullable → backfill; `image_url`/`cover_image`/`image` stay as the offline/legacy
fallback): `catalog.products.image_key`+`image_asset_id`, `directory.stores.cover_image_key`+
`cover_image_asset_id`, `directory.menus.image_key`+`image_asset_id`.

RLS (Supabase only): anon/authenticated may `SELECT` **ACTIVE PUBLIC** rows and a creator may read
their own row (incl. PRIVATE); **writes are service_role only** (no insert/update policy).

Endpoints (`internal/media`): `POST /media/upload-url` (auth; validate `image/{jpeg,png,webp}` ≤ 8 MiB,
mint DRAFT + deterministic key, return 300 s presigned PUT), `POST /media/confirm` (auth; DRAFT→ACTIVE +
owner link + cache purge), `GET /media/resolve?ids=` (anon batch of ACTIVE PUBLIC → public URLs, Valkey
24 h), public `GET /assets/*` (stable no-CDN path → 302 presigned GET on the public bucket; unused when
`R2_CDN_BASE` is set), `GET /media/private/{id}` (creator/admin; 300 s presigned GET), `PUT /media/{id}/status` +
`DELETE /media/{id}` (admin moderation/GC), `POST /media/gc` (admin; one synchronous GC pass — 503 when
R2 unset). Key minting: with a hash → `media/{hash:2}/{hash}.{ext}` (content-addressed, cache-forever);
without → `media/{yyyy}/{mm}/{img_id}.{ext}`.

Config: `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_PUBLIC_BUCKET` /
`R2_PRIVATE_BUCKET` / `R2_CDN_BASE` (optional custom domain, e.g. `img.faazio.in`) / `PUBLIC_BASE_URL`
(the gateway's own origin, used for `/assets/{key}` when no CDN domain). Owning contexts link a confirmed
asset via `imageKey` or `imageAssetId` — `PUT /seller/products/{id}` (catalog), `POST`/`PUT /seller/menus/…`
(directory), `PUT /seller/stores/{id}/cover` (directory) — resolving ownership through the
`contracts.MediaReader` interface (never a sibling import). Read selects (`productSelect`/
`productListSelect`, `storeSelect`/`storeListSelect`, `SellerMenus`, `Menu`) coalesce
`nullif(image_key,'')` and decorate to the configured media base (`${R2_CDN_BASE}/{key}`, or
`${PUBLIC_BASE_URL}/assets/{key}` when no CDN), so `image`/`coverImage`/menu `image` are always
displayable (legacy text URL is the fallback; with neither base set the key is ignored and the legacy
URL is used). Rx images prefer the R2 private bucket,
falling back to Supabase Storage when R2 is unset (`internal/pharma/storage.go`). Cache:
`media:asset:{id}` 24 h (caching doc §5/§8).

**Seed / backfill (Phase 7).** `server/supabase/seed/lib/{databuild,r2,mediaplan,constants}.mjs` share
one @data compile (`databuild`), the Node SigV4 presigner (`r2`, mirrors `internal/platform/r2`), the
content-addressed key/id derivation + SQL emitters (`mediaplan`), and the key prefix/MIME allowlist
(`constants`). `backfill_r2.mjs` downloads the **288 distinct** product/store/menu image URLs (541
references), sha256s them → `media/{hash:2}/{hash}.jpg` + `img_<16hex>`, PUTs to `faazio-public` via a
presigned URL, and writes `media_manifest.json` + `backfill_media.sql` (idempotent `media.assets`
insert + owner links). `generate.mjs` then reads `media_manifest.json` (when present) to emit the
`media.assets` rows + `image_key`/`*_asset_id` columns in `0001_seed.sql` — absent manifest, every key
stays null and the legacy unsplash URL remains the fallback. Runbook:
`docs/RUNBOOKS/DATA_FIXTURES.md` → "R2 image backfill".

**GC + purge (Phase 8, migration `0026`).** Two workers (built in `cmd/server`, both disabled when
R2/Cloudflare are unset):

- **GC sweeper** (`internal/media/sweeper.go`) — reclaims orphaned uploads: every DRAFT older than the
  24 h draft TTL gets its R2 object deleted (`r2.DeleteObject`, presigned DELETE) then its row dropped.
  Runs every 6 h; the admin `POST /media/gc` runs one synchronous pass (`contracts.Sweeper`). Scans via
  the `0025` `media_assets_status_idx (status, created_at desc)`.
- **CDN purge worker** (`internal/media/purger.go`) — `LISTEN media_updated` on a dedicated connection
  and purges the affected CDN URL. `0025` emits on insert/update; `0026` adds a DELETE trigger
  (`media.notify_asset_delete`) carrying the OLD `r2_key` so a removed/reclaimed asset stops serving
  from the edge. The purge is a Cloudflare `purge_cache` call (`internal/platform/cloudflare`), enabled
  by `CF_ZONE_ID` + `CF_API_TOKEN` (≤30 files/request; best-effort — a disabled purger just lets the
  Cache Rule expire). This is why content-addressed keys can still be invalidated on moderation/delete.

### 12.17 Seller hero campaigns — self-serve poster creative + deep-link target (migrations `0027`–`0028`)

`ads.sponsored_slots` (`0015`) can only promote a product on a rail: no poster, no deep-link target, no
placement/schedule. `0027` adds the second creative surface — a seller-owned **hero campaign** — without
touching the rail table. One row = one (campaign, placement), so a single publish on several placements
is measured independently (`campaign_id` groups them).

`0028` moves this surface **self-serve**: a verified seller publishing their OWN item on a fitting
placement goes straight to `LIVE` (no admin approval queue — the gateway machine-checks ownership,
placement fit, creative bounds, per-seller cap and daily rate). `REJECTED` now means *taken down for
abuse* (admin only); `REQUESTED`/`APPROVED` are deprecated (kept for old rows, never minted again).

```sql
-- new ad_placement values (additive): HOME_HERO, MART_HERO, PHARMA_HERO, FOOD_HERO, CATEGORY_TOP, STORE_TOP
CREATE TYPE ad_creative_type AS ENUM ('RAIL', 'HERO');
CREATE TYPE ad_target_type   AS ENUM ('PRODUCT', 'DISH', 'STORE', 'VENUE');

CREATE TABLE ads.campaigns (
  placement_id      text PRIMARY KEY,              -- 'ad-cmp-*' minted by the gateway
  campaign_id       text NOT NULL,                 -- groups the placements of one seller publish
  seller_id         text NOT NULL REFERENCES sellers.sellers(seller_id) ON DELETE CASCADE,
  creative_type     ad_creative_type NOT NULL DEFAULT 'HERO',
  placement         ad_placement NOT NULL,         -- MART_HERO | CATEGORY_TOP | STORE_TOP | …
  target_type       ad_target_type NOT NULL,
  target_id         text NOT NULL CHECK (char_length(target_id) BETWEEN 1 AND 64),
  target_app        app_brand NOT NULL,
  category          text CHECK (category IS NULL OR char_length(category) <= 64), -- CATEGORY_TOP scope
  store_id          text CHECK (store_id IS NULL OR char_length(store_id) <= 64), -- STORE_TOP scope
  title             text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40),
  subtitle          text NOT NULL DEFAULT '' CHECK (char_length(subtitle) <= 60),
  image_url         text NOT NULL DEFAULT '' CHECK (char_length(image_url) <= 512), -- resolved URL (SDUI-banner rule)
  cta               text NOT NULL DEFAULT '' CHECK (char_length(cta) <= 24),
  state_code        char(2),
  starts_at/ends_at timestamptz CHECK (ends_at > starts_at),
  status            ad_status NOT NULL DEFAULT 'LIVE',  -- 0028: instant publish
  reports           int4 NOT NULL DEFAULT 0,            -- 0028: user "Report ad" taps (no PII)
  takedown_reason   text CHECK (takedown_reason IS NULL OR char_length(takedown_reason) <= 280),
  impressions/clicks INT4, orders_attributed INT8,
  requested_at/updated_at timestamptz,
  CHECK (ends_at <= starts_at + interval '90 days')     -- 0028: campaign_window_max (NOT VALID)
);
```

Indexes: `(placement, status, ends_at)`, `(seller_id)`, `(campaign_id)` (all `0027`); `0028` adds the
cap lookup `(seller_id, placement) WHERE status='LIVE'` and the anon read
`(status, placement, target_app, category, store_id, ends_at, requested_at DESC)`. The creative is a
bounded, already-resolved public URL mirroring the SDUI banner leaf (`SduiBanner.image_url`) — the
portal uploads to R2 and stores the resolved CDN URL, so the app renders it as-is (no `image_key`
round-trip). The target must be an item the seller owns (handler-enforced against
`catalog.products`/`directory.menus`/`directory.stores`/`directory.dining_venues`), so a hero can never
deep-link another seller's product. RLS: a seller reads their own rows; admins read by scope (mirrors
`0015`). Endpoints: caching doc §5, `mvp-backend.md` §3 and `monolith-breakdown.md` §1 (`ads` row).

### 12.18 Portal auth — gateway-native credentials + rotating refresh (migrations `0032` + `0033` + `0034` + `0038`)

The Partner Portal sign-in is gateway-native: `0032` adds the durable credential + session store,
`0033` widens the issued roles to `SELLER` and `STATE_ADMIN` with a scope, and `0034` clears the
forced-rotation flag on seeded `SUPER_ADMIN` rows (superadmins are never confined). No GoTrue/Firebase-Web
dependency, because the gateway already owns the role gate and the audit trail.

```sql
CREATE TABLE admins.portal_users (
  user_id             text PRIMARY KEY,            -- stable slug, e.g. 'pu-super-1'
  email               text NOT NULL,               -- PII; unique on lower(email)
  display_name        text NOT NULL DEFAULT '',
  password_hash       text NOT NULL,               -- Argon2id PHC (pepper applied upstream)
  role                text NOT NULL DEFAULT 'SUPER_ADMIN'
                        CHECK (role IN ('SUPER_ADMIN','STATE_ADMIN','SELLER')),   -- 0033
  seller_id           text REFERENCES sellers.sellers(seller_id) ON DELETE CASCADE, -- 0033, SELLER only
  state_code          text CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),  -- 0033, STATE_ADMIN only
  active              boolean NOT NULL DEFAULT true,
  must_change         boolean NOT NULL DEFAULT true,   -- forced rotation; not applied to SUPER_ADMIN (0034)
  failed_attempts     int4 NOT NULL DEFAULT 0,
  locked_until        timestamptz,                 -- durable 5-failure → 15 min lockout
  last_login_at       timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at/updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_users_scope_check CHECK (
    (role = 'SUPER_ADMIN' AND seller_id IS NULL AND state_code IS NULL) OR
    (role = 'SELLER'      AND seller_id IS NOT NULL AND state_code IS NULL) OR
    (role = 'STATE_ADMIN' AND seller_id IS NULL AND state_code IS NOT NULL)
  )
);
CREATE UNIQUE INDEX portal_users_email_lower_uniq ON admins.portal_users (lower(email));

CREATE TABLE admins.portal_sessions (
  token_hash            text PRIMARY KEY,          -- sha256(raw refresh token), hex
  session_id            text NOT NULL,             -- refresh family id (many rows per family)
  user_id               text NOT NULL REFERENCES admins.portal_users(user_id) ON DELETE CASCADE,
  expires_at            timestamptz NOT NULL,      -- sliding idle expiry (last rotation + 30 d)
  used_at               timestamptz,               -- set once on rotation; a replay inside grace is idempotent
  revoked_at            timestamptz,
  ip_hash               text NOT NULL DEFAULT '',  -- sha256(client ip) prefix; no raw IP
  absolute_expires_at   timestamptz NOT NULL DEFAULT (now() + interval '180 days'), -- 0038 hard cap (never extended)
  last_seen_at          timestamptz,               -- 0038 latest rotation/activity
  reuse_grace_until     timestamptz,               -- 0038 replay window (30 s): inside = grace, after = theft
  ua_hash               text NOT NULL DEFAULT '',  -- 0038 sha256(User-Agent) prefix; no raw UA
  rotated_to_hash       text,                      -- 0038 child token this row rotated to (grace-chain)
  created_at            timestamptz NOT NULL DEFAULT now()
);
```

Indexes: `(lower(email))` unique, `(active)`, `(seller_id) WHERE seller_id IS NOT NULL`,
`(state_code) WHERE state_code IS NOT NULL`, `portal_sessions(session_id)`, `portal_sessions(user_id)`,
`portal_sessions(expires_at)`, `portal_sessions(absolute_expires_at)` (0038), `portal_sessions(rotated_to_hash)
WHERE rotated_to_hash IS NOT NULL` (0038).
RLS is enabled and `anon`/`authenticated` are revoked: the gateway (service_role) is the only writer and
direct Supabase clients never see credential/session rows. **No seed INSERT ships** — the two accounts
are provisioned manually with `tools/hash-password` (runbook `PORTAL_AUTH.md`); seller and state-admin
logins are issued at runtime by `POST /admin/portal-users` (superadmin only) and can be disabled or
password-reset per `PUT /admin/portal-users/{id}` and `PUT /admin/portal-users/{id}/password`.
`must_change` confines only scoped roles: a new/reset `SELLER`/`STATE_ADMIN` defaults to a forced first
rotation (the request may set `forceChange:false`), while `SUPER_ADMIN` is never forced — its password
is active immediately, and `0034_portal_superadmin_no_force.sql` repairs any seeded superadmin row.

Session lifecycle (`0038` adds the GCP-style lifetimes): access = HS256 JWT (`iss=faazio-portal`, `aud=portal`,
`app_role`, optional `seller_id`/`state_code`, `must_change`, 15 min, `jti`); refresh = opaque `faazio_pr_*`
(32 random bytes, SHA-256 at rest, **30-day sliding idle**, **180-day absolute cap** set at login and never
extended, **30-second reuse grace**). The verifier requires `seller_id` for a seller token and a 2-letter
`district_code` (or legacy `state_code`) for a district-admin token, and rejects any other role. Each rotation consumes the presented row
atomically (`used_at`, `reuse_grace_until=now()+30s`, `rotated_to_hash=<child>` in one `UPDATE ... WHERE
used_at IS NULL AND revoked_at IS NULL AND expires_at > now() AND absolute_expires_at > now()`) and inserts a
child under the same family + absolute cap. A replay *inside* the grace window is an idempotent rotation
(`PORTAL_REFRESH_GRACE`, `X-Refresh-Reused`), a replay *after* it revokes the family (`invalid_refresh_reuse`),
an absolute-cap hit revokes the family (`session_expired_absolute`), and an idle lapse revokes **only that
row** (`session_expired_idle`) so one lapsed device never logs the others out. Logout denylists the access
`jti` in Valkey (≤15 min) and revokes the family; password change rotates
the hash, clears `must_change`, revokes every session and denylists the current token. An admin reset
sets `must_change` to the effective `forceChange` (default false for `SUPER_ADMIN`, true otherwise),
also clearing the lockout and revoking every session. Cache keys/TTLs:
caching doc §5, endpoints + ownership: `monolith-breakdown.md` §1 (`portal auth` row).

### 12.19 State-admin identity guard — duplicates become impossible (migration `0036`)

**Authority:** `monolith-breakdown.md` §1 (`admins` row), `web-portal.md` (the `/admin/super/district-admins`
unified creation), `PORTAL_AUTH.md` §3.

Why: `0015` shipped `admins.state_admins` with **no** uniqueness constraint, so two roster rows could
share `Admin@x.com` / `ADMIN@x.com`, and portal login + roster were two disconnected inserts
(`POST /admin/portal-users` after `POST /district-admins`) that could diverge (orphan roster / orphan
login). This migration makes duplicate emails durable-impossible and backs the `POST /district-admins`
collision gate. **Identity policy (superadmin decision, 2026-10):** email is the ONE-PERSON-ONE-ROLE
key and is hard-blocked everywhere; **phone is a SOFT warning** — a shared line can legitimately cover
several people (team/SME phones), so a shared phone never blocks creation, only surfaces as a `201
warnings[]` notice.

```sql
-- Roster email uniqueness (case-insensitive) — the missing guard. A->B API checks race; this is
-- the for-sure rule: two rows can never share an email again.
CREATE UNIQUE INDEX IF NOT EXISTS state_admins_email_lower_uniq
  ON admins.state_admins (lower(email));

-- Roster phone lookup — NOT unique (shared phones are allowed by policy). Digits-only equality so
-- '+91 90000 00000' / '919000000000' / '09000000000' are the same person; the soft shared-phone
-- warning uses this index to find pre-existing rows fast (incl. legacy formatted ones). The older
-- draft's UNIQUE index is dropped (idempotent) so creation can never hard-block on phone.
DROP INDEX IF EXISTS admins.state_admins_phone_digits_uniq;
CREATE INDEX IF NOT EXISTS state_admins_phone_digits_idx
  ON admins.state_admins (regexp_replace(phone, '\D', '', 'g'));

-- Seller phone digit lookup (soft warning: a district-admin phone already owned by a seller).
CREATE INDEX IF NOT EXISTS sellers_phone_digits_idx
  ON sellers.sellers (regexp_replace(phone, '\D', '', 'g'))
  WHERE phone IS NOT NULL AND phone <> '';
```

New confirms:
- `admins.portal_users` has `portal_users_email_lower_uniq` (`lower(email)`, `0032`) — the
  **cross-role gate**: a `STATE_ADMIN`/`SELLER` email can never shadow a `SUPER_ADMIN` email.
  `state_admins` roster rows do **not** FK to `portal_users` (a roster can be pre-provisioned
  without a login); the link is the shared `lower(email)`, joined at write time by
  `internal/admins` (Provisioner).
- `sellers.sellers` has **no email column** (`0015` table def), so the only SELLER collision axis is
  phone digits (`sellers_phone_digits_idx`) — and that is a warning, not a 409. A seller-belonging
  email is caught via `portal_users` (a SELLER credential row uses the same email table), hence
  `email_used_by_seller`.
- Phone storage: `admins.state_admins.phone` is normalized to the bare 10 digits going forward
  (backend `NormalisePhone`: strip non-digits, drop one leading `91`/`0`, require exactly 10); legacy
  rows keep their format and are matched by the digits expression. Duplicate phones across roster rows
  are expected and allowed.

### 12.20 Audit-log retention — rolling 7-day window (migration `0037`)

**Authority:** `monolith-breakdown.md` §1 (`admins` row), `caching-cloudflare-valkey.md` §8, `web-portal.md`
(audit-log copy note), `mvp-backend.md` §12 (entry 20), `RUNBOOKS/TROUBLESHOOTING.md`.

`0015` shipped `admins.audit_logs` as **append-only by convention** — no RLS UPDATE/DELETE policy, so
the portal promise "nothing here can be edited or deleted" held forever. This retention migration
converts the trail into a **rolling 7-day window** (`DELETE > 7d`, **all roles** — SELLER,
STATE_ADMIN, SUPER_ADMIN; no archive): rows older than 7 days are deleted, so a mass un-OOP-able
forensics/log table is instead bounded. The portal stays read-only (no new RLS policy; no DELETE grant).

```sql
CREATE OR REPLACE FUNCTION admins.purge_audit_logs(max_age INTERVAL DEFAULT INTERVAL '7 days')
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
-- batched: delete in 2000-row ctid chunks so a first-run mass purge never takes one long lock
-- (media GC batch philosophy); returns the total deleted.
$$;
```

**Scheduler (superadmin decision, 2026-10): the gateway worker on Render, NOT pg_cron.** `main.go`
constructs `admins.NewPurger(...)` and runs `Purger.Run(ctx)`, which fires at **00:00 IST** every day
(IST = UTC+5:30, no DST — a fixed `time.FixedZone`; the `nextMidnightIST` math is unit-tested). The
migration deliberately does **not** `cron.schedule` so two schedulers can never double-fire; the
optional `18 30 * * *` (00:00 IST) pg_cron equivalent is documented in the migration header for a team
that wants an out-of-band scheduler. A missed midnight (Render free-tier sleep, deploys) just means the
next day's pass purges a slightly wider window in the same batched delete. Every pass records a
surviving `AUDIT_PURGE` row (`action='AUDIT_PURGE'`, `after={deleted, cutoff}`) so purges are visible
in-trail; the row is written after the cutoff and therefore survives the very purge it reports.

**Manual trigger:** SUPER_ADMIN-only `POST /audit-logs/purge` (gateway) runs one pass on demand with
the caller's JWT identity in the `AUDIT_PURGE` row — parity with `POST /media/gc` for staging/test.

**First-run mass delete warning:** if the table holds months of pre-0037 history, the first 00:00 IST
pass deletes it all (batched). Check before deploying:
`SELECT count(*) FROM admins.audit_logs WHERE created_at < now() - interval '7 days';`
Purged rows are unrecoverable — there is **no archive** (superadmin decision, 2026-10).

### 12.21 Seller onboarding + Razorpay Route split (migration `0039`)

**Authority:** `monolith-breakdown.md` §1 (`sellers` + `settlement` rows), `mobile-app.md`
("Sell with us"), `server-gateway-plan.md`, `web-portal.md` (seller review), `RUNBOOKS/RELEASE.md`
(Route env), `RUNBOOKS/TROUBLESHOOTING.md`.

`0039` is additive. Existing sellers keep working: `platform_fee_pct` defaults to `10` and
`otp_verified` defaults to `false` (legacy rows predate the OTP gate).

```sql
ALTER TABLE sellers.sellers
  ADD COLUMN platform_fee_pct SMALLINT NOT NULL DEFAULT 10 CHECK (platform_fee_pct BETWEEN 1 AND 100),
  ADD COLUMN razorpay_linked_account_id TEXT,
  ADD COLUMN contact_email TEXT NOT NULL DEFAULT '',
  ADD COLUMN fssai_number TEXT, ADD COLUMN fssai_cert_key TEXT, ADD COLUMN fssai_cert_asset_id TEXT,
  ADD COLUMN otp_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN otp_verified_at TIMESTAMPTZ,
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN rejection_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE sellers.bank_accounts ADD COLUMN bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sellers.kyc_documents ADD COLUMN asset_id TEXT;          -- media.assets id
ALTER TYPE kyc_doc_type ADD VALUE IF NOT EXISTS 'PASSBOOK';
ALTER TYPE kyc_doc_type ADD VALUE IF NOT EXISTS 'FSSAI';

CREATE TABLE sellers.kyc_verification_log (   -- append-only manual PAN/GSTIN/FSSAI/passbook checks
  log_id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES sellers.sellers ON DELETE CASCADE,
  doc_type kyc_doc_type NOT NULL, verified_by TEXT NOT NULL, verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NOT NULL DEFAULT '');

CREATE TABLE sellers.seller_request_history ( -- changed fields on a rejected resubmission
  history_id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES sellers.sellers ON DELETE CASCADE,
  field_name TEXT NOT NULL, old_value TEXT NOT NULL DEFAULT '', new_value TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT now());

ALTER TABLE payments.payouts
  ADD COLUMN razorpay_transfer_id TEXT, ADD COLUMN release_after TIMESTAMPTZ, ADD COLUMN released_at TIMESTAMPTZ;

-- 0041: optional shop pin captured by the seller map picker (public business location).
ALTER TABLE sellers.sellers ADD COLUMN latitude FLOAT8, ADD COLUMN longitude FLOAT8;
```

**Rules**
- `platform_fee_pct` is server-validated (1–100; FOOD ≥ 5) on create, admin edit and resubmission.
  Settlement reads it server-side; the client never supplies the fee at payment time.
- **No full bank account number is stored.** The gateway forwards it to Razorpay Route in memory at
  onboarding (and retries may create the account without bank details); Postgres keeps only
  `account_number_masked` (last four) + IFSC + beneficiary + bank name.
- KYC bytes live in the private R2 bucket; `kyc_documents` stores the object key + `asset_id`, never a
  URL/bytes. `/media/private/{id}` mints a 300 s GET for the creator or an admin.
- `otp_verified` is the digital-signature gate (set only after a client OTP round-trip); submission is
  rejected when false and, in a production deployment, the bearer Firebase ID token's `phone_number`
  claim must match `contact_phone` (`auth.OTPSigned`, `401 otp_unverified`) — the flag is never trusted
  on its own. The OTP runs on a disposable Firebase app so the shopper session is untouched.
- Rejection appends to `rejection_history`; `seller_request_history` records each changed field on
  resubmission. Both are deleted when an admin sets `ACTIVE` (clean state after approval).
- RLS: seller reads their own rows; district admin their district (legacy rows without a district
  and legacy state-scoped admins fall back to the parent state); super admin all. Writes stay
  `service_role` only (the gateway).
- Route transfers are stored with `on_hold` + `release_after = now() + 14 days`; the settlement
  worker releases due holds every 15 minutes when `RAZORPAY_ROUTE_*` (or the fallback
  `RAZORPAY_*`) credentials are configured, and marks the payout `PAID`.

### 12.22 Razorpay Route reconciliation + reversal (migration `0040`)

**Authority:** `server-gateway-plan.md`, `monolith-breakdown.md` §1 (settlement row),
`RUNBOOKS/RELEASE.md`, `RUNBOOKS/TROUBLESHOOTING.md`.

`0040` is additive and introduces only new terminal payout states.

```sql
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'REVERSED';
ALTER TABLE payments.payouts ADD COLUMN reversed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX payouts_transfer_uniq
  ON payments.payouts (razorpay_transfer_id) WHERE razorpay_transfer_id IS NOT NULL;
```

**Rules**
- `payments.payouts.status` lifecycle: `SCHEDULED`/`ON_HOLD` → `PAID` (release) · `FAILED`
  (`transfer.failed`) · `REVERSED` (refund/return). `released_at` / `reversed_at` stamp the terminal
  transition; `ON_HOLD` rows are the only ones the releaser sweeps.
- `POST /webhooks/razorpay/route` is public but every body must carry a valid
  `X-Razorpay-Signature` over the raw bytes using `RAZORPAY_ROUTE_WEBHOOK_SECRET` (fallback
  `RAZORPAY_WEBHOOK_SECRET`). It maps `transfer.released` → `PAID`, `transfer.failed` → `FAILED`,
  `transfer.reversed` → `REVERSED`; unknown events are acknowledged without touching money state.
  Replays are idempotent (no row moves when the status already matches).
- `POST /payouts/{id}/reverse` (SUPER_ADMIN) calls Razorpay `POST /transfers/{id}/reverse` first and
  only then marks the local row `REVERSED`; a Razorpay rejection leaves the row untouched (502).
- The webhook path keys on `razorpay_transfer_id`, now unique per payout. No payload, bank detail or
  secret is stored or logged.

### 12.23 `delivery.*` — Delivery Partner onboarding, dispatch + multi-stop execution (migrations `0042`, `0043`, `0045`)

**Authority:** `server-gateway-plan.md` (Delivery partner), `monolith-breakdown.md` §1 (delivery
row), `caching-cloudflare-valkey.md` (§4–§5 rider keys). Additive only; the customer/marketplace
tables are untouched.

| Table | Purpose |
|---|---|
| `delivery.delivery_boys` | Rider profile + KYC review state. `rider_id` PK; `user_id` links the checkout identity that receives the order-ping notification; `phone` is E.164; `state_code` + `hub_zone` scope dispatch; `vehicle_type`; `max_capacity` is hard-capped by vehicle at intake (`BICYCLE=1`, `TWO_WHEELER=2`, `FOUR_WHEELER=5`); `status` (`APPLIED → PENDING_REVIEW → VERIFIED → ACTIVE`, plus `SUSPENDED`/`BLACKLISTED`/`REJECTED`); `is_available`, `current_load`, `rating`, `completed_orders`, `last_heartbeat_at` |
| `delivery.delivery_documents` | One row per captured document (`AADHAAR`, `PAN`, `SELFIE`, `DL_FRONT/BACK`, `RC_FRONT/BACK`, `INSURANCE_FRONT/BACK`). Holds the private R2 `file_key` + optional `media.assets` id only — never a URL or bytes. `status` (`PENDING`/`VERIFIED`/`REJECTED`/`REUPLOAD_REQUESTED`), reviewer + reason |
| `delivery.delivery_bank_accounts` | Pending-review payout account. Stores the masked tail only (same rule as `sellers.bank_accounts`); the full number is never persisted |
| `delivery.delivery_orders` | Dispatch job (`ASSIGNED → ACCEPTED → ROUTE_COMPLETE`, or `REJECTED`/`CANCELLED`), store/customer-order ids, `route_sequence` JSONB, distance/ETA, `require_otp`, `expires_at` (45 s accept window). `0043` adds `dispatch_attempts` (max 5 offers) and `excluded_rider_ids` JSONB (riders who declined this job) for the fallback chain |
| `delivery.delivery_stops` | Ordered `PICKUP`/`DROP` stops with `PENDING/AT_PICKUP/PICKED_UP/AT_CUSTOMER/DELIVERED/FAILED`. `sequence` is unique per order; dispatch globally re-optimizes the rider's open stops across all accepted jobs (full VRP) and renumbers them, so the lowest sequence is the next actionable stop and each order's `route_sequence` lists its stop ids in that global order. The handover OTP is stored **hashed** (`customer_otp_hash`, SHA-256 of code + stop id) with `otp_expires_at`; plaintext never reaches Postgres. `0045` adds `otp_attempts` (locked after 5 guesses; reset when delivered) |
| `delivery.rider_heartbeats` | Optional low-frequency Postgres mirror. The authoritative live coordinate is Valkey `delivery:rider:{id}:location` (TTL 300 s) |
| `delivery.delivery_ratings` | Post-delivery 1–5 rating + comment, unique per order; the rider aggregate is recomputed in the same tx |

**Security / RLS**
- Writes are `service_role` only (the gateway). Authenticated riders may read their own rows; a
  `DISTRICT_ADMIN` may read rows in its `district_code` (legacy rows: parent `state_code`); `SUPER_ADMIN` reads all. Nothing is anon-readable.
- PII (phone, address, emergency contact, customer phone) is auth-scoped and never cached in Valkey
  or exposed to anon feeds. KYC images stay in the private R2 bucket and render through
  `GET /media/private/{id}` presigned GETs.
- Every rider mutation writes an audit row (`DELIVERY_BOY_APPLY`, `…_DOC_VERIFIED`, `…_VERIFY`,
  `…_REJECT`, `…_DOC_REUPLOAD_ADMIN`, `…_ACTIVATE`, `…_SUSPEND`, `…_BLACKLIST`, `…_ASSIGN`, `…_ACCEPT`,
  `…_REJECT_ORDER`, `…_REASSIGN`, `…_PICKUP`, `…_DELIVERED`).

**Payout engine:** the rider payout ledger was added in `0052` and extended in `0055` (see `12.25`
and `12.27`). `delivery_orders.payout_amount_paisa` stays a display projection; platform/seller
splitting, COD reconciliation, TDS and payout frequency remain out of scope.

### 12.24 District rollout + platform-fee change requests (migrations `0046`–`0050`)

**Authority:** `monolith-breakdown.md` §1 (`admins`, `sellers`, `portal auth`), `mobile-app.md`
("Sell with us", account console), `web-portal.md` (district console + fee review), `caching-cloudflare-valkey.md`
(no new cache keys). Production coverage is **Tamil Nadu (38) + Puducherry (4)** districts.

```sql
-- 0046: district master (the FK target; seeded, read-only to app roles)
CREATE TABLE admins.district_master (
  district_code TEXT PRIMARY KEY, name TEXT NOT NULL, state_code CHAR(2) NOT NULL);

-- 0047: seller district (nullable on legacy rows; validated against the master when present)
ALTER TABLE sellers.sellers ADD COLUMN district_code TEXT REFERENCES admins.district_master(district_code);
CREATE INDEX sellers_district_idx ON sellers.sellers (district_code);

-- 0048: state admins -> district admins (rename + nullable backfill; legacy state scope retained)
ALTER TABLE admins.state_admins RENAME TO district_admins;
ALTER TABLE admins.district_admins ADD COLUMN district_code TEXT REFERENCES admins.district_master(district_code);
-- scope CHECK: district_code IS NOT NULL OR state_code IS NOT NULL
-- portal_users: role STATE_ADMIN -> DISTRICT_ADMIN, add district_code, scope CHECK mirrors above
-- audit_logs actor_role CHECK widened to include DISTRICT_ADMIN

-- 0049: seller-initiated platform-fee change requests
CREATE TABLE sellers.seller_fee_change_requests (
  request_id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES sellers.sellers ON DELETE CASCADE,
  district_code TEXT, current_fee_pct SMALLINT NOT NULL, requested_fee_pct SMALLINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  admin_note TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT, reviewed_at TIMESTAMPTZ, review_reason TEXT NOT NULL DEFAULT '');
CREATE UNIQUE INDEX seller_fee_change_requests_one_pending
  ON sellers.seller_fee_change_requests (seller_id) WHERE status = 'PENDING';

-- 0050: district-precise RLS for seller data (the 0048 helper compared state only)
CREATE FUNCTION sellers.is_admin_for(p_state char(2), p_district text) RETURNS boolean;
-- SUPER_ADMIN all; STATE_ADMIN/DISTRICT_ADMIN same state + district claim match (empty row district
-- or empty claim falls back to state). seller/kyc/bank/opt-in/fee-request policies repointed.
```

**Rules**

- **Wire role is `DISTRICT_ADMIN`.** `auth.RoleStateAdmin` remains a Go alias of
  `RoleDistrictAdmin` and the gateway canonicalises any legacy `STATE_ADMIN` claim/header to
  `DISTRICT_ADMIN`; no token or DB row is written as `STATE_ADMIN` after `0048`. Existing non-TN/PY
  admins stay **state-scoped** (`district_code` NULL) because coverage is TN/PY only;
  `auth.CanActForSellerDistrict` prefers the district claim and falls back to the parent `state_code`
  (and to state for sellers with no district).
- `district_code` on sellers is **optional server-side** (legacy apps/tests submit only a state), but
  the mobile onboarding screen requires it for TN/PY and rejects a district that does not belong to
  the selected state (`400 bad_request`).
- The live `platform_fee_pct` is still immutable through `PATCH /sellers/{id}/platform-fee` for
  sellers. A seller files a **request**; a district admin (own district) or super admin approves it.
  Only `APPROVED` mutates `sellers.sellers.platform_fee_pct`; one `PENDING` request per seller is
  enforced by the partial unique index, and the seller can read only their own history.
- Cache keys/TTLs are unchanged (no district cache). RLS: district master is read-only to
  authenticated roles; seller rows, KYC/bank documents, verification history, festival opt-ins and
  fee requests are readable by the owning seller or an admin whose district matches (legacy rows with
  no district fall back to the parent state). Campaigns/coupons/ads remain state-level reads. All
  writes go through the gateway (`service_role`).

### 12.25 GST invoicing + seller tax + dynamic delivery fee + rider payouts (migrations `0051`–`0053`)

**Authority:** `monolith-breakdown.md` §1 (`checkout`, `tax` + `taxmath`, `settlement`, `delivery`),
`mobile-app.md` (tax-invoice card, partner Earnings), `web-portal.md` (GST master).
No new cache keys; invoices are immutable origin rows and are never edge-cached.

```sql
-- 0051: tax rate card + platform invoice settings
CREATE TABLE tax.tax_rates (            -- category GST master (seller picks on listing)
  tax_rate_id TEXT PRIMARY KEY, sector app_brand NOT NULL, category TEXT NOT NULL,
  gst_rate_pct SMALLINT NOT NULL DEFAULT 5 CHECK (gst_rate_pct IN (0,5,12,18,28)),
  is_active BOOLEAN NOT NULL DEFAULT true, updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (sector, category));
CREATE TABLE tax.platform_settings (    -- singleton row id = 1
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  platform_gst_pct SMALLINT NOT NULL DEFAULT 18,
  tcs_pct NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  tds_pct NUMERIC(5,2) NOT NULL DEFAULT 0.10,
  delivery_fee_paisa BIGINT NOT NULL DEFAULT 5000);
CREATE TABLE tax.tax_invoices (
  invoice_id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL UNIQUE,
  order_number TEXT NOT NULL DEFAULT '', customer_id TEXT NOT NULL,
  seller_id TEXT, seller_name TEXT, seller_gstin TEXT, tax_rate_pct SMALLINT NOT NULL,
  taxable_value_paisa BIGINT NOT NULL, product_tax_paisa BIGINT NOT NULL,
  platform_fee_paisa BIGINT NOT NULL, platform_gst_paisa BIGINT NOT NULL,
  delivery_fee_paisa BIGINT NOT NULL, tcs_paisa BIGINT NOT NULL, tds_paisa BIGINT NOT NULL,
  coupon_discount_paisa BIGINT NOT NULL DEFAULT 0, total_paisa BIGINT NOT NULL,
  seller_net_paisa BIGINT NOT NULL, pdf_key TEXT, generated_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- checkout.orders: invoice_id/taxable_value_paisa/product_tax_paisa/platform_fee_paisa/
-- platform_gst_paisa/delivery_fee_paisa/tcs_paisa/tds_paisa/total_charged_paisa
-- payments.settlement_ledger: tds_paisa, product_tax_paisa, platform_gst_paisa

-- 0053: dynamic (distance-based) customer delivery-fee rate card
CREATE TABLE tax.delivery_fee_settings (-- singleton row id = 1; gateway reads, SUPER_ADMIN edits
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  base_distance_km NUMERIC(6,2) NOT NULL DEFAULT 3.00,
  base_fee_paisa BIGINT NOT NULL DEFAULT 3500,
  per_extra_km_paisa BIGINT NOT NULL DEFAULT 700,
  updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

### 12.25b Central remote config — the "Central Digital Menu" (migration `0059`)

-- 0059: central remote config ("Central Digital Menu") — SUPER_ADMIN-edited key/value set the
-- mobile apps fetch on cold boot (GET /app-config) to override bake-time defaults, no store release
CREATE TABLE admins.app_config (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  category TEXT NOT NULL CHECK (category IN ('brand','maps','region','feature','maintenance','limits')),
  value JSONB NOT NULL DEFAULT 'null'::jsonb CHECK (octet_length(value::text) <= 4096),
  is_public BOOLEAN NOT NULL DEFAULT false,
  app_variant TEXT NOT NULL DEFAULT 'all' CHECK (app_variant IN ('customer','delivery','seller','all')),
  value_secret BOOLEAN NOT NULL DEFAULT false, description TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT is_public OR NOT value_secret));
CREATE INDEX app_config_public_idx ON admins.app_config (is_public) WHERE is_public;
CREATE INDEX app_config_variant_idx ON admins.app_config (app_variant);
CREATE INDEX app_config_category_idx ON admins.app_config (category);
-- access classes: mobile apps read public rows through the gateway (service_role, bypasses RLS);
-- direct anon/authenticated Supabase clients may SELECT only is_public rows (RLS). The gateway is
-- the only writer. value_secret rows are masked in the portal (value = null, "leave blank to keep")
-- and never served to the app; writes are audit-logged (admins.audit_logs, secret omitted).

-- 0052: rider payout engine (supersedes the "Phase 5 out of scope" note in 0042)
CREATE TABLE delivery.payout_settings ( -- singleton row id = 1
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  base_rate_paisa BIGINT NOT NULL DEFAULT 3000, base_distance_km NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  per_extra_km_paisa BIGINT NOT NULL DEFAULT 700,
  night_surge_paisa BIGINT NOT NULL DEFAULT 2000,
  weather_surge_paisa BIGINT NOT NULL DEFAULT 2500,
  festival_surge_paisa BIGINT NOT NULL DEFAULT 1500);
CREATE TYPE delivery_payout_status AS ENUM ('PENDING','PAID');
CREATE TABLE delivery.delivery_payouts (
  payout_id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE,
  rider_id TEXT NOT NULL REFERENCES delivery.delivery_boys(rider_id),
  distance_km NUMERIC(7,2) NOT NULL, base_rate_paisa BIGINT NOT NULL,
  extra_km_charge_paisa BIGINT NOT NULL, surge_paisa BIGINT NOT NULL,
  surge_reason TEXT NOT NULL DEFAULT '', total_paisa BIGINT NOT NULL,
  status delivery_payout_status NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ, paid_by TEXT, razorpay_transfer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- delivery.delivery_orders.payout_basis (distance/surge breakdown JSONB, ≤2048 bytes)
```

**Rules**

- Catalog prices are **GST-inclusive**. `taxable = gross*100/(100+rate)`, product GST =
  `gross − taxable`. The customer pays product gross + delivery fee − platform-funded coupon;
  coins are a payment tender, not a discount.
- **Platform commission is removed.** `taxmath.Compute` yields
  `platform_fee_paisa = 0` and `platform_gst_paisa = 0` regardless of `sellers.platform_fee_pct`;
  sellers keep their full GST-inclusive gross. `seller_net_paisa = gross − TCS − TDS`.
- TCS (1%) and TDS (0.1%) are withheld from seller gross and recorded on the invoice and the
  settlement ledger. The previous hardcoded `TCS: 0` in `settlement` is gone.
- **Customer delivery fee is dynamic** (replaces the flat ₹50/`delivery_fee_paisa` for new orders):
  PICKUP waives it; DELIVERY charges `base_fee_paisa` up to `base_distance_km`, then
  `base_fee_paisa + (distance_km − base_distance_km) × per_extra_km_paisa` with fractional km rounded
  to paisa (default 3 km / ₹35 / ₹7-per-km as of `0054`). Distance is Haversine between
  `directory.stores` pins and the live drop fix — the same estimate the client mirrors via
  `GET /checkout/delivery-fee`. With no live fix or no pinned store the card's `base_fee_paisa` is
  charged — the client shows the same default — so settlement never diverges from the displayed
  total (`tax.platform_settings.delivery_fee_paisa` is legacy). Rain/night/festival surge is added
  per `12.26`.
- Invoice rows are immutable; `GET /orders/{id}/invoice` is owner-scoped and returns a presigned
  R2 URL only when `pdf_key` is populated (PDF rendering is deferred; the app renders the JSON).
- Rider payout = base (₹30 / 3 km) + ₹7/km beyond + night (23:00–03:00 IST), weather/festival surge.
  `GET /delivery/payouts/{orderId}` upserts a PENDING row for the owning rider; its breakdown is
  mirrored onto `delivery.delivery_orders.payout_basis` (audit JSONB) alongside the display
  `payout_amount_paisa`; `POST /delivery/payouts/{orderId}/settle` is district-scoped for district
  admins and global for super admins (recorded Mark Paid; no Razorpay transfer). `0055` adds the
  manual allocation + dual payout columns described in `12.27`.
- RLS/grants follow the existing guarded Supabase pattern; all writes go through the gateway
  (`tax.delivery_fee_settings` is service_role-only — no client grants).

### 12.26 Server-authoritative delivery pricing: zones, weather + festival surge, payout parity (migration `0054`)

**Authority:** `monolith-breakdown.md` §1 (`checkout`, `delivery`, `weather`, `festival`, `geo`,
`pricing`), `caching-cloudflare-valkey.md` (weather keys/TTLs), `server-gateway-plan.md`
(super-admin endpoints; the portal surge UI is a follow-up).

```sql
-- 0054: ops weather budget trail + super-admin festival windows
CREATE SCHEMA ops;
CREATE TABLE ops.weather_api_usage (   -- one durable row per day (≤365/year); Valkey is the live counter
  d DATE PRIMARY KEY, calls BIGINT NOT NULL DEFAULT 0 CHECK (calls >= 0),
  fy TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE ops.festival_calendar (   -- active row's surge_paisa is the customer + rider surcharge
  id TEXT PRIMARY KEY, name TEXT NOT NULL, start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  surge_paisa BIGINT NOT NULL DEFAULT 0 CHECK (surge_paisa >= 0),
  active BOOLEAN NOT NULL DEFAULT true, created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX festival_calendar_active_window_idx
  ON ops.festival_calendar (active, start_date, end_date);

-- checkout.orders: the customer-price basis, persisted once at placement
ALTER TABLE checkout.orders
  ADD COLUMN delivery_zone_id TEXT,
  ADD COLUMN delivery_distance_km NUMERIC(7,2) CHECK (delivery_distance_km >= 0),
  ADD COLUMN delivery_surge_paisa BIGINT NOT NULL DEFAULT 0 CHECK (delivery_surge_paisa >= 0),
  ADD COLUMN delivery_surge_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN delivery_billing_basis JSONB;   -- price breakdown snapshot, ≤4096 bytes

-- align pre-0054 installs: customer extra km is ₹7 (same as the rider card)
UPDATE tax.delivery_fee_settings SET per_extra_km_paisa = 700
 WHERE id = 1 AND per_extra_km_paisa = 900;   -- never overwrite a super-admin edit
```

**Rules**

- **One distance, one rate.** The customer fee and rider payout both use the server distance
  (store pin → drop fix, Haversine) with fractional km rounded to paisa. Customer base is ₹35 / 3 km,
  rider base ₹30 / 3 km; extra km is ₹7/km to both, so Faazio keeps exactly the ₹5 base and ₹0 on
  every extra km and surge rupee.
- **Surge reasons.** Night is derived from the clock (23:00–03:00 IST) using the rider card's
  `night_surge_paisa`. Rain applies only when the drop cell is actually raining per Weather Union
  (manual override honoured). Festival applies only inside an active `ops.festival_calendar` row;
  that row's `surge_paisa` is authoritative (not the old card default). Night + rain + festival stack.
- **Zone.** The drop cell is a deterministic ~2.5 km pointy-top hex (`geo.GeoCell`) used as the
  weather cache/override key; it is not a geofence (every coordinate resolves).
- **Payout parity.** `checkout.orders` stores the charged `delivery_distance_km`,
  `delivery_surge_paisa`, `delivery_surge_reason` and the full `delivery_billing_basis`. Rider payout
  reuses that stored distance + surge when present — including a stored 0 distance — (legacy orders
  with no basis fall back to the delivery route distance + clock-derived surge). Admin
  `?weather=1&festival=1` on the payout endpoint forces a fresh derivation for testing.
- **Free-delivery coupons.** A `promo.coupons.free_delivery` coupon zeroes the customer's
  `delivery_fee_paisa` at settlement (platform-funded). The rider payout still reuses the stored
  distance/surge basis, so the pass-through is unaffected.
- **Weather budget.** Hard cap 60,000 calls per Indian financial year (Apr 1 → Mar 31), enforced by
  the gateway before every provider call; one Supabase row per day preserves the audit trail.
- **RLS/grants.** `ops.*` is service_role-only (no client grants); RLS enabled where Supabase roles
  exist. New order columns follow the existing `checkout.orders` owner-scoped reads.

### 12.27 Manual district allocation + dual rider payout mode (migration `0055`)

**Authority:** `server-gateway-plan.md` (Delivery partner), `monolith-breakdown.md` §1 (`delivery`),
`web-portal.md` (manual allocation + payout boards). Additive; no cache keys change.

```sql
CREATE TYPE delivery_payout_mode AS ENUM ('AUTOMATED', 'MANUAL');

ALTER TABLE delivery.delivery_orders
  ADD COLUMN district_code TEXT REFERENCES admins.district_master(district_code),
  ADD COLUMN payout_mode delivery_payout_mode NOT NULL DEFAULT 'AUTOMATED',
  ADD COLUMN manual_distance_km NUMERIC(7,2) CHECK (manual_distance_km >= 0),
  ADD COLUMN manual_fare_paisa BIGINT CHECK (manual_fare_paisa >= 0),
  ADD COLUMN calculated_fare_paisa BIGINT CHECK (calculated_fare_paisa >= 0),
  ADD COLUMN fare_override_reason TEXT;
-- Same five columns mirrored on delivery.delivery_payouts as the settlement audit trail.
-- district_code is backfilled from directory.stores.seller_id -> sellers.sellers.district_code;
-- legacy stores without a district stay NULL and are visible to SUPER_ADMIN only.
CREATE INDEX delivery_orders_district_status_idx
  ON delivery.delivery_orders (district_code, status, created_at DESC);
CREATE INDEX delivery_payouts_mode_status_idx
  ON delivery.delivery_payouts (payout_mode, status, created_at DESC);
```

**Rules**

- `payout_mode` is mandatory at allocation (the admin API rejects a missing/invalid value).
  Auto-dispatched legacy rows default to `AUTOMATED`.
- `AUTOMATED` settles the rate-card calculation (stored checkout distance + surge basis, legacy
  fallback route/clock). `MANUAL` requires `manual_distance_km` + `manual_fare_paisa`; settlement
  returns `409 manual_fare_required` until both are recorded. `calculated_fare_paisa` keeps the
  rate-card preview for audit even when the manual fare overrides it.
- The mode and manual fare may change while the payout is `PENDING`; once `PAID` both the payout row
  and the order fields are immutable.
- `Mark Paid` writes `status='PAID'`, `paid_at`, `paid_by` and an audit row. It is a recorded
  settlement only — no Razorpay transfer or platform/seller split is created.
- `district_code` is derived server-side from the store's seller; clients never supply it for scope.

### 12.28 Seller order decisions + rejection refund (migration `0056`)

```sql
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE checkout.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT
  CHECK (rejection_reason IS NULL OR octet_length(rejection_reason) <= 500);

CREATE INDEX IF NOT EXISTS orders_seller_status_date_idx
  ON checkout.orders (status, status_date DESC);
```

`REJECTED` is the seller's NEW→terminal decision. The accept path reuses the existing lifecycle
(NEW→PACKED) and triggers the normal auto-dispatch. Rejection records an optional reason (≤500
chars) and marks every captured `checkout.payments` row `REFUNDED` in the same transaction as the
order status, so order state + payment ledger can never diverge; `refundedPaisa` is a
response/detail projection (money state stays in `checkout.payments`) and `ORDER_REJECTED` is
enqueued to the customer after the commit. The production checkout does not persist a Razorpay payment id,
so this is a ledger refund; calling the Razorpay refund API is a future payment-capture task.
The generic `PUT /orders/{id}/status` deliberately does **not** accept `REJECTED` so a refund cannot
be skipped. It accepts the portal's upper-case lifecycle; the gateway maps `SHIPPED`/`DELIVERED`/
`CANCELLED` onto the legacy TitleCase enum labels created in `0001` before writing, and projects
them back to upper-case on seller reads.

### 12.29 Strict district scope for seller-owned catalog/directory/pharma (migration `0057`)

**Authority:** `monolith-breakdown.md` §1 (`catalog/directory`, `pharma`), `mvp-backend.md`
(management endpoint scope). No cache keys/TTLs change.

`0057` only backfills ownership already implied by the schema, so strict service-layer scope has a
deterministic owner before handlers start denying legacy rows:

```sql
-- store state from its seller
UPDATE directory.stores s SET state_code = sel.state_code
  FROM sellers.sellers sel WHERE s.seller_id = sel.seller_id AND s.state_code IS NULL;
-- product/menu owner from its store
UPDATE catalog.products p SET seller_id = s.seller_id
  FROM directory.stores s WHERE p.store_id = s.id AND p.seller_id IS NULL;
UPDATE directory.menus m SET seller_id = s.seller_id
  FROM directory.stores s WHERE m.venue_id = s.id AND m.seller_id IS NULL;
```

- `auth.AdminScope` is strict for these routes: `SUPER_ADMIN` is unscoped; `DISTRICT_ADMIN` needs a
  non-empty `district_code` and **does not** fall back to the parent state. A `SELLER` or a legacy
  state-only admin is denied by the management handlers.
- District-admin reads/writes for products, stores, menus and vendor prescriptions require the row's
  `seller_id` to resolve to a seller in that district. Rows with no seller ownership remain
  `SUPER_ADMIN`-only until an owner is assigned.
- Menus resolve the seller as dish owner → store owner → any menu owner on the venue. Seeded
  dining-venue menus (`tr-*`/`dn-*`, `seller_id='sel-food'`, no `directory.stores` row) are
  therefore editable by that seller and its district admin; a venue with no ownership at all stays
  super-admin-only. `UpsertMenu` re-checks the same owner at the repo layer (W71).
- Seller/app and admin RLS (`0050`) keeps its legacy state fallback; strict scoping is enforced in the
  gateway service layer. Media moderation and `admins` audit/customer reads are unchanged.
