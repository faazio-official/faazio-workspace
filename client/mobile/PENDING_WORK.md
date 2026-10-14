# Pending Work

Scoped, dated backlog entries for features intentionally deferred until their
dependencies exist. Do not build the backend/seller flows until told to.

---

## Phone-auth OTP — typed full code stuck + broken back (fixed)

**Status:** 🟢 Shipped (code); on-device verification pending.

**Symptom:** entering the 6th OTP digit left the user on the OTP screen — no advance, no error,
no slide — and back erased the typed phone number.

**Root cause:** submit was a one-shot side effect inside the 6th keystroke's `onChangeText`
(no retry, no guard), `login()` was **not awaited** and had no `.catch` (silent rejection),
`otpError` was dead code (only ever set to `''`), there was no Verify button, and the target
`LanguageSelection` route was `React.lazy` behind a navigator-wide `<Suspense>` so the first push
swapped the whole native tree for `SplashFallback` mid-navigation.

**Fix:**
- `submitOtp` derives from `otpCode` via `useEffect` (fires however 6 digits arrive), guarded by
  `submitRef`; it dismisses the keyboard, `await`s `login()`, then `navigation.replace`s
  (guarded by `navigationRef.isReady()`). Failures set `otpError` (shake + toast now reachable)
  and reset the guard for retry.
- Always-present **Verify** CTA (enabled at 6 digits, spinner while awaiting) as the manual fallback.
- Input hardening: clamp to 6 digits instead of dropping over-length values; verified/retried
  focus; guarded phone auto-advance timer + keyboard dismiss.
- Two-step back (keyboard → phone entry, number preserved) wired to chevron + hardware
  `BackHandler`; `replace` removes the consumed OTP screen so back from Choose-language lands on
  Welcome.
- `LanguageSelection` + `Location` are now eager imports (first-run chain); other pushed screens
  stay lazy.

---

## Onboarding — welcome wordmark ships as raster

**Status:** 🟢 Shipped (PNG); design follow-up open.

The onboarding header wordmark (`variant="welcome"`) ships as a 99 KB raster
(`src/assets/logo-welcomepage.png`), extracted from `assets/brand/logo-welcomepage.svg`
because that SVG wraps a base64 PNG (an `<image>` child) rather than vector paths.
Rendering it via react-native-svg's `<Image>` is fragile on the New Architecture, and the
base64 would inline ~132 KB into the eagerly-loaded JS bundle. **Follow-up:** ask design
for a true vector export (no badge, transparent background) to cut ~100 KB from the app.

---

## Vendor ratings & reviews — phase 1 (client-side, derived gate)

**Status:** 🟢 Shipped (phase 1). Server build is deferred (see below).

**Feature:** Verified buyers rate the vendor they bought from, from five entry points
(My Orders card, Order Details, Mart vendor profile, Pharma shop, Food restaurant
profile). The rating form is a root `RateVendor` route.

**Design (locked):**
- **Eligibility = any non-cancelled order** (Delivered / Shipped / Processing); the
  server later tightens to `DELIVERED`. **Derived, never a stored flag**, permanently
  true for a `(user, vendor)` pair once it exists ("old customer keeps the ability").
- Vendor identity resolved once via `resolveVendorForProduct`
  (`data/directory/vendors.ts`) and snapshotted at placement (`PlacedOrder.storeIds`,
  `OrderRow.vendorStoreIds`, `MyOrder.storeId`).
- `hasPurchasedFromVendor` (`data/checkout/orders.ts`) + in-session `ordersStore` merge
  (`services/vendorRatings.ts`) drives all five entry points; the rating screen re-checks.
- One live rating per `(user, vendor)`, latest wins; `orderIds[]` kept as
  verified-purchase provenance; revisiting shows "Update your rating".
- Public display full name only (no id, phone, order id, avatar); nothing rating-related logged.
- Food dining-venue identity table (`data/food/diningVenues.ts`) holds ids/names only —
  full venue-data migration remains a separate task.

**Deferred:** the `DELIVERED`-only tightening; moderation on the public review list. **Now built
(server):** the Go reviews endpoints (`GET /vendors/:id/reviews`, `GET /vendors/:id/reviews/summary`,
`PUT /vendors/:id/rating`) with the server-side derived purchase gate, plus the `GatewayClient`
seam (`getVendorReviews`, `rateVendor`). The screen migration waits on Supabase phone OTP replacing
`authStore.login()`.

---

## Food — Restaurant menu category rail clipped (shared MenuCategoryRail)

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** On `RestaurantMenuScreen` the horizontal category chip rail rendered as a ~12–15px
sliver — every glyph half-cut, pills not positioned properly.

**Root cause:** RN injects `flexGrow: 1, flexShrink: 1` into every ScrollView
(`ScrollView.js` `baseHorizontal`). The menu page stacked the rail and the tall vertical menu list as
plain siblings in one `flex: 1` column with neither overriding those injected styles. A ScrollView
has no measure override (`ScrollViewShadowNode::layout`), so its base size is its content: the list's
basis ≈ thousands of px, the rail's ≈ ~50px. Yoga weights shrink by flex-basis, so the large negative
free space squeezed the ~50px rail by roughly the list's ratio → collapse. A ScrollView clips to its
frame (`overflow: scroll`) and the rail's content container centers its chips, so only a horizontal
band of each glyph survived. `RestaurantProfileScreen` nests the identical rail inside a single
vertical ScrollView (no sibling to compete with) — hence the bug was unique to the full-menu page.

**Changes:**
- New shared `features/food/components/MenuCategoryRail.tsx` (exported from the food components
  index): owns the pill chip metrics (`hs/vs/ms`, `gap`, `alignItems: 'center'`) and the layout
  contract — `flexGrow: 0` / `flexShrink: 0` on the rail box (plain `flex: 0` is insufficient, it
  leaves `flexShrink: 1`).
- `RestaurantMenuScreen.tsx`: consumes `MenuCategoryRail`; the vertical list ScrollView now owns
  `style={styles.list}` (`flex: 1`), so exactly one child takes the leftover space. Kept
  `keyboardShouldPersistTaps="handled"` (now in the shared rail) so the first chip tap is still not
  swallowed by the autofocused search keyboard.
- `RestaurantProfileScreen.tsx`: consumes the same rail (passing `marginBottom` via `style`),
  removing the duplicated inline chip styles. `flexGrow/flexShrink: 0` is a no-op for a child of a
  ScrollView content container.
- Natural rail height (padding + chip) rather than a fixed `height` — stays correct at larger system
  font scale and with long category names.

