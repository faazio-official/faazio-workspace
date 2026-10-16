# Faazio Data Control

> Data ownership, consumption, and status control for every sub-app's data.
> This is the authoritative map of **who owns**, **who consumes**, and **what is real vs mock**
> for each entry in the shared `data/` layer. The React Native app (`client/mobile/`) is the only
> current consumer — the root Vite web app (frozen reference) uses its own `src/data/` copies.

> **MVP (active):** live `@mock` data migrates **per module** to Supabase (Postgres) + MongoDB
> via `GatewayClient` (`@mock` → `@server`) — see `docs/architecture/mvp-backend.md`. `@data/*`
> stays the live fallback in mock mode and on remote error until each consumer is migrated.

---

## Status Taxonomy

| Tag | Meaning |
|---|---|
| `@mock` | Static seeded fixture for local development. Will be replaced by the Go Chi backend (`server/`). **Not production data.** |
| `@seed` | Bootstrap seed hydrated into client state stores on first launch (cart / favourites / location). |
| `@static` | Deliberately immutable in-code config (e.g. the Home section registry order). Expected to become server-driven later. |
| `@static-editorial` | Editorial/marketing fixture with no backing table (brand campaign cards, Mart/Food/Pharma hero + deal rails). Presentation-owned; the correct long-term home is the SDUI layout doc, **not** a per-table migration. Not a wiring gap. |
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
| `cart` | `features/cart` | `addresses.ts`, `coupons.ts`, `pickup-resolver.ts` | `@mock` (`coupons.ts` now hydrates from `GET /coupons` via `GatewayClient.getCoupons`, fixture fallback) |
| `account` | `features/profile` | `orders.ts` | `@mock` |
| `directory` / `reviews` (vendor) | `features/profile` (rating form/CTA) + every vendor surface | `directory/vendors.ts`, `food/diningVenues.ts`, `reviews/vendorReviews.ts` | `@mock` |
| `home` | `features/home` | `sections.ts`, `rails.ts`, `campaigns.ts`, `demographics.ts`, `instantFeed.ts`, `nearbyOffers.ts`, `filterFeed.ts`, `seeds.ts` | mixed `@mock` / `@seed` / `@static` |

**Seed inventory expansion:** the mart/food/pharma/explore/categories/orders/coupons fixtures
were expanded so the new search-results-style Favourites page and richer catalogs look alive on
first launch: mart +4 stores and ~20 products (Home Appliances, Furniture, Books, Toys & Gifts,
Sports, Grocery); food +6 restaurants and ~14 dishes/specials (+2 booking dishes); pharma +10 OTC/
devices/baby-care/Ayurveda products; explore +3 stacks; categories +4 mart buckets; orders +8
(MART/FOOD/PHARMA × status × Delivery/Self-Pickup, every `productId` resolvable); coupons +2;
`seedFavorites` extended to span FOOD/MART/PHARMA. Because the normalized tables import these
arrays, every new product auto-derives its catalog + stock rows.

