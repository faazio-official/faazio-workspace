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
| `grocery` | `features/ecommerce` | `products.ts` | `@mock` |
| `food` | `features/food` | `products.ts`, `stores.ts`, `bookingDishes.ts` | `@mock` |
| `pharma` | `features/pharma` | `products.ts` | `@mock` (+ `@unused` by mobile) |
| `explore` | `features/catalog` (Categories/Favourites) | `stacks.ts` | `@mock` |
| `categories` | `features/catalog` | `searchDatabase.ts` | `@mock` |
| `productMeta` | `features/product` (ProductDetail) | `reviews.ts` | `@mock` (+ `@unused` by mobile) |
| `cart` | `features/cart` | `addresses.ts`, `coupons.ts` | `@mock` |
| `account` | `features/profile` | `orders.ts` | `@mock` |
| `home` | `features/home` | `sections.ts`, `rails.ts`, `demographics.ts`, `instantFeed.ts`, `nearbyOffers.ts`, `storeOffers.ts`, `filterFeed.ts`, `seeds.ts` | mixed `@mock` / `@seed` / `@static` |

---

## Per-Sub-App Control

### `@data/mart` — owner: `features/ecommerce` (Mart screens)

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `martProducts` | `MartProduct[]` | `FaMartScreen`; `data/home/filterFeed` (data-internal pool) | `@mock` |
| `martStores` | `StoreProfile[]` | `FaMartScreen`; home `StoreOffersSection` | `@mock` |

### `@data/grocery` — owner: `features/ecommerce` (Grocery screen)

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `groceryProducts` | `GroceryProduct[]` | `GroceryScreen` | `@mock` |

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

### `@data/account` — owner: `features/profile`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pastOrders` | `PastOrder[]` | `AccountView` (order history) | `@mock` |

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
| `storeOffers` | `StoreOffer[]` | home `StoreOffersSection` | `@mock` |
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