**Verification:** `npm run ts:check` and `npm run check:boundaries` pass (278 modules, no
violations). On-device pass pending: pills render fully and flush under the search box, rail scrolls
clean, first chip tap registers with the keyboard open, diet toggle shrink/grow does not clip, list
scrolls independently, and `RestaurantProfileScreen` chips look unchanged.

**Docs:** `docs/architecture/mobile-app.md` (Food — Restaurant profile vs full menu).

**Date:** 2026-09-30

---

## Category drill-in — pill rail + single ad + one-per-row product cards

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** Refined the category drill-in page (`CategoryDrillIn`) to a pill-chip
title rail, a single ad carousel, and a continuous one-per-row product list per
vendor — replacing the text/underline rail, per-store ads and horizontal product rails.

**Changes:**
- **Pill title rail** (`features/catalog/components/CategoryTitleRail.tsx`): chips mirror the
  shared filter-chip metrics (`height: vs(32)`, `paddingHorizontal: hs(14)`, `borderRadius: ms(16)`,
  `gap: hs(8)`). Inactive chips are transparent with dark (`#111827`) text; the active chip is
  filled with the accent and white text. The underline bar was removed.
- **Faazio-blue page accent** (`CategoryDrillInPanel.tsx`): added `FAAZIO_BLUE = '#1162D3'` and
  use it for the rail on this (brand-surface) page only — `MART_ACCENT`/`PHARMA_ACCENT` stay in
  `@data` for the Master Categories / vendor theme. Selecting a chip clears the search query and
  snaps the body `ScrollView` back to the top.
- **Single ad section**: the top title-contextual `AdBannerCarousel` under the rail is now the only
  ad placement; per-store ads were removed.
- **`StoreProductSection`**: store-name heading is a full-width tap target → vendor page (rating ·
  distance kept, **no chevron circle**), followed by a plain vertical list (`gap: hs(10)`,
  `paddingHorizontal: hs(16)`) of the new `ProductRowCard`s.
- **New `ProductRowCard.tsx`** (feature-local, catalog): white bordered card (`borderColor
  #EFEFEF`, `borderRadius ms(12)`, `padding hs(10)`), 96px square `expo-image` on the left, and a
  body with name / one-line desc / price + strike-through + green % off, plus the add / quantity
  stepper on the right — cart wired via `useCartProductActions`, row tap → `ProductDetail`.
- **Dead code**: `getVendorAds` removed from `services/categoryVendors.ts` (no remaining callers);
  `getAdsForQuery` unchanged and still feeds the single ad.

**Decisions:** rating star stays amber (`#F59E0B`); inactive pills transparent + black text, active
filled brand blue; per-row add-to-cart stepper kept.

**Verification:** `npm run ts:check`, `npm run check:boundaries` (277 modules, no violations) and
`npm run check:drillin` (112 titles, 0 unresolved) pass. On-device visual pass pending (pill rail,
ad swap + scroll reset on title switch, product → detail, heading → vendor, add/stepper → cart).

**Docs:** `docs/architecture/mobile-app.md` (category drill-in), `PAGE_CATALOG.md`.

**Date:** 2026-09-30

---

## Category drill-in — seed catalog so every taxonomy title resolves vendors

**Status:** 🟢 Shipped (data + guard); on-device visual verification pending.

**Root cause:** the category drill-in page renders `No vendors yet` (and hides the ad carousel)
whenever the auto-selected title's `MASTER_CATEGORIES.searchQuery` matches no product via
`services/categoryVendors.ts` `matchesQuery` (per-token AND over name + category + desc +
attributes). The taxonomy had outgrown the fixtures: **80 of 112 titles (71%)** resolved zero
vendors, so most tabs opened empty even though the screen wiring was correct (this was a data
coverage bug, not a component bug — `matchesQuery` is shared with `VendorDetailScreen`, and
Search parity matters, so the matcher was left as-is).

**Fix (data, not code):**
- `data/mart/products.ts` +74 rows and `data/pharma/products.ts` +11 rows (plus `STORE_BY_CATEGORY`
  keys `allergy` → `store-p2`, `personal-care` → `store-p4`) seed every title: each new row keeps
  the exact query tokens (incl. plurals/gender/number words) in one product's searchable text.
- Thin first-of-tab titles gained depth (second product ± store): Bluetooth Headphones, Fresh
  Apples, Fresh Milk, BP Monitor, Multivitamin, Nebulizer.
- No new stores and no component/service changes; existing 13 Mart + 6 Pharma outlets cover all
  titles.

**Guard:** `client/mobile/scripts/check-drillin-coverage.mjs` (`npm run check:drillin`) re-runs
the predicate over the raw fixtures and exits 1 if any title resolves 0 vendors or a product id is
duplicated.

**Verification:** `npm run check:drillin` → `112 titles, 0 unresolved`; `npm run ts:check` +
`npm run check:boundaries` pass. On-device pass still needed (open several tabs, confirm each shows
store heading → product rail → 16:9 ad and the top ad carousel).

**Docs:** `data/DATA_CONTROL.md`, `docs/architecture/data-layer-sdui.md`,
`docs/architecture/mobile-app.md`, `docs/DEVELOPER_ONBOARDING.md`,
`docs/RUNBOOKS/DATA_FIXTURES.md`, `docs/RUNBOOKS/TROUBLESHOOTING.md`.

**Date:** 2026-09-30

---

## Category drill-in — flat rail + store product rails + 16:9 store ads

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** Redesigned the category drill-in page (`CategoryDrillIn`) from
grouped vendor rows into a flat title rail with store-grouped horizontal product
rails and contextual 16:9 store ads.

**Changes:**
- **Titles rail flattened** (`features/catalog/components/CategoryTitleRail.tsx`, renamed from
  `SubgroupTextRail`): fed `subgroups.flatMap(s => s.items)` — every sub-category title in one
  long, ungrouped horizontal scroll; first item auto-selected, accent tint + underline unchanged.
  `CategoryDrillInPanel` state moved from `activeSubgroupId` to `activeItemId`.
- **New store-grouped body** (`features/catalog/components/StoreProductSection.tsx`): per matching
  store, a big store-name heading (tap → `VendorDetails` with the title query), a horizontal
  product rail built directly on shared `ProductCardBase` (`variant="rail"`, `appBrand` MART/PHARMA,
  cart wired via `useCartProductActions`, card tap → `ProductDetail`; keeps the
  `catalog → features/*/cards/` boundary green), then a 16:9 store ad.
