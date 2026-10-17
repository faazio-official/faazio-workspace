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

**Per-venue menus** (`data/food/menus.ts`): exports `restaurantMenus`
(`Record<string, SpecialDish[]>` keyed by the 18 dining-restaurant names, ~5 dishes each),
`storeMenus` (keyed by the 12 delivery-store names, derived from `foodProducts` via `storeId`)
and the flat pool `allRestaurantMenuDishes`. `menuForVenueName(name)`
resolves dining first then delivery; the shared `features/food/utils/menu.ts`
`getMenuForRestaurant()` reads it first, falling back to the `TODAYS_SPECIALS` cuisine-match +
padding logic only for an unseeded venue, so every dining room **and delivery kitchen** has its
own menu (`RestaurantProfileScreen` + `RestaurantMenuScreen` consume it). Both pools are seeded
into `directory.menus` (88 dishes / 30 venues), so `GatewayClient.getMenu` serves the durable
rows remote-first with the fixture as the offline fallback.

**Product-keyed reviews** (`data/reviews/reviews.ts`): `PRODUCT_REVIEWS` maps real catalog
product ids (e.g. `fm-m1`, `gr-p1`, `sp-1`, `m-italian-margherita`, `ph-f1`) to 3-4 reviews
each; `getReviewsByProductId` returns the keyed rows or falls back to the app's representative
set (never empty). Representative ids: FOOD→`sp-1`, MART→`fm-m1`, PHARMA→`ph-f1`.

**Pharma recent orders** (`data/pharma/recentOrders.ts`): exports `PHARMA_RECENT_ORDERS`
(`PharmaRecentOrder[]`, 4 rows, each with an optional `productId` mapping to real pharma ids
`ph-f1`/`ph-t3`/`ph-d1`) + the `PharmaRecentOrder` type. `PharmaScreen` now imports it,
replacing its former inline `RECENT_ORDERS` copy (Phase 7 de-dup).

**Vendor identity & ratings** (`data/directory/vendors.ts`, `data/food/diningVenues.ts`,
`data/reviews/vendorReviews.ts`): `resolveVendorForProduct(product)` is the single owner of
"which vendor does this product/order belong to", merging `directory/stores` with the
dining-venue identity table. Vendor identity is resolved once and snapshotted onto orders
(`MyOrder.storeId`, `OrderRow.vendorStoreIds`, `PlacedOrder.storeIds`), so an old order keeps
resolving to the same vendor. `hasPurchasedFromVendor(userId, vendorId)` is the **derived**
rating-eligibility gate (non-cancelled order; server later tightens to `DELIVERED`; stays true
once earned). `reviews/vendorReviews.ts` holds seeded public reviews (full name only); the
signed-in user's live rating is device-local (`state/vendorRatingStore.ts`), merged in by
`services/vendorRatings.ts`.

### Normalized microservice tables (new surface)

A parallel, microservice-shaped view of the same source data that **imports** from the
legacy fixtures (never hand-copied), so the two surfaces can't drift:

| Table | Simulates (Future Prod) | Consolidates | MVP origin |
|---|---|---|---|
| `catalog/products.ts` | Rust + Tantivy search index | all product records, deduped by `id`; `getProductById` | Supabase `catalog` + Postgres FTS |
| `directory/stores.ts` | Go + PostgreSQL | mart + food stores | Supabase `directory` |
| `directory/vendors.ts` | Go + PostgreSQL | vendor identity view (stores + `food/diningVenues`) — `resolveVendorForProduct` | Supabase `directory` (derived view) |
| `food/diningVenues.ts` | Go + PostgreSQL | dining-venue ids/names only (identity) | Supabase `directory` (identity) |
| `reviews/reviews.ts` | Go + PostgreSQL | `productMeta/reviews` | Supabase `reviews` |
| `reviews/vendorReviews.ts` | Go + PostgreSQL | seeded public vendor reviews (full name only) | Supabase `reviews` |
| `inventory/stock.ts` | Go + DynamoDB | net-new stock rows | Supabase `inventory` |
| `checkout/orders.ts` | Go + CockroachDB | account/cart/addresses/coupons | Supabase `checkout` |
| `accounts/profile.ts` | Go + PostgreSQL | account profile/orders/nav/details | Supabase `accounts` |
| `home/sdui.ts` | Python + MongoDB | home section structure — **IDs only** | MongoDB `sdui_layouts` |

The Home SDUI doc is now **web-editable** end to end: `client/web/platform`'s *App content (SDUI)*
page (`app/admin/super/sdui`) reads the raw ID-only sections from `GET /admin/sdui/home` and
publishes edits via `PUT /admin/sdui/home` (super-admin, `internal/sdui` → `reco.Repo.SaveHome`
`$inc version` + compiled-feed cache purge). The app's `GET /sdui/home` then recompiles on its next
poll — no app release.

