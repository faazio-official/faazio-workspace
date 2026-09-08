# Faazio Data Control

> Data ownership, consumption, and status control for every sub-app's data.
> This is the authoritative map of **who owns**, **who consumes**, and **what is real vs mock**
> for each entry in the shared `data/` layer. The React Native app (`client/mobile/`) is the only
> current consumer — the root Vite web app (frozen reference) uses its own `src/data/` copies.

---

## Status Taxonomy

| Tag | Meaning |
|---|---|
| `@mock` | Static seeded fixture for local development. Will be replaced by the Go Chi backend (`server/`). **Not production data.** |
| `@seed` | Bootstrap seed hydrated into client state stores on first launch (cart / favourites / location). |
| `@static` | Deliberately immutable in-code config (e.g. the Home section registry order). Expected to become server-driven later. |
| `@unused` | Exported from `data/index.ts` but **not imported** by `client/mobile` today. Candidate for pruning or wiring up. |
| `@aspirational` | Type-only contract not yet produced by any data file (e.g. `schema.ts` `SDUINode`). |

Every domain file below carries its tag as a top-of-file banner comment.

---

## Ownership Matrix

| Domain | Owner (feature) | Entry files | Status |
|---|---|---|---|
| `mart` | `features/ecommerce` | `products.ts`, `stores.ts` | `@mock` |
| `grocery` | `features/ecommerce` | `products.ts`, `stores.ts` | `@mock` |
| `food` | `features/food` | `products.ts`, `stores.ts`, `bookingDishes.ts` | `@mock` |
| `pharma` | `features/pharma` | `products.ts`, `stores.ts` | `@mock` (+ `@unused` by mobile) |
| `explore` | `features/catalog` (Categories/Favourites) | `stacks.ts` | `@mock` |
| `categories` | `features/catalog` | `searchDatabase.ts` | `@mock` |
| `productMeta` | `features/product` (ProductDetail) | `reviews.ts` | `@mock` (+ `@unused` by mobile) |
| `cart` | `features/cart` | `addresses.ts`, `coupons.ts`, `pickup-resolver.ts` | `@mock` |
| `account` | `features/profile` | `orders.ts` | `@mock` |
| `home` | `features/home` | `sections.ts`, `rails.ts`, `demographics.ts`, `instantFeed.ts`, `nearbyOffers.ts`, `filterFeed.ts`, `seeds.ts` | mixed `@mock` / `@seed` / `@static` |

---

## Normalized Microservice Tables (new surface)

A parallel, **microservice-shaped** view of the same source data, added so the app can
eventually be served by the Go Chi gateway. The legacy fixtures above stay **live and
untouched** until each screen is migrated onto `src/services/api/GatewayClient` (the sole
surface for these tables). These tables **pull from the legacy sources via imports**
(no hand-copied literals), so the two surfaces never drift.

| Table dir | Simulates | Consolidates | Status |
|---|---|---|---|
| `catalog/products.ts` | Rust + Tantivy (search index) | mart/grocery/food/pharma/home/explore/categories product records, deduped by `id`, tokenized. Exposes `getProductById` (resolves a real `Product` from the four domain arrays + converted deal/special products) used by `OrderDetailsScreen`'s **View Product** drill-in | `@mock` |
| `directory/stores.ts` | Go + PostgreSQL (store directory) | `mart/stores`, `food/stores` | `@mock` |
| `reviews/reviews.ts` | Go + PostgreSQL (reviews/specs) | `productMeta/reviews` | `@mock` |
| `inventory/stock.ts` | Go + DynamoDB (key-value stock) | net new — one row per catalog product id | `@mock` |
| `checkout/orders.ts` | Go + CockroachDB (relational) | account/orders, cart/addresses, account/addresses, cart/coupons | `@mock` |
| `accounts/profile.ts` | Go + PostgreSQL (profile) | account/profile, orderStatus, accountNav, details | `@mock` |
| `home/sdui.ts` | Python + MongoDB (doc tree) | home/sections, rails, filterFeed structure — **IDs only** | `@aspirational` |

**Gateway:** `client/mobile/src/services/api/GatewayClient.ts` joins the tables above and is the
intended single data surface for the app. It is **not yet wired into screens** — the legacy
`@data/*` fixtures remain the live path until each consumer is migrated.

---

## Per-Sub-App Control

### `@data/mart` — owner: `features/ecommerce` (Mart screens)

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `martProducts` | `MartProduct[]` | `FaMartScreen`; `data/home/filterFeed` (data-internal pool) | `@mock` |
| `martStores` | `StoreProfile[]` | `FaMartScreen` | `@mock` |
| `MART_DEALS` / `dealToProduct` | `MartDeal[]` / `(MartDeal) => Product` | `FaMartScreen` `DealsOfDayRail`; home `DealsOfDaySection` | `@mock` |

### `@data/grocery` — owner: `features/ecommerce` (Grocery screen)

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `groceryProducts` | `GroceryProduct[]` | `GroceryScreen` | `@mock` |
| `groceryStores` | `StoreProfile[]` | self-pickup resolver (single outlet `store-g1`) | `@mock` |