**Drill-in coverage seeding:** the category drill-in page resolves each `MASTER_CATEGORIES`
`searchQuery` to vendors via `services/categoryVendors.ts` (`matchesQuery` — per-token AND over a
product's name + category + desc + attributes). The taxonomy had outgrown the catalog, so 80 of
112 titles resolved **zero** vendors (`No vendors yet`, ad carousel hidden). `data/mart/products.ts`
(+74 rows) and `data/pharma/products.ts` (+11 rows, plus `STORE_BY_CATEGORY` keys `allergy` and
`personal-care`) were seeded so every one of the 112 titles now resolves ≥1 vendor, and the thin
first-of-tab titles (Bluetooth Headphones, Fresh Apples, Fresh Milk, BP Monitor, Multivitamin,
Nebulizer) gained a second store. `client/mobile/scripts/check-drillin-coverage.mjs`
(`npm run check:drillin`) re-runs the predicate and fails if any title resolves 0 vendors or a
product id is duplicated — run it whenever the taxonomy or catalog changes.

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
| `directory/vendors.ts` | Go + PostgreSQL (vendor identity view) | `directory/stores` + `food/diningVenues` — deduped `VendorRef[]` with `resolveVendorForProduct` (identity resolver, single owner). Snapshotted onto orders at placement | `@mock` |
| `food/diningVenues.ts` | Go + PostgreSQL (dining-venue identity + data) | ids/names mirroring `features/food/mocks/restaurants.ts` + `food/stores`. `directory.dining_venues` now carries `app`/`rating`/`cover_image`/`categories` (+ gated `address`/`phone`/`hours`) — migration `0013` | `@mock` → `@server` |
| `reviews/vendorReviews.ts` | Go + PostgreSQL (vendor reviews) | vendor-scoped public reviews (full name only) keyed by vendor id; merged with the user's live rating from `state/vendorRatingStore` by `services/vendorRatings` | `@mock` |
| `reviews/reviews.ts` | Go + PostgreSQL (reviews/specs) | `productMeta/reviews`. Reviews are now **product-keyed** — per-product rows attached to real catalog ids (`fm-*`/`sp-*`/`ph-*` bestsellers) with an app-scoped fallback so `getReviewsByProductId` never returns empty | `@mock` |
| `inventory/stock.ts` | Go + DynamoDB (key-value stock) | net new — one row per catalog product id | `@mock` |
| `checkout/orders.ts` | Go + CockroachDB (relational) | account/orders, cart/addresses, account/addresses, cart/coupons | `@mock` |
| `accounts/profile.ts` | Go + PostgreSQL (profile) | account/profile, orderStatus, accountNav, details | `@mock` |
| `home/sdui.ts` | Python + MongoDB (doc tree) | home/sections, rails, filterFeed structure — **IDs only** | `@aspirational` |

> **`@schema` reference:** each normalized table above maps **1:1** to a production table specified in
> `docs/architecture/db-schema.md` (tables, datatypes, sample rows, cache keys). Keep the two in sync
> when a fixture's shape changes.

**Vendor-rating eligibility (derived, never a stored flag):**
`checkout/orders.ts` `hasPurchasedFromVendor(userId, vendorId)` is true iff the user has a
**non-cancelled** order that resolves to that vendor — phase 1 keeps any non-cancelled order (the
future server tightens to `DELIVERED`), and it stays true for the `(user, vendor)` pair once it
exists ("old customer keeps the ability"). Vendor identity is resolved once via
`directory/vendors.ts` `resolveVendorForProduct` and snapshotted at placement
(`MyOrder.storeId`, `OrderRow.vendorStoreIds`, `PlacedOrder.storeIds`), so an old order keeps
resolving to the same vendor. The signed-in user's live rating (one per `(user, vendor)`, latest
wins) lives in `client/mobile/src/state/vendorRatingStore.ts` (persisted `faazio/vendor-ratings/v1`);
`services/vendorRatings.ts` is the single owner of the gate, reused by all five entry points.
Public display is **full name only** — no id, phone, order id, or avatar — and nothing
rating-related is logged. Production schema: `docs/architecture/db-schema.md` §7.7.

**Gateway:** `client/mobile/src/services/api/GatewayClient.ts` joins the tables above and is the
single data surface for the app. It is **wired** — set `EXPO_PUBLIC_GATEWAY_URL` +
`EXPO_PUBLIC_USE_GATEWAY=true` to hit the MVP monolith (`server/gateway`); otherwise it reads the
`@data/*` fixtures, and every remote call falls back to fixtures on error. Screens migrate
incrementally with no call-site change. Authored by the MVP backend
(`docs/architecture/mvp-backend.md`); context mapping in `docs/architecture/monolith-breakdown.md`;
wiring order in `docs/architecture/data-layer-sdui.md`.

---

## Per-Sub-App Control

### `@data/mart` — owner: `features/ecommerce` (Mart screens)

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `martProducts` | `MartProduct[]` | `FaMartScreen`; `data/home/filterFeed` (data-internal pool) | `@mock` |
| `MartProduct.storeId` | `string` (**required**) | Vendor link for campaigns, vendor drill-in, product-detail store section, self-pickup. Every `martProducts` row must set **top-level** `storeId` — enforced by the type; `ts:check` fails otherwise | contract |
| `martStores` | `StoreProfile[]` | `FaMartScreen` "Local Vendors Near You" rail + vendor drill-in (replaces the retired `MART_LOCAL_VENDORS` mock) | `@mock` |
| `MART_DEALS` / `dealToProduct` | `MartDeal[]` / `(MartDeal) => Product` | `FaMartScreen` `DealsOfDayRail`; home `DealsOfDaySection`. `MartDeal` gained optional `rating?`/`priceNote?` for the minimal deal card | `@static-editorial` |