**Mart merchandising via the same doc.** The Mart feed is server-controlled by three sections in the
same `sdui_layouts/home` doc, served on their own endpoint `GET /sdui/mart` (so the Mart screen never
downloads or couples to the full Home payload/ETag): `martHero` (an array of editorial `banners` with
image + copy), `martDeals` and `martEssentials` (real `catalog` product ids). Because the Home renderer
ignores unknown section ids, one doc drives both feeds. `martService.fetchMartFeed` reads them through
`gateway.getMartFeed()` and falls back to the `mocks/martHomeFeed.ts` fixture offline. A section
present-but-empty renders empty (a portal typo is visible, not masked); only an absent section falls
back to the fixture. `banners` is the only non-ID leaf in the doc — it carries display copy + an image
URL, **never money** (prices are always joined from `catalog.products`), so the ID-only rule holds and
no per-rail SQL table is needed. Note (W41/W43): the Mart hero carousel is **paid inventory first** —
`CampaignHero` renders the ad-server `MART_HERO` campaigns and only when there is no LIVE fill falls
back to the SDUI `martHero.banners` house hero (`MartHouseHero`, no AD pill, no ad events,
non-interactive) and then to nothing (both empty → no slot), never a fabricated ad (see
`caching-cloudflare-valkey.md` §5a).

The **production** counterparts of every normalized table above (per-service DB schema, datatypes,
sample rows) are specified in `docs/architecture/db-schema.md` — traceability is 1:1 (mock table ↔
production table).

## Data flow today vs future

```
 TODAY (legacy)
 screen ──► @data/<domain>/* (typed arrays)          [@mock fixtures]

 MVP (Go Chi modular monolith — active)
 screen ──► GatewayClient (src/services/api/GatewayClient.ts)
                │ HTTP/JSON
                ▼
         thin Go Chi gateway ──► Supabase (Postgres) + MongoDB + Valkey
                │                          ▲
                └── Cloudflare edge ───────┘

 FUTURE PROD (server-driven)
 screen ──► GatewayClient (src/services/api/GatewayClient.ts)
                │ joins the normalized tables above
                ▼
              Go Chi gateway ──► SDUI render tree (data/schema.ts)
                │ gRPC
                ▼
        search / cart / checkout / recommendations
```

`GatewayClient` is **wired to the real gateway** (`EXPO_PUBLIC_GATEWAY_URL` +
`EXPO_PUBLIC_USE_GATEWAY=true`); in its default (mock) mode it reads `@data/*` as before, and in
remote mode **every method falls back to `@data/*` on a network/HTTP error**, so migrating a screen
can never regress data. Wiring order (all methods implemented):

1. `searchProducts` → 2. `getProduct` → 3. `getHomeFeed` → 4. `getReviews` →
5. `getOrders` / `getProfile` (auth-scoped, last), plus `getStores`/`getStore`/`getStock`/
`getProductsByIds`/`getMembership`/`getOrderStatus`/`getAccountNav`/`getDetails`. The
`getOrders` read now feeds the `ordersStore.serverOrders` hydration (My Orders durable history,
server status wins) and `getVendorReviews` / `getVendorReviewSummary` back the `useVendorReviews`
hook (server list + `reviews.vendor_summary` aggregate).

**Write + vendor methods (server routes live; client seam added):** `getVendorReviews` /
`getVendorReviewSummary` / `rateVendor` (derived purchase gate re-checked server-side), `getCart` / `addToCart` /
`updateCartItem` / `removeCartItem` (auth-scoped, never edge-cached), `placeOrder`
(idempotency lock + `SELECT … FOR UPDATE SKIP LOCKED` stock decrement), `getFavourites` /
`addFavourite` / `removeFavourite` (auth-scoped durable shelf, never edge-cached), `getPickupPoints`
(durable `inventory.pickup_points`, replaces the runtime `NEUTRAL_PICKUP` derivation), `payForOrder`
(server-derived payment ledger), `getRewards` (server-authoritative coins/streak/ledger — earned
in-process during `POST /orders`), `getMenu` (durable `directory.menus`), `createPrescription` /
`getPrescriptions` (durable Rx; images in Supabase Storage), and `trackEvent` (ID-only; mock fallback
is a silent no-op — the `search` event is anchored to the top result id since it has no product id
of its own). These unblock the `@mock` → `@server` per-module migration. Auth stays mocked by design
(`authStore.login()`), so the gateway runs with `AUTH_DISABLED=true` in dev.

Screens still read `@data/*` directly and migrate onto `gateway` incrementally — no call-site changes
are required. Every `@mock` entry is now a gateway handler contract.

