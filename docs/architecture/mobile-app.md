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
├── services/                   # GatewayClient, logout, secureSession, categoryRail, homeFeed
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
under the Mart chip in Master Categories.

The Mart home feed's **"Local Vendors Near You"** rail now renders the richer `martStores`
(`StoreProfile[]`) instead of the retired `MART_LOCAL_VENDORS` mock, with a **live in-place
search bar** (dining `RestaurantGrid` pattern — filters by name/categories/desc/offerTag) and an
empty state. Tapping a store opens the vendor drill-in, whose inventory is derived from
`martProducts` by `storeId` (replacing the old hardcoded `lv-*` product map).

`dinner-booking` is a scaffold (README) — not yet shipped as a full flow.

Pharma hosts the **Blood Donor** feature (`pharma/blood-donor/`) — a 5-step registration
wizard (persistent draft/registration via AsyncStorage; the wizard closes permanently on
submit) + a registered-donor dashboard (`DonorDashboard` — request feed with filter chips +
search; rendered inside the Pharma wrapper with the navbar kept and the gradient header
hidden), entered via the `Droplet` tab in the Pharma navbar.

`search` hosts the shared `SearchScreen` shell (`features/search/SearchScreen.tsx`) plus
per-sub-app configs (`configs/*`). Product search (Mart / Pharma / Home Hub)
renders **one dense row per result** via the shared `SearchProductRowCard`
(`components/shared/`) — a row layout with a contain image, 1-line title/description, a
`seller + price` line (seller resolved from the `@data/directory/stores` table via
`storeId`, else `shop`, else the app's single outlet, else category) and a compact Add to
Cart / quantity stepper. Food search already used 1-column row cards (`SearchRestaurantCard`
/ `SearchDishCard`). No config uses a 2-column grid anymore.

The Home hub header (`features/home/HomeTabScreen.tsx` + `hubHeader.ts`) is a **fixed-height
 overlay that collapses via transform only**. `headerOuter` is `position:absolute` with a static
 `height = expandedHeaderH(top)` and is never animated; the inner `headerSlid` stack slides up with
 a `translateY` (`headerSlideStyle`), so the header never triggers a per-frame layout pass. The
 list container is full-screen with `contentContainerStyle.paddingTop = expandedHeaderH(top)`, so at
 rest the first section sits flush below the expanded header and, as the header slides up, the
 freed area simply reveals already-laid-out content. It pins a compact **category rail**
 (`HeaderCategoryRail`) below the search bar, fed by `usePagedRail` over
 `@data/categories/railFeed` (derived from the merged Mart category tree). Tapping a chip
 deep-links the Master Categories sidebar to that tab via `initialTabId`. On scroll the header
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
header and every sub-app header (`SubAppHeader` via `subAppHeaderH(topInset, compact)`) read the
same measured inset; never use `StatusBar.currentHeight` (a static module constant that is `0`
on iOS and stale on Android edge-to-edge).

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
- **Splash failsafe** — `SplashScreen.hideAsync()` is force-called after `SPLASH_TIMEOUT_MS` (8 s)
  even if fonts/hydration stall, preventing a stuck native splash that would trigger an ANR.
- **Hydration timeout** — `hydrateAuth()` / `hydrateLanguage()` run under a 4 s `withTimeout`
  guard; a hanging or failing storage module no longer blocks startup (defaults to unauthenticated)
  and can't become a silent unhandled rejection.


### State (`src/state/`)

| Store | Purpose |
|---|---|
| `authStore` | Session, login payload, auth state |
| `cartStore` | Cart items, quantity, totals |
| `favoriteStore` | Favourites (ids) |
| `bookingStore` | Dinner bookings |
| `foodBookingStore` | Food bookings |
| `pharmaStore` | Prescriptions |
| `bloodDonorStore` | Blood Donor wizard draft + committed registration |
| `searchStore` | Search state/history |
| `languageStore` | Selected language |
| `uiStore` | Sub-app id (`FA_MART`/`FOOD`/`PHARMA`), tab name |
| `foodFilterStore` | Food sub-app Veg / Non-Veg diet filter (`all`/`veg`/`nonveg`), session-scoped |
| `rewardsStore` | FaazioCoins balance, order streak, discount card + activity ledger (persisted AsyncStorage `faazio/rewards/v1`, reset on logout) |

### Services (`src/services/`)

- `api/GatewayClient.ts` — intended single data surface; **not yet wired** (see data doc).
- `secureSession.ts` — tokens via `expo-secure-store` (never AsyncStorage for secrets).
- `logout.ts` — clears auth + cart + favourites + search + pharma + blood donor + rewards stores.
- `categoryRail.ts` — builds category cards from `@data/categories/masterCategories`.
- `homeFeed.ts` — repository seam: `getHomeSections` / `getFilterFeedPage(chip, page)` /
  `getFilterChips` (promise-based, paginated reads from `@data/*`; future Go gateway contract).

## Navigation graph

```
AppNavigator (root native stack)
├── Onboarding ── Login ── LanguageSelection ── Location
├── MainTabs (bottom tabs)
│   ├── Home · Categories · Favourites · You   (+ central Cart pill)
├── SubApp (generic sub-app wrapper)
├── FoodApp (FoodStack)
├── ProductDetail · Search · Cart · PaymentOptions
├── MasterCategories
├── You · UserDetails · SavedAddresses · MyOrders · OrderDetails · FaazioRewards · SellWithUs
├── BloodDonor (Pharma blood-donor wizard/dashboard)
├── BloodRequestDescription (donor request details + nearby requests)
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
that pushes the `SellWithUs` screen. Orders / Details / Addresses / Sell-with-us navigate
today; the remaining rows are placeholders (TODO stub in `AccountView.handleRowPress`).
A FaazioCoins streak card (title + balance + a row of 7 flame icons, filled per
`streakCount`) sits above the nav groups and pushes the `FaazioRewards` screen.

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
Food / Dining / Order headers) backed by the session-scoped `foodFilterStore`. One store
drives every Food screen + food search at once. Venues are classified by `dietType`
(`veg`/`nonveg`/`both`); dishes by `isVeg?`. Pure-veg venues drop in Non-Veg mode and
pure-non-veg venues drop in Veg mode; `both` venues stay in both. Unclassifiable dishes
(`isVeg` undefined) and unclassifiable sections (Promo carousel, Explore Cuisines) are
hidden while a filter is active. Match semantics live in
`features/food/utils/dietFilter.ts` (`venueMatches` / `dishMatches`).

The filter is threaded explicitly rather than read from the store inside a predicate:
each Food screen subscribes to `foodFilterStore` and passes the value into its pure
helpers (`venueMatches` / `dishMatches`). Food search follows the same pattern —
`FoodSearchScreen` reads `dietFilter` and passes it into `createFoodSearchConfig`, which
captures it in the (pure) restaurant/dish predicates, so the config stays deterministic
and rebuilds when the filter changes.

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