- **Contextual store ads** (`services/categoryVendors.ts`): new `getVendorsWithProducts(app, q)`
  (vendor + matching product rows), `getAdsForQuery(app, q)` (top-ranked stores → `VendorAdSlide`s)
  and `getVendorAds(storeId, app)` (single-store ad). Ads derive from the real store rows
  (`coverImage` + `offerTag`/`desc`, `badge: 'SPONSORED'`, `storeId` retained for tap-through) — no
  new `@data` fixtures, so `data/DATA_CONTROL.md` is unchanged.
- **`AdBannerCarousel`** (`components/shared/`): fixed height `vs(156)` → `aspectRatio: 16/9`;
  added optional `showAdLabel` (AD pill, top-right) used by the Home top ad and the drill-in ads.
- **16:9 heroes**: `MartHeroCarousel` (dropped `BANNER_H`) and `PharmaHeroBanner` (`vs(180)` →) now
  `aspectRatio: 16/9`; both stay unlabelled organic heroes.
- **Removed** the now-unused `VendorRowCard.tsx` (no dead code).

**Interpretation notes (per approved plan):** the top ad carousel sits immediately below the titles
rail and is contextual to the selected title; each store's product rail gets its own 16:9 store ad;
the inline searchbar still filters stores by name/locality; the section "deep search" arrow was
removed along with the per-subgroup sections (the app-wide `Search` route is unchanged).

**Verification:** `npm run ts:check` + `npm run check:boundaries` pass (276 modules, no violations).
On-device pass still needed (rail length + auto-select, ad swap on title switch, product → detail,
heading → vendor, add/stepper → cart, 16:9 banners on Home/Mart/Pharma/restaurant hero).

**Docs:** `docs/architecture/mobile-app.md` (AdBannerCarousel + category drill-in + services seam),
`PAGE_CATALOG.md`.

**Date:** 2026-09-30

---

## Vertical-spacing reduction pass — canonical `SPACE` tokens

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** Tightened the vertical rhythm across every page by replacing per-screen
spacing magic numbers with a single token scale.

**Changes:**
- **New `src/theme/spacing.ts`** — `SPACE.SECTION` (`vs(14)`), `SPACE.BLOCK` (`vs(8)`),
  `SPACE.ITEM` (`vs(6)`), `SPACE.LIST_BOTTOM` (`vs(24)`). One owner per section boundary:
  a header owns its top gap (`SECTION`), parents no longer double-pad the same boundary,
  and headers no longer own a bottom gap beyond `BLOCK`.
- **Shared components first** (propagates to ~30 screens): `home/sections/common.tsx`
  `SectionHeader`, `home/cards/SDUIRenderer.tsx`, the food/mart/pharma `*SectionHeader`s,
  `food/components/SectionHeader.tsx` (`minHeight vs(40) → vs(32)`, `hitSlop` retained),
  `HomeView` list tail, and `components/SubAppWrapper.tsx` block/section gaps.
- **Per-page pass** across cart/checkout, auth (location/login), onboarding, pharma
  (home/prescription/blood-donor), favourites, profile, search, rewards, food
  (profile/home/offers), ecommerce (deals/vendor/mart-home), catalog, product, and Home
  sections — oversize section gaps downshifted to `SECTION`, list tails to
  `LIST_BOTTOM`, header→content to `BLOCK`, intra-block rows to `ITEM`. Skeletons
  (`MartHomeSkeleton`, `PharmaHomeSkeleton`, `VendorProfileSkeleton`, food
  `LoadingSkeleton`) mirror the tightened real layout so loading → loaded does not jump.
- `features/food/constants/theme.ts` `sectionGap` 28 → 14 (dead code, aligned).
- `-vs(40)`/`paddingTop vs(24)` hero-overlap pair in `RestaurantProfileScreen` → `-vs(24)`
  / `SPACE.SECTION`.

**Deferred — consolidate the 5 section headers (not executed):** `common/SectionHeader`,
`food/SectionHeader`, `food/FoodSectionHeader`, `MartSectionHeader` and
`PharmaSectionHeader` differ only by accent color + See-all label. Collapsing them into
one parameterized component would enforce the rhythm in one place, but touches many
imports (higher regression surface) and the token pass already fixes every page. Do it
as a follow-up.

**Verification:** `npm run ts:check` + `npm run check:boundaries` pass. On-device visual
pass still needed (Home/Food/Mart/Pharma feeds; cart + location multi-step forms;
short-device `SCREEN_H < 700`; skeleton → loaded frames).

**Docs:** `docs/architecture/mobile-app.md` "Vertical rhythm" section.

**Date:** 2026-09-28

---

**Status:** 🟢 Shipped (client-side).

**Feature:** The Home top-ad banner is extracted into a shared carousel and reused as the restaurant
profile's hero; the Food home header drops its address block.

**Changes:**
- **`components/shared/AdBannerCarousel.tsx`** (new, exported from `components/shared/index.ts`):
  the Home top-ad banner extracted byte-for-byte — 156-high rounded card (`expo-image` bg + overlay +
  badge + title/tagline), 4.5s auto-advance, paging dots, momentum resync, timer cleanup, re-anchor
  on `width`, plus a `< 2 slides` timer/dots guard. Presentation-only: `slides: AdSlide[]`,
  optional `onSlidePress`, optional `style` (no built-in margins) — so it is boundary-safe
  (`components/shared` may not import features).
- **`features/home/sections/AdBannerSection.tsx`** is now a thin wrapper over it: passes
  `topAdSlides`, the `targetApp → subAppIdFor → onLaunchSubApp` press mapping and the hub's margins
  (`marginHorizontal hs(16)`, `marginTop vs(4)`, `marginBottom vs(12)`) — pixel-identical to before.
- **`RestaurantProfileScreen.tsx`**: the `RemoteImage` hero + 40% dark overlay are replaced by a solid
  `#F3F4F6` band (`paddingTop: insets.top + 52`, `paddingHorizontal hs(16)`, `paddingBottom vs(52)`)
  holding `<AdBannerCarousel slides={topAdSlides} />` with no press handler (taps are a no-op inside
  Food). The pinned toolbar, `−40` white-board overlap, menu, offers rail and cart pill are unchanged.
- **`DiningHeader.tsx`**: removed the address section (area + "Delivering to Home", `area` /
  `onAreaPress` props, `MapPin`/`ChevronDown`/`ChevronRight`, location styles, second `dietRow`). The
  row is now back chevron · centered `DietToggle` (`flex-1`, `alignItems: 'center'`) · equal-width
  right spacer; the toggle stays uncontrolled and still writes the shared `foodFilterStore`.
  `FoodHomeScreen` needs no change.

**Docs:** `docs/architecture/mobile-app.md` (shared carousel, RestaurantProfile hero, Food home
header), `data/DATA_CONTROL.md` (`topAdSlides` consumer row).

**Date:** 2026-09-27

---

