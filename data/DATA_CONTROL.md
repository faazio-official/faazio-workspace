# Faazio Data Control

> Data ownership, consumption, and status control for every sub-app's data.
> This is the authoritative map of **who owns**, **who consumes**, and **what is real vs mock**
> for each entry in the shared `data/` layer. The React Native app (`client/mobile/`) is the only
> current consumer — the root Vite web app (frozen reference) uses its own `src/data/` copies.

> **Production (live):** live data is served **server-only** by the Go gateway over Supabase
> (Postgres) + MongoDB via `GatewayClient`. `@data/*` fixtures are retained for shared types,
> static taxonomy and seed rows; `GatewayClient` never substitutes them on a remote error.
> A few presentation surfaces (`PharmaScreen` category grid, PDP store/related blocks, search
> fallback) still use curated `@data/*` rows as an explicit **offline/error shell** — never as the
> online origin while the gateway answers. Each is called out below.
> See `docs/architecture/mvp-backend.md` and `docs/architecture/data-layer-sdui.md`.

---

## Status Taxonomy

| Tag | Meaning |
|---|---|
| `@mock` | Fixture retained for types/editorial seeds or an explicit offline/error fallback. **Never the online origin** — `GatewayClient` is server-only; screens may show it only when the server gave no answer. |
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
| `mart` | `features/ecommerce` | `products.ts`, `stores.ts` | `@server` (fixtures are type/offline seeds) |
| `food` | `features/food` | `products.ts`, `stores.ts`, `menus.ts`, `specials.ts`, `diningVenues.ts` | mixed `@mock` / `@server` — `menus.ts` + `diningVenues.ts` seed `directory.menus`/`directory.dining_venues` and fall back locally (`getList` → `GatewayClient.fetchMenu`/`fetchVenues`); `features/food/mocks/*` (`restaurants`, `homeFeed`, `specials`) are the client-side first-paint for the restaurant grid + mind/snack rails (see `@data/food` below) |
| `pharma` | `features/pharma` | `products.ts`, `stores.ts`, `bloodRequests.ts`, `recentOrders.ts` | mixed `@mock` / `@server` — pharma home feed (SDUI sections, coupons, hero) + History read `GatewayClient`; `PHARMA_PRODUCTS_DB` supplies authored category ids/copy while `POST /products/batch` overlays money/rating/image online; authored rows are the offline/error shell only |
| `explore` | `features/catalog` (Categories/Favourites) | `stacks.ts` | `@server` (fixtures are type seeds) |
| `categories` | `features/catalog` | `searchDatabase.ts` | `@static` taxonomy |
| `productMeta` | `features/product` (ProductDetail) | `reviews.ts` | `@server` (fixture `@unused`) |
| `cart` | `features/cart` | `addresses.ts`, `coupons.ts`, `pickup-resolver.ts` | `@server` (`coupons.ts` hydrates from `GET /coupons`; fixture seeds `promo.coupons`, no runtime fallback) |
| `account` | `features/profile` | `orders.ts` | `@server` |
| `directory` / `reviews` (vendor) | `features/profile` (rating form/CTA) + every vendor surface | `directory/vendors.ts`, `food/diningVenues.ts`, `reviews/vendorReviews.ts` | `@server` (fixtures are type seeds) |
| `home` | `features/home` | `sections.ts`, `rails.ts`, `campaigns.ts`, `demographics.ts`, `instantFeed.ts`, `nearbyOffers.ts`, `filterFeed.ts`, `seeds.ts` | `@server` + `@seed`/`@static` registry |

> **No dining/table-booking feature exists.** The Food sub-app supports only delivery and pickup
> fulfillment (`FulfillmentMode = 'DELIVERY' | 'PICKUP'`). `directory.dining_venues` (and the
> `data/food/diningVenues.ts` fixture) is **restaurant identity only** — no table counts, time slots,
> or reservation fields exist and none will be added.

