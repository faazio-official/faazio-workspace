# Pending Work

Scoped, dated backlog entries for features intentionally deferred until their
dependencies exist. Do not build the backend/seller flows until told to.

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
  (`features/home/HeaderCategoryRail.tsx` + `hooks/usePagedRail.ts` over
  `@data/categories/railFeed`). Tapping a chip deep-links the Master Categories sidebar; the rail
  stays **visible and interactive on collapse** (mirroring the search bar — no fade, no ghost-touch
  guard) since `collapsedVisibleHeaderH` already reserves its space below the search bar. Only the
  logo/sectors block above fades. The rail is a plain horizontal
  `ScrollView` (not a FlashList) since this region animates every frame, chips keyed by
  `item.id` in the map (`HEADER_RAIL_H`).
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

**Future / honest gaps:**
- **Interested/Accepted are local-only** (persisted AsyncStorage) — the actual
  hospital-contact flow, matching and donor-detail sharing are backend future (Go Chi).
  Accept's confirmation dialog states the sharing contract; delivery is not built.
- **Distance (`distanceKm`) is mock seed data** — no real geo between donor and hospital
  yet; the nearby sort is a real sort over the seeded values.
- **Bell press is a no-op** (TODO in `DonorDashboard`) — no notification screen or push
  infra; the badge count is the `BLOOD_DONOR_UNREAD_ALERTS` seed constant.
- **Funnel icon is visual-only** — a filter sheet is not designed yet; ditto presence only.
- **"Nearby" is city-matching, not geo**: request `city` vs the donor's registered
  `preferredLocation` (case-insensitive contains). Real geo swaps the matcher, not the UI.
- **Request feed is a static seed** (`BLOOD_REQUESTS`, 5 fixtures) — the Go Chi backend
  owns the real feed; `BloodRequest` shape documented as the interim contract.
- **Registered UI is a minimal scaffold** — redesign pending (own design pass). Editing
  donor details will return inside that UI, not via wizard re-entry.
- **At-rest security tradeoff (accepted for mock stage):** persisted draft/registration
  includes health data in plain AsyncStorage. Small payload, never logged, cleared on
  logout — but it must move server-side (encrypted at rest) with the Go Chi backend.
- **Server contract (documented, not built):** future donor registry upserts are keyed by
  `registration.accountPhone` → idempotent, one donor row per account. `accountPhone` is
  `null` when the account has no phone on file (no fabrication).
- Notification **delivery** is not built: no `expo-notifications`, no push infra, no
  backend. The step-4 banner copy describes eventual server behavior. Matching + push will
  live in the Go Chi backend (`server/`) once wired.
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
`DietToggle` in the Food / Dining / Order headers. Venues classified by `dietType`
(`veg`/`nonveg`/`both`); dishes by `isVeg?`. Match semantics in
`src/features/food/utils/dietFilter.ts` (`venueMatches` / `dishMatches`). The filter ANDs
with food-search chips (`foodSearchConfig.tsx` now uses the real `dietType` flag instead of
the old `/veg/i` cuisine heuristic). Unclassifiable sections (Promo carousel, Explore
Cuisines) hide while a filter is active.

**Note (found during exploration):** `src/features/food/FoodMenuView.tsx` is **legacy-unused**
— not imported by any screen (the new `FoodHomeScreen`/`OrderDetailScreen`/`DiningScreen`
replace the old `FoodScreen` architecture). It can be removed if a full cleanup is wanted.

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
- **Destination screens not built** for Payments, Coupons & Offers, Favourites, Recently
  Viewed, and Customer Support — these rows keep the TODO stub in
  `AccountView.handleRowPress` and don't navigate yet.
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
with an 8 s failsafe + 4 s hydration timeouts (prevents a stuck splash → ANR). Stale 188 MB
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

**Date:** 2026-09-11