## Food — "Today's Special" home-card parity + Restaurant menu header / category rail fixes

**Status:** 🟢 Shipped (client-side).

**Feature:** Three parity/UX fixes in the Food sub-app.

**Changes:**
- **Food "Today's Special Near You" = Home card.** `SpecialDishCard.tsx` is now a thin adapter over
  `features/food/cards/FoodProductCard` → shared `ProductCardBase`, passing the Home rail's exact
  props (`variant="rail"`, `hs(116)`, `imageAspect: 1`, `roundedImageBottom`, rating/price/badge/
  heart/add hidden). `FeaturedDishCarousel` rail padding aligned to Home
  (`paddingLeft hs(16)` / `paddingRight hs(4)` / `paddingBottom vs(8)`). One row of all diet-filtered
  specials (Home stacks two) — accepted delta, and the food cards lose the old restaurant/price
  lines to match Home strictly.
- **Restaurant menu header.** `RestaurantMenuScreen` toolbar title is now just **"Menu"**; the full
  restaurant name renders below the toolbar, above the search bar (full-width, two-line wrap) instead
  of being truncated in the toolbar.
- **Category rail.** The chip `ScrollView` sets `keyboardShouldPersistTaps="handled"` (the autofocused
  search keyboard previously swallowed the first chip tap); chips are now derived from the menu's
  actual dish cuisines via the new `getMenuCategories` in `utils/menu.ts` (venue `restaurant.cuisines`
  carried labels no dish matched → dead chips), with the selected chip falling back to `Bestsellers`.
  Applied to `RestaurantMenuScreen` and `RestaurantProfileScreen`; the data fixtures are untouched.
  This supersedes the Food half of the earlier "Smaller Today's Special cards" entry.

**Date:** 2026-09-27

---

## Food — dedicated Restaurant Menu page + shared menu row / cart pill, central bottom inset

**Status:** 🟢 Shipped.

**Feature:** The restaurant profile's inline menu search is replaced by a dedicated **RestaurantMenu**
page with its own autofocused full-width search bar and diet toggle. Menu rows and the white View
Cart pill are extracted into shared components, and the bottom safe-area inset is now reserved once
at the app root instead of per screen/navbar.

**Changes:**
- **`features/food/screens/RestaurantMenuScreen.tsx`** (new): full restaurant menu — autofocused
  search bar (dish name/description), `Bestsellers` + cuisine chips, `DietToggle` in the toolbar
  (via `FoodDetailTopBar.right`), shared `MenuItemRow` list and `ViewCartPill`. Adds/steppers write
  to the same restaurant-scoped cart slice as the profile.
- **`features/food/components/MenuItemRow.tsx`** (new): shared dish row (thumb, name/desc/price,
  outlined **Add** → **− qty +** stepper), used by the profile and the menu page.
- **`features/food/components/ViewCartPill.tsx`** (new): shared restaurant-scoped white View Cart
  pill; absolute, right-aligned, no per-screen inset math.
- **`features/food/utils/menu.ts`** (new): `getMenuForRestaurant` / `getOwnDishes` extracted from
  `RestaurantProfileScreen` so both screens share one menu builder.
- **`navigation/types.ts` / `FoodStack.tsx`**: new `RestaurantMenu` route
  (`{ restaurant: DiningRestaurant; dietFilter: DietFilter }`).
- **`RestaurantProfileScreen.tsx`**: dropped the live menu `TextInput`, the `onLayout`
  scroll-and-focus jump and the `MoreVertical` action; the in-menu box is now a **"Search in menu"**
  button and the toolbar Search icon both push `RestaurantMenu` (threading `dietFilter`).
- **`App.tsx`**: new `AppLayout` reserves `useBottomInset()` once for the whole app, so bottom
  navbars/sticky footers/scroll paddings use base heights. Removed the now-redundant per-screen
  inset handling in `MainTabs` (`HubTabBar`), `SubAppWrapper`, `FoodBottomNav`, `RestaurantGrid`,
  `MedicalShopDetailsScreen`, `DonorDashboard`, `DonorDetailsScreen`, `PharmaVendorList`,
  `PrescriptionNoteStep` and `PrescriptionOrderConfirmedView`.

**Date:** 2026-09-27

---

## Food — Restaurant-isolated cart, bigger menu search, − qty + stepper, white View Cart pill

**Status:** 🟢 Shipped.

**Feature:** Adds from a restaurant are scoped to that restaurant on the cart page, the menu search
bar is enlarged to full width, menu rows get a real − qty + stepper, and the restaurant footer is a
plain white "View Cart" pill.

**Changes:**
- **One cart, scoped by ownership** (`state/cartStore.ts`): `CartItem.restaurantId?`; `addToCart`
  gained an optional 5th `restaurantId` arg (adopts an untagged line on re-add via `i.restaurantId ??
  restaurantId`); new `clearRestaurantCart(id)` removes only that restaurant's lines. No second
  store — checkout/payment/orders stay single-sourced.
- **Nav** (`navigation/types.ts`): `Cart` params are now `{ restaurantId?; restaurantName? }`
  (kept `| undefined` — a required-param object breaks React Navigation's composite `navigate`
  typing). All 7 call sites pass a params object explicitly: `{}` for the common cart,
  `{ restaurantId, restaurantName }` from `RestaurantProfileScreen.openCart`.
- **`CartScreen.tsx`**: reads `route.params`, filters to the scoped slice, and its `setCartItems` is
  **scope-aware** (replaces only the scoped slice) so placing an order / clearing can't wipe other
  lines. Wires `onClearItems` (`clearRestaurantCart`) and `onDeleteItem` (`removeFromCart`) only in
  scoped mode.
- **`CartView.tsx`**: new optional `restaurantName` / `onClearItems` / `onDeleteItem` props
  (presentational, no cart imports). Scoped title (`{restaurant} Cart`), red **Clear** in the BAG
  top bar, per-row **trash** delete, and a scoped empty state ("No items from {restaurant} yet").
  Common cart is unchanged (no Clear/trash).
- **`RestaurantProfileScreen.tsx`**: cart selectors now derive from
  `cart.filter(i => i.restaurantId === restaurant.id)` (footer count + `dishQuantity`); menu rows
  render a bordered **− qty +** stepper once added; the menu search header is a full-width **column**
  (title above, larger `ms(14)` input below) and its `onLayout` feeds a new `menuSearchYRef` so the
  toolbar's search-icon jump still lands on the input; the footer is a white **View Cart** pill
  (icon + label + item count + arrow, no ₹ amount / orange card). Dead footer styles + `cartTotal`
  memo removed.