**Seed inventory expansion:** the mart/food/pharma/explore/categories/orders/coupons fixtures
were expanded so the new search-results-style Favourites page and richer catalogs look alive on
first launch: mart +4 stores and ~20 products (Home Appliances, Furniture, Books, Toys & Gifts,
Sports, Grocery); food +6 restaurants and ~14 dishes/specials ; pharma +10 OTC/
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
| `catalog/products.ts` | Rust + Tantivy (search index) | mart/food/pharma/home/explore/categories product records, deduped by `id`, tokenized. Exposes `getProductById` (resolves a real `Product` from the domain arrays + converted deal/special products) used by `OrderDetailsScreen`'s **View Product** drill-in; `CatalogEntry.storeId` + `getCatalogEntriesByStore` back the offline mirror of `GET /stores/{id}/products` (Mart vendor drill-in) | `@mock` |
| `directory/stores.ts` | Go + PostgreSQL (store directory) | `mart/stores`, `food/stores` | `@mock` |
| `directory/vendors.ts` | Go + PostgreSQL (vendor identity view) | `directory/stores` + `food/diningVenues` — deduped `VendorRef[]` with `resolveVendorForProduct` (identity resolver, single owner). Snapshotted onto orders at placement | `@mock` |
| `food/diningVenues.ts` | Go + PostgreSQL (restaurant-venue identity only — no booking/reservation fields) | ids/names mirroring `features/food/mocks/restaurants.ts` + `food/stores`; exports `restaurantVenues`/`getRestaurantVenueById`/`findRestaurantVenueByName`. `directory.dining_venues` now carries `app`/`rating`/`cover_image`/`categories` (+ gated `address`/`phone`/`hours`) — migration `0013` | `@mock` → `@server` |
| `reviews/vendorReviews.ts` | Go + PostgreSQL (vendor reviews) | vendor-scoped public reviews (full name only) keyed by vendor id; merged with the user's live rating from `state/vendorRatingStore` by `services/vendorRatings` | `@mock` |
| `reviews/reviews.ts` | Go + PostgreSQL (reviews/specs) | `productMeta/reviews`. Reviews are now **product-keyed** — per-product rows attached to real catalog ids (`fm-*`/`sp-*`/`ph-*` bestsellers) with an app-scoped fallback so `getReviewsByProductId` never returns empty | `@mock` |
| `inventory/stock.ts` | Go + DynamoDB (key-value stock) | net new — one row per catalog product id | `@mock` |
| `checkout/orders.ts` | Go + CockroachDB (relational) | account/orders, cart/addresses, account/addresses, cart/coupons | `@mock` |
| `accounts/profile.ts` | Go + PostgreSQL (profile) | account/profile, orderStatus, accountNav, details | `@mock` |
| `home/sdui.ts` | Python + MongoDB (doc tree) | home/sections, rails, filterFeed structure — **IDs only** (plus the `martHero`/`foodHero` editorial `banners` leaves) | `@aspirational` |

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
single data surface for the app. It is **wired** — set `GATEWAY_URL` +
`USE_GATEWAY=true` (then `npm run configure`) to hit the production monolith (`server/gateway`). Live
reads/writes are **server-only**: a failed or disabled remote call throws (`GatewayHttpError` /
`GatewayOfflineError`) instead of fabricating a remote success; the per-entry status column below notes
where a screen keeps an explicit offline first-paint. Authored by the production backend
(`docs/architecture/mvp-backend.md`); context mapping in `docs/architecture/monolith-breakdown.md`;
wiring order in `docs/architecture/data-layer-sdui.md`.

---

## Per-Sub-App Control

