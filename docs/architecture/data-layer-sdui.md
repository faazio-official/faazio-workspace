# Data Layer & SDUI Deep-Dive

> **Status:** LIVE (data) / PLANNED (server-driven SDUI) · **Scope:** root `data/` +
> `GatewayClient`.

## Why this exists

All product screens need typed, consistent data. Instead of scattering literals in each
screen, Faazio keeps a single **source of truth** in root `data/`, consumed via the
`@data/*` import alias. `data/DATA_CONTROL.md` is the **authoritative** ownership matrix —
this doc is a companion, not a duplicate.

## Status taxonomy

Every domain file carries a top-of-file banner tag:

| Tag | Meaning |
|---|---|
| `@mock` | Static fixture for local dev; replaced by the future Go Chi backend |
| `@seed` | Bootstrap seed hydrated into client stores on first launch (cart / favourites / location) |
| `@static` | Immutable in-code config (e.g. Home section registry order) |
| `@unused` | Exported but not imported by mobile today — prune or wire up |
| `@aspirational` | Type-only contract not yet produced by any data file (e.g. `SDUINode`) |

## Data layout

```
data/
├── index.ts            # re-exports everything @data/* pulls from
├── types.ts            # shared entity types
├── schema.ts           # @aspirational SDUI contract types
├── DATA_CONTROL.md     # authoritative ownership matrix + known gaps
├── mart/ food/ pharma/   # per-sub-app products + stores (+ deals/specials, food menus, pharma recent orders)
├── explore/ categories/ productMeta/ reviews/
├── cart/ account/ accounts/ checkout/ inventory/
└── home/               # sections, rails, feeds, seeds, sdui
```

## Ownership highlights (per `DATA_CONTROL.md`)

| Domain | Owner | Status |
|---|---|---|
| `mart` | `features/ecommerce` | `@mock` |
| `food` | `features/food` | `@mock` |
| `pharma` | `features/pharma` + `services/categoryVendors` (via `storeId`) | `@mock` |
| `explore`, `categories` | `features/catalog` | `@mock` |
| `cart` | `features/cart` | `@mock` |
| `account` | `features/profile` | `@mock` |
| `home` | `features/home` | mixed `@mock` / `@seed` / `@static` |

The category rail feed (`data/categories/railFeed.ts`, consumed by `HeaderCategoryRail` via
`usePagedRail`) is derived from `MASTER_CATEGORIES.FA_MART`.
Each `CategoryRailItem` also carries a `vendorTags: string[]` array (`TAB_VENDOR_TAGS`) that maps a
rail tab id to the `StoreProfile.categories` tags a vendor must match — this lives in the data layer
because the rail taxonomy names don't equal the store category tags, and the future Go
`GET /categories/rail?page=` endpoint will serve the same shape.

**Blood Donor targeted Ask Blood** (`data/pharma/bloodRequests.ts` and
`data/pharma/bloodDonors.ts`) exports `DonorMatchRequest`, `DonorProfile`, `BLOOD_DONORS`,
and `ASK_BLOOD_COPY`. The mobile Ask form searches by city + blood group, selects one donor,
and persists a request containing both requester and recipient user IDs. The mock donor
directory is accessed through `services/donorDirectory.ts`; the future backend replaces that
seam and owns authorization, request status, secure contact disclosure, and notifications.

**Home ad campaigns** (`data/home/campaigns.ts`): the "Deals of the day" section's vendor campaigns
(`adCampaigns`, split into `carouselOneCampaigns` / `carouselTwoCampaigns` for the two stacked
auto-playing carousels). Each `AdCampaign` references a **real Mart vendor by `storeId`** (resolved
via `getCampaignStore` against the store directory) and its catalog products **by id only**
(`productIds`), resolved via `getProductById` (`getCampaignProducts`, which also keeps only rows
whose `storeId` matches the campaign vendor) — following the same SDUI "ID-only" rule as
`home/sdui.ts` and `data/catalog/products.ts`. `MartProduct.storeId` is a **required top-level**
field (drives campaign resolution, vendor drill-in, the product-detail store section, and
self-pickup); a dev-only guard in `campaigns.ts` warns if any campaign resolves <2 products.

