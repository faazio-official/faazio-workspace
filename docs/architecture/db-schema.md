# Faazio DB Schema Bible

> **Status:** REFERENCE — MVP implemented, Future Prod planned. This is the canonical, LLM-greppable
> reference for the microservice databases behind `server/`. It answers, for every table: *which
> microservice → which DB → which language → which schema → which datatype → which cache key → which
> admin queries*. All sample rows are derived from the **real `@data/*` fixtures** (provenance noted
> per row) — nothing is invented.
> **Implemented (MVP):** the DDL in §5–§8 ships as Postgres migrations under
> `server/supabase/migrations/` (schemas, INT8 paisa, `TIMESTAMPTZ`, ENUMs verbatim) with seed under
> `server/supabase/seed/`. The CockroachDB / Tantivy / DynamoDB targets remain **Future Prod**.
>
> **MVP vs Future Prod:** the **MVP** (single authority: `docs/architecture/mvp-backend.md`) runs on
> **one Supabase (Postgres) project + MongoDB Atlas M0 + Aiven Valkey**. The CockroachDB / Tantivy /
> DynamoDB / per-service Postgres targets in this doc are **Future Prod**. See the MVP mapping in §0.
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

### MVP mapping (read this first)

The **MVP** runs each production table below on **one Supabase (Postgres) project** + **MongoDB
Atlas M0** + **Aiven Valkey**; the CockroachDB / Tantivy / DynamoDB / standalone Postgres targets
specified in this doc are **Future Prod**. Datatypes (§2) are unchanged — the policy is
Postgres-compatible.

| Production table (§) | MVP origin | Future Prod DB |
|---|---|---|
| `catalog.products` + search (§5) | Supabase `catalog` + Postgres FTS `catalog.products_search` (`tsvector`/`pg_trgm`/`unaccent`) | CockroachDB + Tantivy |
| `inventory.*` stock/carts/reservations/pickup_points (§6) | Supabase `inventory` + `SELECT … FOR UPDATE SKIP LOCKED` + `pg_cron` TTL | DynamoDB / Firestore |
| `checkout.*`, `directory.*`, `reviews.*`, `accounts.*` (§7) | Supabase schemas `checkout`/`directory`/`reviews`/`accounts`, RLS on | CockroachDB + standalone Postgres |
| `recommendations.*` (§8) | MongoDB Atlas M0 (unchanged) | Same (no change) |
| Gateway (§4) | Thin Go Chi over Supabase + Mongo + Valkey | Full gateway + gRPC microservices |

Full MVP matrix, RLS classes, and endpoints: `docs/architecture/mvp-backend.md`.

---

## 1. Service ⇄ Database ⇄ Language master matrix

| # | Service | Language | Database | DB role | Cloud Run spec | Talks to |
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

**MVP narrowing (migrations `0004`–`0006`).** The Postgres MVP applies a byte diet on top of this
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
| `recommendations.*` (user_events/segments/product_stats/sdui_layouts) | `data/home/sdui.ts` | MongoDB |

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

> **MVP:** Supabase `catalog.products` + Postgres FTS `catalog.products_search` (`tsvector` + `pg_trgm`
> GIN + `unaccent`, `search_tokens` generated col) replace the Tantivy index. The Tantivy spec below is
> **Future Prod**; the datatypes here stay.

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
  rating        REAL NOT NULL DEFAULT 0,     -- 0..5, 1-decimal (MVP 0005; Future Prod f64/FAST)
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

> **MVP:** Supabase `inventory` schema; atomic decrement via `SELECT … FOR UPDATE SKIP LOCKED`, TTL
> sweep via `pg_cron` (replaces DynamoDB condition expressions + TTL). The DynamoDB/Firestore mapping
> below is **Future Prod**.

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

> **MVP:** the `checkout`, `directory`, `reviews`, and `accounts` schemas all live in the one Supabase
> project (RLS on); the CockroachDB + standalone Postgres split below is **Future Prod**. DDL is
> Postgres-compatible.

**One DB, three logical schemas** (all ownership-annotated): `checkout` (primary owner), `catalog`
(documented in §5 — physical home), `accounts` (§8), `directory` (§7.5), `reviews` (§7.6).

### 7.1 `checkout.users` — source `data/checkout/orders.ts` `usersTable`, `data/accounts/profile.ts`

```sql
CREATE TYPE fulfillment_mode AS ENUM ('DELIVERY','PICKUP');
CREATE TYPE order_status   AS ENUM ('Processing','Shipped','Delivered','Cancelled');

CREATE TABLE checkout.users (
  user_id          TEXT PRIMARY KEY,        -- 'user-1'
  user_uid         UUID NOT NULL DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,           -- PII
  default_address_id TEXT REFERENCES checkout.addresses(address_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Bytes | Why | Index |
|---|---|---|---|---|
| `user_id` | TEXT PK | 6 | stable slug | PK |
| `user_uid` | UUID | 16 | join key | btree |
| `name` | TEXT | ~12 | display | — |
| `email` | TEXT | ~24 | contact (**PII**) | unique btree |
| `phone` | TEXT | ~14 | contact (**PII**) | unique btree |
| `default_address_id` | TEXT | 6 | FK | btree |
| `created_at` | TIMESTAMPTZ | 8 | audit | — |

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

### 7.3 `checkout.coupons` — source `data/checkout/orders.ts` `couponsTable` + `data/cart/coupons.ts`

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
  qty          SMALLINT NOT NULL,     -- app caps qty at 99 (MVP 0005)
  unit_price_paisa INT8 NOT NULL
);
```

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
  hours         TEXT
);
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
dining venue. `directory.vendors` is a derived identity view (ids + names only); the
full food venue-data migration is a separate task.

