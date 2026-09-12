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
| `food` | `features/food` | `products.ts`, `stores.ts`, `bookingDishes.ts` | `@mock` |
| `pharma` | `features/pharma` | `products.ts`, `stores.ts` | `@mock` (+ `@unused` by mobile) |
| `explore` | `features/catalog` (Categories/Favourites) | `stacks.ts` | `@mock` |
| `categories` | `features/catalog` | `searchDatabase.ts` | `@mock` |
| `productMeta` | `features/product` (ProductDetail) | `reviews.ts` | `@mock` (+ `@unused` by mobile) |
| `cart` | `features/cart` | `addresses.ts`, `coupons.ts`, `pickup-resolver.ts` | `@mock` |
| `account` | `features/profile` | `orders.ts` | `@mock` |
| `home` | `features/home` | `sections.ts`, `rails.ts`, `demographics.ts`, `instantFeed.ts`, `nearbyOffers.ts`, `filterFeed.ts`, `seeds.ts` | mixed `@mock` / `@seed` / `@static` |

**Seed inventory expansion:** the mart/food/pharma/explore/categories/orders/coupons fixtures
were expanded so the new search-results-style Favourites page and richer catalogs look alive on
first launch: mart +4 stores and ~20 products (Home Appliances, Furniture, Books, Toys & Gifts,
Sports, Grocery); food +6 restaurants and ~14 dishes/specials (+2 booking dishes); pharma +10 OTC/
devices/baby-care/Ayurveda products; explore +3 stacks; categories +4 mart buckets; orders +8
(MART/FOOD/PHARMA × status × Delivery/Self-Pickup, every `productId` resolvable); coupons +2;
`seedFavorites` extended to span FOOD/MART/PHARMA. Because the normalized tables import these
arrays, every new product auto-derives its catalog + stock rows.

---

## Normalized Microservice Tables (new surface)

A parallel, **microservice-shaped** view of the same source data, added so the app can
eventually be served by the Go Chi gateway. The legacy fixtures above stay **live and
untouched** until each screen is migrated onto `src/services/api/GatewayClient` (the sole
surface for these tables). These tables **pull from the legacy sources via imports**
(no hand-copied literals), so the two surfaces never drift.

| Table dir | Simulates | Consolidates | Status |
|---|---|---|---|
| `catalog/products.ts` | Rust + Tantivy (search index) | mart/food/pharma/home/explore/categories product records, deduped by `id`, tokenized. Exposes `getProductById` (resolves a real `Product` from the domain arrays + converted deal/special products) used by `OrderDetailsScreen`'s **View Product** drill-in | `@mock` |
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
| `martStores` | `StoreProfile[]` | `FaMartScreen` "Local Vendors Near You" rail + vendor drill-in (replaces the retired `MART_LOCAL_VENDORS` mock) | `@mock` |
| `MART_DEALS` / `dealToProduct` | `MartDeal[]` / `(MartDeal) => Product` | `FaMartScreen` `DealsOfDayRail`; home `DealsOfDaySection`. `MartDeal` gained optional `rating?`/`priceNote?` for the minimal deal card | `@mock` |

### `@data/grocery` — **removed (merged into `mart`)**

The standalone `grocery` domain and its `@data/grocery/*` exports were deleted. Grocery
products (`gr-p*`) and the single outlet `store-g1` ("Faazio Mart Freshmart") were merged
into `mart/products.ts` and `mart/stores.ts` with `app: 'MART'`; grocery categories merged
into the Mart category tree; `recentlyViewedGrocery` folded into `recentlyViewedMart`; and
the `GROCERY` member was dropped from `AppBrand` / `CartCategory` / `SubAppId` /
`CategoryAppId`. Search, favourites and cart now surface grocery items under Mart.

> **Store-backed pickup:** every `StoreProfile` now carries optional `address`/`phone`/`hours`, and
> every MART/FOOD product sets `Product.storeId` (PHARMA maps to its single outlet by
> app). `getPickupPointsForItems` uses this linkage so Self-Pickup shows the actual store(s) the
> order came from — not a hardcoded Faazio hub. `data/directory/stores.ts` consolidates the
> apps' stores.