### `@data/mart` — owner: `features/ecommerce` (Mart screens)

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `martProducts` | `MartProduct[]` | `FaMartScreen`; `data/home/filterFeed` (data-internal pool) | `@mock` |
| `MartProduct.storeId` | `string` (**required**) | Vendor link for campaigns, vendor drill-in, product-detail store section, self-pickup. Every `martProducts` row must set **top-level** `storeId` — enforced by the type; `ts:check` fails otherwise | contract |
| `martStores` | `StoreProfile[]` | `FaMartScreen` "Local Vendors Near You" rail + vendor drill-in (replaces the retired `MART_LOCAL_VENDORS` mock); also the PDP store-block offline/error fallback (server-first via `GET /store/{id}`). Server-first nearby rail via `getStoresNearby` (fixture only when offline / no fix) | `@mock` → `@server` (offline fallback) |
| `MART_DEALS` / `dealToProduct` | `MartDeal[]` / `(MartDeal) => Product` | `FaMartScreen` `DealsOfDayRail` — **server-controlled** via the SDUI doc (`martDeals.productIds`, read by `martService.fetchMartFeed` → `getMartFeed`); `dealToProduct` and this fixture are the offline first-paint fallback only. `home/DealsOfDaySection` (Home) still resolves `md-*` through the catalog independently. Rows seeded into `catalog.products`. `MartDeal` gained optional `rating?`/`priceNote?` for the minimal deal card | `@static-editorial` (copy) + `@fallback` → SDUI ids, server-priced |
| `MART_DAILY_ESSENTIALS` (`features/ecommerce/mocks/martHomeFeed.ts`) | `MartEssential[]` | `DailyEssentialsRail` — now **server-controlled** via the SDUI home doc (`martEssentials.productIds`, read by `martService.fetchMartFeed` → `getMartFeed`); this fixture is the offline first-paint fallback only. The retired `mf-*` ghost ids were replaced with real `gr-*` catalog ids. The old `MART_HERO_BANNERS` fixture + `MartHeroCarousel` are **retired** (`W42`) — the Mart hero is a paid `MART_HERO` placement; when there is no LIVE fill it falls back to the SDUI `martHero.banners` house hero (`MartHouseHero`), and to nothing when empty | `@fallback` → SDUI |

> **Mart feed resilience + price parity (W43).** `martService.fetchMartFeed` now degrades each leg
> independently (per-leg `catch` + a body guard) so a failing `GET /stores`/`GET /sdui/home` renders
> the remaining rails rather than a stuck skeleton. The Deals + Daily-Essentials rails overlay the
> server-owned festival discount (`services/pricing` `useActiveDiscounts` → `priceDeals`/
> `priceEssentials`) so the shopper pays the same price as the paid shelf / vendor drill-in; mock or
> offline → `{}` → base price, never a synthesized discount.

