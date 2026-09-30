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
│   └── shared/                 # 15 reusable primitives (ProductCardBase, StoreCardBase, Screen, AdBannerCarousel, …)
├── features/                   # vertical feature modules (15)
├── navigation/                 # AppNavigator, MainTabs, FoodStack, types
├── services/                   # GatewayClient, logout, secureSession, categoryVendors, homeFeed
├── state/                      # Zustand stores (12)
├── theme/                      # brandTokens, spacing (SPACE tokens), fonts, sectorVisuals
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
(`StoreProfile[]`) instead of the retired `MART_LOCAL_VENDORS` mock, with an empty state. The
in-section **search bar** and **category pill filter** (`VendorCategoryPills`) were removed (the
Mart header search + header category rail are untouched); the section shows the full vendor list.
Tapping a store opens the
vendor drill-in, whose inventory is derived from `martProducts` by `storeId` (replacing the old
hardcoded `lv-*` product map). The vendor drill-in's **"Discounted Products" rail** renders each
promoted product with the shared **'AD' pill** (`showAdLabel` on `MartProductCard` → `AdLabelBadge`
bottom-right of the image), matching Home's disclosure for promoted rails; the plain **"All
Products"** grid below stays unlabelled (the vendor's own catalog, not promoted placement).

Pharma's home feed ends with a pharma-local **"Local Medicals Near You"** rail backed by
`@data/pharma/stores`. Each stacked card shows distance, rating, delivery time, offer and a
**Visit Store** CTA that opens `MedicalShopDetails`; the rail has an empty state and intentionally
does not render a "View all" action. `MedicalShopDetails` keeps the pharmacy boundary local while
using `getVendorProducts`/`matchesQuery` and `SearchPharmaProductCard` for its live product list.
Its shop info block includes the cover, contact details, hours and pickup address, and its
`UploadPrescriptionFAB` opens `PrescriptionFlow` with the pharmacy preselected.

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
`UniversalFeedCard` (`variant="rail"`, `hs(116)` wide, **square 1:1** image with **rounded
corners**) — the same styling as the "Daily Essentials" (Deals of the day) rail. Rating, price,
badges and the add-to-cart control are hidden (`showRating`/`showPrice`/`showBadge`/`showAddButton`
off); taps open the shared `CommonProductDetailView`. Each rail samples up to `CARDS_PER_RAIL`
(10) items.

**Food "Today's Special Near You"** (`features/food/components/SpecialDishCard.tsx`, consumed only
by `FeaturedDishCarousel` ← `FoodHomeScreen`): a thin adapter over the Food sub-app's
`FoodProductCard` (→ shared `ProductCardBase`) passing the Home rail's exact props (`variant="rail"`,
`hs(116)` wide, `aspectRatio: 1` rounded image, name-only body with rating/price/badge/heart/add
hidden) — so the Food card is pixel-identical to the Home "Today's Special" card and the two can't
drift. Food renders a single rail of all diet-filtered specials (Home stacks two).

The **shared `AdBannerCarousel`** (`components/shared/AdBannerCarousel.tsx`) is the extracted Home
top-ad banner — a **16:9 full-width rounded card** (`expo-image` bg + overlay + badge + title/tagline)
that auto-advances every 4.5s with paging dots, manually swipeable, timer cleared on unmount and
re-anchored on `width` (skipped when there are fewer than 2 slides). It is presentation-only:
spacing comes from the caller via `style`, taps via an optional `onSlidePress` (no handler → the tap
is a no-op), and an optional `showAdLabel` overlays the shared "AD" pill for genuinely paid
placements. Home's `AdBannerSection` is now a thin wrapper over it (passing `topAdSlides`, the
AppBrand → SubAppId press mapping and the hub's margins); Food renders the same carousel in the
restaurant profile's gray hero band. The Mart hero (`MartHeroCarousel`) and Pharma hero
(`PharmaHeroBanner`) are also **16:9** now (single source of ratio for the one-card-per-row
banners); they stay unlabelled as organic hero banners.

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
(`onOpenProduct`); grid + footer adds for FOOD are **direct** (the fulfilment gate was
removed — the mode is chosen later on the cart BAG step). The old "Free Delivery / COD /
10-Day Return / Assured" trust block was removed from the shared view (applies to MART/PHARMA
too — one component).

`dinner-booking` is a scaffold (README) — not yet shipped as a full flow.