- **`SearchDishCard.tsx`**: optional `restaurantId` prop passed to `addToCart`;
  `RestaurantOffersScreen` passes `restaurant.id` (its adds count toward that restaurant). Food
  search keeps not passing it → search adds stay common-cart only.

**Out of scope:** tagging adds made from `CommonProductDetailView` / `FoodSearchScreen`, and any
Mart/Pharma cart UX change.

**Date:** 2026-09-27

---

## Food — Restaurant details local diet toggle + menu-search jump

**Status:** 🟢 Shipped.

**Feature:** The restaurant profile now carries its own All/Veg/Non-Veg toggle in the pinned
toolbar and the toolbar's Search icon jumps to (and focuses) the in-menu search bar.

**Changes:**
- `DietToggle.tsx` is now **optionally controlled** (`value?` + `onChange?`): no props keeps the
  existing shared-store behavior for the home/Search headers; passing both drives a screen-local
  value. When controlled it does not subscribe to the store (no wasted re-renders).
- `RestaurantProfileScreen.tsx` seeds a screen-local `dietFilter` once from
  `foodFilterStore.getState().dietFilter` and never writes back — the restaurant toggle follows
  home by default (re-seeded on each open) and overriding it leaves home/search untouched. The
  toggle sits between the back button and the search/share/more actions (`alignItems: 'center'`).
- The Menu-search `TextInput` and the main `ScrollView` are now ref'd; `focusMenuSearch` measures
  `mainBoard` + `menuHeaderContainer` via `onLayout` (same pure-JS convention as `RestaurantGrid`)
  and scrolls the search bar under the pinned toolbar, then focuses it. Works from any offset.
- Main `ScrollView` gained `keyboardShouldPersistTaps="handled"` so the toggle/icons stay tappable
  while the keyboard is open.