> **`@mock` pool vs server-controlled rails (clarified).** `martProducts`/`martStores` are the
> **offline/mock mirror** of the server catalog + directory (`catalog.products` / `directory.stores`):
> the Mart feed vendors, the vendor drill-in and the category drill-in read the server
> (`getStores('MART')`, `GET /stores/{id}/products`, `GET /search`) and use these fixtures only as the
> offline fallback (via `useVendorProducts`/`useCategoryVendors`). The **hero** (`MART_HERO` paid +
> `martHero.banners` house fallback), **Deals** (`martDeals.productIds`) and **Daily Essentials**
> (`martEssentials.productIds`) sections are **server-controlled** through the Mongo SDUI doc
> (`GET /sdui/mart`) and `ads.campaigns`; the `MART_DEALS`/`MART_DAILY_ESSENTIALS` fixtures are
> first-paint fallbacks only. `campaign` mode (`@data/home/campaigns.ts`) is now **server-owned
> too (W50)**: the `hotBrandDeals.campaigns[]` SDUI leaf compiles into the anon
> `GET /home/campaigns(/{id})` projection (`GatewayClient.getHomeCampaigns`/`getHomeCampaign`),
> with the `@data` fixture as the offline fallback.

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
| `foodProducts` | `FoodProduct[]` | data-internal only — `data/catalog/products.ts` (catalog index), `data/food/menus.ts` (`storeMenus`), `data/home/filterFeed.ts`, `data/reviews/reviews.ts` + seed generation. Each carries optional `isVeg?` for the diet filter | `@mock` |
| `topOfWeekDishes` | `TopOfWeekDish[]` | **`@unused`** — no mobile import; retained as an editorial/seed fixture only. Each carries optional `isVeg?` | `@mock` + `@unused` |
| `foodStores` | `StoreProfile[]` | `features/food/utils/restaurantForProduct` (product → restaurant resolution), home `MostRatedRestaurantsSection` (offline first-paint), `CommonProductDetailView` (PDP store block fallback) + seed generation | `@mock` |
| `restaurantMenus` | `Record<string, SpecialDish[]>` | `RestaurantProfileScreen.getMenuForRestaurant` (per-restaurant menus keyed by restaurant name, so every restaurant's "Recommended & Offers" rail + menu is populated); seeded into `directory.menus` (migrations `0013`/`0019`/`0022`, `status` from `0017`). Dishes may carry an authored `SpecialDish.mrp`; only `mrp > price` shows a strike-through (never synthesized) | `@mock` → `@server` |
| `storeMenus` | `Record<string, SpecialDish[]>` | delivery-kitchen menus keyed by `foodStores[].name`, derived from `foodProducts` via `storeId` (single source — no hand-copied literals); consumed by `getMenuForRestaurant` / `GatewayClient.getMenu` fallback and seeded into `directory.menus` (88 dishes / 30 venues). Removes the old per-venue `TODAYS_SPECIALS` cuisine-match for the 12 `store-f*` kitchens | `@mock` → `@server` |
| `allRestaurantMenuDishes` | `SpecialDish[]` | catalog index (search) — flat pool of all per-restaurant menu dishes | `@mock` |
| `menuForVenueName` | `(name: string) => SpecialDish[]` | `getMenuForRestaurant` + `GatewayClient.getMenu` — restaurant menu first, then delivery menu (the single resolver for both) | `@mock` |

> **Food offers/ads disclosure rule (W45).** Organic food is **never** paid and never an "offer":
> only `mrp > price` dishes (`getOfferDishes` in `features/food/utils/menu.ts`, shared by
> `RestaurantProfileScreen` + `RestaurantOffersScreen`) appear under "Recommended & Offers", and they
> carry **no** `AdLabelBadge`. The visible Food offer is the **authoritative live coupon**
> (`GET /coupons?app=FOOD` via `useBestCoupon`, strict) — the store `offerTag` chip/banner is
> decorative `@static-editorial` copy and only a fallback, with no price promise. The Food house hero
> is the `foodHero.banners` SDUI leaf (the paid `FOOD_HERO` renders first) and the "Today's Special
> Near You" order is the `foodSpecials.productIds` SDUI leaf (ID-only, money joined from
> `catalog.products`; unknown ids fall back to fixture order). `TODAYS_SPECIALS` no
> longer pads an unseeded venue (the old cuisine-match could leak other restaurants' dishes into a
> profile) — an unseeded venue shows an honest empty menu.

> **Menu discount truth (W56).** A `directory.menus` dish is **not** festival-eligible:
> `promo.festival_optins` is `catalog.products`-scoped and checkout ignores menus, so the authored
> `mrp_paisa` strike is the only menu discount. The restaurant grid shows an honest empty state on a
> server-authoritative empty venue list (`GatewayClient.fetchVenues`); no fixture venues are shown.