Pharma hosts the **Blood Donor** feature (`pharma/blood-donor/`) — a 5-step registration
wizard (persistent draft/registration via AsyncStorage; the wizard closes permanently on
submit) + a registered-donor dashboard (`DonorDashboard` — targeted "Requests for You"
section plus the hospital request feed with filter chips + search; rendered inside the
Pharma wrapper with the navbar kept and the gradient header hidden), entered via the
`Droplet` tab in the Pharma navbar. Both the wizard and dashboard host a floating
**"Ask Blood"** action (`AskBloodSheet` on the shared `SlideUpSheet`) that collects only
city and blood group, then resolves matching donors through the async
`services/donorDirectory.ts` repository seam. Selecting a donor opens `BloodDonorDetails`,
where the user can send one targeted `DonorMatchRequest`; the request is persisted in the
same blob and rendered only for the selected donor by `donorUserId`. It is never inserted
into the common hospital feed or broadcast to all donors. The donor registry and targeted
request delivery remain mock/local until Go Chi owns them.

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
first tab) and flattens `subgroups → items` into a **flat, unbounded pill rail** of every
sub-category title (`CategoryTitleRail` — first auto-selected; inactive chips transparent with dark
text, the active one filled with the **Faazio-blue** page accent; no grouping). The page is a brand
surface, so it uses `#1162D3` rather than the per-app `MART_ACCENT`/`PHARMA_ACCENT`. For the selected
title it renders a **store-grouped body**: a **single 16:9 carousel of the title's top-ranked store
ads** (AD-labelled, tap → that store's page), then one `StoreProductSection` per matching store — a
**store-name heading** (tap → vendor page; rating · distance, no chevron) over a **continuous
vertical list of one-per-row `ProductRowCard`s** (96px square image left; name/desc/price + discount
and the add/stepper on the right; cart wired via `useCartProductActions`, card tap → `ProductDetail`).
Only this one ad carousel is shown per page (per-store ads were removed). Ads are derived from the
real store rows (`coverImage` + `offerTag`/`desc`) via the seam, so no separate ad fixtures exist. An
**inline searchbar** (this page only) live-filters the store list by name/locality; a title with no
matching stores shows a subtle "No vendors yet" row. Selecting a different rail chip resets the
search query **and** snaps the body back to the top. Every one of the 112 `MASTER_CATEGORIES` titles
is seeded to resolve ≥1 vendor (guarded by `npm run check:drillin`), so the page never opens empty.
Vendors/products are grouped by `storeId` via the repository seam `services/categoryVendors.ts`
(`getVendorsForApp` + `getVendorsWithProducts` — per-token match over the same `searchableText` as
the search configs, grouped per store, sorted by match count then rating; `getVendorProducts`;
`getAdsForQuery` builds the top-store ad slides). Tapping a store pushes `VendorDetailScreen` (route
`VendorDetails`, params `storeId`/`app`/`initialQuery`) — a back arrow with an **inline searchbar to
its right** (auto-focused, title query pre-applied), a compact profile block, and a one-per-row
product list reusing `SearchMartProductCard`/`SearchPharmaProductCard` (per-app), plus a
results-count line and a "No matches" empty state.

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

**Bottom-inset convention:** reserved **once, centrally** by `App.tsx`'s `AppLayout`, which pads the
whole app with `useBottomInset()` (`src/utils/responsive.ts`, i.e.
`Math.max(useSafeAreaInsets().bottom, vs(8))`). It exists because the app is edge-to-edge at the
native level (`android:navigationBarColor` is transparent), so the window draws behind the system
gesture pill / 3-button bar (`insets.bottom` ≈24 dp gesture, ≈48 dp 3-button, ≈34 dp iOS home
indicator) and every bottom edge must stay clear. Reserving it at the root keeps the top full-bleed
(per-screen `insets.top` still applies) while bottom navbars, sticky footers/pills and scroll
`contentContainerStyle`s use their **base** heights with no inset math — e.g.
`features/food/components/FoodBottomNav`, `navigation/MainTabs` (`HubTabBar`),
`components/SubAppWrapper`, the `ViewCartPill`, and the pharma prescription/donor screens. Modals
render in separate native windows, so those keep their own insets.

**Sub-app header (Mart / Pharma):** `components/shared/SubAppHeader.tsx` renders a compact header
for Mart & Pharma — back button + a **white live searchbar** (no address pill anymore) that filters
the in-place feed via `searchQuery`. When `hideBrandRow` is set the brand row is dropped. Mart's
header additionally pins the shared `HeaderCategoryRail` below the searchbar (via `belowSearchSlot`),
so the category rail stays visible while the feed scrolls beneath it — the same pattern as the Home
hub header. The wrapper (`components/SubAppWrapper.tsx`) passes `compactHeader` (renamed from the old
`hasAddressBar`) to toggle the compact layout and supplies the rail for `FA_MART`.

Every visible bottom navbar also exposes the shared `components/shared/NavbarHomeShortcut`: a
Faazio-blue circular Home button centered over the first tab, with three quarters of the circle
above the bar. It appears on Favourites/You in `MainTabs`, on Mart/Pharma wrapper tabs, and on both
Food tabs; it is hidden on the main Home tab and when Mart's vendor drill-in hides its chrome.
`barHeight` is the bar's own measured height (its base height, since the bottom inset is reserved
centrally — see "Bottom-inset convention" above).

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
- **Error boundaries & recovery** — `components/ErrorBoundary.tsx` shows a recoverable card that
  always renders the thrown `message` (plus the first stack frame in dev) — release builds strip
  `console.*`, so this is the only in-app signal. The root boundary in `AppNavigator` (`scope="App"`)
  wraps the whole navigator and offers **"Go to Home"**; `SubAppScreen` adds a **scoped**
  `scope="SubApp"` boundary so a Mart/Pharma render failure degrades inside the sub-app instead of
  blanking the app. Recovery resets navigation via `navigationRef`
  (`src/navigation/navigationRef.ts`, wired as `ref` on `NavigationContainer`).