> **Store-backed pickup:** every `StoreProfile` now carries optional `address`/`phone`/`hours`, and
> every MART/FOOD product sets `Product.storeId` (GROCERY/PHARMA map to their single outlet by
> app). `getPickupPointsForItems` uses this linkage so Self-Pickup shows the actual store(s) the
> order came from — not a hardcoded Faazio hub. `data/directory/stores.ts` consolidates all four
> apps' stores.

### `@data/food` — owner: `features/food`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `foodProducts` | `FoodProduct[]` | `FoodMenuView`; `data/home/filterFeed` (internal) | `@mock` |
| `topOfWeekDishes` | `TopOfWeekDish[]` | `FoodScreen` (top-of-week rail) | `@mock` |
| `foodStores` | `StoreProfile[]` | `FoodScreen`; home `DiningSpecialsSection`, `MostRatedDiningSection` | `@mock` |
| `BOOKING_DISHES_DB` | `BookingDish[]` | **`@unused`** — `FoodScreen` defines its own inline copy | `@mock` + `@unused` |

### `@data/pharma` — owner: `features/pharma`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pharmaProducts` | `PharmaProduct[]` | **`@unused`** — `PharmaScreen` keeps an inline `PHARMA_PRODUCTS_DB` | `@mock` + `@unused` |
| `pharmaStores` | `StoreProfile[]` | self-pickup resolver (single outlet `store-p1`) | `@mock` |
| `PHARMA_PRODUCTS_DB` | `PharmaDBItem[]` | **`@unused`** | `@mock` + `@unused` |
| `PHARMA_CATEGORIES` | `PharmaCategory[]` | **`@unused`** | `@mock` + `@unused` |

### `@data/explore` — owner: `features/catalog`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `exploreStacks` | `ExploreStack[]` | `CategoriesView`, `FavouritesView` | `@mock` |

### `@data/categories` — owner: `features/catalog`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `categoriesSearchDatabase` | `Record<string, Product[]>` | `CategoriesView`, `FavouritesView` | `@mock` |

### `@data/productMeta` — owner: `features/product` (ProductDetail)

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `avatarMap` | `Record<string, string>` | **`@unused`** — `ProductDetailView` has an inline copy | `@mock` + `@unused` |
| `getProductReviews` | `(app: AppBrand) => Review[]` | **`@unused`** | `@mock` + `@unused` |
| `getProductSpecs` | `(app: AppBrand) => SpecItem[]` | **`@unused`** | `@mock` + `@unused` |
| `getProductHighlights` | `(app: AppBrand) => string[]` | **`@unused`** | `@mock` + `@unused` |

### `@data/cart` — owner: `features/cart`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `defaultAddresses` | `Address[]` | `CartView` (checkout addresses) | `@mock` |
| `coupons` | `Coupon[]` | `CartView` (promo codes) | `@mock` |
| `getPickupPointsForItems` | `(items) => PickupPoint[]` | `CartView` (self-pickup toggle → pickup-point radio cards, one per distinct store in the cart) | `@mock` |
| `NEUTRAL_PICKUP` | `PickupPoint` | fallback hub for cart items whose store can't be determined | `@mock` |

> **Self-pickup contract:** `FulfillmentMode` / `PickupPoint` are the typed contract the future Go
> Chi backend will serve via a real store/geolocation API. Self-pickup points are **store-backed**,
> not a hardcoded Faazio hub: `getPickupPointsForItems` resolves each cart item → product
> (`getProductById`) → its `storeId` (or `shop` matched to a store name, or the app's single outlet
> for GROCERY/PHARMA) and returns **one pickup point per distinct store** (a cart spanning several
> stores lists all of them; the user visits whichever applies). Items with no determinable store
> collapse to `NEUTRAL_PICKUP`. Checkout waives the delivery fee (`computeTotals` zeroes it for
> `PICKUP`). `MyOrder.fulfillment` (optional — absent = delivery) drives the My Orders
> "Delivery / Self Pickup" chip. Contact phone for pickup is the signed-in user's
> `userProfile.phone` — no fabricated PII.

### `@data/account` — owner: `features/profile`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pastOrders` | `PastOrder[]` | **`@unused`** — old order-history UI removed with `AccountView` | `@mock` + `@unused` |
| `myOrders` | `MyOrder[]` (with `app` sub-app field, optional `fulfillment`, and optional `productId` linking to a real product) | `MyOrdersScreen` (order list, sub-app rail, status filter, Delivery/Self-Pickup chip); `getMyOrderById` → `OrderDetailsScreen` | `@mock` |
| `getMyOrderById` | `(id: string) => MyOrder \| undefined` | `OrderDetailsScreen` (resolves the order by `orderId` route param) | `@mock` |
| `myOrdersStatusFilters` | `MyOrdersStatusFilterItem[]` (labels only) | `MyOrdersScreen` (filter sheet options; counts derived at runtime) | `@mock` |
| `userProfile` | `UserProfile` | `AccountScreen` (My Account header card) | `@mock` |
| `saverMembership` | `SaverMembership` | `AccountScreen` (Smart Saver banner) | `@mock` |
| `orderStatusCounts` | `OrderStatusCount[]` | **`@unused` (UI)** — status grid removed from `AccountView`; still consumed by `orderStatusTable` (`data/accounts/profile.ts` → `GatewayClient.getOrderStatus`) | `@mock` |
| `accountNavGroups` | `AccountNavGroup[]` | `AccountScreen` (nav list, incl. My Orders entry row) | `@mock` |
| `accountDetails` | `UserDetailsData` | `UserDetailsScreen` (Your Details) | `@mock` |
| `savedAddresses` | `SavedAddress[]` | `SavedAddressesScreen` (Addresses) | `@mock` |