### `@data/pharma` — owner: `features/pharma`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pharmaProducts` | `PharmaProduct[]` | `services/categoryVendors` (category drill-in / vendor details, via `storeId`) + seed generation; **`@unused`** by `PharmaScreen` (keeps an inline `PHARMA_PRODUCTS_DB`) | `@mock` |
| `pharmaStores` | `StoreProfile[]` | Pharma home **Local Medicals Near You** rail + `MedicalShopDetails` profile/inventory entry + prescription vendor list, preset flow, and self-pickup resolver (6 outlets `store-p1…p6`, each pickup-capable); also the PDP store-block offline/error fallback (server-first via `GET /store/{id}`) | `@mock` |
| `PHARMA_RECENT_ORDERS` / `PharmaRecentOrder` | `PharmaRecentOrder[]` / type | `PharmaScreen` History tab (recently ordered cards; de-dups the former inline `RECENT_ORDERS`) | `@mock` |
| `PHARMA_PRODUCTS_DB` | `PharmaDBItem[]` | `PharmaScreen` **authored category grid** (real `ph-*` ids + copy). Online, ids are resolved via `POST /products/batch` and the server price/rating/image/badge are overlaid before `useActiveDiscounts`, so the shown price matches checkout; authored rows render only while offline or if the batch call fails. Delisted ids drop out of the grid | `@mock` |
| `PHARMA_CATEGORIES` | `PharmaCategory[]` | `data/catalog/products.ts` pharma facet categories (server search) | `@mock` |
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
| `BLOOD_REQUESTS` | `BloodRequest[]` | Donor dashboard + request-details page (feed + detail fields) — feed hydrated via `GatewayClient.fetchBloodRequests()` (`useBloodRequests` returns `{ requests, source, settled }`; fixture-enriched display extras, `live`/`empty-authoritative`/`offline-fallback`/`cache-stale` provenance; server `contact`/`address` never backfilled with fixture PII; `settled` lets a cold deep link wait for the live board before judging a request missing) | `@server` (fixture fallback) |
| `BLOOD_REQUEST_DETAIL_COPY` | `{ bannerTitle; bannerSubtitle; confirmNote }` | Request-details page (banner + privacy note copy) | `@mock` |
| `DonorMatchRequest` | `interface` (+ `DonorMatchStatus`) | Targeted Ask Blood request persisted by `bloodDonorStore` and shown to its recipient; `status: 'pending' \| 'accepted' \| 'declined' \| 'completed'` mirrors the server `match_status` | `@server` (server-hydrated incoming + outgoing) |
| `ASK_BLOOD_COPY` | `{ fabLabel; sheetTitle; searchSubtitle; resultsSubtitle; continueLabel }` | Ask Blood search/results copy | `@mock` |
| `BLOOD_DONORS` / `DonorProfile` | `DonorProfile[]` / type | Offline fallback for `services/donorDirectory.ts` (Ask Blood matching + donor detail) — remote-first `GET /donors` (consented, auth-scoped) via no-fallback `fetchBloodDonors` is the live source; `findMatchingDonors` returns `{ donors, source }` (`live`/`empty-authoritative`/`offline-fallback`) so a `200 []` is never masked by the fixture and a fixture donor is never shown as consented live | `@server` (fixture fallback) |

> **Category→outlet duplication:** `PHARMA_PRODUCTS_DB` (the authored rows) and the `STORE_BY_CATEGORY`
> map in `data/pharma/products.ts` are the two authorities for a medicine's stocking outlet —
> `pharmaProducts` derives each row's `storeId` from the map, so changing a category's outlet is a
> one-place edit; do not hardcode a store onto an authored `PHARMA_PRODUCTS_DB` row.

