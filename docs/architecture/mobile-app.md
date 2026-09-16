# Mobile App Architecture Deep-Dive

> **Status:** LIVE · **Scope:** `client/mobile/` — the React Native (Expo) SuperApp.

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo **SDK 57** |
| React Native | **0.86.3** (New Architecture, Hermes) |
| React | **19.2.3** |
| State | **Zustand** (`src/state/`) |
| Navigation | React Navigation — Native Stack + Bottom Tabs |
| Lists | `@shopify/flash-list` |
| Data | `@data/*` (root `data/`, see `data-layer-sdui.md`) |

## Why this exists

This is the **only live runtime**. The root Vite web app was removed (see git history);
all active product work ships through this app. It is a multi-sector "superapp":
mart (which now includes the former grocery catalog), food, pharma, plus
cross-cutting home/search/cart/profile.

## Module map (`src/`)

```
src/
├── App.tsx                     # root — providers + AppNavigator
├── components/                 # global atomic UI (AppText, FaazioLogo, shared/, …)
│   └── shared/                 # 13 reusable primitives (ProductCardBase, StoreCardBase, Screen, …)
├── features/                   # vertical feature modules (15)
├── navigation/                 # AppNavigator, MainTabs, FoodStack, types
├── services/                   # GatewayClient, logout, secureSession, categoryVendors, homeFeed
├── state/                      # Zustand stores (12)
├── theme/                      # brandTokens, fonts, sectorVisuals
└── utils/                      # responsive (hs/vs/ms/wp/hp)
```

### Features (`src/features/`)

`auth` · `cart` · `catalog` · `dinner-booking` · `ecommerce` · `favourites` · `food` ·
`home` · `onboarding` · `pharma` · `product` · `profile` · `rewards` · `search` · `sub-app`

The former `grocery` sub-app was removed: grocery products/stores merged into Mart
(`ecommerce`), the `GROCERY` `SubAppId` was dropped, and the `grocery-home/` components,
`GroceryScreen`, `GroceryProductCard`, `SearchGroceryProductCard`, `grocerySearchConfig`
and the `grocery` search/favourites toggles were deleted. Grocery categories now surface
under the Mart rail chips (merged into the `FA_MART` category tree).

The Mart home feed's **"Local Vendors Near You"** rail now renders the richer `martStores`
(`StoreProfile[]`) instead of the retired `MART_LOCAL_VENDORS` mock, with a **live in-place
search bar** (dining `RestaurantGrid` pattern — filters by name/categories/desc/offerTag), a
**category pill filter** (`VendorCategoryPills`) that shows the same feed as the Mart header rail
and filters the vendor list in place (AND-combined with the search text via each rail item's
`vendorTags` against `StoreProfile.categories`), and an empty state. Tapping a store opens the
vendor drill-in, whose inventory is derived from `martProducts` by `storeId` (replacing the old
hardcoded `lv-*` product map). The vendor drill-in's **"Discounted Products" rail** renders each
promoted product with the shared **'AD' pill** (`showAdLabel` on `MartProductCard` → `AdLabelBadge`
bottom-right of the image), matching Home's disclosure for promoted rails; the plain **"All
Products"** grid below stays unlabelled (the vendor's own catalog, not promoted placement).