### `@data/grocery` — **removed (merged into `mart`)**

The standalone `grocery` domain and its `@data/grocery/*` exports were deleted. Grocery
products (`gr-p*`) and the single outlet `store-g1` ("Faazio Mart Freshmart") were merged
into `mart/products.ts` and `mart/stores.ts` with `app: 'MART'`; grocery categories merged
into the Mart category tree; `recentlyViewedGrocery` folded into `recentlyViewedMart`; and
the `GROCERY` member was dropped from `AppBrand` / `CartCategory` / `SubAppId` /
`CategoryAppId`. Search, favourites and cart now surface grocery items under Mart.

> **Store-backed pickup:** every `StoreProfile` now carries optional `address`/`phone`/`hours`, and
> every MART/FOOD product sets `Product.storeId`. PHARMA products set `storeId` from a
> category→outlet map (`STORE_BY_CATEGORY` in `data/pharma/products.ts`) so the 6 outlets
> `store-p1…p6` all hold real inventory instead of defaulting to the flagship `store-p1` —
> self-pickup and the prescription vendor list now surface all six pharma outlets.
> `getPickupPointsForItems` uses this
> linkage so Self-Pickup shows the actual store(s) the order came from — not a hardcoded Faazio
> hub. `data/directory/stores.ts` consolidates the apps' stores.