> **Blood Donor contract:** `BloodDonorDraft` / `BloodDonorRegistration` are the typed shape
> the Go Chi backend persists (donor registry). As of migration `0010`, the server is the
> durable home: `blood.donors` (health PII, RLS own-rows), the `blood.donor_directory`
> security-definer view (consented, display-safe columns only), `blood.requests` (public board;
> `contact`/`address` redacted for anon), `blood.interests`, and `blood.match_requests`.
> `bloodDonorStore` keeps AsyncStorage (`faazio/bloodDonor/v1`) as an optimistic cache and mirrors
> writes to `PUT /donors/me` + `setBloodInterest`/`createDonorMatch` as **outcome-returning** calls
> (`synced`/`offline`/`signed-out`). It tags the optimistic row `pendingSync` and queues a
> `PendingDonorOp` in the same blob when a write is non-durable; the outbox is flushed on hydration
> + app foreground and `hydrateFromServer` reconciles the server rows over the local mirrors (server
> wins by id, local-only preserved). Mock mode (remote disabled) keeps the device mirror as final —
> no fabricated server success. Health data stays out of plain logs. `BLOOD_REQUESTS` is now the
> fixture **fallback** for the dashboard feed: `hooks/useBloodRequests` reads `GET /blood-requests`
> (`blood.requests`) through the no-fallback `GatewayClient.fetchBloodRequests` remote-first and
> merges fixture-only display extras (`imageUrl`/`purposeDescription`/patient demographics/
> `distanceKm`) by id; the hook returns `{ requests, source }` (`live` | `empty-authoritative` |
> `offline-fallback` | `cache-stale`) so a `200 []` shows an honest empty card while an error shows
> the fixture/cache labelled "offline". The detail page renders redacted rows gracefully, and a
> redacted/absent server contact/address is rendered blank — never backfilled with a fixture
> lookalike. `BLOOD_DONORS` is the
> donor-directory **offline fallback**; `GET /donors` (auth-scoped, `consent AND available` only via
> `blood.donor_directory`) is the live source read by `services/donorDirectory.ts` through the
> no-fallback `GatewayClient.fetchBloodDonors`. `findMatchingDonors` returns `{ donors, source }`
> (`live`/`empty-authoritative`/`offline-fallback`): a live `200 []` renders an honest "no consented
> donors" empty (never backfilled with fixtures), and an offline search shows the fixture filtered to
> the query behind a "Showing saved donors — offline" chip. The detail route carries that `source`,
> so a donor opened from a live search resolves only from server rows (an unknown id = honest missing);
> only an offline/fallback search may resolve from the fixture. Un-tapping interest propagates to the
> server (`DELETE /blood-requests/{id}/interest` via `clearBloodInterest`, retryable through the
> `interest-remove` outbox op) instead of staying device-local.
> **Targeted Ask Blood contract:** the user searches by city + blood group, selects one
> `DonorProfile`, and creates one `DonorMatchRequest` containing both requester and
> recipient user IDs. `POST/GET /donor-match-requests` persists it server-side; the local blob is
> an optimistic cache. The recipient reads their incoming set from
> `GET /donor-match-requests/incoming` (server-hydrated into `bloodDonorStore.incomingMatchRequests`)
> and accepts/declines via `PUT /donor-match-requests/{id}/status` — recipient-only, pending-only,
> outcome-returning, and enqueuing a PII-free `MATCH_ACCEPTED`/`MATCH_DECLINED` notification
> to the requester. The requester's outgoing row carries the real status. Contact disclosure on
> acceptance remains reveal-gated Go Chi work; the public board post is `POST /blood-requests` via the
> outcome-returning `createBloodRequest` (AskBloodSheet "Post to the public board").

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
> Order Details "Pickup From" card. Contact phone for pickup is the signed-in user's verified
> `authStore.user.phone` (or the saved address phone), never the `userProfile` fixture — no
> fabricated PII.
>
> **Dynamic delivery fee (W65/W66) — no data change needed.** The delivery fee is a **server
> setting**, not a `@data` value: `tax.delivery_fee_settings` (`0053`) holds the rate card (default
> 3 km / ₹35 / ₹7 per extra km as of `0054`), the gateway owns the road-distance math
> (`GET /checkout/delivery-fee`, `directory.stores` pins + Haversine), and `taxmath.Compute` settles
> the same figure at placement. Night/rain/festival surge and the FREE-Delivery coupon ruling are
> also server-owned (`delivery.payout_settings`, `ops.festival_calendar`, `promo.coupons`); the client
> only mirrors the delivery estimate (`computeDeliveryFeePaisa`) as an offline fallback. There is
> nothing to version here.