```sql
-- Derived view: stores + dining venues, identity only.
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

**O(1) rating aggregate (MVP 0004).** `GET /vendors/:id/reviews/summary` reads a
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

> **MVP:** MongoDB Atlas M0 is kept **as-is** (no change); the Python service is Future Prod — the thin
> gateway reads `sdui_layouts` directly (ID-only) until then.

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
    { id: 'adBanner', title: 'Offers', accent: '#111827', productIds: [], storeIds: [] },
    { id: 'hotBrandDeals', title: 'Deals of the day', accent: '#1162D3',
      productIds: ['hbd-1','hbd-2','hbd-3','hbd-4','hbd-5'] },
    { id: 'dealsOfDay', title: 'Daily Essentials', accent: '#F25C3D',
      productIds: ['md-1','md-2','md-3','md-4','md-5','md-6'] },
    { id: 'mens', title: 'Men', accent: '#1162D3',
      productIds: ['men-1','men-2','men-3','men-4','men-5','men-6'] },
    { id: 'filterFeed', title: 'Filter Feed', accent: '#8B5CF6', productIds: [], chips: [...] }
  ],
  updatedAt: ISODate(...)
}
```

(provenance `data/home/sdui.ts:63-78` — section ids/titles/accents/productIds exact).

| Field | BSON type | Why |
|---|---|---|
| `_id` | ObjectId/string | layout key |
| `version` | int32 | cache invalidation bump |
| `sections[].id` | string | section kind |
| `sections[].productIds` | array<string> | **ID-only** refs to catalog |
| `sections[].storeIds` | array<string> | refs to directory.stores |
| `sections[].chips` | array<doc> | filter chips (ID-only) |
| `updatedAt` | Date (int64 millis) | freshness |

The gateway emits `ETag: "home-v{version}"` on `GET /sdui/home`; a matching `If-None-Match` returns
`304`, so repeat polls cost ~50 B instead of the full compiled tree.

### 8.2 `user_events` (TTL)

Raw user-behavior events (browse/view/add-to-cart), **ID-only + no PII**, auto-expired.

```js
{ _id: ObjectId, userIdHash: 'sha256…', productId: 'fm-f1', event: 'view', at: ISODate(), expiresAt: ISODate() }
```

**MVP (live):** written by `POST /events` (`server/gateway/internal/reco/repo.go`); the 90-day
TTL is the native Mongo TTL index `user_events_ttl` (`expireAfterSeconds: 0` on `expiresAt`),
created by `server/supabase/seed/mongo/seed.js`. The handler bounds the vocabulary to
`event ∈ {view, cart_add, order, search}` and `productId ≤ 64` chars so the Atlas M0 collection
cannot be grown with junk. The raw `user_id` is never stored — only the `sha256:` hash. The seed also
installs a `$jsonSchema` validator (`collMod`, `validationAction: "error"`) as write-time
defence-in-depth behind the handler allowlist. `user_events` stays **write-only** (no read index):
the TTL index is the only index, keeping M0 writes/space minimal.

### 8.3 `recommendations` / `segments` / `product_stats`

> **MVP status:** these three collections are **empty** — MongoDB in the MVP is exactly
> **`sdui_layouts` + `user_events`** (kept live), roughly 10% of the data surface. The shapes below
> are Future Prod; an empty collection is created lazily on first write.

- `recommendations`: precomputed per-user (`userIdHash`) or per-segment product-id lists, ID-only.
- `segments`: user-segment mappings (ID-only).
- `product_stats`: aggregate view/cart/order counts per product id (ID-only, no PII).

**Access patterns:** fetch precomputed recommendation list → return ID-only ids → gateway joins
catalog. **Cache:** `faazio:v1:reco:{userIdHash}:{context}` (TTL 1 h); `faazio:v1:sdui:home:{version}`
(edge TTL 300 s). **Invalidation:** on `user_events` batch flush / layout version bump.

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

- **MVP implemented, Future Prod plan-only.** The Postgres migrations
  (`server/supabase/migrations/0001–0006`) and generated seed exist on disk; the CockroachDB /
  Tantivy / DynamoDB / Python targets do **not**. The DDL below is the authority those migrations
  port from. `0004` adds lean indexes + guards, `0005` the type byte diet, `0006` the checkout
  idempotency table.
- **Sample rows** are `@data/*`-derived where noted; the `stock` numbers are **algorithm-derived**
  (not hardcoded) to avoid drift, and `ph-c1`/`sp-1` point to their fixture files rather than repeating
  values.
- The **datatype choices** cite real type systems (CockroachDB ENUM/INT8/TIMESTAMPTZ, Tantivy
  STORED/INDEXED/FAST, DynamoDB attribute types, BSON int32/int64/Date) but are **recommendations** —
  final DDL tuning happens when the backend is built.
- Ownership of the CockroachDB cluster is **shared across logical schemas** (`catalog`, `directory`,
  `reviews`, `accounts`, `checkout`) — each owned by its service, physically co-located. This is
  documented per section and may be split into separate clusters later.
- The **cache layer** decision (Aiven Valkey + Cloudflare) supersedes the older "Upstash Redis"
  mentions in `server/README.md` / `server-gateway-plan.md` — see those docs' decision notes.