- **Splash failsafe** — `SplashScreen.hideAsync()` is force-called after `SPLASH_TIMEOUT_MS` (10 s)
  even if fonts/hydration stall, preventing a stuck native splash that would trigger an ANR.
- **Branded splash minimum** — the cold-start splash (`SplashFallback` `royal` variant) shows the
  wide `logo.png` centered on Faazio blue (`#4250FF`) with no spinner, and stays up for at least
  `SPLASH_MIN_DISPLAY_MS` (5 s) via `App.tsx` before the app UI renders.
- **Hydration timeout** — `hydrateAuth()` / `hydrateLanguage()` run under a 4 s `withTimeout`
  guard; a hanging or failing storage module no longer blocks startup (defaults to unauthenticated)
  and can't become a silent unhandled rejection.


### Vertical rhythm (`src/theme/spacing.ts`)

Vertical gaps use a single canonical scale instead of per-screen magic numbers.
`SPACE` (all `vs()`-scaled) owns the four rhythm values:

| Token | Base | Owns |
|---|---|---|
| `SPACE.SECTION` | `vs(14)` | Gap between two major sections — the **one** owner of a section boundary |
| `SPACE.BLOCK` | `vs(8)` | Section header → its own content |
| `SPACE.ITEM` | `vs(6)` | Rows/cards inside a block |
| `SPACE.LIST_BOTTOM` | `vs(24)` | Scroll tail at the bottom of a list |

Ownership rule: a boundary has exactly one owner of its gap. A section header (e.g.
`features/home/sections/common.tsx` `SectionHeader`, or the food/mart/pharma
`*SectionHeader`s) owns its top gap (`SPACE.SECTION`); parents must not also add
`paddingTop`/`marginTop` for the same boundary, and headers do not own a bottom gap
beyond `SPACE.BLOCK`. Skeletons mirror the tightened real layout so loading → loaded
does not jump vertically. The five visually-parallel `SectionHeader` components are
still separate files; consolidating them is tracked in `client/mobile/PENDING_WORK.md`.

### State (`src/state/`)