### `@data/account` — owner: `features/profile`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `pastOrders` | `PastOrder[]` | **`@unused` (UI)** — old order-history UI removed with `AccountView`; still consumed by `ordersTable` (seed generation). Statuses must stay inside the `order_status` enum — the seed generator now fails on an unknown value instead of silently coercing it | `@mock` + `@unused` |
| `myOrders` | `MyOrder[]` (with `app` sub-app field, optional `fulfillment`, optional `pickup` pickup-address snapshot for `PICKUP` orders, and optional `productId` linking to a real product) | `MyOrdersScreen` (order list, sub-app rail, status filter, Delivery/Self-Pickup chip); `getMyOrderById` → `OrderDetailsScreen` (incl. "Pickup From" card for pickup orders) | `@mock` |
| `getMyOrderById` | `(id: string) => MyOrder \| undefined` | `OrderDetailsScreen` (resolves the order by `orderId` route param) | `@mock` |
| `myOrdersStatusFilters` | `MyOrdersStatusFilterItem[]` (labels only) | `MyOrdersScreen` (filter sheet options; counts derived at runtime) | `@mock` |
| `userProfile` | `UserProfile` | `UserDetailsScreen` fallback only — `GET /profile` is the live source; `ProvisionUserID` now forward-fills `accounts.profile` on first OTP login and the server falls back to `checkout.users` for pre-provision rows, so a signed-in user never renders this fixture's fabricated PII | `@server` (fixture is offline/error shell) |
| `saverMembership` | `SaverMembership` | **`@unused` (UI)** — Smart Saver banner removed from `AccountView`; still consumed by `membershipTable` (`data/accounts/profile.ts` → `GatewayClient.getMembership`) | `@mock` |
| `orderStatusCounts` | `OrderStatusCount[]` | **`@unused` (UI)** — status grid removed from `AccountView`; still consumed by `orderStatusTable` (`data/accounts/profile.ts` → `GatewayClient.getOrderStatus`) | `@mock` |
| `accountNavGroups` | `AccountNavGroup[]` — six titled groups (`profile`, `payments`, `privacy`, `earn`, `legal`, `support`); `privacy` is active with `delete-account` / `request-data-deletion` rows, `legal` is `comingSoon`, `earn` is active with a `sell-with-us` row | `AccountScreen` (nav list, incl. My Orders + Sell with us entry rows; group titles + Coming-soon placeholders) | `@mock` |
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
| `SELLER_SETUP_FIELDS` | `SellerSetupField[]` — seller-onboarding field labels/placeholders (business identity, PAN/state, platform fee, bank name/account/IFSC/beneficiary, contact email, FSSAI) | `SellerRegistrationScreen` (`features/seller-onboarding/`; labels/placeholders for the onboarding wizard; submission goes to `POST /sellers` via `GatewayClient.submitSellerApplication`) | `@mock` |
| `SellerSetupField` | type | `SellerRegistrationScreen` | `@mock` |

### `@data/districts` — owner: `features/seller-onboarding`

| Export | Type | Mobile consumers | Status |
|---|---|---|---|
| `DISTRICTS` | `DistrictInfo[]` — 42 TN/PY districts (`districtCode`, `name`, `stateCode`) | `SellerRegistrationScreen` (district picker for covered states) | `@mock` |
| `districtsForState` / `stateForDistrict` / `districtName` | helpers | seller onboarding, future district-scoped lists | `@mock` |
| `DistrictInfo` | type | mobile + web mirrors | `@mock` |

> **Contract:** Mirrors `admins.district_master` (migration `0046`); the gateway
> (`internal/platform/geo`) is authoritative. `DISTRICTS` must stay in sync with `geo.go` and the web
> mirror `client/web/platform/src/data/districts.ts`.

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
| `nearbyOffers` | `NearbyOffer[]` | home `NearbyOffersSection` | `@mock` → `@server` (`fetchProductsNearby`, offline/no-fix fallback) |
| `filterChips` / `filterFeedPools` / `FilterChipId` | typed pools | home `FilterFeedSection` | `@mock` |
| `seedCartItems` | `CartItem[]` | **`@unused`** (cart is server-authoritative — `state/cartStore` pulls `inventory.carts`; no client reads this fixture) | `@seed` + `@unused` |
| `seedFavorites` | `string[]` | Supabase seed generator only (`server/supabase/seed/generate.mjs` inserts them into `favourites.items` for the demo user — 15 ids spanning FOOD, MART, PHARMA, explore & `cat-*` search ids, all resolvable in `catalogIndex`); the mobile `state/favoriteStore` is server-authoritative and reads `GET /favourites` | `@seed` → `@server` |
| `seedLocation` | `string` | **`@unused`** by mobile | `@seed` + `@unused` |

