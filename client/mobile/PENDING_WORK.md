# Pending Work

Scoped, dated backlog entries for features intentionally deferred until their
dependencies exist. Do not build the backend/seller flows until told to.

---

## Pharma prescription flow + unified receipt tracking & My Orders merge

**Feature:** New full-bleed **PrescriptionFlow** (route `PrescriptionFlow`, `features/pharma/prescription/`):
`PrescriptionCameraStep` (full-screen `expo-camera` `CameraView` with a consent dialog before mount,
flash, thumbnail strip with per-photo delete, "n/10" counter, `Confirm(n)` at ≥1, 10-page hard cap)
→ `PrescriptionNoteStep` (optional pharmacist note) → `PharmaVendorList`/`PharmaVendorCard`
(search filters name/categories/desc/offerTag; "Order" pill CTA; pharma-local — cannot import
`features/ecommerce`) → `PharmaFulfilmentSheet` (Delivery/Self-Pickup on the shared `SlideUpSheet`)
→ `PrescriptionOrderConfirmedView` (unified tracking box + prescription-details card + Track My Order/Done).
The flow holds its draft locally and writes to the new **`ordersStore`** (prescription kind); it
bypasses the cart entirely. The `UploadPrescriptionFAB` now navigates to it.

**Receipt rework (`CartView`):** the ETA badge and both step-row variants are replaced by one unified
**Real-Time Tracking Status** box — a pulsing "Order has been placed" row, plus a "Pickup from:
{store}, {address}" line for PICKUP. `handlePlaceOrder` also writes `ordersStore.recordOrder` (items
kind). Items Purchased rows drop the icon: name is ¾-width ellipsized (`maxWidth: '75%'`) with a grey
"x {qty}" and right price. A primary **Track My Order** button (new optional `onTrackOrder` prop,
wired in `CartScreen` → `MyOrders` with `highlightOrderId`) joins the receipt actions.

**My Orders (`MyOrdersScreen`):** merges `ordersStore.orders` (newest first) above `@data myOrders`
(rail counts recompute); prescription placed orders render a distinct 📄 "Prescription order" card
("N pages • {vendor}", Delivery/Self-Pickup chip, Processing pill); the `highlightOrderId` route
param auto-selects that order's sub-app and rings its card.

**Data:** `data/pharma/stores.ts` expanded 1 → 6 pickup-capable outlets (`store-p1…p6`); new
`src/state/ordersStore.ts` (`PlacedOrder` with `kind: 'items' | 'prescription'`).

**Native:** `expo-camera` installed + registered in `app.json` (camera permission message). Requires
a native rebuild (`npm run android`).

**Future / honest gaps:**
- Photos are captured and shown only in-session; nothing uploads them yet (future Go backend).
- `OrderDetails` still resolves via `getMyOrderById` (@data), so placed-order "View Details" shows
  the "not found" fallback until OrderDetails is backed by `ordersStore`.

---

## Data layer — catalog depth, reviews, per-restaurant menus, orders/account, home rails

**Status:** 🟢 Shipped (data + mock).

**Feature:** A data-depth pass across `@data/*` so every store, dish, review and order list
looks populated (no empty outlets/buckets, no empty review sets).

**Changes:**
- **Catalog depth** — `data/mart/products.ts`: +8 products (Vibe Apparel `store-m4` fm-v1..fm-v4,
  ProArena Sports `store-m9` fm-pa1..fm-pa4), so every mart store has ≥2 products.
  `data/food/products.ts`: dishes for previously-empty stores (Paradise Biryani `store-f1`,
  La Paris `store-f5`, Midnight Dhaba `store-f6`). `data/pharma/products.ts`: `storeId` now set
  via a `STORE_BY_CATEGORY` map (vitamin→p4, supplements→p6, fever→p2, antiseptic→p2,
  hypertension→p3, asthma→p1, diarrhea→p5, cough→p5, default p1) so all 6 pharma outlets
  `store-p1…p6` hold real inventory.
- **Per-product reviews** — `data/reviews/reviews.ts` is product-keyed: `PRODUCT_REVIEWS` maps
  real catalog ids (e.g. `fm-m1`, `gr-p1`, `sp-1`, `m-italian-margherita`, `ph-f1`) to 3-4 reviews
  each; `avatarMap` extended to ~20 Indian profiles. `getReviewsByProductId` returns keyed rows
  or falls back to the app's representative set (never empty); representative ids changed to
  FOOD→`sp-1`, MART→`fm-m1`, PHARMA→`ph-f1`.
- **Per-restaurant menus (new `data/food/menus.ts`)** — `restaurantMenus: Record<string,
  SpecialDish[]>` keyed by the 18 dining-restaurant names (~5 dishes each) + `allRestaurantMenuDishes`.
  `RestaurantProfileScreen.getMenuForRestaurant()` reads `restaurantMenus[restaurant.name]` first,
  falling back to the old `TODAYS_SPECIALS` cuisine-match + padding logic. Exports registered in
  `data/index.ts`.
- **Explore & search depth** — `data/explore/stacks.ts`: +2 stacks (`pharma-wellness` PHARMA,
  `monsoon-essentials` MART, 4 items each). `data/categories/searchDatabase.ts`: `cat-pb-3`
  (Snail Repair Eye Cream) added to the ph-beauty bucket. `data/food/bookingDishes.ts`: 10 → 16
  dishes (bd-11..bd-16) across Breakfast/Lunch/Dinner.
- **Orders & account** — `data/account/orders.ts`: `pastOrders` 2 → 12 (all Delivered except one
  Cancelled FOOD); `myOrders` 15 → 20 (id 16-20: Cancelled FOOD `sp-6`, Delivered PHARMA pickup
  `ph-dev5` MediTrust, Processing FOOD `m-mughlai-biryani`, Delivered MART `fm-pa1`, Shipped
  PHARMA pickup `ph-otc3` Wellness Plus). `data/account/orderStatus.ts` `orderStatusCounts`
  corrected to match (All 20 / Processing 3 / Shipped 4 / Delivered 10 / Cancelled 3).
  `data/cart/coupons.ts`: +MONSOON25 (25%, min 899), +HEALTH10 (10%, min 399).
- **Seeds & favourites** — `data/home/seeds.ts` `seedFavorites` 6 → 15 (adds `fm-m1`, `fm-e1`,
  `fm-f1`, `gr-p1`, `sp-1`, `m-italian-pasta`, `m-korean-fc`, `ph-t3`, `cat-pw-1`, all resolvable
  in `catalogIndex`). `favourites/mocks.ts` `FavItem` gained a `productId` linking each of the 8
  tab items to a real `@data` catalog id (e.g. `g1→gr-p1`, `f2→cat-fd-1`, `p2→ph-f1`).
- **De-dup (Phase 7)** — new `data/pharma/recentOrders.ts` exports `PHARMA_RECENT_ORDERS`
  (`PharmaRecentOrder[]`, 4 rows, optional `productId` → `ph-f1`/`ph-t3`/`ph-d1`) + type,
  registered in `data/index.ts`. `PharmaScreen` dropped its inline `RECENT_ORDERS` array + local
  `RecentOrder` interface and now imports `PHARMA_RECENT_ORDERS` (resolves the known gap).
  `data/food/specials.ts` gained the missing `@mock` status banner.
- **Home rails & campaigns** — `data/home/campaigns.ts`: +4 vendor campaigns (thread-labs
  `store-m3`, vibe-apparel `store-m4` in carousel 1; scholars-bookland `store-m6`, wood-steel
  `store-m8` in carousel 2), carousels now rotate 3-4 cards each. `data/home/rails.ts`:
  `recentlyViewedMart` +rvm-5 (Floral Maxi Summer Dress), `recentlyViewedFood` +rvf-4
  (Chicken Dum Biryani).

**Date:** 2026-09-15

---

## Food fulfilment UX — cart toggle, order pickup address, restaurant navigation

**Status:** 🟢 Shipped.

**Feature:** Decide fulfilment on the cart page itself; show the pickup address on order
details; let the food product-detail page open the restaurant profile.

**Changes:**
- **Cart BAG** (`CartView.tsx`): the order-level **Deliver / Self-Pickup** toggle moved from
  the ADDRESS step onto the BAG step (a "How do you want your order?" card). Pickup renders
  the pickup-point radio cards (one per distinct store via `getPickupPointsForItems`) +
  contact row directly on the page; Delivery shows a "Deliver to" row → ADDRESS. The ADDRESS
  step is now **delivery-only** (`Select Delivery Address`). Proceed to Pay goes straight to
  PAYMENT for pickup; payment's back button returns to BAG in both modes. `computeTotals`
  still zeroes the fee for pickup.