| Store | Purpose |
|---|---|
| `authStore` | Session, login payload, auth state |
| `cartStore` | Cart items, quantity, totals; `addToCart(id, name, price, emoji, restaurantId?)` — the optional 5th arg tags a line to a restaurant (adopts an untagged line on re-add); `clearRestaurantCart(id)` removes only that restaurant's lines. Fulfilment is chosen order-level on the cart, not per item |
| `favoriteStore` | Favourites (ids) |
| `bookingStore` | Dinner bookings |
| `foodBookingStore` | Food bookings |
| `pharmaStore` | Prescriptions |
| `bloodDonorStore` | Blood Donor wizard draft + committed registration + targeted donor requests (`donorMatchRequests`) |
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
  match count then rating), `getVendorsWithProducts(app, q)` (adds each store's matching product
  rows for the rails), `getVendorProducts(storeId, app)`, `getAdsForQuery(app, q)` /
  `getVendorAds(storeId, app)` (store-derived `VendorAdSlide`s), `matchesQuery`, `productSearchableText`.
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
├── FoodApp (FoodStack — FoodHome dining-first → Search → RestaurantProfile → RestaurantMenu / RestaurantOffers; 2-tab bottom nav Home/Search + You/Cart)
├── ProductDetail · Search · Cart (`{ restaurantId?, restaurantName? }`) · PaymentOptions
├── CategoryDrillIn (category drill-in page from the Home/Mart rail) ── VendorDetails (single-store search)
├── DealsLanding (deals page — `campaign` mode from the Home "Deals of the day" carousel, `discounts` mode from the Mart vendor profile "View All")
├── You · UserDetails · SavedAddresses · MyOrders · Favourites · OrderDetails · FaazioRewards · SellWithUs
├── BloodDonor (Pharma blood-donor wizard/dashboard)
├── BloodDonorDetails (selected matching donor profile + targeted request)
├── BloodRequestDescription (donor request details + nearby requests)
├── MedicalShopDetails (pharma store profile + live store inventory)
├── PrescriptionFlow (full-bleed pharma prescription capture → note → vendor → confirmed;
│   optional `presetVendorId` skips the vendor step and opens fulfilment for that pharmacy)
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
Food home header + Search headers) backed by the session-scoped `foodFilterStore`. One store
drives every Food screen + food search at once. The Food home header (`DiningHeader`) is now a
back chevron with the toggle centered in the row (the old address block — area + "Delivering to
Home" — was removed); the toggle is uncontrolled, so it writes the shared store like the rest of
the home. Venues are classified by `dietType`
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

`DietToggle` is **optionally controlled**: with no props it reads/writes the shared store
(home + Search headers, unchanged), while passing `value` + `onChange` drives a screen-local
override without touching the store. `RestaurantProfileScreen` and `RestaurantMenuScreen` both use
the controlled form: they seed a screen-local `dietFilter` once from
`foodFilterStore.getState()` and never write back, so each restaurant screen's toggle follows home
by default (re-seeded on each open because the screen is popped), overrides only that restaurant's
menu/rail, and leaves home/search untouched. On the profile the toggle sits between the back button
and the search/share actions in the pinned top toolbar; on the full menu it is the toolbar's
trailing node (via `FoodDetailTopBar.right`). The profile's in-menu **"Search in menu"** button and
its toolbar Search icon both push the **`RestaurantMenu`** page (threading the current
`dietFilter`), which owns the real, autofocused full-width search bar — the profile no longer hosts
a live `TextInput` or the old `onLayout` scroll-and-focus jump.

## Food — Restaurant profile vs full menu

`RestaurantProfileScreen` is the restaurant's landing page (ad-banner hero band, info card,
Recommended & Offers rail, category chips, menu preview) and `RestaurantMenuScreen` is the dedicated
full-menu page.

The profile hero is a solid light-gray `#F3F4F6` band (padded clear of the pinned toolbar) holding
the shared `AdBannerCarousel` over `topAdSlides` — the old restaurant `RemoteImage` + dark overlay
was dropped. The carousel has no press handler here, so taps are a no-op inside Food; the pinned
back/search/share toolbar, the `−40` overlapping white board, menu, offers rail and cart pill are
unchanged.

- Both render identical dish rows via the shared `features/food/components/MenuItemRow` (thumb,
  name/description/price, outlined **Add** → **− qty +** stepper) and the same restaurant-scoped
  white `ViewCartPill`. Their menu is built by `features/food/utils/menu.ts`
  (`getMenuForRestaurant` / `getOwnDishes` / `getMenuCategories`), extracted from the profile so the
  profile and the menu page can't drift.
- Both screens' category chips are derived from the **actual menu's dish cuisines**
  (`getMenuCategories`) rather than the venue-level `restaurant.cuisines` labels, so every chip maps
  to at least one dish under the exact-equality `dish.cuisine` filter; the selected chip falls back
  to `Bestsellers` if the active diet filter removes its dishes.
- `RestaurantMenuScreen` shows the restaurant name below the `FoodDetailTopBar` (whose title is now
  just **"Menu"**) and above the full-width search bar, so long names get a full-width two-line
  heading instead of being truncated in the toolbar. It adds the full-width search bar (filters on
  dish name/description), the `Bestsellers` + cuisine category chips and the diet toggle; the chip
  rail sets `keyboardShouldPersistTaps="handled"` so the first chip tap isn't swallowed by the
  autofocused search keyboard. It adds/steppers through the same restaurant-scoped cart slice as the
  profile, so the **View Cart** count stays in sync between both.