**Per-restaurant menus** (`data/food/menus.ts`): exports `restaurantMenus`
(`Record<string, SpecialDish[]>` keyed by the 18 dining-restaurant names, ~5 dishes each) and
`allRestaurantMenuDishes` (flat pool for the catalog index/search). `RestaurantProfileScreen`
`getMenuForRestaurant()` reads `restaurantMenus[restaurant.name]` first, falling back to the
old `TODAYS_SPECIALS` cuisine-match + padding logic, so every dining room's menu is populated.

**Product-keyed reviews** (`data/reviews/reviews.ts`): `PRODUCT_REVIEWS` maps real catalog
product ids (e.g. `fm-m1`, `gr-p1`, `sp-1`, `m-italian-margherita`, `ph-f1`) to 3-4 reviews
each; `getReviewsByProductId` returns the keyed rows or falls back to the app's representative
set (never empty). Representative ids: FOOD→`sp-1`, MART→`fm-m1`, PHARMA→`ph-f1`.

**Pharma recent orders** (`data/pharma/recentOrders.ts`): exports `PHARMA_RECENT_ORDERS`
(`PharmaRecentOrder[]`, 4 rows, each with an optional `productId` mapping to real pharma ids
`ph-f1`/`ph-t3`/`ph-d1`) + the `PharmaRecentOrder` type. `PharmaScreen` now imports it,
replacing its former inline `RECENT_ORDERS` copy (Phase 7 de-dup).

### Normalized microservice tables (new surface)

A parallel, microservice-shaped view of the same source data that **imports** from the
legacy fixtures (never hand-copied), so the two surfaces can't drift:

| Table | Simulates | Consolidates |
|---|---|---|
| `catalog/products.ts` | Rust + Tantivy search index | all product records, deduped by `id`; `getProductById` |
| `directory/stores.ts` | Go + PostgreSQL | mart + food stores |
| `reviews/reviews.ts` | Go + PostgreSQL | `productMeta/reviews` |
| `inventory/stock.ts` | Go + DynamoDB | net-new stock rows |
| `checkout/orders.ts` | Go + CockroachDB | account/cart/addresses/coupons |
| `accounts/profile.ts` | Go + PostgreSQL | account profile/orders/nav/details |
| `home/sdui.ts` | Python + MongoDB | home section structure — **IDs only** |

The **production** counterparts of every normalized table above (per-service DB schema, datatypes,
sample rows) are specified in `docs/architecture/db-schema.md` — traceability is 1:1 (mock table ↔
production table).

## Data flow today vs future

```
 TODAY (legacy)
 screen ──► @data/<domain>/* (typed arrays)          [@mock fixtures]

 FUTURE (server-driven)
 screen ──► GatewayClient (src/services/api/GatewayClient.ts)
                │ joins the normalized tables above
                ▼
              Go Chi gateway ──► SDUI render tree (data/schema.ts)
                │ gRPC
                ▼
        search / cart / checkout / recommendations
```

`GatewayClient` is the intended single data surface but is **not yet wired** — the legacy
`@data/*` path stays live until each consumer is migrated. Every `@mock` entry becomes a
future handler contract.

## Fail-safe contract

1. **Always** add/keep the status banner (`@mock`/`@seed`/...) at the top of a data file.
2. Update `data/DATA_CONTROL.md` when adding, removing, or re-owning a fixture.
3. Emit **typed entity arrays** — do **not** emit `SDUINode` trees (that contract is
   `@aspirational` only).
4. Data files may cross-link within `data/` (e.g. `getProductById`) but must not import
   `client/mobile` internals.
5. Prefer typed exports over `as` casts.

## Honest limitations

- All live data is **mock** — nothing is fetched from a backend yet.
- `schema.ts` `SDUINode` is `@aspirational` — not a live contract.
- Several screens keep inline copies of `@data` fixtures (marked `@unused`) — de-dup is a
  tracked priority (see `DATA_CONTROL.md` "Known Gaps").

## Authoring new fixtures

Follow [RUNBOOKS/DATA_FIXTURES.md](../RUNBOOKS/DATA_FIXTURES.md).