### `@data/food` — owner: `features/food`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `foodProducts` | `FoodProduct[]` | `FoodMenuView`; `data/home/filterFeed` (internal). Each carries optional `isVeg?` for the diet filter | `@mock` |
| `topOfWeekDishes` | `TopOfWeekDish[]` | `FoodScreen` (top-of-week rail). Each carries optional `isVeg?` | `@mock` |
| `foodStores` | `StoreProfile[]` | `FoodScreen`; home `DiningSpecialsSection`, `MostRatedDiningSection` | `@mock` |
| `BOOKING_DISHES_DB` | `BookingDish[]` | **`@unused`** — `FoodScreen` defines its own inline copy | `@mock` + `@unused` |
| `restaurantMenus` | `Record<string, SpecialDish[]>` | `RestaurantProfileScreen.getMenuForRestaurant` (per-restaurant menus keyed by dining-restaurant name, so every dining room's "Recommended & Offers" rail + menu is populated); seeded into `directory.menus` (migration `0013`) | `@mock` → `@server` |
| `allRestaurantMenuDishes` | `SpecialDish[]` | catalog index (search) — flat pool of all per-restaurant menu dishes | `@mock` |

> **Dinner/table + food bookings (migration `0011`):** `state/bookingStore` (`BookingRecord`) and
> `state/foodBookingStore` (`FoodBookingRecord`) were memory-only. They now have a durable home in
> `bookings.tables` + `bookings.food_orders`, served by `internal/bookings` (`GET/POST /bookings`,
> `DELETE /bookings/{id}`, `GET/POST /food-bookings`). The partial unique index is the double-book
> guard. `GatewayClient` methods exist; store/screen reconciliation is pending (see
> `client/mobile/PENDING_WORK.md`).

### `@data/pharma` — owner: `features/pharma`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pharmaProducts` | `PharmaProduct[]` | `services/categoryVendors` (category drill-in / vendor details, via `storeId`); **`@unused`** by `PharmaScreen` (keeps an inline `PHARMA_PRODUCTS_DB`) | `@mock` |
| `pharmaStores` | `StoreProfile[]` | Pharma home **Local Medicals Near You** rail + `MedicalShopDetails` profile/inventory entry + prescription vendor list, preset flow, and self-pickup resolver (6 outlets `store-p1…p6`, each pickup-capable) | `@mock` |
| `PHARMA_RECENT_ORDERS` / `PharmaRecentOrder` | `PharmaRecentOrder[]` / type | `PharmaScreen` History tab (recently ordered cards; de-dups the former inline `RECENT_ORDERS`) | `@mock` |
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
| `BLOOD_REQUESTS` | `BloodRequest[]` | Donor dashboard + request-details page (feed + detail fields) — dashboard feed hydrated via `GatewayClient.getBloodRequests()` (`useBloodRequests`; fixture-enriched display extras, fixture fallback) | `@mock` → `@server` |
| `BLOOD_DONOR_UNREAD_ALERTS` | `number` | Donor dashboard (bell badge seed) | `@mock` |
| `BLOOD_REQUEST_DETAIL_COPY` | `{ bannerTitle; bannerSubtitle; confirmNote }` | Request-details page (banner + privacy note copy) | `@mock` |
| `DonorMatchRequest` | `interface` | Targeted Ask Blood request persisted by `bloodDonorStore` and shown to its recipient | `@mock` |
| `ASK_BLOOD_COPY` | `{ fabLabel; sheetTitle; searchSubtitle; resultsSubtitle; continueLabel }` | Ask Blood search/results copy | `@mock` |
| `BLOOD_DONORS` / `DonorProfile` | `DonorProfile[]` / type | Mock donor-directory repository for city + blood-group matching | `@mock` |

> **Blood Donor contract:** `BloodDonorDraft` / `BloodDonorRegistration` are the typed shape
> the Go Chi backend persists (donor registry). As of migration `0010`, the server is the
> durable home: `blood.donors` (health PII, RLS own-rows), the `blood.donor_directory`
> security-definer view (consented, display-safe columns only), `blood.requests` (public board;
> `contact`/`address` redacted for anon), `blood.interests`, and `blood.match_requests`.
> `bloodDonorStore` keeps AsyncStorage (`faazio/bloodDonor/v1`) as an optimistic cache and mirrors
> writes to `PUT /donors/me` + `setBloodInterest`/`createDonorMatch` best-effort. Health data
> stays out of plain logs. `BLOOD_REQUESTS` is now the fixture **fallback** for the dashboard feed:
> `hooks/useBloodRequests` reads `GET /blood-requests` (`blood.requests`) remote-first and merges
> fixture-only display extras (`imageUrl`/`purposeDescription`/patient demographics/`distanceKm`) by
> id; the detail page renders redacted rows gracefully. `BLOOD_DONORS` is the
> donor-directory seed; `GET /donors` (auth-scoped) replaces it.
> **Targeted Ask Blood contract:** the user searches by city + blood group, selects one
> `DonorProfile`, and creates one `DonorMatchRequest` containing both requester and
> recipient user IDs. `POST/GET /donor-match-requests` persists it server-side; the local blob is
> an optimistic cache. Backend authorization, status changes, contact disclosure, and
> notifications remain Go Chi work.

### `@data/explore` — owner: `features/catalog`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `exploreStacks` | `ExploreStack[]` | `CategoriesView`, `FavouritesView` | `@mock` |

### `@data/categories` — owner: `features/catalog`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `categoriesSearchDatabase` | `Record<string, Product[]>` | `CategoriesView`, `FavouritesView` | `@mock` |
| `MASTER_CATEGORIES` / `ALL_TABS` | `Record<CategoryAppId, CategoryTab[]>` / `CategoryTab[]` | `CategoryDrillInScreen` (via `CategoryDrillInPanel`), `SubgroupTextRail` | `@mock` |
| `HEADER_CATEGORY_RAIL` / `getCategoryRailPage` / `HEADER_RAIL_TOTAL` | `CategoryRailItem[]` + paging helpers | `HeaderCategoryRail` (via `usePagedRail`) — Home/Mart header rail. Each item carries a `vendorTags: string[]` array (`TAB_VENDOR_TAGS`) mapping rail tab ids to `StoreProfile.categories` tags | `@mock` |

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
| `defaultAddresses` | `Address[]` | `CartView` (saved-address fallback when live location is unavailable) | `@mock` |
| `coupons` | `Coupon[]` | `CartView` (promo codes) | `@mock` |
| `getPickupPointsForItems` | `(items) => PickupPoint[]` | `CartView` (order placement — auto-derives one pickup point per distinct vendor for self-pickup orders) | `@mock` |
| `NEUTRAL_PICKUP` | `PickupPoint` | fallback hub for cart items whose store can't be determined | `@mock` |

> **Self-pickup contract:** `FulfillmentMode` / `PickupPoint` are the typed contract the future Go
> Chi backend will serve via a real store/geolocation API. Self-pickup points are **store-backed**,
> not a hardcoded Faazio hub: `getPickupPointsForItems` resolves each cart item → product
> (`getProductById`) → its `storeId` (or `shop` matched to a store name, or the app's single outlet
> for PHARMA) and returns **one pickup point per distinct store** (a cart spanning several
> stores lists all of them; the user visits whichever applies). Items with no determinable store
> collapse to `NEUTRAL_PICKUP`. Checkout waives the delivery fee (`computeTotals` zeroes it for
> `PICKUP`). There is **no pickup-point picker** in the cart — the vendors are auto-derived at
> order placement and **all** are snapshotted on the order (`ordersStore.PlacedOrder.pickups`) and
> shown on the receipt + Order Details. `MyOrder.fulfillment` (optional — absent = delivery) drives
> the My Orders "Delivery / Self Pickup" chip; `MyOrder.pickup` (a `PickupAddress` snapshot —
> name, address, hours — taken at placement time, present only for `PICKUP` orders) drives the
> Order Details "Pickup From" card. Contact phone for pickup is the signed-in user's
> `userProfile.phone` — no fabricated PII.

### `@data/account` — owner: `features/profile`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pastOrders` | `PastOrder[]` | **`@unused`** — old order-history UI removed with `AccountView` | `@mock` + `@unused` |
| `myOrders` | `MyOrder[]` (with `app` sub-app field, optional `fulfillment`, optional `pickup` pickup-address snapshot for `PICKUP` orders, and optional `productId` linking to a real product) | `MyOrdersScreen` (order list, sub-app rail, status filter, Delivery/Self-Pickup chip); `getMyOrderById` → `OrderDetailsScreen` (incl. "Pickup From" card for pickup orders) | `@mock` |
| `getMyOrderById` | `(id: string) => MyOrder \| undefined` | `OrderDetailsScreen` (resolves the order by `orderId` route param) | `@mock` |
| `myOrdersStatusFilters` | `MyOrdersStatusFilterItem[]` (labels only) | `MyOrdersScreen` (filter sheet options; counts derived at runtime) | `@mock` |
| `userProfile` | `UserProfile` | `AccountScreen` (My Account header card) | `@mock` → `@server` |
| `saverMembership` | `SaverMembership` | **`@unused` (UI)** — Smart Saver banner removed from `AccountView`; still consumed by `membershipTable` (`data/accounts/profile.ts` → `GatewayClient.getMembership`) | `@mock` |
| `orderStatusCounts` | `OrderStatusCount[]` | **`@unused` (UI)** — status grid removed from `AccountView`; still consumed by `orderStatusTable` (`data/accounts/profile.ts` → `GatewayClient.getOrderStatus`) | `@mock` |
| `accountNavGroups` | `AccountNavGroup[]` — six titled groups (`profile`, `payments`, `privacy`, `earn`, `legal`, `support`); `privacy`/`legal` are `comingSoon`; `earn` is active with a `sell-with-us` row | `AccountScreen` (nav list, incl. My Orders + Sell with us entry rows; group titles + Coming-soon placeholders) | `@mock` |
| `accountDetails` | `UserDetailsData` | `UserDetailsScreen` (Your Details) — hydrated via `GatewayClient.getDetails()` (server `accounts.details` nested blob flattened; fixture fallback) | `@mock` → `@server` |
| `savedAddresses` | `SavedAddress[]` | `SavedAddressesScreen` (Addresses) — hydrated via `GatewayClient.getAddresses()` (`GET /profile/addresses`, label→tag mapped; fixture fallback) | `@mock` → `@server` |

> **Order → product link:** each `MyOrder.productId` (optional) references a real product in the
> four domain fixtures (order names are aligned to those products so the card and the product
> detail stay coherent). The lookup (`getProductById`) lives in `data/catalog/products.ts` — this
> is a **data-internal** cross-domain link inside `data/`, so no sub-app boundary is crossed and
> `features/profile` → `@data/*` stays clean per the dependency-cruiser rules. `data/checkout/orders.ts`
> `fromMyOrder` mirrors the id into `OrderLineItem.productId`.

### `@data/seller` — owner: `features/profile`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `SELLER_SETUP_FIELDS` | `SellerSetupField[]` — seller-onboarding field labels/placeholders (business name, owner, category, GSTIN, business address, bank account, IFSC, contact phone) | `SellWithUsScreen` (labels/placeholders for the onboarding form; submission goes to `POST /sellers` via `GatewayClient.submitSellerApplication`) | `@mock` |
| `SellerSetupField` | type | `SellWithUsScreen` | `@mock` |

> **Contract:** Read-only label/placeholder source for the seller-onboarding form. The list is
> stable; FK/field changes to the server contract happen in `GatewayClient.submitSellerApplication`
> (`sellers.sellers`), not here.

### `@data/home` — owner: `features/home`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `homeSections` | `HomeSectionDescriptor[]` | `HomeView` (section registry) | `@static` |
| `HomeSectionKind` | type union | `HomeView`, `HomeView` sections | `@static` |
| `portalSectors` | `PortalSector[]` | home `ExploreSectorsSection` | `@mock` |
| `topAdSlides` | `AdSlide[]` | home `AdBannerSection` (via shared `AdBannerCarousel`) + food `RestaurantProfileScreen` hero (same carousel) | `@mock` |
| `hotBrandDeals` | `Product[]` | home `BrandCampaignsSection` (ex-`HotBrandDealsSection`); its `hbd-*` rows remain in the catalog index + search | `@mock` |
| `adCampaigns` / `getCampaignProducts` / `getCampaignStore` / `carouselOneCampaigns` / `carouselTwoCampaigns` | `AdCampaign[]` + resolvers + carousel slices | home `BrandCampaignsSection` (via `BrandCampaignCard`) → `DealsLandingScreen` (`campaign` mode). Each campaign references a **real Mart vendor by `storeId`** (resolved via `getStoreById`) plus products **by id only**, resolved via `getProductById` (kept to the vendor's `storeId`) | `@static-editorial` → SDUI layout doc |
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
| `seedFavorites` | `string[]` | `state/favoriteStore` (seeds the search-results-style Favourites page — 15 ids spanning FOOD, MART, PHARMA, explore & `cat-*` search ids, all resolvable in `catalogIndex`); also seeded into `favourites.items` (migration `0007`) | `@seed` → `@server` |
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

> **Contract:** All rewards rules are enterprise-controlled constants. As of migration `0008`, the
> **server is the authority**: `rewards.balances` + append-only `rewards.ledger` are written by
> `checkout.CreateOrder` (via `contracts.RewardsWriter`) and read back through `GET /rewards`
> (`faazio:v1:rewards:view:{userId}` 60 s). The AsyncStorage balance is now an optimistic cache that
> reconciles on `rewardsStore.reconcile()` when the gateway is remote; these constants remain the
> shared rate contract (a future admin console will own them).

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

1. **Duplicated mock data in screens.** `PharmaScreen` (home feed arrays in `mocks/pharmaHomeFeed.ts`),
   `FoodScreen` (booking dishes), `FaMartScreen` (mart home feed in `mocks/martHomeFeed.ts`), and
   `ProductDetailView` each keep inline/feature copies of data. The `PharmaScreen` recent-orders
   copy has been de-duplicated into `data/pharma/recentOrders.ts`; the pharma/mart **home-feed**
   arrays remain feature-local (feature-specific UI types) and are a deliberate de-dup priority.
   Canonical copies are marked `@unused` until those screens switch to `@data/*`.
2. **Unused rail exports.** Several `@data/home/rails` exports (`todaysOffers`, `mixedRecommendations`,
   `popularDining`, `recentlyViewedHistory`, `sponsoredAds`, `faMartFinds`, `restaurantSpecials`)
   are exported but not consumed by mobile. They were built for the frozen Vite reference.
   **Prune candidates** — keep exported, prune when a home section is ready for them.
3. **`schema.ts` (`SDUINode`)** is `@aspirational` — defined but not produced by any data file yet.
   Data files emit typed entity arrays, not SDUI trees. Do not rely on it as a live contract.
4. **Screens still read mock data.** The MVP monolith ships
   (`docs/architecture/mvp-backend.md`) and `GatewayClient` is wired, but screens read `@data/*`
   until migrated per module (`@mock` → `@server`); `GatewayClient` falls back to `@data/*` on error.
   Migrated so far: Home SDUI feed, mart/catalog vendor drill-in, product search (3 configs),
   favourites, cart durability, checkout `placeOrder`, Pharma Rx capture/upload/create + quote/READY
   polling, orders history, vendor-review reads, `search` analytics, and **profile reads**
   (`userProfile`/`accountDetails`/`savedAddresses`). Remaining slices (food menus, blood feed,
   dining, booking create) are blocked on server-contract deltas — see `WORKFLOW_SCRATCHPAD.md` §9.
5. **Per-restaurant menus are seeded only for the 18 dining restaurants.** The 12 food-delivery
   `foodStores` still derive menus from the shared `TODAYS_SPECIALS` catalog.