**Home "Deals of the day" vendor-campaign zone** (`features/home/sections/BrandCampaignsSection.tsx`,
section id `hotBrandDeals`): the renamed section (was "Hot Brand Deals") renders **two stacked,
auto-playing paging carousels** on the purple `#EDE9FE` container. Each carousel item is a white
`BrandCampaignCard` (`features/home/cards/BrandCampaignCard.tsx`) — a bold **vendor-name title**
with a "View all →" action, a computed **"Up to X% off"** discount label below (derived from the
campaign products' max discount — no `offerTag`/EMI text), and a 2-product row of bigger minimal ad
cards (`features/home/cards/AdProductCard.tsx`: a large **square** image with an `AdLabelBadge`
'AD' pill bottom-right, a bigger 2-line title, slashed grey MRP + bold black price — no
plus/badge/rating; laid out flexibly to fill the row). Carousels auto-play every ~4.5s (pattern lifted from `AdBannerSection`) with
paging dots, manually swipeable; timers clear on unmount and re-anchor on `width`. Campaign fixtures
live in `@data/home/campaigns.ts` (`adCampaigns`), each referencing a **real Mart vendor by
`storeId`** (resolved via `getCampaignStore` against the store directory) plus catalog products
**by id only**, resolved via `getProductById`/`getCampaignProducts`. The "View all" opens the
**`DealsLanding`** route in `campaign` mode (see nav graph). The sibling `DealsOfDaySection` (title
"Daily Essentials") is a display-only rename — its section id `dealsOfDay` is unchanged.

**Home "Today's Special" randomized rails** (`features/home/sections/DiningSpecialsSection.tsx`,
section id `diningSpecials`, titled "Today's Special"): renders **two stacked, independent
horizontal rails** of randomized cards drawn from a combined pool of **Food + Mart + Pharma**
products (`TODAYS_SPECIALS` via `dishToProduct`, `recentlyViewedMart`, `hotBrandDeals`,
`recentlyViewedPharma`). Each rail scrolls horizontally on its own (no shared scroll state); the
mix is sampled once per mount so re-renders don't reshuffle. Cards are the shared
`UniversalFeedCard` (`variant="rail"`, `hs(150)` wide, **square 1:1** image with **rounded
corners**) — the same styling as the "Daily Essentials" (Deals of the day) rail. Mart/Pharma cards
use the "+" add-to-cart action; taps open the shared `CommonProductDetailView`.

The **Mart Product Detail** (`CommonProductDetailView`) renders a store section below the
"Product Details" block for any MART product with a resolvable `storeId`: a store card
(cover thumb + rating chip, name + verified badge, location line, open/closes row), a
**"More from {store.name}"** 2-column related-products grid (same-store `martProducts`,
rendered with the shared `ProductCardBase` so the ecommerce-cards boundary stays green —
only Add / quantity steppers are interactive, card press is disabled), and a **"View Vendor"**
button. "View Vendor" pushes `SubApp` with `subAppId: 'FA_MART'` plus the optional
`initialVendorStoreId` param, which `SubAppWrapper` uses to open the vendor drill-in directly
(header/tab-bar auto-hide for free). FOOD/PHARMA products, deals and products without a
`storeId` render no store section.

The shared **Product Detail** (`CommonProductDetailView`) also renders a FOOD vendor card for
any FOOD product (below "Product Details") resolved by `product.shop` against `@data/food/stores`
`foodStores` (name + verified badge, desc, open/distance/delivery row; name-only header when the
restaurant isn't in `foodStores`), plus a **"More from {restaurant}"** 2-column grid of the
restaurant's other `TODAYS_SPECIALS` (via `dishToProduct`). Card tap pushes another `ProductDetail`
(`onOpenProduct`); grid + footer adds for FOOD are gated by the **fulfilment sheet**
(`FoodAddModeSheet`) instead of adding straight to the cart. The old "Free Delivery / COD /
10-Day Return / Assured" trust block was removed from the shared view (applies to MART/PHARMA
too — one component).

`dinner-booking` is a scaffold (README) — not yet shipped as a full flow.

Pharma hosts the **Blood Donor** feature (`pharma/blood-donor/`) — a 5-step registration
wizard (persistent draft/registration via AsyncStorage; the wizard closes permanently on
submit) + a registered-donor dashboard (`DonorDashboard` — request feed with filter chips +
search; rendered inside the Pharma wrapper with the navbar kept and the gradient header
hidden), entered via the `Droplet` tab in the Pharma navbar. Both the wizard and the
dashboard host a floating **"Ask Blood"** action (`AskBloodSheet` on the shared `SlideUpSheet`)
that posts a user blood request (`bloodDonorStore.askRequests`, persisted in the same blob)
which appears at the top of the dashboard feed as a non-navigating `UserBloodRequestCard`
("Your Request" chip — never fake-verified). Each post bumps the bell unread badge (simulated
fan-out: `BLOOD_DONOR_UNREAD_ALERTS` + ask count) — real per-device push delivery is a Go Chi
backend task.

`search` hosts the shared `SearchScreen` shell (`features/search/SearchScreen.tsx`) plus
per-sub-app configs (`configs/*`). Product search (Mart / Pharma / Home Hub)
renders **one dense row per result** via the shared `SearchProductRowCard`
(`components/shared/`) — a slim one-line **vendor header** (small bold store name +
tiny Store icon, hairline divider) above a row layout with a contain image, 1-line
title/description and a `price` line (seller resolved from the `@data/directory/stores`
table via `storeId`, else `shop`, else the app's single outlet, else category) plus a
compact Add to Cart / quantity stepper. `showStoreHeader` can hide the header (the
single-store `VendorDetails` page passes `false`). Food search is dishes-only: it renders
one row per result via `SearchDishCard` (edge-to-edge, no horizontal gutter) with no
Restaurants mode and no toggle rail (`showToggles: false`, single seeded "Dishes" toggle).
No config uses a 2-column grid anymore.

Product card images on the Mart / Pharma / Food pages (and the Home rails that reuse the
same wrapper cards) are **1:1 square** (`imageAspect = 1` on `ProductCardBase` and the
Mart / Pharma / Food wrappers, plus the standalone `MartDealCard`); the shared base
defaults to 3:4 so the product-detail "More from store" grid and search-result rows keep
portrait images.

**Flipkart-style type-ahead suggestions** (`features/search/suggestions.ts` +
`SearchSuggestions.tsx`): while the user types but has not committed, the shell swaps
everything below the header for a suggestion list. `buildProductSuggestions()` is a pure
engine ranking products by name prefix > name substring > category match (dedupe by id,
cap 8), each row a thumbnail · name · blue "In \<category\>" subtitle · ↖ ArrowUpLeft; a
"Search for '\<query\>'" row covers zero matches. Tapping a row commits the term, records it
in recents and blurs. Wired via the optional `buildSuggestions` on `SearchScreenConfig`
(Mart / Pharma / Home-Hub use `buildProductSuggestions`; Food is deferred — different item
shape). Recent searches still show on empty query; seeded deep-links (`initialQuery`)
commit immediately so they skip suggestions and show results as before.

**Category drill-in + vendor details** (`features/catalog/`): a rail chip (Home hub or Mart
sub-app header) opens `CategoryDrillInScreen` (route `CategoryDrillIn`, params `tabId`/`title`/
`app`). `CategoryDrillInPanel` resolves the tab from `MASTER_CATEGORIES[app]` (falling back to the
first tab), renders the tapped category's **subgroups as a plain-text rail** (`SubgroupTextRail` —
first auto-selected, active tinted with the app accent + underline; no pill background), and shows
a section per sub-category (`item`) listing **one-per-row vendor cards** (`VendorRowCard` — cover
thumb, name, rating, locality + distance). It also owns an **inline searchbar** (this page only)
that live-filters the vendor rows by name/locality. Section headers keep an arrow that routes to
the `Search` screen with that sub-category's query. Vendors are grouped by `storeId` via the
repository seam `services/categoryVendors.ts` (`getVendorsForApp` — per-token match over the same
`searchableText` as the search configs, grouped per store, sorted by match count then rating;
`getVendorProducts`). Tapping a vendor pushes `VendorDetailScreen` (route `VendorDetails`, params
`storeId`/`app`/`initialQuery`) — a back arrow with an **inline searchbar to its right** (auto-
focused, sub-category query pre-applied), a compact profile block, and a one-per-row product list
reusing `SearchMartProductCard`/`SearchPharmaProductCard` (per-app), plus a results-count line and
a "No matches" empty state. Sub-categories with no matching products show a subtle "No vendors yet"
row so the taxonomy stays visible.

The Home hub header (`features/home/HomeTabScreen.tsx` + `hubHeader.ts`) is a **fixed-height
 overlay that collapses via transform only**. `headerOuter` is `position:absolute` with a static
 `height = expandedHeaderH(top)` and is never animated; the inner `headerSlid` stack slides up with
 a `translateY` (`headerSlideStyle`), so the header never triggers a per-frame layout pass. The
 list container is full-screen with `contentContainerStyle.paddingTop = expandedHeaderH(top)`, so at
 rest the first section sits flush below the expanded header and, as the header slides up, the
  freed area simply reveals already-laid-out content. It pins a compact **category rail**
  (`components/shared/HeaderCategoryRail.tsx`) below the search bar, fed by `usePagedRail` over
   `@data/categories/railFeed` (derived from the merged Mart category tree). The same rail is reused
   by the Mart sub-app header (pinned below its searchbar). Tapping a chip opens the **category
   drill-in page** (`features/catalog/CategoryDrillInScreen.tsx`, route `CategoryDrillIn`) scoped to
   that tab (see below). On scroll the header
 **shrinks**: the `headerSlid` stack translates up by `min(clamp, collapseCap)`, and the two blocks
 that would otherwise be hard-clipped fade out **on the UI thread** (Reanimated, reading only
 shared values — no JS work per frame):
 - **Top block** (logo/location row + sectors row) — `fadeTopBlockStyle`, opacity `1 → 0` across
   `clampProgress 0 → 0.5·cap`. Fading (not clipping) is what hides this block cleanly and also
   removes the clipped sectors-row remnant that would otherwise poke under the status bar at full
   collapse.
 - **Top block** fades (see above); the **rail block does not** — the category rail stays fully
   visible and interactive on collapse, mirroring the search bar. It renders at constant opacity
   (plain `View`, no `useAnimatedStyle`, no ghost-touch guard) so the chips remain tappable at all
   times. The collapsed header's reserved height (`collapsedVisibleHeaderH`) already keeps the
   search bar + rail zone on-screen, so the rail persists without any geometry change.
 The top block uses `renderToHardwareTextureAndroid` (safe because the elevated search-bar shadow
 was removed). `clampProgress = clamp / collapseCap` (guarded when the measured cap is `0`);
 scroll-up reverses the same curve for automatic fade-in. All `useAnimatedStyle` closures read
 only shared values (`clamp`, `collapseCap`, derived `clampProgress`) + primitives, which keeps
 reanimated stable on Fabric. The rail height is captured in `HEADER_RAIL_H`.

The rail itself is a **plain horizontal `ScrollView`** (not a FlashList) — this region animates
 every frame, and the FlashList virtualization machinery (measure/recycle/commit) would otherwise
 re-rasterize inside the sliding overlay. The data is tiny and static (paged slices of a fixed
 array), so a `ScrollView` with a right-edge `loadMore` scroll handler is sufficient; the same
 pattern lives in `features/home/cards/FilterChipsRail.tsx`.

Visually, the header blends into the `#f1f5f9` content below: the **gradient is fully opaque**
 (`HubGradient` — all stops `stopOpacity: 1`; no 15% bleed-through that would ghost scrolling
 content under the overlay), has a square bottom edge (no rounded corners) and no drop shadow, the
 rail renders as plain inline black text chips (no pill background/border), and a soft band
 feathers from the vertical middle of the search bar into the `#f1f5f9` background, completing
 just below the search bar (`HEADER_BOTTOM_PAD` under it) — everything below reads as slate
 padding that merges with the list background, so the collapsed header shows only the search
 bar + padding rather than a tall blue slab. The search bar is **de-elevated**: no `shadow*`/`elevation`, replaced with a
 `borderWidth: 1` + `borderColor: rgba(0,0,0,0.05)` — elevation inside a clipped, transformed,
 opacity-animated overlay is a documented Android artifact source (RN issues #32078 / #25093 /
 #23090), so it must not coexist with the fades.

**Top-inset convention:** one canonical source of truth — `useSafeAreaInsets().top`. The Home
header and every sub-app header (`SubAppHeader` via `subAppHeaderH(topInset, compact, withRail?)`) read the
same measured inset; never use `StatusBar.currentHeight` (a static module constant that is `0`
on iOS and stale on Android edge-to-edge). The optional `withRail` adds the pinned rail slot
(`SUB_HEADER_RAIL_H`, mirroring the Home `HEADER_RAIL_H`) — passed for the Mart sub-app header.

**Sub-app header (Mart / Pharma):** `components/shared/SubAppHeader.tsx` renders a compact header
for Mart & Pharma — back button + a **white live searchbar** (no address pill anymore) that filters
the in-place feed via `searchQuery`. When `hideBrandRow` is set the brand row is dropped. Mart's
header additionally pins the shared `HeaderCategoryRail` below the searchbar (via `belowSearchSlot`),
so the category rail stays visible while the feed scrolls beneath it — the same pattern as the Home
hub header. The wrapper (`components/SubAppWrapper.tsx`) passes `compactHeader` (renamed from the old
`hasAddressBar`) to toggle the compact layout and supplies the rail for `FA_MART`.

**Home feed performance:** the home feed (`HomeView`) runs on an **`Animated.FlatList`**
(reanimated-wrapped `FlatList`; migrating to `@shopify/flash-list` v2 is tracked in
`PENDING_WORK.md`) and never mirrors scroll position into JS state: `scrollY`/`viewportH` are
Reanimated `SharedValue`s, so `renderItem` is a stable identity and mounted cards do not
re-render while scrolling.
`FilterFeedSection` (the Discover grid) auto-loads its next batch via an **edge-triggered
UI-thread worklet** (`useDerivedValue` + `runOnJS`) that fires once when the user crosses ~60% of
the visible grid, and **prefetches** the next batch's image URLs (`Image.prefetch`, `expo-image`)
so cards decode ahead of the fold. The header collapse is **1:1** with the finger
(`DAMPING = 1.0`). Flat-list tuning uses `initialNumToRender=2`, `maxToRenderPerBatch=6`,
`windowSize=5`, `updateCellsBatchingPeriod=50`, `scrollEventThrottle=16`; no `removeClippedSubviews`
(redundant with virtualization, a known blank/flicker source on Fabric). Network images use
`expo-image` (`contentFit="cover"`, `cachePolicy="memory-disk"`, `transition`) via the shared
`ProductCardBase` — never plain RN `Image` (no cache control / raw pop-in). A **repository seam**
(`src/services/homeFeed.ts`:
`getHomeSections` / `getFilterFeedPage(chip, page)` / `getFilterChips`) exposes promise-based,
paginated reads from `@data/*` — the contract the future Go Chi gateway will fulfil. Startup
 defers non-initial routes with `React.lazy` (kept eager: `Onboarding`, `Login`, `MainTabs`/`Home`)
 and loads only the used Roboto weights (`400`–`900`), gated to Android (iOS uses `System`).

#### Startup resilience & crash visibility (`App.tsx`)

- **Global error handler** — `ErrorUtils.setGlobalHandler` is installed at module scope so
  synchronous JS/render errors are not silently swallowed in release builds (where `babel` strips
  all `console.*`). Logs via `[Faazio:global-error]` in dev; production telemetry is a backlog item.
- **Splash failsafe** — `SplashScreen.hideAsync()` is force-called after `SPLASH_TIMEOUT_MS` (10 s)
  even if fonts/hydration stall, preventing a stuck native splash that would trigger an ANR.
- **Branded splash minimum** — the cold-start splash (`SplashFallback` `royal` variant) shows the
  wide `logo.png` centered on Faazio blue (`#4250FF`) with no spinner, and stays up for at least
  `SPLASH_MIN_DISPLAY_MS` (5 s) via `App.tsx` before the app UI renders.
- **Hydration timeout** — `hydrateAuth()` / `hydrateLanguage()` run under a 4 s `withTimeout`
  guard; a hanging or failing storage module no longer blocks startup (defaults to unauthenticated)
  and can't become a silent unhandled rejection.


### State (`src/state/`)

| Store | Purpose |
|---|---|
| `authStore` | Session, login payload, auth state |
| `cartStore` | Cart items, quantity, totals; `addToCart` accepts optional `{ fulfilment }` for FOOD items |
| `favoriteStore` | Favourites (ids) |
| `bookingStore` | Dinner bookings |
| `foodBookingStore` | Food bookings |
| `pharmaStore` | Prescriptions |
| `bloodDonorStore` | Blood Donor wizard draft + committed registration + posted "Ask Blood" requests (`askRequests`) |
| `searchStore` | Search state/history |
| `languageStore` | Selected language |
| `uiStore` | Sub-app id (`FA_MART`/`FOOD`/`PHARMA`), tab name |
| `foodFilterStore` | Food sub-app Veg / Non-Veg diet filter (`all`/`veg`/`nonveg`), session-scoped |
| `rewardsStore` | FaazioCoins balance, order streak, discount card + activity ledger (persisted AsyncStorage `faazio/rewards/v1`, reset on logout) |
| `ordersStore` | In-session placed orders (`PlacedOrder`: items or prescription kind) merged above `@data` fixtures in My Orders; `recordOrder` / `getOrderById` |

### Services (`src/services/`)

- `api/GatewayClient.ts` — intended single data surface; **not yet wired** (see data doc).
- `secureSession.ts` — tokens via `expo-secure-store` (never AsyncStorage for secrets).
- `logout.ts` — clears auth + cart + favourites + search + pharma + blood donor + rewards stores.
- `categoryVendors.ts` — repository seam for the category drill-in: `getVendorsForApp(app, q)`
  (per-token match over the search configs' `searchableText`, grouped per `storeId`, sorted by
  match count then rating), `getVendorProducts(storeId, app)`, `matchesQuery`, `productSearchableText`.
- `homeFeed.ts` — repository seam: `getHomeSections` / `getFilterFeedPage(chip, page)` /
  `getFilterChips` (promise-based, paginated reads from `@data/*`; future Go gateway contract).

## Navigation graph

```
AppNavigator (root native stack)
├── Onboarding ── Login ── LanguageSelection ── Location
├── MainTabs (bottom tabs)
│   ├── Home · Favourites · You   (+ central Cart pill)
├── SubApp (generic sub-app wrapper; optional `initialVendorStoreId` opens the Mart vendor drill-in)
│   (Mart tabs: Home · Search · You · Cart — "You" pushes the account page)
├── FoodApp (FoodStack — FoodHome dining-first → Search → RestaurantProfile → RestaurantOffers; 2-tab bottom nav Home/Search + You/Cart)
├── ProductDetail · Search · Cart · PaymentOptions
├── CategoryDrillIn (category drill-in page from the Home/Mart rail) ── VendorDetails (single-store search)
├── DealsLanding (deals page — `campaign` mode from the Home "Deals of the day" carousel, `discounts` mode from the Mart vendor profile "View All")
├── You · UserDetails · SavedAddresses · MyOrders · Favourites · OrderDetails · FaazioRewards · SellWithUs
├── BloodDonor (Pharma blood-donor wizard/dashboard)
├── BloodRequestDescription (donor request details + nearby requests)
├── PrescriptionFlow (full-bleed pharma prescription capture → note → vendor → confirmed)
```

Entry is `Onboarding` (or `MainTabs` when authenticated) — decided in `AppNavigator.tsx`
from `useAuthStore.isAuthenticated`.

## Account navigation groups

The "You" page (`features/profile/AccountView.tsx`) renders its nav list from the
`@data/account/accountNav.ts` fixture (`accountNavGroups`), which is grouped and titled
via `AccountNavGroup.title`. Six groups render in order: `profile` (Profile settings),
`payments` (Payments and credits), `privacy` (Privacy and security), `earn` (Earn with us),
`legal` (Terms and policies), and `support` (Help & Support). The `privacy` and `legal`
groups are `comingSoon` — they render a single non-tappable "Coming soon" row in place of
real nav rows. The `earn` group is active and carries a `sell-with-us` row ("Sell with us")
that pushes the `SellWithUs` screen. Orders / Details / Addresses / Favourites / Sell-with-us
navigate today; Favourites opens the search-results-style `Favourites` root route (see below).
The `payments` group now holds only the `payments` row ("Payments") — the old
`coupons` "Coupons & Offers" stub row was removed. The remaining rows (Recently Viewed,
Customer Support, Payments) are placeholders (TODO stub in `AccountView.handleRowPress`).
A FaazioCoins streak card (title + balance + a row of 7 flame icons, filled per
`streakCount`) sits above the nav groups and pushes the `FaazioRewards` screen.

## Favourites page (from My Account)

`FavouritesScreen` (root route `Favourites`) wraps the presentational `FavouritesPageView`,
a search-results-style page reached from the "Favourites" row in My Account. It mirrors the
search shell: a static header (back chevron + "Favourites (N)" title pill), a
`SegmentedToggle` (All / Mart / Food / Pharma), a sort-only `FilterChipsRail`, and a
`FlatList` of favourite items resolved via `getCatalogEntriesByIds(useFavoriteStore.favorites)`
rendered with the shared `SearchProductRowCard` (each heart toggles the favourite off/on
live). Tapping an item pushes `ProductDetail`. The store reads `seedFavorites`
(`@data/home/seeds.ts`) on first launch.

## Sell with us (mock partner onboarding)

`SellWithUsScreen` (route `SellWithUs`) is a mock partner-onboarding page reached from the
Account `earn` group. It lists the required seller details (`business name`, `owner`,
`category`, `GSTIN`, `business address`, `bank account`, `IFSC`, `contact phone`) from the
`@data/seller/sellerSetup.ts` fixture (`SELLER_SETUP_FIELDS`) and shows a read-only mock
"Submit for review" action. No data is sent — the real seller onboarding moves server-side
with the Go Chi backend (see `PENDING_WORK.md`).

## FaazioRewards (coins + streak)

The `rewards` module (`src/features/rewards/`) implements a lightweight FaazioCoins
loyalty loop that is entirely device-local (no backend yet — see `PENDING_WORK.md`):

- **Earn:** `rewardsStore.recordOrder(paidTotal, coinsRedeemed, orderId)` runs on order
  placement in `CartView.handlePlaceOrder`. Coins are earned at `COIN_EARN_RATE` (₹1000/coin)
  on the **paid** amount (post coupon + coin redemption), so users can't farm coins by paying
  with coins. Pure math lives in `features/rewards/rewardsLogic.ts` (`evaluateStreak`,
  `coinsEarnedFor`, `computeRedeemableRupees`, `isCardActive`, …) — unit-testable with no store.
- **Streak:** calendar-date based (`lastOrderDay` vs today, local). Same-day orders count once;
  a missed day hard-resets to 1. At `STREAK_TARGET_DAYS` (7) a `DISCOUNT_CARD_PERCENT` (10%)
  card is granted (`grantedAt` + `expiresAt` 5 days out) and the streak resets to 0.
- **Redeem:** the payment step shows an opt-in `CoinsRedeemRow` (only when balance ≥
  `COIN_REDEEM_MIN`) that redeems whole rupees of coins and lowers the pay total.
- **Streak card in cart:** an active card is listed first in the Bag coupon sheet as
  "Faazio Streak — 10% OFF" and reuses the existing `appliedDiscount` machinery (opt-in).
- **Card expiry:** `expireStaleCard()` is invoked at hydration and read time; no timers.
- **Visibility:** the Account page (`AccountView`) shows a FaazioCoins streak card (title +
  balance + 7 flame icons filled per `streakCount`); `FaazioRewardsScreen` (route
  `FaazioRewards`) shows the balance card, 7-dot streak strip, active discount card, and the
  activity ledger.
- **Persistence:** hand-rolled AsyncStorage (`faazio/rewards/v1`, `bloodDonorStore` pattern),
  `reset()` wired into `logout.ts`. All rules come from `@data/rewards/rewards.ts`
  (enterprise-controlled constants — see `data/DATA_CONTROL.md`).
- **Mock seed:** on a fresh install the store starts at `coinBalance = 245` /
  `streakCount = 5` (demo values) until real orders override them; `reset()` on logout zeroes
  the balance and streak.

## Food diet filter

The Food sub-app exposes a Zomato-style **All / Veg / Non-Veg** toggle (`DietToggle` in the
Food home + Search headers) backed by the session-scoped `foodFilterStore`. One store
drives every Food screen + food search at once. Venues are classified by `dietType`
(`veg`/`nonveg`/`both`); dishes by `isVeg?`. Pure-veg venues drop in Non-Veg mode and
pure-non-veg venues drop in Veg mode; `both` venues stay in both. Unclassifiable dishes
(`isVeg` undefined) are hidden while a filter is active. Match semantics live in
`features/food/utils/dietFilter.ts` (`venueMatches` / `dishMatches`).

The filter is threaded explicitly rather than read from the store inside a predicate:
each Food screen subscribes to `foodFilterStore` and passes the value into its pure
helpers (`venueMatches` / `dishMatches`). Food search follows the same pattern —
`FoodSearchScreen` reads `dietFilter` and passes it into `createFoodSearchConfig`, which
captures it in the (pure) dish predicate, so the config stays deterministic and rebuilds
when the filter changes.

## Food fulfilment sheet

Every first-add of a dish in the Food sub-app is gated by `FoodAddModeSheet`
(`features/food/components/FoodAddModeSheet.tsx`, built on the shared `SlideUpSheet`).
Step 1 asks **Dining / Food order**; "Dining" confirms immediately, "Food order" advances
to step 2 (**Delivery / Self pickup**) with a back affordance. The chosen mode is
**persisted** on the cart item (`CartItem.fulfilment` — `'dining' | 'delivery' | 'pickup'`)
via the `addToCart(…, { fulfilment })` option, and rendered as a small per-row label in the
cart for FOOD rows only (`Dining` / `Food order · Delivery` / `Food order · Self pickup`;
items without a stored mode fall back to `Food order · Delivery`). Re-adding an existing
item never overwrites its stored mode. Wired into the dishes-only search results, the
restaurant offers page, the restaurant profile menu "Add", and the FOOD product-detail
footer + related-dish grid adds. Qty stepper (+/−) stays direct everywhere. Food home
promo/Top-of-Week add buttons remain direct (unchanged, defaulting to Delivery).

The **RestaurantProfile "Recommended & Offers" rail** (`features/food/screens/RestaurantProfileScreen.tsx`)
renders its deal-card dish images with the shared **'AD' pill** (`AdLabelBadge`, bottom-right of
each image) to disclose the promoted placement — matching Home and the Mart vendor drill-in.
The "View All" page (`RestaurantOffersScreen`) is intentionally left unlabelled (scope note).

## Cart (BAG) item selection

The cart BAG step (`features/cart/CartView.tsx`) lets the user tick/untick items per row
before paying. Selection is screen-scoped checkout UI, held in `CartView` local state as a
**deselection set** (`deselectedIds`) so new items are ticked by default with no sync
effects. A shared `Checkbox` primitive (`components/shared/Checkbox.tsx`) renders the
22px rounded square (grey border → green `#118C4F` with white check) used by both item
rows and category-group headers. Each category header (Mart/Food/Pharma) shows a
tri-state **group checkbox** (all-ticked / partial `indeterminate` / none) that checks or
unchecks the whole category; unticked categories stay visible but dimmed so items can be
re-ticked.

Every downstream money number is driven by the **selected subset** only — `computeTotals`
(To Pay), savings/`originalTotal`, coins estimate, `pickupPointList`, and the payment-step
item count. Placing an order (`handlePlaceOrder`) snapshots only the selected items onto
the receipt, and **keeps unticked items in the cart** (only the selected items are paid for
and wiped). When zero items are ticked the Proceed button is disabled. The 3 category cards
are now **full-bleed** (edge-to-edge, no side gutters/borders) with a larger 64px item
thumbnail; the savings/coupon card keeps its 16px inset.

## Cart checkout — fulfilment + pickup on the BAG step

The order-level **Food Delivery ⇄ Self Pickup** switch lives on the cart **BAG** step
(`features/cart/CartView.tsx`), not the address page. `fulfillment` (`'DELIVERY' |
'PICKUP'`) remains a single `CartView`-scoped state driving `computeTotals` (pickup waives
the ₹49 fee), `PaymentOptionsScreen`, and the receipt timeline.

- **BAG:** a "How do you want your order?" card renders the segmented toggle. In **Delivery**
  mode it shows a compact "Deliver to {label}" row that opens the **ADDRESS** step to pick a
  saved/custom address. In **Self Pickup** mode it renders the pickup-point radio cards (one
  per distinct store, store-backed via `getPickupPointsForItems`) + the "Pickup contact" row
  directly on the page, so pickup needs no address detour.
- **ADDRESS step** is now **delivery-only** (`Select Delivery Address`); the toggle and
  pickup branch were removed from it.
- **BAG bottom bar:** Delivery shows the tappable `addrRow` → ADDRESS; Pickup shows a static
  (non-navigating) "Pickup from …" summary since the picker is on this page. **Proceed to
  Pay** goes straight to **PAYMENT** for pickup, **ADDRESS** for delivery. Payment's back
  button returns to BAG in both modes.

The **My Orders → Order Details** page renders a "Pickup From" card (store name, address,
`Open {hours}`, pickup contact) when an order is `fulfillment: 'PICKUP'` with `pickup` data.
The FOOD product-detail store section (`CommonProductDetailView`) now exposes a tappable
restaurant row + a "View Restaurant" button (`onViewRestaurant`) that deep-links into the
nested `FoodApp → RestaurantProfile` via `getDiningRestaurantForProduct`
(`features/food/utils/restaurantForProduct.ts`).

## Order receipt — unified tracking

The receipt (`CartView`) shows a **single unified Real-Time Tracking Status** box for every
order: a pulsing "Order has been placed" row (no ETA badge, no two-step variants). For
PICKUP it additionally renders a "Pickup from: {store}, {address}" line. `handlePlaceOrder`
now also writes to `ordersStore.recordOrder` (items kind) so the order is real in My Orders.
A primary **Track My Order** button (optional `onTrackOrder` prop, wired in `CartScreen` to
`navigation.navigate('MyOrders', { highlightOrderId })`) sits in the receipt actions.
"Items Purchased" rows no longer show an icon: the name is ¾-width ellipsized
(`maxWidth: '75%'`) with a grey "x {qty}" and right-aligned price.

## Prescription flow (pharma)

`PrescriptionFlowScreen` (root route `PrescriptionFlow`, full-bleed — the camera can't live
in the sub-app wrapper) runs a step machine `CAPTURE → NOTE → VENDORS → CONFIRMED`:
- **CAPTURE** (`PrescriptionCameraStep`) — full-screen `CameraView` with a consent dialog
  (`requestCameraPermissionsAsync`) before mount, shutter, flash toggle, thumbnail strip with
  per-photo delete, "n/10" counter, `Confirm (n)` enabled at ≥1 and hard-capped at 10 pages.
- **NOTE** (`PrescriptionNoteStep`) — thumbnail recap + optional multiline pharmacist note.
- **VENDORS** (`PharmaVendorList` + `PharmaVendorCard`) — mirrors Mart's local-vendor rail but
  the CTA is an "Order" pill; search filters name/categories/desc/offerTag. Built pharma-local
  (cannot import `features/ecommerce`).
- **CONFIRMED** (`PrescriptionOrderConfirmedView`) — check + "Order Confirmed!" + order ID +
  the unified tracking box (pickup line for PICKUP) + prescription-details card (vendor, mode,
  pages, note) instead of an items list + **Track My Order** / Done. Nothing touches `cartStore`.
- Fulfilment choice (`PharmaFulfilmentSheet` on `SlideUpSheet`, Delivery/Self-Pickup rows,
  subtitle = vendor name) gates the direct order — not persisted to the cart. Placing the
  order calls `ordersStore.recordOrder` (prescription kind) and shows in My Orders with a
  📄 "Prescription order" card ("N pages • {vendor}", Delivery/Self-Pickup chip, Processing).

## My Orders — merged list + prescription cards

`MyOrdersScreen` merges `ordersStore.orders` (newest first) above the `@data myOrders`
fixtures; the sub-app rail counts recompute from the merged list. Prescription placed orders
render a distinct 📄 card, and a `highlightOrderId` route param auto-selects that order's
sub-app in the rail and rings its card.

## Boundary enforcement

- **Home is the sanctioned cross-sub-app consumer** — only Home may import another sub-app's
  `cards/*` or `@data/<other>/*`.
- Sub-app screens may import only their own domain + shared primitives/theme/state.
- Enforced by `dependency-cruiser` via `npm run check:boundaries` (config:
  `.dependency-cruiser.cjs`). A violation fails the check.

## Build & patch system

- `patch-package` (`postinstall`) applies the `@shopify/react-native-skia` patch — mandatory.
- `react-native-svg-transformer` + `sharp` for asset optimization.
- `babel-plugin-transform-remove-console` trims logs in production builds.

## Honest limitations

- **All data is mock** — served from `@data/*`, not a backend (see `data-layer-sdui.md`).
- **`GatewayClient` is unwired** — screens still read legacy `@data/*` fixtures.
- **Duplicated mock data** in a few screens (`PharmaScreen`, `FoodScreen` booking dishes,
  `ProductDetailView`) — canonical copies exist under `@data/` marked `@unused`; de-dup is
  a tracked priority (see `data/DATA_CONTROL.md` "Known Gaps").
- `ts:check` currently requires `--ignoreDeprecations 6.0` due to a pre-existing `baseUrl`
  deprecation in `tsconfig.json` (unrelated to feature work).

## Verification workflow

```bash
cd client/mobile
npm run ts:check            # typecheck
npm run check:boundaries    # dependency-cruiser
adb devices && npm run android
```