> **Order → product link:** each `MyOrder.productId` (optional) references a real product in the
> four domain fixtures (order names are aligned to those products so the card and the product
> detail stay coherent). The lookup (`getProductById`) lives in `data/catalog/products.ts` — this
> is a **data-internal** cross-domain link inside `data/`, so no sub-app boundary is crossed and
> `features/profile` → `@data/*` stays clean per the dependency-cruiser rules. `data/checkout/orders.ts`
> `fromMyOrder` mirrors the id into `OrderLineItem.productId`.

### `@data/home` — owner: `features/home`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `homeSections` | `HomeSectionDescriptor[]` | `HomeView` (section registry) | `@static` |
| `HomeSectionKind` | type union | `HomeView`, `HomeView` sections | `@static` |
| `portalSectors` | `PortalSector[]` | home `ExploreSectorsSection` | `@mock` |
| `topAdSlides` | `AdSlide[]` | home `AdBannerSection` | `@mock` |
| `hotBrandDeals` | `Product[]` | home `HotBrandDealsSection` | `@mock` |
| `recentlyViewedMart/Food/Grocery/Pharma` | `Product[]` | `HomeView` (Recently Viewed rail) | `@mock` |
| `todaysOffers` | `TodaysOffer[]` | **`@unused`** | `@mock` + `@unused` |
| `mixedRecommendations` | `MixedRecommendation[]` | **`@unused`** | `@mock` + `@unused` |
| `popularDining` | `PopularDiningItem[]` | **`@unused`** | `@mock` + `@unused` |
| `recentlyViewedHistory` | `RecentlyViewedItem[]` | **`@unused`** | `@mock` + `@unused` |
| `sponsoredAds` | `SponsoredAd[]` | **`@unused`** | `@mock` + `@unused` |
| `faMartFinds` | `FaMartFind[]` | **`@unused`** | `@mock` + `@unused` |
| `restaurantSpecials` | `RestaurantSpecial[]` | **`@unused`** | `@mock` + `@unused` |
| `mensPicks` / `womensPicks` / `childrensPicks` / `hairSkinPicks` | `Product[]` | home `MensSection` / `WomensSection` / `ChildrensSection` / `HairSkinCareSection` | `@mock` |
| `instantFeed` | `Product[]` | data-internal only (`filterFeed`); not directly by screens | `@mock` |
| `nearbyOffers` | `NearbyOffer[]` | home `NearbyOffersSection` | `@mock` |
| `filterChips` / `filterFeedPools` / `FilterChipId` | typed pools | home `FilterFeedSection` | `@mock` |
| `seedCartItems` | `CartItem[]` | `state/cartStore` | `@seed` |
| `seedFavorites` | `string[]` | `state/favoriteStore` | `@seed` |
| `seedLocation` | `string` | **`@unused`** by mobile | `@seed` + `@unused` |

---

## Cross-Sub-App Access Rules

- **Home is the sanctioned cross-sub-app consumer.** Home feed sections may import any sub-app's
  `cards/*` and `@data/<sub-app>/*`. This is intentional and the ONLY cross-domain boundary.
- **Sub-app screens may only import their own domain** (`@data/<own>/*`) plus shared primitives
  (`@/components/shared/*`, `@/theme/*`, `@/state/*`). They must never import another sub-app's
  `cards/*` or `@data/<other>/*`.
- Enforced by `dependency-cruiser` (`npm run check:boundaries` in `client/mobile/`) — see
  `.dependency-cruiser.cjs`. A violation fails CI.

## Known Gaps (honest inventory)

1. **Duplicated mock data in screens.** `PharmaScreen`, `FoodScreen` (booking dishes), and
   `ProductDetailView` each keep inline copies of data that already exists under `@data/`.
   The canonical copies are marked `@unused` until those screens switch to `@data/*`.
   **This is a deliberate priority for de-duplication.**
2. **Unused rail exports.** Several `@data/home/rails` exports (`todaysOffers`, `mixedRecommendations`,
   `popularDining`, `recentlyViewedHistory`, `sponsoredAds`, `faMartFinds`, `restaurantSpecials`)
   are exported but not consumed by mobile. They were built for the frozen Vite reference.
   Prune or wire up when a home section needs them.
3. **`schema.ts` (`SDUINode`)** is `@aspirational` — defined but not produced by any data file yet.
   Data files emit typed entity arrays, not SDUI trees. Do not rely on it as a live contract.
4. **All live data is mock.** Until `server/` (Go Chi) ships, nothing in `@data/` is fetched from a backend.