### `@data/food` — owner: `features/food`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `foodProducts` | `FoodProduct[]` | `FoodMenuView`; `data/home/filterFeed` (internal). Each carries optional `isVeg?` for the diet filter | `@mock` |
| `topOfWeekDishes` | `TopOfWeekDish[]` | `FoodScreen` (top-of-week rail). Each carries optional `isVeg?` | `@mock` |
| `foodStores` | `StoreProfile[]` | `FoodScreen`; home `DiningSpecialsSection`, `MostRatedDiningSection` | `@mock` |
| `BOOKING_DISHES_DB` | `BookingDish[]` | **`@unused`** — `FoodScreen` defines its own inline copy | `@mock` + `@unused` |

### `@data/pharma` — owner: `features/pharma`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pharmaProducts` | `PharmaProduct[]` | **`@unused`** — `PharmaScreen` keeps an inline `PHARMA_PRODUCTS_DB` | `@mock` + `@unused` |
| `pharmaStores` | `StoreProfile[]` | self-pickup resolver (single outlet `store-p1`) | `@mock` |
| `PHARMA_PRODUCTS_DB` | `PharmaDBItem[]` | **`@unused`** | `@mock` + `@unused` |
| `PHARMA_CATEGORIES` | `PharmaCategory[]` | **`@unused`** | `@mock` + `@unused` |
| `BLOOD_GROUPS` | `BloodGroup[]` | Blood Donor wizard (blood-group chip grid) | `@mock` |
| `BLOOD_DONOR_STEPS` | `BloodDonorStep[]` | Blood Donor wizard (stepper + step nav) | `@mock` |
| `BLOOD_DONOR_BANNER` | `{ title; subtitle }` | Blood Donor wizard (info banner, step 1 only) | `@mock` |
| `AGE_RANGES` | `{ id; label }[]` | Health & Eligibility step (age select) | `@mock` |
| `YES_NO_OPTIONS` | `{ value; label }[]` | Health & Eligibility step (Yes/No radios) | `@mock` |
| `HEALTH_YESNO_QUESTIONS` | `HealthYesNoQuestion[]` | Health & Eligibility step (4 questions) | `@mock` |
| `WEIGHT_LIMITS` | `{ min; max }` | Health & Eligibility step (weight format bounds) | `@mock` |
| `DONATION_TYPES` | `{ value; label }[]` | Availability step (donation-type radios) | `@mock` |
| `LOCATION_MIN_LENGTH` | `number` | Availability step (preferred-location min length) | `@mock` |
| `NOTIFICATION_SOURCES` | `{ id; label }[]` | Notifications step (alert-preference rows) | `@mock` |
| `NOTIFICATIONS_BANNER` | `{ message }` | Notifications step (info-banner copy) | `@mock` |
| `CONSENT_LABEL` | `string` | Review step (consent checkbox copy) | `@mock` |
| `PRIVACY_NOTE` | `string` | Review step (footer privacy note) | `@mock` |
| `BLOOD_REQUESTS` | `BloodRequest[]` | Donor dashboard + request-details page (feed + detail fields) | `@mock` |
| `BLOOD_DONOR_UNREAD_ALERTS` | `number` | Donor dashboard (bell badge seed) | `@mock` |
| `BLOOD_REQUEST_DETAIL_COPY` | `{ bannerTitle; bannerSubtitle; confirmNote }` | Request-details page (banner + privacy note copy) | `@mock` |