- `RestaurantMenu` is typed as `{ restaurant: DiningRestaurant; dietFilter: DietFilter }` in
  `FoodStackParamList`.

## Food add-to-cart — direct adds, fulfilment on the cart

Every add of a dish in the Food sub-app is **direct** — `addToCart(id, name, price, emoji)` with
no popup. The old `FoodAddModeSheet` (Dining / Food order → Delivery / Self pickup) was **deleted**;
fulfilment is no longer captured per item (`CartItem.fulfilment` and the `CartFulfilment` type were
removed). Instead the **order-level** Delivery / Self Pickup choice is made on the cart BAG step.
This applies everywhere: the dishes-only search results, the restaurant offers page, the restaurant
profile menu "Add", and the FOOD product-detail footer + related-dish grid adds. Qty steppers (+/−)
stay direct everywhere. Food home promo/Top-of-Week add buttons were already direct (unchanged).

The **RestaurantProfile "Recommended & Offers" rail** (`features/food/screens/RestaurantProfileScreen.tsx`)
renders its deal-card dish images with the shared **'AD' pill** (`AdLabelBadge`, bottom-right of
each image) to disclose the promoted placement — matching Home and the Mart vendor drill-in.
The "View All" page (`RestaurantOffersScreen`) is intentionally left unlabelled (scope note).

## Restaurant-isolated cart (one cart, scoped by ownership)

There is still **one `cartStore`**; a `CartItem.restaurantId` (optional) tags lines added from a
restaurant page (the profile menu and its offers page, via `SearchDishCard.restaurantId`). Lines
added elsewhere — food search, product detail, Mart/Pharma, seeds — stay **untagged** and belong
to the common cart only. Re-adding an untagged dish from a restaurant page **adopts** it (backfills
`restaurantId`).

- **RestaurantProfile / RestaurantMenu** show only their own lines: the white **View Cart** pill (no
  orange card, no ₹ amount — just icon + "View Cart" + item count + arrow) and the menu **− qty +**
  stepper both derive from `cart.filter(i => i.restaurantId === restaurant.id)`, so other
  restaurants'/common lines never show. Its "View Cart" pushes `Cart` with
  `{ restaurantId, restaurantName }`.
- **Cart (`CartScreen`)** reads those params: scoped mode shows **only** that restaurant's lines,
  with a scoped title, a red **Clear** action (`clearRestaurantCart`) and a per-row **trash**
  delete (`removeFromCart`); the common cart (no params) shows everything with no Clear/trash.
  Writes are **scope-aware** — `setCartItems` replaces only the scoped slice, so checkout/clear
  can never wipe other restaurants'/common items. `CartView` gates the scoped chrome purely on the
  presence of `onClearItems`/`onDeleteItem` (presentational, no cart imports added).

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

## Cart checkout — fulfilment + live-location delivery on the BAG step

The order-level **Delivery ⇄ Self Pickup** toggle lives on the cart **BAG** step
(`features/cart/CartView.tsx`). `fulfillment` (`'DELIVERY' | 'PICKUP'`) is a single
`CartView`-scoped state, starting as `null` — **nothing selected by default**, so the
**Proceed to Pay** button stays disabled until a mode is chosen. It drives `computeTotals`
(pickup waives the ₹49 fee), `PaymentOptionsScreen`, and the receipt timeline.

- **BAG:** a "How do you want your order?" card renders the segmented toggle. In **Delivery**
  mode a live-address row appears below it — resolved via the `useLiveAddress` hook
  (`src/hooks/useLiveAddress.ts`, expo-location: in-UI consent → `getCurrentPositionAsync`
  → `reverseGeocodeAsync`; coordinates/address are never logged). If permission is denied or
  no fix is available it falls back to the saved primary `defaultAddresses[0]` with a
  "using saved address" note so ordering never dead-ends. In **Self Pickup** mode nothing
  extra renders — vendors are derived at order placement (no picker UI).
- **ADDRESS step removed entirely** (`'ADDRESS'` dropped from `CheckoutStep`); there is no
  manual saved-address selection page. Proceed to Pay goes to **PAYMENT** in both modes;
  Payment's back button returns to BAG.