> **Sponsored rail (W30):** `HomeSectionKind` gained `sponsoredRail` — a paid, separately-labelled
> Home rail fed by `GatewayClient.getLiveAds`/`getSponsoredProducts` (`GET /ads/live?slot=HOME_TOP`;
> seed `ads.sponsored_slots` + `sel-3`). It has **no** `@data` fixture by design — paid placements
> never fabricate a fallback, so an empty/offline result collapses the section. The legacy
> `sponsoredAds` export above (`data/home/rails.ts`) is unrelated and stays `@unused`.
>
> **Placements (W32):** the same fill/event pipeline now serves three surfaces off the boundary-safe
> shared `components/shared/SponsoredRail` — `HOME_TOP` (Home rail), `SPONSORED_SHOWCASE` (Mart home
> feed) and `SECTOR_RAIL` (vendor "Discounted Products" landing). Impressions/clicks post to
> `POST /ads/events`; the last tapped slot attributes the next order (`orders_attributed`). See
> `docs/architecture/caching-cloudflare-valkey.md` §5a for the surface map. Seed carries one demo
> LIVE slot per placement.
>
> **Paid hero campaigns (W41/W42/W45):** `ads.campaigns` (one row per campaign+placement) feeds the
> shared `components/shared/CampaignHero` via `GatewayClient.getHeroAds` (`GET /ads/hero`) at
> `MART_HERO` (Mart home), `FOOD_HERO` (Food home), `PHARMA_HERO` (Pharma home), `CATEGORY_TOP`
> (category drill-in) and `STORE_TOP` (Mart vendor + Pharma medical shop + Food restaurant profile).
> Like the rail it has **no** `@data` fixture — no LIVE fill collapses to the host fallback / `null`.
> The Food/Mart house fallback is the `foodHero`/`martHero` SDUI `banners` leaf. The creative is a
> resolved `image_url` (mirrors the SDUI banner leaf); the deep-link target is resolved server-side
> (`services/adsTarget.ts`). Same `POST /ads/events` impression/click pipeline. The removed
> store-derived `SPONSORED` ad slides (`getAdsForQuery`) were the only fake ad source. The seed now
> carries demo LIVE rows for `MART_HERO`/`CATEGORY_TOP`/`STORE_TOP` **and two `FOOD_HERO` creatives**
> so the placement is locally testable.

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
   `FaMartScreen` (mart home feed in `mocks/martHomeFeed.ts`), and
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
4. **Server-only reads.** `GatewayClient` never falls back to `@data/*`; a failed/disabled remote
   call throws and the screen renders an honest offline/empty state. Every customer, seller and
   admin read/write is gateway-backed. The blood **writes** still use the store's `pendingOps`
   outbox as a UX retry queue (server-wins reconcile); no fixture rows are shown.
5. **~~Per-restaurant menus are seeded only for the 18 dining restaurants.~~ Resolved (W33).**
   The 12 food-delivery `foodStores` now have their own menus: `data/food/menus.ts` derives
   `storeMenus` from `foodProducts` by `storeId`, and the seed emits `directory.menus` rows for
   every `store-f*` kitchen (88 dishes / 30 venues). `TODAYS_SPECIALS` no longer pads an unseeded
   venue — the old cuisine-match fallback (which could surface another restaurant's dishes) was
   removed (W45); an unseeded venue now shows an honest empty menu.
6. **The two `auth.Require` writes use the real Firebase session.** A signed-in shopper carries a
   verified Firebase ID token (W60), so `POST /ads/events` (paid-ad measurement → portal KPIs) and
   `PUT /vendors/{id}/rating` (server-durable vendor rating) reach the ad-server/reviews origin on a
   production `AUTH_DISABLED=false` gateway. W49 keeps both client paths honest —
   `recordAdEvent` returns a confirmed-only boolean, `submitVendorRating` resolves a
   `synced`/`offline`/`signed-out`/`not-verified` outcome — and the device-local rating display +
   local last-click attribution keep the shopper flow complete offline. Local dev can still use
   `AUTH_DISABLED=true` (`user-1`). No anon write path is opened (avoids KPI/rating poisoning). See
   `client/mobile/PENDING_WORK.md` W49/W60.