> **Blood Donor contract:** `BloodDonorDraft` / `BloodDonorRegistration` are the typed shape
> the future Go Chi backend will persist (donor registry). `BloodDonorRegistration.profile`
> snapshots the full draft at submit, plus `accountPhone` (from the logged-in account; null
> if none on file) — the future server upsert is **keyed by phone** → idempotent, one donor
> row per account. The mobile store persists draft + registration to AsyncStorage
> (`faazio/bloodDonor/v1`, plain storage accepted for the mock stage — health data at rest
> must move server-side with the backend) and is cleared on logout. Health data stays out
> of plain logs. `BLOOD_REQUESTS` is the dashboard feed + request-details seed (hospital
> donation requests with full detail fields — photo, patient context/age/gender, hospital
> contact/address, remarks, distance; all **required** so the detail page renders only real
> data); the backend feed replaces it later — the `BloodRequest` shape stays stable.
> "Nearby" filtering is city-vs-donor-`preferredLocation` matching until real geo exists.

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
> for PHARMA) and returns **one pickup point per distinct store** (a cart spanning several
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
| `saverMembership` | `SaverMembership` | **`@unused` (UI)** — Smart Saver banner removed from `AccountView`; still consumed by `membershipTable` (`data/accounts/profile.ts` → `GatewayClient.getMembership`) | `@mock` |
| `orderStatusCounts` | `OrderStatusCount[]` | **`@unused` (UI)** — status grid removed from `AccountView`; still consumed by `orderStatusTable` (`data/accounts/profile.ts` → `GatewayClient.getOrderStatus`) | `@mock` |
| `accountNavGroups` | `AccountNavGroup[]` — six titled groups (`profile`, `payments`, `privacy`, `earn`, `legal`, `support`); `privacy`/`legal` are `comingSoon`; `earn` is active with a `sell-with-us` row | `AccountScreen` (nav list, incl. My Orders + Sell with us entry rows; group titles + Coming-soon placeholders) | `@mock` |
| `accountDetails` | `UserDetailsData` | `UserDetailsScreen` (Your Details) | `@mock` |
| `savedAddresses` | `SavedAddress[]` | `SavedAddressesScreen` (Addresses) | `@mock` |

> **Order → product link:** each `MyOrder.productId` (optional) references a real product in the
> four domain fixtures (order names are aligned to those products so the card and the product
> detail stay coherent). The lookup (`getProductById`) lives in `data/catalog/products.ts` — this
> is a **data-internal** cross-domain link inside `data/`, so no sub-app boundary is crossed and
> `features/profile` → `@data/*` stays clean per the dependency-cruiser rules. `data/checkout/orders.ts`
> `fromMyOrder` mirrors the id into `OrderLineItem.productId`.

### `@data/seller` — owner: `features/profile`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `SELLER_SETUP_FIELDS` | `SellerSetupField[]` — required seller-onboarding details (business name, owner, category, GSTIN, business address, bank account, IFSC, contact phone) | `SellWithUsScreen` (mock "Sell with us" onboarding list) | `@mock` |
| `SellerSetupField` | type | `SellWithUsScreen` | `@mock` |

> **Contract:** Read-only fixture for the mock seller-onboarding page. Real seller
> onboarding moves server-side with the Go Chi backend (see `client/mobile/PENDING_WORK.md`).

### `@data/home` — owner: `features/home`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `homeSections` | `HomeSectionDescriptor[]` | `HomeView` (section registry) | `@static` |
| `HomeSectionKind` | type union | `HomeView`, `HomeView` sections | `@static` |
| `portalSectors` | `PortalSector[]` | home `ExploreSectorsSection` | `@mock` |
| `topAdSlides` | `AdSlide[]` | home `AdBannerSection` | `@mock` |
| `hotBrandDeals` | `Product[]` | home `HotBrandDealsSection` | `@mock` |
| `recentlyViewedMart/Food/Pharma` | `Product[]` | `HomeView` (Recently Viewed rail) | `@mock` |
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
| `seedFavorites` | `string[]` | `state/favoriteStore` (seeds the search-results-style Favourites page — includes FOOD, MART & PHARMA ids) | `@seed` |
| `seedLocation` | `string` | **`@unused`** by mobile | `@seed` + `@unused` |

### `@data/rewards` — owner: `features/rewards`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `COIN_EARN_RATE` | `number` (₹1000 per coin) | `rewardsStore.recordOrder` (coins earned on paid amount) | `@static` |
| `COIN_REDEEM_RATE` | `number` (100 coins per ₹1) | `rewardsLogic.computeRedeemableRupees`, `rewardsStore.redeemCoins` | `@static` |
| `COIN_REDEEM_MIN` | `number` (100 coins min redemption) | `CoinsRedeemRow` (gate + validation) | `@static` |
| `STREAK_TARGET_DAYS` | `number` (7) | `rewardsLogic.evaluateStreak` (card grant threshold) | `@static` |
| `DISCOUNT_CARD_PERCENT` | `number` (10) | `rewardsStore.recordOrder` (grant), CartView streak coupon | `@static` |
| `DISCOUNT_CARD_VALIDITY_DAYS` | `number` (5) | `rewardsStore.recordOrder` (card expiry) | `@static` |
| `FaazioDiscountCard` | type | `rewardsStore`, `rewardsLogic`, `FaazioRewardsScreen` | `@static` |

> **Contract:** All rewards rules are enterprise-controlled constants. Balances, streaks, and
> cards are **local-device-only** (persisted AsyncStorage, never logged with PII) until the Go
> Chi backend issues server-side balances — see `client/mobile/PENDING_WORK.md`.

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