- **Order Details** (`OrderDetailsScreen.tsx` + `data/account/orders.ts` + `data/types.ts`):
  new optional `MyOrder.pickup` (`PickupAddress` snapshot) drives a **"Pickup From"** card
  (store name, address, `Open {hours}`, pickup contact). The 6 PICKUP fixtures were populated
  from real store addresses.
- **Food product-detail** (`CommonProductDetailView.tsx`, `ProductDetailScreen.tsx`,
  `features/food/utils/restaurantForProduct.ts`): new `onViewRestaurant` prop makes the FOOD
  restaurant store row tappable + adds a **View Restaurant** button, deep-linking into nested
  `FoodApp → RestaurantProfile`. `getDiningRestaurantForProduct` resolves by `storeId` →
  `foodStores`, then `shop` → dining mocks, then `shop` → `foodStores`, else `undefined`.

**Data:** `@data/types` `PickupAddress` + `MyOrder.pickup`; `data/account/orders.ts`.

**Date:** 2026-09-14

---

## Cart — item selection checkboxes + food fulfilment labels

**Status:** 🟢 Shipped.

**Feature:** The cart BAG step lets the user tick/untick items before paying; FOOD rows
show their fulfilment mode.

**Changes:**
- **Shared `Checkbox`** (`components/shared/Checkbox.tsx`, exported from
  `components/shared/index.ts`): rounded square, grey border → green `#118C4F` with a
  white check; `indeterminate` renders a white minus (partial group).
- **Selection-driven totals** (`CartView.tsx`): a screen-scoped `deselectedIds` set keeps
  new items ticked by default. To Pay / savings / coins estimate / pickup points / payment
  item count all compute from the selected subset. Category headers (Mart/Food/Pharma) got
  a tri-state **group checkbox** replacing the old icon chip (icons removed from
  `CATEGORY_META`). Placing an order snapshots only selected items on the receipt and
  **keeps unticked items in the cart**. Proceed is disabled when nothing is ticked.
- **Layout:** removed the "Review Items" heading; the 3 category cards are now **full-bleed**
  (edge-to-edge, no gutters/borders; savings card keeps its 16px inset); item thumbnails
  bumped 48 → 64px.
- **Food fulfilment label** (FOOD rows only): `Dining` / `Food order · Delivery` /
  `Food order · Self pickup`, rendered from the persisted `CartItem.fulfilment` (fallback
  Delivery when absent). The mode is now captured at all four gated add sites
  (`RestaurantProfileScreen`, `RestaurantOffersScreen`, `FoodSearchScreen`,
  `CommonProductDetailView`) via `addToCart(…, { fulfilment })`; re-adding never overwrites
  the stored mode. `data/types.ts` + `cartStore.ts` gained the `fulfilment` field /
  `CartFulfilment` type; `@data/home/seeds.ts` FOOD seeds carry explicit modes so both
  labels show on first launch.

**Data:** `@data/types` `CartFulfilment` + `CartItem.fulfilment`; `@data/home/seeds.ts`.

**Date:** 2026-09-14

---

## Food — dishes-only search + fulfilment sheet gating first-adds

**Status:** 🟢 Shipped.

**Feature:** Simplified Food search to dishes-only and gated every Food first-add
behind a fulfilment chooser.

**Changes:**
- **Dishes-only search** (`foodSearchConfig.tsx`): removed the Restaurants mode,
  `SearchRestaurantCard`, and the Restaurants/Dishes toggle — a single seeded
  "Dishes" toggle with `showToggles: false`. Placeholder is now
  "Search dishes or cuisines…". `SearchRestaurantCard.tsx` deleted.
- **Edge-to-edge dish cards** (`SearchDishCard.tsx`): the card is edge-to-edge by
  default (`marginHorizontal: 0`) and the now-redundant `fullWidth` prop was removed;
  the offers page no longer passes it. Card `onAdd` is now overridable (the screen
  supplies it to gate the add) — qty stepper stays direct.
- **Fulfilment sheet** (`FoodAddModeSheet.tsx`, new, on the shared `SlideUpSheet`):
  step 1 asks Dining / Food order (Dining confirms immediately); "Food order"
  advances to step 2 (Delivery / Self pickup) with a back affordance. The chosen
  mode only gates the add — it is **not persisted** on the cart item (no cart-store
  change). Wired into the dishes-only search results, the restaurant offers page,
  the restaurant profile menu "Add", and the FOOD product-detail footer + related-
  dish grid adds.
- **Product detail** (`CommonProductDetailView.tsx`): removed the "Free Delivery /
  COD / 10-Day Return / Assured" trust block (shared component, applies to
  MART/PHARMA/FOOD). Added a FOOD vendor card (resolved by `product.shop` against
  `@data/food/stores`, name-only header when unmatched) + a "More from {restaurant}"
  2-col grid of the restaurant's other specials; card tap pushes another detail page
  (`onOpenProduct`), and FOOD footer/grid first-adds go through the fulfilment sheet.

**Scope notes / deferred:**
- Food home promo / Top-of-Week add buttons remain **direct** (unchanged) — only
  search, offers, restaurant menu, and product-detail first-adds are gated.
- The chosen fulfilment mode was originally not persisted; **it is now persisted**
  on the cart item (`CartItem.fulfilment`, via `addToCart(…, { fulfilment })`) and
  shown as a per-row label in the cart for FOOD rows (see the Cart item-selection
  entry below).

**Date:** 2026-09-14

---

## Food — RestaurantProfile UX pass + offers page wiring

**Status:** 🟢 Shipped.

**Feature:** Polished the restaurant profile screen UX and wired the previously
unreachable "View All" offers page.

**Changes (`RestaurantProfileScreen.tsx`):**
- Fixed a crash bug — `getOffers(menu)` → `getAllOffers(menu)` (was a runtime
  `ReferenceError` that crashed the profile screen on open).
- Pinned the back/search/share/more toolbar to the top as an absolute overlay
  (safe-area-inset driven) so it no longer scrolls away with the hero image.
- Offers rail: removed the 'SPECIAL' image label, made the dish image square
  (3:3), allowed titles to wrap to 3 lines, and removed the per-card '+' button.
- "View All" now navigates to the (pre-existing) `RestaurantOffersScreen`.
- Removed the veg/non-veg square markers from menu list cards (diet filtering on
  dish data is unaffected).
- Extra breathing room above the "Menu" header.

**Date:** 2026-09-14

---

## Food — RestaurantOffers page: restaurant-only filtering + search + edge-to-edge

**Status:** 🟢 Shipped.

**Feature:** Polished the "View All" offers page so it shows only the current
restaurant's own dishes, added an in-page search bar, and made result rows
render edge-to-edge.

**Changes:**
- `RestaurantProfileScreen.tsx`: the "Recommended & Offers" rail and the
  "View All" navigation both use only the current restaurant's own dishes
  (`menu.filter(d => d.restaurant === restaurant.name)`); other restaurants'
  dishes are no longer shown. The old "every 3rd item" offers derivation
  (`getAllOffers`) was removed.
- `RestaurantOffersScreen.tsx`: added a search box (filters by dish name /
  description), an empty state for restaurants with no own offers, and a
  "no matches" state when the search finds nothing.