**Home SDUI cutover (W35).** `getHomeFeed` (`GET /sdui/home`) is now the single source of truth for
every Home section whose doc carries the data: the gateway joins each section's `productIds` **and**
`storeIds` (`HomeSection.stores`, via the previously unused `contracts.StoreReader`), and the app
threads `products`/`stores`/`chips[].productIds` into the rails, keeping each `@data/home/*` fixture
as the offline first-paint. Only the paid `HOME_HERO` banner and the vendor-campaign carousels stay
fixture-owned (no server surface yet).

**Public promo reads + editorial rails (W29).** `cart/coupons.ts` is now `@mock → @server`:
`GatewayClient.getCoupons(app?)` reads the anon `GET /coupons` projection (fixture fallback), and the
cart coupon sheet hydrates from it. The fixture seeds `promo.coupons` (the table `GET /coupons`
reads); the legacy `checkout.coupons` is unseeded and unused by any repo. The brand-campaign / hero /
deal rails (`home/campaigns.ts`, `MART_DEALS`, `TOP_RATED_*`) are tagged **`@static-editorial`** —
they are presentation fixtures with no backing table, and their correct long-term home is the SDUI
layout doc, not a coupon/ads table.
The gateway also exposes `GET /ads/live` (LIVE slots); the shared **`components/shared/SponsoredRail`**
(Home `SponsoredRailSection`, Mart `FaMartScreen`, vendor `DealsLandingScreen`) consumes it via
`GatewayClient.getLiveAds` (+ `getSponsoredProducts`, the catalog join) for `HOME_TOP`,
`SPONSORED_SHOWCASE` and `SECTOR_RAIL`. Paid placements have **no** fixture fallback — an empty/offline
result collapses the rail (never a fabricated sponsored shelf), and every card carries the AD
disclosure. Impressions/clicks post to `POST /ads/events` (`GatewayClient.recordAdEvent`, de-duped
per user); the last tapped slot attributes the next order via `services/adsAttribution.ts`. Money/Rx/address writes honour `EXPO_PUBLIC_STRICT=true`, which disables the fixture fallback so
a failed write can never masquerade as a local success. Under the same flag, **money-critical reads**
(`getProduct`, `getStock`, `getProductsByIds`, `getMenu`, `getCoupons`, `validateCoupon`,
`getOrderTracking`) also go strict — a price/stock/discount/Rx status is never fabricated from a
fixture on a remote error (W34). `getVenue(id)`/`getOrderTracking(orderId)` surface the W34 single
reads.

**Shopper price + discount integrity (W31).** Discount percentage is always derived from an
authoritative source, never invented on-device. `data/food/menus.ts` dishes may carry an authored
`mrp` (`SpecialDish.mrp`) — only `mrp > price` shows a strike-through, and the Food
"Recommended & Offers" rail (`RestaurantProfileScreen`, `RestaurantOffersScreen`) no longer
synthesizes `price × 1.2`. Festival opt-ins reach the app via anon `GET /promo/active-discounts?ids=`
(`GatewayClient.getActiveDiscounts`); `services/pricing.ts` (`effectivePrice`, `applyActiveDiscount`,
`useActiveDiscounts`) overlays them on base prices in the Mart vendor rail and `DealsLanding`
(`discounts` mode). Mock mode returns no discounts — base prices stand. The Home
`DealsOfDaySection` (daily essentials) resolves its `md-*` ids through the catalog
(`getProductsByIds`) with `dealToProduct` only as the offline fallback (the `md-*` rows are seeded).

## Fail-safe contract

1. **Always** add/keep the status banner (`@mock`/`@seed`/...) at the top of a data file.
2. Update `data/DATA_CONTROL.md` when adding, removing, or re-owning a fixture.
3. Emit **typed entity arrays** — do **not** emit `SDUINode` trees (that contract is
   `@aspirational` only).
4. Data files may cross-link within `data/` (e.g. `getProductById`) but must not import
   `client/mobile` internals.
5. Prefer typed exports over `as` casts.
6. **Taxonomy ↔ catalog coverage:** every `MASTER_CATEGORIES` `searchQuery` must resolve ≥1
   vendor in the matching app's product pool (the drill-in's `matchesQuery` per-token predicate).
   After editing `data/categories/masterCategories.ts` or the mart/pharma product fixtures, run
   `npm run check:drillin` (fails on any unresolved title or duplicate product id).

## Honest limitations

- All live data is **mock** — nothing is fetched from a backend yet.
- `schema.ts` `SDUINode` is `@aspirational` — not a live contract.
- Several screens keep inline copies of `@data` fixtures (marked `@unused`) — de-dup is a
  tracked priority (see `DATA_CONTROL.md` "Known Gaps").

## Authoring new fixtures

Follow [RUNBOOKS/DATA_FIXTURES.md](../RUNBOOKS/DATA_FIXTURES.md).