- Honest empty states: the menu empty text now distinguishes a search miss from a diet filter that
  emptied the list; the "Recommended & Offers" header + rail hide entirely when the active filter
  leaves no dishes (so "View All" can't navigate to an empty page).

**Scope:** `foodFilterStore`, `FoodHomeScreen`, `DiningHeader`, and `FoodSearchScreen` unchanged.

**Date:** 2026-09-27

---

## Bottom navbars hidden behind Android's gesture bar

**Status:** 🟢 Shipped.

**Symptom:** The Main app tabs (`HubTabBar`), the Mart/Pharma wrapper bar, and (less visibly) their
labels sat under Android's gesture pill / 3-button bar because the window is edge-to-edge
(`android:navigationBarColor` is transparent) and those bars used a fixed height with no
`paddingBottom`.

**Cause:** React Navigation's default tab bar reserves `insets.bottom`; our custom `tabBar` render
prop bypassed it. Only `FoodBottomNav` was correct (it already used
`Math.max(insets.bottom, vs(8))` and measured its real height via `onLayout`).

**Changes:**
- New `useBottomInset()` in `src/utils/responsive.ts` (`Math.max(insets.bottom, vs(8))`) — one
  canonical formula alongside `useTopInset`, mirrored from the Food bar.
- `navigation/MainTabs.tsx` — `HubTabBar` grows by the inset (`height: TAB_BAR_H + inset`,
  `paddingBottom: inset`); fixed `height` removed from `tabBarWrap`; `NavbarHomeShortcut` gets the
  total height.
- `components/SubAppWrapper.tsx` — `navBarH = vs(72) + inset` feeds the absolute bar, the viewport
  `paddingBottom`, and the Home shortcut; the two dead `height: vs(72)` / `paddingBottom: vs(72)`
  style entries removed.
- `features/food/components/FoodBottomNav.tsx` — inline formula swapped to `useBottomInset()`
  (identical output; the `onLayout` height measurement is unchanged).
- `features/food/components/RestaurantGrid.tsx` — food-feed clearance now tracks the inset
  (`vs(104) + useBottomInset() - vs(8)`) so the last row stays clear on 3-button / iOS.

**Future / honest gaps:** No navigation/state/native/API change; purely inset wiring.

**On-device checklist** (Settings → System → Navigation mode; build via
`gh workflow run android-debug.yml`):
- Gesture nav (inset ≈24) + 3-button nav (inset ≈48): Main tabs, Mart (4 tabs), Pharma (5 tabs,
  adaptive width) — labels fully above the pill, bar background reaches the screen bottom, items
  centered.
- Mart/Pharma feed last row scrolls clear of the taller bar; Mart vendor drill-in still hides
  chrome (`isChromeHidden`).
- `NavbarHomeShortcut` still overlaps ~¼ of every bar.
- Food unchanged (regression); iOS home indicator (~34) now clears all bars too.

**Date:** 2026-09-27

---

## OTA / differential update delivery (expo-updates)

**Status:** 🔴 Backlog — not chosen or implemented.

**Gap:** The app ships as a single Metro bundle with no over-the-air JS update channel. There is
no `expo-updates`, EAS Update, CodePush, or Play Feature Delivery wiring in `package.json` /
`app.json`. `React.lazy` routes only defer module *evaluation* — they neither reduce download size
nor deliver features on demand (see "Home feed scroll & startup performance").

**Options considered:**
- **`expo-updates` / EAS Update (recommended pragmatic path)** — Expo-native OTA JS-bundle updates;
  no store resubmit for JS-only changes. Whole-bundle (not per-feature); needs a hosted update
  server/channel config.
- **Play Feature Delivery / dynamic feature modules** — per-feature native delivery, but effectively
  incompatible with the current `expo prebuild` single-module Android project without significant
  config-plugin work.
- **Flipkart-style per-feature OTA** — custom infrastructure (their plugin system); out of scope.

**Decision:** not adopted yet. If adopted, add the OTA-promote step to `docs/RUNBOOKS/RELEASE.md`
and record the update channel here.

**Date:** 2026-09-21

---

## Pharma local medicals, medical shop details & navbar Home shortcut

**Status:** 🟢 Shipped.

**Feature:** Pharma home now ends with a **Local Medicals Near You** rail. Tapping a medical opens
`MedicalShopDetails`, a pharma-local shop profile with contact/hours/pickup information, live
store-product search, and the existing prescription FAB. The FAB opens `PrescriptionFlow` with the
shop preset, so the vendor picker is skipped and fulfilment opens after the note step. A shared
Faazio-blue Home shortcut now floats above every visible bottom navbar: Favourites/You, Mart/Pharma,
and both Food tabs; it is hidden on main Home and Mart vendor drill-in chrome.

**Changes:**
- Added `LocalMedicalsRail`/`LocalMedicalCard`, the `MedicalShopDetails` root route and lazy screen,
  `presetVendorId` typing/branching in the prescription flow, and conditional Pharma section
  "View all" rendering.
- Added shared `NavbarHomeShortcut`; wired its measured geometry into `MainTabs`, `SubAppWrapper`,
  and the dynamic-height `FoodBottomNav`.
- Reused `pharmaStores`, `getVendorProducts`, `matchesQuery`, `SearchPharmaProductCard`, and
  `PharmaImage`; no new data shapes or duplicate product pools.

**Future / honest gaps:**
- Medical inventory and prescription photos remain fixture/in-session data until the Go Chi gateway
  and upload API are wired.

**Date:** 2026-09-17

---

## Kill the add-mode popup — fulfilment moves to the cart, live-location delivery, vendor pickup addresses

**Status:** 🟢 Shipped.

**Feature:** Adds are instant everywhere (no dining/pickup popup). Fulfilment is chosen on the
cart BAG step as a **Delivery / Self Pickup** toggle (nothing selected by default → Proceed to
Pay stays disabled). Delivery auto-fills the **live GPS address** (no manual ADDRESS step);
Self Pickup needs no address UI. Self-pickup orders record **all vendor pickup addresses** and
show them on the order-success receipt and on Order Details.

**Changes:**
- **Remove the gate** — deleted `FoodAddModeSheet.tsx`. `RestaurantProfileScreen`,
  `RestaurantOffersScreen`, `FoodSearchScreen` (config `foodSearchConfig.tsx`), and
  `CommonProductDetailView` now `addToCart(id, name, price, emoji)` directly. Dropped
  `onDishAdd`/`onAdd` from the search config + `SearchDishCard`.
- **Store/data** — `CartItem.fulfilment`, `CartFulfilment`, and the `addToCart(…, opts)`
  param removed (`cartStore.ts`, `data/types.ts`, `@data/home/seeds.ts`).
- **Cart BAG** (`CartView.tsx`) — single Delivery / Self Pickup toggle; the pickup-point
  radio list, contact row, "Deliver to" row, and the whole **ADDRESS step** are removed.
  Delivery shows the live address (or a "using saved address" fallback). Proceed to Pay is
  disabled until a mode is chosen; both modes go to PAYMENT.
- **Live location** — new `src/hooks/useLiveAddress.ts` (expo-location: consent →
  `getCurrentPositionAsync` → `reverseGeocodeAsync`; no PII logged). Delivery capture is
  stored on the order (`PlacedOrder.location`); `app.json` location-permission text updated
  (needs a native rebuild).
- **Vendor pickup addresses** — `ordersStore` gained `PlacedOrder.pickups` (one point per
  vendor, derived from `getPickupPointsForItems`). The RECEIPT and **Order Details**
  (`OrderDetailsScreen.tsx`) render one "Pickup From" card per vendor. Order Details now
  resolves via `ordersStore.getOrderById` first, falling back to `@data getMyOrderById` —
  fixing the placed-order "not found" gap.

**Native:** `app.json` `expo-location` permission message + iOS `NSLocationWhenInUseUsageDescription`
updated to cover checkout auto-fill. Requires a CI debug build (`gh workflow run android-debug.yml`).

**Future / honest gaps:**
- The live location is captured on the order but nothing uploads it yet (future Go backend).

**Date:** 2026-09-16

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
a CI debug build (`gh workflow run android-debug.yml`).

**Future / honest gaps:**
- Photos are captured and shown only in-session; nothing uploads them yet (future Go backend).

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
- **Cart BAG** (`CartView.tsx`): the order-level **Delivery / Self Pickup** toggle lives on the
  BAG step (a "How do you want your order?" card). Nothing is selected by default — Proceed to
  Pay stays disabled until a mode is chosen. Delivery shows the **live location** (GPS +
  reverse geocode via `useLiveAddress`); Self Pickup adds no address UI. There is **no ADDRESS
  step** — the manual saved-address page was removed. Proceed to Pay goes to PAYMENT in both
  modes. `computeTotals` still zeroes the fee for pickup.
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

**Feature:** The cart BAG step lets the user tick/untick items before paying.

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

**Data:** `@data/types` `CartFulfilment` + `CartItem.fulfilment`; `@data/home/seeds.ts`.
> **Removed (2026-09-16):** per-item FOOD fulfilment is gone — the mode moved to an order-level
> **Delivery / Self Pickup** toggle on the cart BAG step (nothing chosen by default). The
> `FoodAddModeSheet` add-gate, `CartItem.fulfilment`, the `CartFulfilment` type, the FOOD
> per-row label, and `addToCart(…, { fulfilment })` were deleted across the four add sites.

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
> **Removed (2026-09-16):** the `FoodAddModeSheet` fulfilment gate is deleted. Every Food
> add (search, offers, restaurant menu, product-detail) now adds **directly**; the
> order-level Delivery / Self Pickup toggle moved to the cart BAG step.

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

## Wire GatewayClient → production tables (per mvp-backend.md / db-schema.md)

**Status:** 🟢 Shipped (client wiring + MVP monolith). Screens still read `@data/*` and migrate
incrementally.

**Feature:** `src/services/api/GatewayClient.ts` is wired to the MVP **Go Chi modular monolith**
(`server/gateway`, `docs/architecture/mvp-backend.md` + `docs/architecture/monolith-breakdown.md`)
over Supabase (Postgres) + MongoDB + Aiven Valkey. Set `EXPO_PUBLIC_GATEWAY_URL` +
`EXPO_PUBLIC_USE_GATEWAY=true` to go remote; otherwise it reads `@data/*` and every remote call
**falls back to fixtures on error**, so screen migration can't regress. Cache keys/TTLs follow
`docs/architecture/caching-cloudflare-valkey.md` (unchanged). Caveat: local dev is auth-open
(`AUTH_DISABLED=true`); phone-OTP → gateway JWT still to be exercised end-to-end on device.

**Wiring order** (`docs/architecture/data-layer-sdui.md`): `searchProducts` → `getProduct` →
`getHomeFeed` → `getReviews` → `getOrders`/`getProfile` — all implemented.

**MVP endpoint checklist** (`mvp-backend.md` §3) — all shipped server-side:
- [x] `GET /health`
- [x] `GET /search?q=&app=` → `searchProducts`
- [x] `GET /product/:id` (+ `/product/:id/reviews`) → `getProduct`
- [x] `GET /sdui/home` → `getHomeFeed`
- [x] `GET /vendors/:id/reviews` (+ `/summary`, `PUT /rating`) → `getReviews` / `rateVendor`
- [x] `GET /stores`, `/store/:id` → `getStores` / `getStore`
- [x] `GET /orders`, `/profile` (+ `/membership`, `/order-status`, `/account-nav`, `/profile/details`)
- [x] writes: `/cart…`, `POST /orders`, `POST /events`

**Sweetspot pass (server-side, wire-compatible):** migrations `0004`–`0006` (lean indexes +
JSONB guards + vendor rating counter, non-money type byte diet, checkout idempotency); slim
product/store list projections, one-batch SDUI join, `auth_uid → user_id` cache, bounded product
reviews, `/sdui/home` ETag. Cache keys/TTLs and `GatewayClient` signatures are unchanged, so no
client change is required. Authority: `docs/architecture/{db-schema,caching-cloudflare-valkey,monolith-breakdown}.md`.

**Date:** 2026-10-13 (updated: MVP monolith built + sweetspot pass)

---

## `@mock` → `@server` per-module migration (W22)

**Status:** 🟡 In progress. Mart feed, catalog vendor detail, favourites, product search, the Home
SDUI section registry, the cart/checkout path and the Pharma Rx capture/upload/create path are
migrated to the gateway; the remaining modules still read `@data/*` directly.

**Feature:** Flipping `EXPO_PUBLIC_USE_GATEWAY=true` only helps modules that call `GatewayClient`.
This item routes each module through it, one at a time, keeping the built-in fixture fallback.

- [x] **mart feed** — `features/ecommerce/services/martService.ts` hydrates `localVendors` from
      `gateway.getStores('MART')` (`directory.stores`); curated banners/deals stay local until SDUI.
- [x] **catalog/directory vendor detail** — `features/catalog/VendorDetailScreen.tsx` renders the local
      `getStoreById` fixture immediately, then upgrades to `gateway.getStore(id)` (no loading flash,
      no regression offline).
- [x] **favourites** — `features/favourites/FavouritesPageView.tsx` resolves the shelf locally first,
      then upgrades to `gateway.getProductsByIds(favorites)`; a toggle removes the card immediately.
- [x] **search** — `SearchScreen` gains an optional `SearchModeConfig.fetch`: when remote, the
      committed query loads from `gateway.searchProducts` and the server pool replaces `mode.data`
      (local predicate/facets still refine; the substring predicate is skipped for server FTS hits).
      Wired in the mart/pharma/home product configs; food search stays local (dining venues aren't in
      `directory.stores`), and Food's `getMenu` is already remote.
- [x] **home/SDUI** — new `features/home/hooks/useHomeFeed.ts` loads the server SDUI doc
      (`gateway.getHomeFeed`) and `HomeView` renders its ordered sections, threading the doc's joined
      rail products into the Recently-Viewed sections; the static `@data/home/sections` registry is the
      offline/first-paint fallback. Bespoke hero sections (ad/brand/dining/filter-feed) keep their local
      fixtures until the SDUI doc is extended to carry their content.
- [ ] **dining** — blocked: the `tr-*`/`dn-*` dining venues are identity-only in `data/food/diningVenues.ts`
      and are **not** in `directory.stores`, so `diningService` cannot be server-backed until the
      dining-venue profile data is seeded. `gateway.getMenu(venueId)` (dish lists) is already remote-ready.
- [x] **cart durability** — `state/cartStore.ts` mirrors every mutation to `inventory.carts`
      best-effort and `hydrate()`s the durable cart at startup (remote mode; empty server cart is a
      no-op). Local state stays the optimistic model.
- [x] **checkout/orders** — `CartView.handlePlaceOrder` calls `gateway.placeOrder(...)` and keys the
      local order by the **server-returned id** (server prices + decrements stock + holds the
      idempotency lock); purchased lines are dropped from the durable server cart. `paymentMethod` is
      not sent (payment deferred).
- [x] **pharma Rx** — `PrescriptionFlowScreen.handleConfirm` uploads photos to the private bucket via
      signed URLs (`gateway.uploadPrescriptionImage` → object key), then creates the Rx with
      `gateway.createPrescription` (real `imagePaths` + `addressId`), keyed by the server id.
- [ ] **pharma Rx quote view** — the customer-facing quote/READY polling + reveal view (My Orders)
      still shows the local receipt only; the gateway serves quote/READY + outbox notifications.
- [ ] **orders/rewards, blood, bookings** — stores already call `GatewayClient`; verify on-device with
      `AUTH_DISABLED=true` before flipping the flag for release.

**Date:** 2026-10-14 (updated: cart/checkout + pharma Rx client wiring)

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
  group, targeted **Requests for You** filtered by the active account's `user.id`, and the
  `BLOOD_REQUESTS` seed feed via `BloodRequestCard`. The Donor tab renders
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
- **Targeted "Ask Blood" shipped** (`components/AskBloodSheet.tsx` on the shared
  `SlideUpSheet`): a floating FAB on both the wizard and dashboard opens a two-stage flow.
  The user enters only city and blood group, taps Continue, and receives matching available
  donors from the async `services/donorDirectory.ts` mock repository. Tapping a donor opens
  `DonorDetailsScreen`, where `Request This Donor` creates one `DonorMatchRequest` addressed
  to that donor's `donorUserId`. Requests are persisted in the existing blood-donor blob
  and render only in the selected donor's dashboard under **Requests for You**; they are not
  inserted into the common hospital request feed or broadcast to all donors.

**Future / honest gaps:**
- **Interested/Accepted are local-only** (persisted AsyncStorage) — the actual
  hospital-contact flow, matching and donor-detail sharing are backend future (Go Chi).
  Accept's confirmation dialog states the sharing contract; delivery is not built.
- **Distance (`distanceKm`) is mock seed data** — no real geo between donor and hospital
  yet; the nearby sort is a real sort over the seeded values.
- **Bell press is a no-op** (TODO in `DonorDashboard`) — no notification screen or push
  infra; the badge count remains the `BLOOD_DONOR_UNREAD_ALERTS` seed plus the current
  donor's incoming targeted-request count. Cross-device delivery is not built.
- **Funnel icon is visual-only** — a filter sheet is not designed yet; ditto presence only.
- **"Nearby" is city-matching, not geo**: request `city` vs the donor's registered
  `preferredLocation` (case-insensitive contains). Real geo swaps the matcher, not the UI.
- **Request feed is a static seed** (`BLOOD_REQUESTS`, 5 fixtures) — the Go Chi backend
  owns the real feed; `BloodRequest` shape documented as the interim contract.
- **Targeted donor requests are device-local** during the mock stage. The recipient filter
  is user-specific, but cross-device delivery and donor response/status transitions require
  the Go Chi backend.
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
  backend. Targeted Ask Blood matching currently uses the mock donor repository and local
  persistence; matching, push, authorization, and request status will live in the Go Chi
  backend (`server/`) once wired.
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
`server/` (MVP modular monolith: `docs/architecture/mvp-backend.md`).

**Blocked by:**
- Seller/store-owner write APIs (the MVP monolith exists; this seller surface is not modelled yet).
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

## Sell with us — live partner onboarding

**Status:** 🟢 Live submit (gateway wired; `@data` label fixture retained).

**Feature:** `SellWithUsScreen` (route `SellWithUs`, from the Account `earn` group's
`Sell with us` row) is a real onboarding form. It collects business name, owner, category
(`MART`/`FOOD`/`PHARMA` chips), GSTIN, PAN, business address, contact phone and a 2-letter
state code, then submits a `PENDING_REVIEW` application via
`GatewayClient.submitSellerApplication` (`POST /sellers`, audited). On success it shows the
returned `sellerId`; offline/mock mode returns a local `PENDING_REVIEW` row so the flow still
completes. Field labels/placeholders still come from the stable
`@data/seller/sellerSetup.ts` fixture (`SELLER_SETUP_FIELDS`).

**Remaining / honest gaps:**
- **KYC + bank** are collected after approval (`POST /sellers/{id}/kyc`,
  `PUT /sellers/{id}/bank-account`, portal/seller-scoped) — not on this first screen.
- **No document picker yet** — KYC upload from mobile is a later step (Storage object keys).

**Date:** 2026-09-10 — updated 2026-10-13 (live submit).

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

## Mart "Local Vendors Near You" — remove in-section search + category pill rail

**Status:** 🟢 Shipped (client-side).

**Feature:** The Mart feed's `LocalVendorRail` drops its **in-section search bar** and the
**category pill rail** (`VendorCategoryPills`) beneath it. The section keeps its
`MartSectionHeader` title and renders the full `martStores` list directly (with its empty state).
The Mart **header** search + header category rail are untouched. `VendorCategoryPills` was removed
(only used by this rail); `usePagedRail` remains in use by the header rail.

**Date:** 2026-09-16

## Sub-app crash hardening — visible, scoped, recoverable

**Status:** 🟢 Shipped (client-side).

**Feature:** A render error while Mart/Pharma mounts previously blanked the whole navigator with an
opaque "Something went wrong" card, and release builds strip `console.*` so the cause was invisible.
- `components/ErrorBoundary.tsx` now takes `scope` / `onReset`, always renders the thrown `message`
  (first stack frame in dev only), and offers **"Go to Home"** alongside "Try again" (reset
  navigation via `navigationRef`, `src/navigation/navigationRef.ts`).
- `SubAppScreen` wraps `SubAppWrapper` in a **scoped** `scope="SubApp"` boundary so a sub-app-only
  failure degrades in place and Home/Food keep working; it also guards an absent `route.params`.
- `SubAppWrapper` derives its config from a module-scope `SUB_APP_PRESETS` with a
  **never-undefined fallback** + an in-app "Unsupported sub-app" state (no more `config.tabs` on
  `undefined`), and guards `initialVendorStoreId` (`Array.isArray(martStores)`).
- Header consolidation finished: one `SubAppHeader` for all sub-apps (Mart pins `HeaderCategoryRail`
  via `belowSearchSlot`); `MartSubAppHeader.tsx` + `SubAppHeaderBackdrop.tsx` deleted.

**Date:** 2026-09-27

## Smaller "Today's Special" cards (Home + Food)

**Status:** 🟢 Shipped (client-side).

**Feature:** Food's **"Today's Special Near You"** card (`SpecialDishCard.tsx`) is rebuilt as a
compact `hs(116)`-wide card — **square** (`aspectRatio: 1`) image on top, dish name / restaurant /
price stacked below, no gradient overlay (the old 175×250 portrait card). On Home, the
`diningSpecials` rails shrink from `hs(150)` → `hs(116)` (`DiningSpecialsSection.tsx`), rails
tightened (`paddingBottom vs(8)`, `marginTop vs(4)`) and `CARDS_PER_RAIL` 8 → 10.

**Date:** 2026-09-27

## Durable backend seam — blood (0010) + bookings (0011)

**Status:** 🟡 Server + seed + `GatewayClient` shipped; screen reconciliation pending.

**Done:** the previously memory-only workflows now have a durable home served by the gateway:
- **blood** (`internal/blood`, migration `0010`): donor registry (`blood.donors` + the
  `blood.donor_directory` consented view), request board (`blood.requests`, `contact`/`address`
  redacted for anon), `blood.interests`, `blood.match_requests`. `bloodDonorStore` now mirrors
  `register()` → `PUT /donors/me`, `toggleInterested`/`acceptRequest` → `setBloodInterest`, and
  `requestDonor` → `createDonorMatch` (best-effort; AsyncStorage stays the optimistic cache).
- **bookings** (`internal/bookings`, migration `0011`): `bookings.tables` + `bookings.food_orders`.
  `GatewayClient` exposes `getBookings/createBooking/cancelBooking/getFoodBookings/createFoodBooking`.

**Remaining:** wire `bookingStore`/`foodBookingStore` (currently unused by any screen) to hydrate
from and write to the gateway; migrate the blood dashboard/request board off the `BLOOD_REQUESTS` /
`BLOOD_DONORS` `@data` seeds to `GET /blood-requests` / `GET /donors`.

**Date:** 2026-10-13

## DB-gap series closed — hardening (0014) + reco read path

**Status:** 🟢 Server + seed + `GatewayClient` shipped (phase 6, final).

**Done:**
- **`0014_hardening.sql`**: one generic `util.touch_updated_at()` trigger attached to every mutable
  table (stores/stock/carts/pickup_points/profile/vendor_reviews/prescriptions/bookings.tables/
  blood.donors/rewards.balances), a `checkout.purge_idempotency_keys()` pg_cron sweep (7-day window),
  hot-path indexes (`vendor_reviews(vendor_id, created_at desc)`, `prescriptions(user_id, status)`),
  and schema `USAGE` grants to `anon`/`authenticated` (Supabase-only). Idempotent/re-runnable.
- **Mongo**: `seed.js` now validates + creates the four MVP collections
  (`sdui_layouts`, `user_events`, `recommendations`, `product_stats`).
- **reco read path**: `GET /recommendations` (auth-scoped) reads the caller's `recommendations` doc by
  `userIdHash`, falls back to top `product_stats`, joins catalog, cached `faazio:v1:reco:{hash}:home`
  1 h. Client `getRecommendations()` falls back to highest-rated catalog entries.

**Remaining (Future Prod):** the batch job that writes `recommendations` / `product_stats` (and the
`segments` collection); wiring recommendations into a Home rail.

**Date:** 2026-10-13