- `SearchDishCard.tsx`: made the card **edge-to-edge by default** (no horizontal
  margin) and deleted the now-redundant `fullWidth` prop — food search results and the
  offers page share one behavior (see the later "Food fulfilment sheet + dishes-only
  search" entry, which removed the prop).

**Note:** restaurants with no dishes under their exact catalog name (e.g.
"Cafe Corretto") show no rail cards (the section header stays) and an empty
"No current offers" state on the offers page.

**Date:** 2026-09-14

---

## Food — dining-first home; Dining/FoodOrder tabs retired

**Status:** 🟢 Shipped.

**Feature:** Consolidated the Food sub-app into a **dining-first home** on a single scroll
surface. `FoodHomeScreen` now renders the former Dining content (DiningHeader with `DietToggle`,
"Top Rated Restaurants" carousel, "Today's Special Near You" carousel) plus the two rescued
Order rails ("What's on your mind?" `MindGridRail`, "Snacks & Beverages" `SnacksRail`) all as
the `RestaurantGrid` list header, with the "Restaurants For Dining" grid as the body. The
 Food stack is now `FoodHome → Search → RestaurantProfile`, and the bottom nav is **2 tabs
 (Home / Search)** + You/Cart.
**Removed (files deleted):**
- Screens: `DiningScreen.tsx`, `DiningDetailScreen.tsx`, `OrderDetailScreen.tsx`.
- Components: `FoodHeader`, `HeroCardPair`, `CategoryRail`, `PopularSpotRail`, `TopFoodRail`,
  and the `order/` folder (`OrderHeader`, `PromoCarousel`, `PopularDishRail`, `PopularDishCard`,
  `CuisineRail`, `MealsComboRail`).
- Dead code (pre-existing, unreferenced): `Header.tsx`, `PromoBannerPair.tsx`,
  `features/food/FoodMenuView.tsx`.
- Mock data: `mocks/orderFeed.ts` (snacks moved to `mocks/homeFeed.ts`).
- Assets: `src/assets/food/*.avif` hero banners + the `DINING_BANNER`/`ORDER_FOOD_BANNER`/
  `FALLBACK_MODE_BANNER_*` constants.

**Behavior changes:**
- Search result taps (`FoodSearchScreen`) now open `RestaurantProfile` (restaurants) or
  `ProductDetail` via `dishToProduct` (dishes) instead of the old `OrderDetail` feed.
- `DiningFeed` slimmed to `{ topRated, specials, dining, topFoods }`; `restaurantToProduct` /
  `nearbyToRestaurant` mappers removed.
- `NearbyRestaurantRow` + `NearbyRestaurant` retained (still used by the Home hub's
  "Most Rated Dining" rail).

**Date:** 2026-09-14

---

## Home "Deals of the day" brand campaigns + Deals landing page

**Status:** 🟢 Shipped (client-side, mock data).

**Feature:** Two display-only renames on the main-app Home hub, the old "Hot Brand Deals"
grid → a two-carousel **brand-campaign section**, and a new shared **Deals landing page**:
- **Renamed `DealsOfDaySection` title** "Deals of the Day" → **"Daily Essentials"** (display-only;
  section id `dealsOfDay` and the Mart sub-app's own `DealsOfDayRail` are untouched).
- **Renamed `HotBrandDealsSection` → `BrandCampaignsSection`** (section id `hotBrandDeals` kept):
  keeps the `#EDE9FE` container but renders **two stacked, auto-playing paging carousels** of white
  `BrandCampaignCard`s (bold **vendor-name title** + "View all →", a computed **"Up to X% off"**
  discount label below — derived from the products' max discount, no `offerTag`/EMI text — and a
  2-product row of bigger minimal `AdProductCard`s laid out flexibly: a large **square** image with
  an `AdLabelBadge` 'AD' pill bottom-right, a bigger 2-line title, slashed grey MRP + bold black
  price; no plus/badge/rating). Carousels auto-play every ~4.5s (pattern lifted from `AdBannerSection`) with
  paging dots and clean up timers on unmount. Campaign fixtures in `@data/home/campaigns.ts`
  (`adCampaigns` split into `carouselOneCampaigns`/`carouselTwoCampaigns`), each referencing a
  **real Mart vendor by `storeId`** (via `getCampaignStore`) plus products **by id only**, resolved
  via `getProductById`.
- **New `DealsLanding` route + `features/ecommerce/DealsLandingScreen.tsx`** — one page, two
  modes: `campaign` (full brand hero + 2-col product grid, from the Home carousel "View all") and
  `discounts` (vendor's discounted products, from the Mart vendor profile "View All"). Full cart
  wiring + empty/unknown-id fallbacks.
- **Vendor profile "View All" now navigates** — `VendorProfileView` gained an optional
  `onViewAllDiscounts` (hidden when absent/empty); `FaMartScreen` passes it via `SubAppWrapper`.
- **De-duplicated the discount predicate** — `getDiscountedProducts(storeId, app)` moved into the
  `services/categoryVendors.ts` repository seam; `FaMartScreen` and the landing page share it.

**Data:** `data/home/campaigns.ts` (new, vendor/`storeId`-based), `data/types.ts` (`AdCampaign`),
`data/index.ts` exports (`getCampaignStore` added); `data/home/sdui.ts` + `docs/architecture/db-schema.md`
sample titles updated to match.

**Fix note (2026-09-15):** The SmartHome Emporium card (`camp-smarthome`, `store-m7`) rendered only **1**
product instead of 2 because 5 `martProducts` rows had `storeId` accidentally nested inside `attributes`
instead of at the top level — `fm-e1`/`fm-e2`/`fm-e3` (`store-m2`) and `fm-ha1`/`fm-ha2` (`store-m7`).
`getCampaignProducts` filters by **top-level** `storeId`, so those rows resolved but were dropped, leaving
only `fm-ha3`. Moved the 5 `storeId`s to the top level in `data/mart/products.ts` and made
`MartProduct.storeId` **required** in `data/types.ts` so any future malformed row fails `ts:check`. Also
added a dev-only authoring guard in `data/home/campaigns.ts` that `console.warn`s any campaign resolving
<2 products. No component changes — the cards behaved as designed.

**Date:** 2026-09-14

## Categories cleanup + Mart vendors pill filter

**Status:** 🟢 Shipped (client-side, mock data).

**Feature:** Retired the classic categories surfaces and added a vendor category pill filter:
- **Removed the main-app "Categories" bottom tab** (`navigation/MainTabs.tsx`, `MainTabParamList`,
  deleted `features/catalog/CategoriesTabScreen.tsx`). Bottom tabs are now Home · Favourites · You.
- **Removed the Mart navbar "Categories" element** (`SubAppWrapper` FA_MART preset) — Mart navbar is
  now Home · Search · You · Cart.
- **Removed Pharma's "Shop by Category" rail + dead code** (`PharmaScreen`: dropped
  `CategoryCardRail` block, `handleCategoryPress`/`handleViewCategories`, the unreachable
  `ALL_CATEGORIES` view, `onCategoryViewChange`; deleted `shared/CategoryCardRail.tsx` and
  `services/categoryRail.ts`).
- **Retired Master Categories entirely**: `HeaderCategoryRail` no longer renders "View All"
  (removed `onViewAll`), deleted `features/catalog/MasterCategoriesScreen.tsx` and
  `shared/CategoriesDualPanel.tsx`, removed the `MasterCategories` route/params and the
  `HomeTabScreen`/`SubAppWrapper` view-all handlers. The rail + `CategoryDrillIn` are the only
  remaining categories surfaces; the taxonomy still backs them via `masterCategories.ts`.
- **New vendor pill filter** ("Local Vendors Near You"): `VendorCategoryPills` (same feed as the
  Mart header rail via `usePagedRail` + a leading "All" pill) filters the vendor list in place,
  AND-combined with the free-text search. `data/categories/railFeed.ts` gained a `vendorTags`
  array per rail item (`TAB_VENDOR_TAGS` mapping rail tab ids to `StoreProfile.categories` tags).

**Data:** `data/categories/railFeed.ts` — `CategoryRailItem` now carries `vendorTags`.

**Date:** 2026-09-13

## Wire GatewayClient → production tables (per db-schema.md)

**Status:** 🟡 Planned — backend not built.

**Feature:** When `server/` ships, wire `src/services/api/GatewayClient.ts` (the intended single data
surface) onto the production tables specified in `docs/architecture/db-schema.md`, replacing the live
`@data/*` fixtures per module (`@mock` → `@server`). Cache keys/TTLs follow
`docs/architecture/caching-cloudflare-valkey.md`.

**Blocked by:** `server/` backend (not built yet).

**Date:** 2026-09-12

---

## Faster release builds + lighter APK (CI caching, ABI trim, R8 minify)

**Status:** 🟢 Shipped (workflow + docs). Numbers not yet measured on a fresh run.

**Feature:** Speed/size hardening of the release pipeline in `.github/workflows/release-apk.yml`:
- **Gradle cache:** `gradle/actions/setup-gradle` caches `~/.gradle` (Maven deps, wrapper dists,
  transform outputs) **and** the Gradle build cache across runs — no more ~1–2 GB re-download +
  re-transform on every (cold, `prebuild --clean`) run.
- **CI-only Gradle tuning:** a "Tune Gradle for CI runner" step writes `~/.gradle/gradle.properties`
  (`-Xmx6144m`, `workers.max=4`, `parallel=true`, `caching=true`). `GRADLE_USER_HOME` takes
  precedence over the generated `android/gradle.properties`, so it lifts the laptop memory caps only
  on the runner; the repo's `gradle.properties` stays laptop-capped by design (systemd-oomd).
- **2-ABI build:** `REACT_NATIVE_ARCHS=arm64-v8a,armeabi-v7a` passed as
  `-PreactNativeArchitectures` — halves native (C++) work + `.so` payload vs the old 4-ABI build.
- **R8 minify + resource shrink ON:** `-Pandroid.enableMinifyInReleaseBuilds=true` +
  `-Pandroid.enableShrinkResourcesInReleaseBuilds=true`. Smaller dex + obfuscation (security win).
  `mapping.txt` uploaded as a **private** artifact (`faazio-mapping-<run_id>`) for retracing.
- **Workflow hygiene:** `concurrency: group: release-apk` (no parallel builds), versioned APK
  artifact name (`faazio-<version>-apk`).

**Font note:** audited `fontWeight` usage — `'800'` (110×) and `'900'` (159×) are both heavily used,
so **no Roboto weight trimming** is possible; `fonts.ts` already loads exactly the used weights.
GIF/WebP Fresco decoders were left enabled (`expo.gif.enabled`/`expo.webp.enabled`) because
`expo-image` (Glide) is the primary renderer but the safe-disable audit wasn't completed.

**Future / honest gaps:**
- **Measure before/after on a real run** (`gh workflow run release-apk.yml`): record step timings,
  APK size, and APK Analyzer dex/native-lib breakdown; paste here. Expected: CI ~43 min → ~18–26 min,
  GitHub APK download ~−50%.
- **Smoke test the minified APK on a device** (Home → Cart → Checkout → Pharma) before trusting an
  R8 release — keep-rule gaps only show at runtime.
- **AAB / Google Play** still not wired into the workflow (input-gated plan only); Play App Signing
  enrollment is a one-time manual step before adopting it.
- **`proguard-android-optimize.txt`** (more aggressive shrinking) not adopted yet — staying on the
  default `proguard-android.txt` first until the device smoke test passes.
- Consider `expo.gif.enabled=false`/`expo.webp.enabled=false` once every image is confirmed to
  render through `expo-image` (~0.1–0.3 MB).
- Larger/self-hosted runner or ccache for C++ remain optional if caching + tuning aren't enough.

**Date:** 2026-09-12

---

## Search type-ahead suggestions (Flipkart-style)

**Status:** 🟢 Shipped (client-side, local fixture data).

**Feature:** While the user types but hasn't committed, the shared `SearchScreen` now swaps
everything below the header for a suggestion list built by `features/search/suggestions.ts`
(`buildProductSuggestions` — name prefix > name substring > category match, dedupe, cap 8)
and rendered by `features/search/SearchSuggestions.tsx` (thumbnail · name · blue "In
\<category\>" subtitle · ArrowUpLeft, plus a "Search for '\<query\>'" fallback row). Tapping a
row commits the term, records it in recents and blurs. Wired via the optional
`buildSuggestions` on `SearchScreenConfig` for Mart / Pharma / Home-Hub. The header pill gets
a focused accent-tint border.

**Deferred:** no debounce (local fixture data). Once the Go Chi backend ships a `/suggest`
endpoint, swap the client-side engine for a debounced server suggest call (and add Food
suggestions — its item shape differs from `Product`).

**Date:** 2026-09-12

---

## Cart "To Pay" banner + Payment promo cleanup & Mart Product Detail store section

**Status:** 🟢 Shipped.

**Feature:** Three targeted UI changes:
- **Cart (`CartView`) — removed the "View Detailed Bill" link and its Bill Details
  sheet.** The To Pay banner is now a static `View` (amounts kept); the `showBillSheet` state,
  the whole `SlideUpSheet`, and the sheet-only styles (`billBannerRight`, `viewBillText`,
  `billLine`, `billTotalLine`, `pricingLabel`, `pricingValue`, `grandTotalLabel`,
  `grandTotalValue`) were deleted. `deliveryFee` stays (still used by the free-delivery coupon).
- **Payment (`PaymentOptionsScreen`) — removed the "Introducing Swiggy Money" promo.**
  `PromoBanner.tsx` deleted (single consumer), the `<PromoBanner />` render dropped, and the
  `PROMO` const removed from `payment/paymentData.ts`.
- **Mart Product Detail (`CommonProductDetailView`) — added a store section** below "Product
  Details" for MART products with a resolvable `storeId`: a store card (cover + rating chip,
  name + verified badge, location line, open/closes row), a "More from {store.name}"
  2-column related-products grid (same-store `martProducts` via the shared `ProductCardBase`
  — boundary-safe; only Add/steppers interactive), and a "View Vendor" button that pushes
  `SubApp` with `initialVendorStoreId` so `SubAppWrapper` opens the vendor drill-in directly.

**Date:** 2026-09-12

---

## Grocery → Mart merge + Home header category rail

**Status:** 🟢 Shipped (data + UI). Home header is a fixed-height **transform-only collapsing
overlay** (no per-frame height animation) with an inset-aware collapse cap (search bar rests below
the status bar, rail pinned) — see the on-device checklist below.

**Feature:** The standalone Grocery sub-app was removed and merged into Mart.
- **Data:** `data/grocery/` deleted; grocery products (`gr-p*`) + outlet `store-g1` merged into
  `mart/products.ts` / `mart/stores.ts` as `app: 'MART'`; `storeId` normalized to top-level on
  the phone products; grocery categories merged under the Mart tree; `recentlyViewedGrocery`
  folded into `recentlyViewedMart`; `GROCERY` dropped from `AppBrand` / `CartCategory` /
  `SubAppId` / `CategoryAppId` / `CategoryRailId`.
- **UI:** `GroceryScreen`, `grocery-home/`, `GroceryProductCard`, `SearchGroceryProductCard`,
  `CatalogGroceryProductCard`, `useGroceryFeed`, `groceryService`, `groceryHomeFeed`,
  `GroceryHomeSkeleton`, `grocerySearchConfig` and the grocery search/favourites toggles removed.
  Grocery items now surface under Mart in Home / Mart / search / cart / favourites / orders.
- **Header rail:** the Home hub header now pins a `HeaderCategoryRail` below the search bar
  (`components/shared/HeaderCategoryRail.tsx` — moved out of `features/home` to be reusable +
  `hooks/usePagedRail.ts` over
  `@data/categories/railFeed`). Tapping a chip deep-links the Master Categories sidebar; the rail
  stays **visible and interactive on collapse** (mirroring the search bar — no fade, no ghost-touch
  guard) since `collapsedVisibleHeaderH` already reserves its space below the search bar. Only the
  logo/sectors block above fades. The rail is a plain horizontal
  `ScrollView` (not a FlashList) since this region animates every frame, chips keyed by
  `item.id` in the map (`HEADER_RAIL_H`). The **Mart sub-app header** (`SubAppWrapper` →
  `SubAppHeader` `belowSearchSlot`) now pins the same shared rail below its searchbar, replacing the
  old in-feed "Shop by Category" `CategoryCardRail` (which remains in Pharma only).
- **Sub-app header searchbar:** the `SubAppHeader` address pill ("Anna Nagar, Chennai / Delivering
  to Home") was removed — Mart & Pharma now always render the live white searchbar (filtering the
  in-place feed via `searchQuery`, which is now actually wired). Food's `FoodHeader` location row was
  replaced by a fake searchbar pill that navigates to its `Search` screen (same as the main home bar).
- **Vendor rail search:** the Mart feed's "Local Vendors Near You" rail now renders `martStores`
  (`StoreProfile[]` from `@data/mart/stores`) instead of the retired `MART_LOCAL_VENDORS` mock,
  with a **live in-place search bar** (dining `RestaurantGrid` pattern) filtering by
  name/categories/desc/offerTag + an empty state. Tapping a store opens the vendor drill-in whose
  inventory derives from `martProducts` by `storeId` (replacing the hardcoded `lv-*` product map);
  `MartLocalVendor`/`MART_LOCAL_VENDORS` were removed.

**Future / honest gaps:**
- **On-device checklist (was: "pinned-rail collapse math not device-verified"):** the Home header
  now collapses by **transform only** — `headerOuter` is a fixed-height `position:absolute` overlay
  (`height = expandedHeaderH(top)`, never animated) whose inner stack slides up via `translateY`
  (`headerSlideStyle`); the list is full-screen with `contentContainerStyle.paddingTop =
  expandedHeaderH(top)`, and `collapseCap = expandedHeaderH - collapsedVisibleHeaderH` slides the
  search bar to exactly `insets.top`. The header is an **opaque overlay** with UI-thread fades:
  top block (logo/location + sectors) fades out by half-collapse, rail fades out by 0.85·cap, and
  the faded rail zone stops catching taps. Verify on device: (1) at rest the first section is
  flush below the header with no ghost overlap/gap and no gradient bleed-through under the header
  (opaque — content must not ghost through); (2) on scroll down the header collapses, the top
  block and rail **fade out** smoothly, the search bar stops just below the status bar with no
  clipped sectors sliver poking under it, and the gradient blend completes just below the
  search bar so the collapsed header reads as search bar + slate padding (no blue slab below
  it; (3) on scroll up it re-expands with the fades reversing
  (no jump, no octagon/shadow artifacts on the search bar); (4) top spacing is consistent on
  Mart/Food/Pharma/Favourites/Categories/You; (5) on iOS the notch/Dynamic Island spacing is
  correct (was broken — inset is now `useSafeAreaInsets().top` everywhere).
- `usePagedRail` pages the static `@data/categories/railFeed`; the Go backend owns the real
  paged endpoint once wired.
- Cart category inference still keys on id prefixes (`gr-*` / `cat-gr*` / `cat-fb*`) which now
  map to Mart — harmless, but a data-driven category source would be cleaner.

**Date:** 2026-09-10

---

## Home feed scroll & startup performance

**Status:** 🟢 Implemented (code), pending **release-build** verification.

**Feature:** Removes the scroll-time JS re-render storm and trims first-load work on the Home hub.
- **No scroll→state mirroring:** `HomeView` deletes the `scrollYState`/`setScrollYState` emit
  (was ~every 40px → full list reconcile → Discover grid re-render). `scrollY`/`viewportH` are
  now Reanimated `SharedValue`s and `renderItem` has a stable identity, so mounted cards never
  re-render because of scrolling.
- **Edge-triggered batch load + prefetch:** `FilterFeedSection` loads the next 8-item batch via a
  UI-thread `useDerivedValue` + `runOnJS` at the **60%** visible threshold (was 80%) and
  prefetches the next batch's image URLs via `expo-image` `Image.prefetch(..., 'memory-disk')` so
  cards decode ahead of the fold, never mid-fling. A `lastLoadH` SharedValue guards against
  re-firing until the grid grows. Card handlers (`onPress`/`onAdd`) are stable `useCallback`s;
  `UniversalFeedCard`/`ProductCardBase` + the 3 brand skins accept `(product) => void` handlers
  (widened, backward-compatible with existing zero-arg call sites).
- **Recycling list engine:** the Home feed's outer list currently runs on **`Animated.FlatList`**
  (reanimated-wrapped `FlatList`) with the flat-list tuning already applied
  (`initialNumToRender=2`, `maxToRenderPerBatch=6`, `windowSize=5`,
  `updateCellsBatchingPeriod=50`, `scrollEventThrottle=16`) and no `removeClippedSubviews`
  (redundant with virtualization, a Fabric blank/flicker source). Migrating to
  **`@shopify/flash-list@2.0.2`** (recycling + `maintainVisibleContentPosition` scroll anchoring
  on by default) remains a **follow-up** — see the honest-gap note below.
- **1:1 header collapse (transform-only):** `DAMPING 0.5 → 1.0` in `HomeView` — the collapsing
  header now moves with the finger like native toolbars (kills the "content outruns my finger"
  surge). The header collapse was rebuilt to **transform-only**: `headerOuter` is a fixed-height
  `position:absolute` overlay (`height = expandedHeaderH(top)`, never animated) whose inner stack
  slides via `translateY`, with the list full-screen and padded by `expandedHeaderH(top)` — so
  scrolling never triggers a per-frame layout pass (kills the lag + "violent up/down jumping").
  The top-of-list **overscroll teleport** (`if (y <= 0) clamp = 0`) was removed so the header
  re-opens interpolated, not slammed open.
- **Images:** shared `ProductCardBase` + `AdBannerSection` now render network images with
  `expo-image` (`contentFit="cover"`, `cachePolicy="memory-disk"`, `transition`, neutral loading
  bg) instead of plain RN `Image` — matches the existing `HeaderCategoryRail` convention.
- **Repository seam:** `src/services/homeFeed.ts` exposes `getHomeSections()` /
  `getFilterFeedPage(chip, page)` / `getFilterChips()` as promise-based, paginated reads from
  `@data/*` — the contract the future Go Chi gateway will fulfil (one-file backend swap). Not
  wired into the hot synchronous path yet: in-memory fixtures resolve in microseconds and an
  async first frame would add skeletons without rendering benefit.
- **Startup deferral:** non-initial routes are `React.lazy` (eager kept: `Onboarding`, `Login`,
  `MainTabs`/`Home`; lazy: Categories/Favourites/You tabs + all pushed screens). Fonts trimmed to
  the used Roboto weights `400`–`900` and gated to Android (iOS uses `System`, `useAppFonts`).

**Future / honest gaps:**
- **Release-build verification is REQUIRED** — dev mode exaggerates jank and TTI. Measure before
  vs after on `npx expo run:android --variant release`: (1) fling the home feed through the
  collapse zone + to bottom — no Discover-grid hitch, no mid-fling stalls, header collapse 1:1
  with the finger; (2) cold start → interactive Home; first section paints without a long blank;
  (3) re-verify the layout fixes (search bar below status bar, no content under header);
  (4) **FlashList v2 behavioral edge cases** (horizontal+RTL/headers aren't used here; verify the
  heterogeneous section feed renders and scrolls correctly, incl. scroll anchoring on loadMore) —
  fallback is the current `Animated.FlatList` + the transform-only header (which already removes
  the per-frame layout churn).
- **Scroll lag / violent jumping fix (was: on-device):** the header-collapse overhaul (fixed-height
  overlay + transform-only collapse, no overscroll teleport) and the
  `preventShadowTreeCommitExhaustion` native flag (enabled in `MainApplication.kt` via
  `ReactNativeFeatureFlags.override`, RN 0.86 defaults it to `false`) target the two remaining
  jitter sources. Reanimated flags the commit-pause flag as the documented fix for
  `useAnimatedScrollHandler` headers on the New Architecture. Verify on device (debug + release):
  fast repeated up/down flings show no oscillation; top overscroll re-opens the header smoothly
  (no teleport); the collapsed state is the search bar under the status bar with the rail pinned;
  taps near the header edge still register (overlay hit-testing changed); no ghost gap under the
  header at rest. The native flag requires a rebuild to take effect; one-line revert in
  `MainApplication.kt` if it regresses.
- `useDerivedValue` + `runOnJS` edge-trigger relies on Reanimated 4.5.1/worklets on Fabric
  (same runtime patched for the frozen-object bug). Fallback if it misbehaves: coarse JS emit
  (~250px) — still ~6× better than the old 40px emit.
- **Lazy routes may be marginal** (Metro ships one bundle; this defers module *evaluation*, not
  size). If release profiling shows no TTI win, collapse 5.1 to just the tab screens.
- `SearchProductRowCard` still uses RN `Image` (search surface, out of the home-feed scope).
- The repository seam is not yet consumed by the screens; wire it (or the `GatewayClient`) once
  the backend exists.

**Date:** 2026-09-11

---

## Blood Donor — dashboard UI, backend

**Status:** 🟢 Wizard closed-loop + dashboard + request-details page shipped (Donor tab, in-wrapper).

**Feature:** Blood Donor (`src/features/pharma/blood-donor/`), entered from the Pharma
navbar `Droplet` tab. A 5-step registration wizard (registry in `data/pharma/bloodDonor.ts`)
plus a registered-donor dashboard.

**Shipped:**
- Step 1 `BloodDetailsStep` (blood-group chip grid only — Rh factor and last-donation date
  were removed per design).
- Step 2 `HealthInfoStep` (age range select, weight field, four Yes/No eligibility
  questions), driven by `AGE_RANGES` / `YES_NO_OPTIONS` / `HEALTH_YESNO_QUESTIONS` /
  `WEIGHT_LIMITS`. Validation via `stepValidation.ts`. Yes/No radios start unselected —
  health claims are never pre-seeded.
- Step 3 `AvailabilityStep` (location field with real GPS via `expo-location`, willing-to-
  travel Yes/No, donation type radios — the radio row wraps so all three options stay
  visible), driven by `DONATION_TYPES` / `LOCATION_MIN_LENGTH`. The multi-date calendar
  ("Availability") and "Preferred Time Slot" select were removed per design; the step now
  collects only location, travel willingness, and donation type.
- Step 4 `NotificationsStep` (three alert-preference switch rows + an info banner), driven
  by `NOTIFICATION_SOURCES` / `NOTIFICATIONS_BANNER`. Toggles **default ON** (an opt-out
  preference, not a claim). **Decision: the design's "Primary Purpose" section was
  intentionally dropped** — the step was renamed from Purpose to Alerts (id `notifications`)
  so the stepper/title stay truthful. Do not restore it without revisiting this decision.
- Step 5 `ReviewStep` — "Your Details" card (pencil → back to step 1), consent checkbox
  (defaults unchecked), "Complete Registration" CTA with privacy note. **Review rows are an
  honest mapping, not the mock's**: no "(Positive)" Rh suffix (never asked), age shown as
  the collected range, four real health Yes/No rows instead of "Good"/last-donation date
  (never collected), no Purpose row (dropped). Complete is gated on all prior steps +
  explicit consent.
- **Workflow closing**: draft + registration persist to AsyncStorage
  (`faazio/bloodDonor/v1`, hand-rolled hydration per repo pattern — no persist middleware).
  Mid-fill exits survive restarts (wizard resumes at `firstIncompleteStep`); a completed
  registration persists so the Donor tab always opens the Registered view. The
  "Edit Registration" re-entry path was **removed** — editing returns with the future
  Registered UI redesign.   `register()` snapshots `accountPhone` (from `authStore`, null if
  none) for the future server upsert.
- `bloodDonorStore` holds the in-progress `draft` + committed `registration`
  (`registration.profile` snapshots the full draft at submit); mode-gated screen flips to
  the dashboard on submit; reset on logout.
- **Registered-donor dashboard** (`DonorDashboard.tsx`): greeting ("Hi, …" from
  `authStore.user.name`), bell with unread-badge seed, red gradient impact banner, filter
  chips (Donation Requests / Nearby / Urgent) + real search over hospital/city/state/blood
  group, and the `BLOOD_REQUESTS` seed feed via `BloodRequestCard`. The Donor tab renders
  it **inside the Pharma wrapper** (pharma navbar visible, gradient header hidden — header
  hiding decoupled from navbar hiding in `SubAppWrapper`); the wizard completion moment
  shows it in-route (navbar-less). `RegisteredDonorView` was deleted (fully replaced).
  Card taps push `BloodRequestDescription` — the full request-details page (see below).
- **Request-details page shipped** (`BloodRequestDescriptionScreen`): hospital card (photo,
  verified chip, location, phone FAB), 2×2 info grid (Blood Group / Units / Needed Within /
  Posted On), Purpose + Additional Information sections, save-a-life banner, and
  **Mark Interested** + **Accept & Proceed** actions backed by `bloodDonorStore`
  (`interestedRequestIds` / `acceptedRequestIds`, persisted in the existing AsyncStorage
  blob, cleared on logout). "Other Requests Nearby" lists the other requests sorted by
  `distanceKm`; nearby taps push the same route per request. Share/phone/map are real
  device integrations (RN `Share`, `tel:` dialer, Google Maps search by address).
- The "Every drop counts" banner is now `showBanner`-driven (step 1 only); the header
  chevron steps back within the wizard (exits only on step 1); the footer is a full-width
  Next on every step (back-nav via chevron + hardware back).
- **"Ask Blood" shipped** (`components/AskBloodSheet.tsx` on the shared `SlideUpSheet`):
  a floating FAB (red pill, `Droplet` + label) on **both** the wizard and the dashboard
  (needing blood doesn't require being a registered donor). The sheet collects blood
  group (`OptionChipGrid`), units (stepper, `ASK_BLOOD_UNITS`-bounded), hospital, city,
  contact (prefilled from the account phone), a deadline chip (`ASK_BLOOD_URGENCY_OPTIONS`)
  and an optional note; a local `canAsk` gate enables the pinned **Ask** button. On submit
  `bloodDonorStore.postAskRequest` stamps `uba-` id + ISO `postedAt`, prepends to
  `askRequests` (persisted in the same AsyncStorage blob, cleared on logout) and the sheet
  shows an honest success state. The posted request appears at the **top of the dashboard
  feed** as a non-navigating `UserBloodRequestCard` ("Your Request" chip — never
  fake-verified), searchable/filterable like the seed feed, and bumps the bell unread
  badge (simulated fan-out).

**Future / honest gaps:**
- **Interested/Accepted are local-only** (persisted AsyncStorage) — the actual
  hospital-contact flow, matching and donor-detail sharing are backend future (Go Chi).
  Accept's confirmation dialog states the sharing contract; delivery is not built.
- **Distance (`distanceKm`) is mock seed data** — no real geo between donor and hospital
  yet; the nearby sort is a real sort over the seeded values.
- **Bell press is a no-op** (TODO in `DonorDashboard`) — no notification screen or push
  infra; the badge count is the `BLOOD_DONOR_UNREAD_ALERTS` seed **plus one record per
  user "Ask Blood" post** (simulated per-device fan-out; see the Ask Blood bullet below).
- **Funnel icon is visual-only** — a filter sheet is not designed yet; ditto presence only.
- **"Nearby" is city-matching, not geo**: request `city` vs the donor's registered
  `preferredLocation` (case-insensitive contains). Real geo swaps the matcher, not the UI.
- **Request feed is a static seed** (`BLOOD_REQUESTS`, 5 fixtures) — the Go Chi backend
  owns the real feed; `BloodRequest` shape documented as the interim contract.
- **User "Ask Blood" requests are device-local + non-navigating** — they render as
  `UserBloodRequestCard`s with no detail push (the full `BloodRequest` detail page requires
  hospital-owned fields the Ask form never collects). A detail/support page for user
  requests waits for the backend to own them.
- **Ask Blood fan-out is simulated** (badge bump, intent-framed copy) — real multi-device
  push delivery + acknowledgement is a Go Chi backend task.
- **AD label is not on `RestaurantOffersScreen`** ("View All") — scope-limited to the
  restaurant profile rail; add the same `AdLabelBadge` there as a one-line follow-up if
  wanted.
- **Registered UI is a minimal scaffold** — redesign pending (own design pass). Editing
  donor details will return inside that UI, not via wizard re-entry.
- **At-rest security tradeoff (accepted for mock stage):** persisted draft/registration
  includes health data in plain AsyncStorage. Small payload, never logged, cleared on
  logout — but it must move server-side (encrypted at rest) with the Go Chi backend.
- **Server contract (documented, not built):** future donor registry upserts are keyed by
  `registration.accountPhone` → idempotent, one donor row per account. `accountPhone` is
  `null` when the account has no phone on file (no fabrication).
- Notification **delivery** is not built: no `expo-notifications`, no push infra, no
  backend. The step-4 banner copy describes eventual server behavior; "Ask Blood" fan-out
  is **simulated client-side** (badge bump + intent-framed copy) until then. Matching +
  push will live in the Go Chi backend (`server/`) once wired.
- Age is a **range select**, not a real date-of-birth — a data-layer swap is needed for
  true eligibility (DOB-based).
- **No medical deferral logic** (e.g. underweight or chronic = Yes → block). Not in the
  design; a backend/Review-layer decision.
- Reverse geocoding relies on the device geocoder (Google Play services on Android);
  emulator geocoding is often unavailable — honest alert shown, manual entry always works.
- Persist `BloodDonorRegistration` via the Go Chi backend (`server/`) once wired
  (currently local-only per account). Backend also owns the real donor registry.

**Interim contract:** Keep the `BloodDonorDraft` / `BloodDonorRegistration` shapes stable so
server wiring is a store + data-layer change only.

**Date:** 2026-09-09

---

## Store Offers — seller-managed (future backend)

**Status:** 🟡 Static seed in production UI. Backend-dependent.

**Feature:** The Home **Store Offers** section (`features/home/sections/StoreOffersSection.tsx`)
currently reads a static seed array from `data/home/storeOffers.ts`.

**Future:** Must be backed by seller/store-owner dashboard writes — a store owner
creates/edits/expires their own offer, which flows into this Home section per-store,
geofenced/ranked by relevance. This will likely be served by the Go Chi backend in
`server/` (currently a placeholder per `AGENTS.md`).

**Blocked by:**
- `server/` backend (not yet built).
- Auth/roles for store owners.
- An admin/seller app or web portal (out of scope for `client/mobile/`).

**Interim contract:** Keep the `StoreOffer` data shape (`data/types.ts`) stable. The
section's `profileFor` mapping is the only boundary that touches the data; swapping the
static array for an API call should be a one-file change inside
`StoreOffersSection.tsx`.

**Date:** 2026-08-01

---

## Nearby Offers — product-level, from nearby stores (live geo)

**Status:** 🟡 Static seed. Data shape stable.

**Feature:** The Home **Nearby Offers** section (`features/home/sections/NearbyOffersSection.tsx`)
shows product-level deals (`NearbyOffer` in `data/types.ts`) surfaced from stores physically
near the user. Currently seeded statically in `data/home/nearbyOffers.ts`.

**Future:** Rank/geofence by live user location and per-store availability once the backend
exists.

**Interim contract:** `NearbyOffer extends Product` + `distance`. Keep the shape stable so
swapping in a geo-ranked API response is a data-layer change only.

**Date:** 2026-08-01

---

## Food — Veg / Non-Veg diet filter

**Status:** 🟢 Shipped.

**Feature:** Zomato-style All / Veg / Non-Veg filter for the Food sub-app
(`src/features/food/screens/`), driven by the session-scoped `foodFilterStore` and a shared
`DietToggle` in the Food home + Search headers. Venues classified by `dietType`
(`veg`/`nonveg`/`both`); dishes by `isVeg?`. Match semantics in
`src/features/food/utils/dietFilter.ts` (`venueMatches` / `dishMatches`). The filter ANDs
with food-search chips (`foodSearchConfig.tsx` now uses the real `dietType` flag instead of
the old `/veg/i` cuisine heuristic). Unclassifiable dishes hide while a filter is active.

**Date:** 2026-09-10

---

## Account — nav rows & Coming-soon groups

**Status:** 🟡 Placeholder rows; Privacy/Legal sections are empty (Earn is now active).

**Feature:** The "You" page nav list (`features/profile/AccountView.tsx`, driven by
`@data/account/accountNav.ts` `accountNavGroups`) is grouped and titled: `profile`
(Profile settings), `payments` (Payments and credits), `privacy` (Privacy and security),
`earn` (Earn with us — now active with a `sell-with-us` row → `SellWithUs`), `legal` (Terms
and policies), `support` (Help & Support). The `privacy` and `legal` groups are
`comingSoon` and render a non-tappable "Coming soon" placeholder row.

**Future / honest gaps:**
- **Destination screens not built** for Payments, Recently Viewed, and Customer Support —
  these rows keep the TODO stub in `AccountView.handleRowPress` and don't navigate yet.
  Favourites now opens the search-results-style `Favourites` root route, and the
  "Coupons & Offers" stub row was removed from the `payments` group.
- **Privacy / Legal have no content** — no privacy/security settings, referral/
  partner/delivery-partner flow, or legal screens exist. Flip `comingSoon` off and add rows
  to each group once those screens are built; no component change is needed (data-driven).

**Interim contract:** Keep the `AccountNavGroup` shape (`title` + optional `comingSoon` +
`rows`) stable so server wiring via `GatewayClient.getAccountNav` (`navTable`) is a
data-layer change only.

**Date:** 2026-09-10

---

## FaazioRewards — coins & streak (local-only until backend)

**Status:** 🟡 Shipped locally; device-local balances (no server authority yet).

**Feature:** `features/rewards/` implements a FaazioCoins + order-streak loyalty loop:
- `rewardsStore` (persisted AsyncStorage `faazio/rewards/v1`, reset on logout) holds the coin
  balance, streak count, discount card, and an activity ledger (capped ~50 entries).
- Coins are earned on the **paid** order amount (`COIN_EARN_RATE` = ₹1000/coin) via
  `CartView.handlePlaceOrder` → `recordOrder(paidTotal, coinsRedeemed, orderId)`.
- Streak is calendar-date based; a 7-day streak grants a 10% discount card (5-day validity),
  reused as an opt-in coupon in the Bag coupon sheet. The payment step has an opt-in
  `CoinsRedeemRow` that redeems whole rupees of coins.
- UI: `FaazioRewardsScreen` (route `FaazioRewards`) and a FaazioCoins streak card on the
  Account page (title + balance + 7 flame icons filled per `streakCount`). All rules come
  from `@data/rewards/rewards.ts`.
- **Mock seed:** fresh installs start at `coinBalance = 245` / `streakCount = 5` (demo)
  until real orders override them; `reset()` on logout zeroes the balance and streak.

**Future / honest gaps:**
- **Balances are local-device-only.** `coinBalance`, `streakCount`, the discount card, and
  the ledger are stored in plain AsyncStorage and never logged with PII. There is no server
  authority yet — a user can edit local state, and balances won't sync across devices.
- **Server-side balances** must move to the Go Chi backend (`server/`): the backend should
  own earn/redemption/streak/card issuance and return authoritative balances via the
  `GatewayClient`. Until then, the `rewardsStore` blob is the single source of truth per device.
- **Order attribution is generated client-side** (`FZ-xxxxxx`) and not reconciled with any
  server order record — the ledger's `orderId` is the same client-generated id shown on the
  receipt, not a backend order reference.
- **No anti-abuse enforcement** — a local-only ledger can't detect forged orders or repeated
  same-day submissions server-side (same-day orders already count once for the streak by design).

**Interim contract:** Keep `@data/rewards/rewards.ts` constants and the `FaazioDiscountCard`
shape stable; server wiring is a store + data-layer swap (replace the local earn/redeem logic
with `GatewayClient` balance calls).

**Date:** 2026-09-10

---

## Sell with us — mock partner onboarding (no backend yet)

**Status:** 🟡 Mock read-only page; no submission or seller backend.

**Feature:** `SellWithUsScreen` (route `SellWithUs`, from the Account `earn` group's
`Sell with us` row) lists the required seller details from
`@data/seller/sellerSetup.ts` (`SELLER_SETUP_FIELDS`: business name, owner, category,
GSTIN, business address, bank account, IFSC, contact phone). The "Submit for review"
button is a read-only mock — no data is captured or sent.

**Future / honest gaps:**
- **Not a real form.** Fields are static sample values, not inputs; nothing is validated or
  submitted. Real onboarding needs a seller backend (see AGENTS.md rule: don't build
  backend/seller flows until told to).
- **Server-side seller onboarding** (KYC, GST/bank verification, product listing) belongs to
  the Go Chi backend (`server/`) + a seller portal.

**Interim contract:** Keep the `SellerSetupField` shape and `SELLER_SETUP_FIELDS` list stable
so wiring real inputs and a `GatewayClient` seller-application submit is a data/screen change.

**Date:** 2026-09-10

---

## Production crash telemetry + release signing (build hardening)

**Status:** 🟢 Release signing done (CI); remote crash reporting still open.

**Shipped (2026-09-11):** `App.tsx` now installs a global `ErrorUtils` handler (so JS/render
errors are no longer swallowed in release, where `babel` strips `console.*`) and guards the splash
with a 10 s failsafe + 4 s hydration timeouts (prevents a stuck splash → ANR). The branded splash
shows the wide `logo.png` centered on Faazio blue for a minimum of 5 s (no spinner). Stale 188 MB
`faazio-debug.apk` / `faazio-release.apk` were removed from the repo root (already `*.apk`-ignored).

**Shipped (2026-09-12):** Release builds now run in **GitHub Actions** via `.github/workflows/release-apk.yml`
(triggered with `gh workflow run`). The workflow runs `expo prebuild --clean`, restores the release
keystore from GitHub secrets (`scripts/restore-keystore.sh`), injects the `release` signingConfig
(`scripts/configure-release-signing.sh`), builds with `./gradlew assembleRelease`, and publishes the
signed APK to a GitHub Release (`gh release upload --clobber` replaces any previous APK). This
replaces the previous "release signs with the debug keystore" gap. Removed the stale
`patches/@shopify+react-native-skia+2.2.12.patch` (skia is no longer a dependency), which was
breaking `npm ci`'s `postinstall` (`patch-package`) in fresh/CI environments.

**Investigated + documented (2026-09-12): local Gradle builds are killed by `systemd-oomd`.**
Every local `assembleDebug` attempt (detached, `--no-daemon`, any config) died ~2 min in with
exit 1 and no output, while the daemon logged `Success` + `EOFException`. Root cause confirmed
via `oomctl dump`: the whole `user@1000.service` slice (~9.6G: Chrome + VS Code + terminals +
Gradle) crosses systemd-oomd's 50%/20s memory-pressure threshold, which SIGKILLs the process
group (kernel `oom_kill` counter never moved). Mitigations applied locally (gitignored
`android/`): `gradle.properties` memory caps (`-Xmx2048m`, `workers.max=2`, `parallel=false`)
+ `local.properties` `sdk.dir`. These are wiped by `expo prebuild --clean` — re-apply, and
see TROUBLESHOOTING.md "Gradle / native build failures" for the full diagnosis. **Working
policy: build via CI (`gh workflow run "Release APK"`); local builds only on a freed machine.**

**Future / honest gaps:**
- **No remote crash reporting.** The global handler only logs locally (dev). Production needs
  Sentry/Crashlytics (or a `GatewayClient` `/errors` endpoint) to surface real-device crashes.

**Shipped (2026-09-15): release APK install failure diagnosis + hardening.** A shared release APK
failed on a friend's device with **"App not installed as package appears to be invalid."**
Root cause: the friend had a **debug-signed** Faazio installed (from earlier `npm run android` dev
testing); the release APK is signed with the **release** keystore (`CN=Faazio`), a *different cert*
from the debug keystore (`CN=Android Debug`), so Android refuses the update. The fix is on the
installer side — **uninstall the old Faazio first, then install the release APK** (see
TROUBLESHOOTING.md → "Release signing"). Hardening shipped alongside:
- New config plugin `plugins/with-release-signing.js` (registered in `app.json`) deterministically
  wires the `release` buildType to the release keystore after every `expo prebuild --clean`, so
  signing survives regeneration without relying solely on the shell script (removes the
  "release falls back to the debug keystore" foot-gun).
- `scripts/configure-release-signing.sh` re-documented to the same effect.
- Version bumped to `1.0.1` / `android.versionCode 2` so the rebuilt APK is a clean install.
- Docs: TROUBLESHOOTING.md "Release signing" + RELEASE.md document the debug-vs-release cert
  conflict and the `apksigner verify` cert check.
- Note: the APK is v2-signed only (correct for `minSdkVersion 24`); v1/JAR signing is intentionally
  omitted by AGP/apksigner for minSdk ≥ 24 and is not the cause of the install failure.

**Date:** 2026-09-15

---

## Category drill-in + vendor details (from the Home/Mart header rail)

**Status:** 🟢 Shipped (client-side, mock data).

**Feature:** A rail chip (Home hub `HeaderCategoryRail` or the Mart sub-app header) now opens a
dedicated **category drill-in page** (`features/catalog/CategoryDrillInScreen.tsx`, route
`CategoryDrillIn`) instead of the classic `MasterCategories` dual panel. The panel
(`components/CategoryDrillInPanel.tsx`) resolves the tab from `MASTER_CATEGORIES[app]`, shows the
tapped category's **subgroups as a plain-text rail** (`SubgroupTextRail`, first auto-selected,
active = accent + underline), and renders a section per sub-category listing **one-per-row vendor
cards** (`VendorRowCard`), grouped via the new repository seam `services/categoryVendors.ts`
(`getVendorsForApp` / `getVendorProducts`). An inline searchbar (page-local) filters the vendor
rows live. Tapping a vendor pushes `VendorDetailScreen` (route `VendorDetails`) — a back arrow
with an inline searchbar to its right (auto-focused, sub-category query pre-applied) and that
store's products rendered one-per-row via `SearchMartProductCard` / `SearchPharmaProductCard`.

**Data:** `data/pharma/products.ts` sets `storeId` from a category→outlet map
(`STORE_BY_CATEGORY` in `data/pharma/products.ts`) so the 6 outlets `store-p1…p6` each hold real
inventory (backing the prescription vendor picker and self-pickup), so both Mart and Pharma can
group by `storeId`.

**Deliberate deviation from the search predicate:** the Search screen matches a contiguous
substring of the full query; with the mock catalog that returns nothing for most multi-word
sub-categories. `getVendorsForApp`/`matchesQuery` instead do a **per-token** match (every query
word must appear in the same `searchableText`) so the drill-in actually groups the fixture data
into per-vendor rows. It shares the exact `productSearchableText` normalization.

**Future / honest gaps:**
- **The classic categories surfaces are now removed** (bottom-tab Categories, rail "View All",
  Mart "View All", Pharma category cards, and the `MasterCategories` route) — see the "Categories
  cleanup" entry above. The rail + drill-in are the only categories surfaces.
- **`app: 'PHARMA'` is currently unreachable** — the rail is always `FA_MART`. The route supports
  Pharma for when a pharma category entry point is added.
- **Per-vendor search is a live filter**, not a full `SearchScreen`; it reuses the row cards but
  not the sort/facet/suggestion machinery.

**Date:** 2026-09-13

## Product card images square + search-result vendor header

**Status:** 🟢 Shipped (client-side).

**Feature:** Product card images on the Mart / Pharma / Food pages (and the Home rails that
reuse the same wrapper cards) are now **1:1 square** instead of 3:4 portrait. Implemented via a
new `imageAspect` prop on `ProductCardBase` (default `3 / 4`, so the product-detail "More from
store" grid keeps portrait) with the Mart / Pharma / Food wrappers defaulting to `1`; the
standalone `MartDealCard` rail was squared too. Search-result rows keep their 3:4 image.

**Search result cards:** `SearchProductRowCard` now renders a slim **one-line vendor header**
(small bold store name + tiny Store icon, hairline divider) above the image/price row instead of
the store name inline in the body. `showStoreHeader` (default `true`, forwarded through
`SearchMartProductCard` / `SearchPharmaProductCard`) lets pages opt out — the single-store
`VendorDetails` page passes `false`. Search and Favourites keep the header.

**Date:** 2026-09-13

## Home "Today's Special" randomized rails

**Status:** 🟢 Shipped (client-side).

**Feature:** The Home `diningSpecials` section is titled **"Today's Special"** (renamed from "Today's
Dining Special"; parity in `data/home/sdui.ts`) and renders **two stacked, independent horizontal
rails** (`DiningSpecialsSection.tsx`) of **randomized cards** drawn from a combined **Food + Mart +
Pharma** pool (`TODAYS_SPECIALS` via `dishToProduct`, `recentlyViewedMart`, `hotBrandDeals`,
`recentlyViewedPharma`). Each rail scrolls horizontally on its own (no shared scroll state); the mix
is sampled once per mount so re-renders don't reshuffle. Cards use the shared `UniversalFeedCard`
(`variant="rail"`, `hs(150)` wide, **square 1:1** image with **rounded corners**) — matching the
"Daily Essentials" (Deals of the day) rail. Rating, price, badges and the add-to-cart control are
hidden (`showRating`/`showPrice`/`showBadge`/`showAddButton` off); taps open the shared
`CommonProductDetailView`. The earlier Home-local `TodaysSpecialCard` (2-up stacked columns) was
removed as obsolete.

**Date:** 2026-09-16

## Mart sub-app header: removed searchbar + category rail

**Status:** 🟢 Shipped (client-side).

**Feature:** The Mart sub-app (`FA_MART`) header no longer shows a searchbar or the pinned category
rail below it. `SubAppHeader` gained a `hideSearch` prop (hides the search pill, keeps the back
button; `subAppHeaderH` now takes `hideSearch` to shrink the header height accordingly).
`SubAppWrapper` passes `hideSearch` for `FA_MART` and no longer renders `HeaderCategoryRail` as the
Mart `belowSearchSlot` (the shared rail component is still used by the Home hub header). The Mart
search tab / `onSearchPress` behaviour is unchanged.

**Date:** 2026-09-16