- **Order placement:** for Delivery, the live fix (or fallback) is the delivery address and
  the GPS coordinates are captured on the order (`PlacedOrder.location`). For Self Pickup,
  `getPickupPointsForItems` auto-derives **one pickup point per distinct vendor** and all of
  them are snapshotted as `PlacedOrder.pickups` (with `pickups[0]` also kept in `pickup` for
  the My Orders chip + prescription flow).

The **My Orders → Order Details** page resolves an order via `ordersStore.getOrderById` first
(in-session placed orders), falling back to `@data getMyOrderById` for fixtures — fixing the
placed-order "not found" gap — and renders a **"Pickup From" card per vendor** (name, address,
`Open {hours}`, contact) for `PICKUP` orders. The FOOD product-detail store section
(`CommonProductDetailView`) now exposes a tappable restaurant row + a "View Restaurant" button
(`onViewRestaurant`) that deep-links into the nested `FoodApp → RestaurantProfile` via
`getDiningRestaurantForProduct` (`features/food/utils/restaurantForProduct.ts`).

## Order receipt — unified tracking

The receipt (`CartView`) shows a **single unified Real-Time Tracking Status** box for every
order: a pulsing "Order has been placed" row (no ETA badge, no two-step variants). For
PICKUP it additionally renders a "Pickup from: {store} +N more, {address}" line and a
**"Pickup From" section listing one card per vendor** (name, address, hours, contact).
`handlePlaceOrder` also writes to `ordersStore.recordOrder` (items kind) so the order is real
in My Orders. A primary **Track My Order** button (optional `onTrackOrder` prop, wired in
`CartScreen` to `navigation.navigate('MyOrders', { highlightOrderId })`) sits in the receipt
actions. "Items Purchased" rows no longer show an icon: the name is ¾-width ellipsized
(`maxWidth: '75%'`) with a grey "x {qty}" and right-aligned price.

## Prescription flow (pharma)

`PrescriptionFlowScreen` (root route `PrescriptionFlow`, full-bleed — the camera can't live
in the sub-app wrapper) runs a step machine `CAPTURE → NOTE → VENDORS → CONFIRMED` for the
normal entry:
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
  When opened from `MedicalShopDetails` with `presetVendorId`, the flow stores that pharmacy after
  NOTE, skips `VENDORS`, and shows the same fulfilment sheet in the flow screen; dismissing it
  returns to NOTE.

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

## Size & delivery strategy

The "lightweight, fast, secure" mandate (AGENTS.md) is enforced at build and delivery time:

- **Hermes + New Architecture** (RN 0.86.3) — precompiled bytecode, lower memory, faster cold start.
- **R8 minify + resource shrinking ON for release** — `-Pandroid.enableMinifyInReleaseBuilds=true`
  and `-Pandroid.enableShrinkResourcesInReleaseBuilds=true`; `mapping.txt` kept as a **private**
  artifact for crash retracing, behind a mandatory device smoke test. See `docs/RUNBOOKS/RELEASE.md`.
- **2-ABI build** (`arm64-v8a,armeabi-v7a`, ~95% device coverage) — roughly halves native `.so`
  payload and C++ build work vs the old 4-ABI universal build (APK download ~−50%).
- **Asset + console trimming** — `react-native-svg-transformer` + `sharp` for assets;
  `babel-plugin-transform-remove-console` strips `console.*` from production. Expo GIF/WebP
  decoders stay enabled pending a full `expo-image` coverage audit.
- **Startup deferral** — non-initial routes use `React.lazy`; only the used Roboto weights
  (`400`–`900`) load, gated to Android. **Honest caveat:** Metro still ships **one bundle**, so
  `React.lazy` defers module *evaluation*, not download size (`PENDING_WORK.md`).
- **OTA / differential delivery — not implemented.** There is **no `expo-updates` / EAS Update /
  CodePush** wiring in `package.json`/`app.json`; `React.lazy` is startup deferral, not per-feature
  delivery. The pragmatic RN path is **`expo-updates` (EAS Update)** for JS-bundle OTA
  (whole-bundle, but no store resubmit for JS-only changes); true Flipkart-style per-feature
  delivery is custom infrastructure and **out of scope**. Decision tracked in `PENDING_WORK.md`.
- **Server-driven content reduces how often native layouts must ship** — data/content changes are
  server-side once the gateway exists (`server-gateway-plan.md`), the lever that keeps an RN
  superapp light.

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
# Android build is CI-only (never local Gradle):
gh workflow run android-debug.yml && gh run watch
```
