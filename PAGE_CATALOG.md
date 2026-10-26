# Faazio SuperApp — Page Catalog

> **Note:** The Grocery sub-app was removed and merged into Mart. Grocery products, stores, and
> categories now live under Mart (`app:'MART'`), surfaced in Home, Mart search, cart, favourites,
> orders, and Master Categories. Deleted files (`GroceryScreen.tsx`, `GroceryPage.tsx`, the
> `grocery-home/` component dir, Grocery product cards, `useGroceryFeed`, `groceryService`,
> `groceryHomeFeed`, `GroceryHomeSkeleton`, `grocerySearchConfig`, `data/grocery/`) are treated as
> stale. Historical/audit rows that describe the pre-merge state are preserved but flagged.
>
> **Note (active RN app):** the shipped React Native app lives under `client/mobile/`. The My
> Account "Favourites" row now opens a search-results-style page (`features/favourites/FavouritesScreen`
> on the `Favourites` root route) backed by `useFavoriteStore`, and the Mart sub-app tab bar gained a
> "You" tab (left of Cart) that pushes the account page. The rows below document the legacy Vite web
> audit and are preserved for history.

## Section 1: Vite Web App — All User-Facing Pages

### 1.1 Onboarding & Auth Flow

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| O1 | **Onboarding Slide 1** — "Welcome to Faazio" | `src/App.tsx` | 472–627 | Carousel slide: illustration + title + description |
| O2 | **Onboarding Slide 2** — "Smart Shopping" | `src/App.tsx` | 472–627 | Carousel slide |
| O3 | **Onboarding Slide 3** — "Satisfy Your Hunger" | `src/App.tsx` | 472–627 | Carousel slide |
| O4 | **Onboarding Slide 4** — "Instant E-Services" | `src/App.tsx` | 472–627 | Carousel slide |
| O5 | **Login — Phone Entry** | `src/App.tsx` | 630–752 | Blue gradient, hero image, phone input (+91), auto-advance |
| O6 | **Login — OTP Verification** | `src/App.tsx` | 753–963 | White sheet, 6-segment OTP input, error toast, resend |
| O7 | **"All Done!" Loading Spinner** | `src/App.tsx` | 969–986 | Centered blue spinner, 2-second transition |
| O8 | **Location Permission Request** | `src/App.tsx` | 989–1059 | Purple gradient, illustration, Allow/Manual CTAs |
| O9 | **Manual Location Search** | `src/App.tsx` | 1061–1206 | White screen, search input, current location, results list |
| O10 | **Map Loader / "Delivering To" Card** | `src/App.tsx` | 1208–1341 | SVG map grid, pulsing pin, white overlay card |

### 1.2 Main Dashboard Hub

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| D1 | **Dashboard Shell** | `src/App.tsx` | 1367–1565 | Gradient header, location, search, bell, bottom tab bar (glassmorphism) |
| D2 | **Home Tab** | `src/components/HomeView.tsx` | full (1258) | See sub-sections below |
| D3 | **Categories Tab** | `src/components/CategoriesView.tsx` | full (517) | See sub-sections below |
| D4 | **Favourites Tab** | `src/components/FavouritesView.tsx` | full (307) | See sub-sections below |
| D5 | **Cart Tab** | `src/components/CartView.tsx` | full (759) | 4-step checkout flow |
| D6 | **Account Tab** | `src/components/AccountView.tsx` | full (116) | Profile, deliveries, orders, settings, logout |

#### Home Tab (D2) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| H1 | Admin Demo Banner | 509–548 | Collapsible "Phase 2 Ditto Demo" status bar |
| H2 | Top Ad Carousel | 551–618 | 3-slide auto-rotating (video/banner/text) |
| H3 | Sector Gateway Grid | 620–667 | MART, FOOD, PHARMA (Grocery merged into Mart) |
| H4 | Sponsored Showcase Carousel | 669–755 | Full-width banner, video/image, mute toggle |
| H5 | Recently Viewed Strip | 757–804 | Horizontal scrollable history |
| H6 | Today's Offers | 806–865 | Deal cards with "Claim Deal" CTA |
| H7 | Recommended For You | 867–909 | 2-column AI curated grid |
| H8 | Popular Dining Restaurants | 911–979 | Horizontal cards with heart toggle |
| H9 | Recently Viewed — Mart | 982–1039 | Horizontal carousel with Add/Added |
| H10 | Recently Viewed — Grocery | 1041–1087 | Removed — grocery folded into Recently Viewed — Mart |
| H11 | Recently Viewed — Pharma | 1089–1135 | Horizontal carousel with Add/Added |
| H12 | FA Mart Curated Finds | 1138–1188 | "Discover" CTA cards |
| H13 | Restaurant Specials | 1190–1255 | "Order Now" CTA cards |

> **RN app note (W42):** the Home top ad (H2, Vite reference above) is now the paid **`HOME_HERO`**
> placement (`CampaignHero` in `features/home/sections/AdBannerSection.tsx`); the static `topAdSlides`
> fixture and the organic Mart `MartHeroCarousel` are retired — every hero is a paid ad that collapses
> to `null` when unfilled.

#### Categories Tab (D3) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| C1 | Filter Pills | 150–182 | ALL/FOOD/MART/PHARMA (Grocery merged into Mart) |
| C2 | Search Bar | 184–194 | Instant search input |
| C3 | Category Grid | 196–243 | 3-column visual grid |
| C4 | Explore Stacks (curated) | 263–407 | Horizontal carousels grouped by stack |
| C5 | Product Grid (list mode) | 408–499 | 2-column product cards |
| C6 | Empty State | 501–512 | No matching products |

#### Favourites Tab (D4) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| F1 | Header Banner | 143–159 | Dark gradient |
| F2 | Per-Sector Product Grids | 161–287 | FOOD/MART/PHARMA (Grocery merged into Mart) |
| F3 | Empty State | 288–303 | No favourites yet |

#### Cart Tab (D5) — 4 Checkout Steps:

| # | Step | Lines | Description |
|---|------|-------|-------------|
| CA1 | **Bag** (items, promo, pricing) | 159–358 | Grouped by app source, quantity controls, coupon code, price breakdown |
| CA2 | **Address** (select or add) | 362–467 | Saved addresses list + add custom form. **RN delta:** adds a Deliver / Self-Pickup toggle (see RN9 / Page 9) |
| CA3 | **Payment** (UPI/Card/COD) | 471–651 | 3 payment methods with dynamic panels, SSL banner |
| CA4 | **Receipt** (confirmed + tracking) | 654–758 | Checkmark, live tracking timeline, items summary, ETA |

#### Account Tab (D6) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| A1 | Profile Summary | 19–37 | Avatar, name, member status, phone/email |
| A2 | Active Delivery Card | 43–52 | Blue gradient order-in-progress |
| A3 | Past Orders | 54–69 | Order history with status badges |
| A4 | Settings | 72–103 | Location, notifications, app version |
| A5 | Logout Button | 105–113 | Destructive action |

### 1.3 Sub-App Wrapper

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| S0 | **Sub-App Shell** | `src/components/SubAppWrapper.tsx` | full (671) | Unified sub-app header, viewport, bottom tabs; wrapped by a scoped `ErrorBoundary` |

#### Sub-App Shell sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| SW1 | Exit Confirmation Modal | 631–668 | Slide-up bottom sheet |
| SW2 | Sub-App Bottom Navbar | 584–628 | Dynamic tabs per app |

### 1.4 Sub-App: Food

> **No dining/table-booking feature exists.** The Food workflow is discover → menu → cart → checkout,
> with only `DELIVERY` or `PICKUP` fulfilment. F05/F07 and the "Dinner Booking" toggle below are
> legacy Vite-audit rows only; the shipped RN Food app has no reservation screen, route or store.

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| F01 | **Food Order Mode** | `src/components/FoodPage.tsx` | 237–663 | Full order mode view |
| F02 | **Store Profile / Restaurant Detail** | `src/components/FoodPage.tsx` | 399–511 | Cover image, menu grid, offers |
| F03 | **Restaurant Directory** | `src/components/FoodPage.tsx` | 512–661 | Filter bar + store list |
| F05 | ~~**Table Reservation Form**~~ | — | — | 🗑️ Removed — no booking feature exists |
| F06 | **Food Menu View** | `src/components/FoodMenuView.tsx` | full (211) | Search, category tabs, 2-column grid |
| F07 | ~~**My Bookings (SubAppWrapper tab)**~~ | — | — | 🗑️ Removed — no booking feature exists |
| F08 | **Food Profile (SubAppWrapper tab)** | `src/components/SubAppWrapper.tsx` | 303–329 | Account details |

#### Food Order Mode (F01) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| FO1 | Mode Toggle | 212–233 | Food Order mode only — the Dinner Booking toggle was removed |
| FO2 | Search Input | 247–258 | "Search on Food" |
| FO3 | Address Card | 260–285 | Emerald green delivery card |
| FO4 | Promo Card | 287–325 | Chicken Teriyaki with Order Now |
| FO5 | Top of Week Carousel | 327–395 | Weekly specials |

#### Mart Home (M01) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| MT1 | Category Pills | 307–336 | Horizontal scrollable |
| MT2 | Category Banner + Countdown | 338–382 | Full-width with timer |
| MT3 | Daily Essentials Strip | 384–447 | Horizontal minimal deal cards (no countdown) |
| MT4 | Featured Stores Grid | 449–511 | Store cards |
| MT5 | All Products Grid | 513–604 | 2-column product grid |

### 1.6 Sub-App: Grocery — REMOVED (merged into Mart)

> The Grocery sub-app was removed. Grocery products/stores/categories now live under Mart
> (`app:'MART'`). The screens below (G01–G03) are historical/removed.

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| G01 | ~~**Grocery Home**~~ | `src/components/GroceryPage.tsx` (deleted/nonexistent) | — | ~~Full grocery landing~~ removed |
| G02 | ~~**Grocery — Aisles (SubAppWrapper tab)**~~ | `src/components/SubAppWrapper.tsx` | — | ~~Aisle directory grid~~ removed |
| G03 | ~~**Grocery — Fresh Club (SubAppWrapper tab)**~~ | `src/components/SubAppWrapper.tsx` | — | ~~Membership card~~ removed |

#### Grocery Home (G01) sub-sections — REMOVED

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| GR1 | Promo Banner | 58–74 | Full-width gradient |
| GR2 | Subcategory Pills | 76–97 | Fresh Produce, Dairy, Bakery, etc. |
| GR3 | Product Grid | 112–213 | 2-column with +/- quantity stepper |

### 1.7 Sub-App: Pharma

> **Superseded registry (2026-10-18).** The Vite-era `src/components/PharmaPage.tsx` is **deleted**
> and Section 1 is a historical audit record — the authoritative Pharma hosts are the RN files below
> (also listed in Section 2). Read this table as the Vite→RN mapping, not a live path list.

| # | Screen | RN host (authoritative) | Vite-era description |
|---|--------|-------------------------|----------------------|
| P01 | **Pharma — Home Tab** | `client/mobile/src/features/pharma/PharmaScreen.tsx` (in-wrapper, `SubAppWrapper`) | Full pharma home (CampaignHero PHARMA_HERO + house hero + rails) |
| P02 | **Pharma — Category entry** | `PharmaScreen.tsx` (`onSearchPress` → Search route) / `CategoryDrillInScreen.tsx` (app=`PHARMA`) | Category tap → server search / drill-in |
| P03 | **Pharma — Category Products (inline)** | `PharmaScreen.tsx` inline `CATEGORY_PRODUCTS` (`PHARMA_PRODUCTS_DB`, real `ph-*` ids) | Legacy per-category grid (kept inline) |
| P04 | **Pharma — Product Detail** | `client/mobile/src/features/product/ProductDetailScreen.tsx` (canonical `ProductDetail`) | Shared PDP (inline legacy view remains) |
| P05 | **Pharma — Donor tab** | `client/mobile/src/features/pharma/blood-donor/BloodDonorScreen.tsx` + `DonorDashboard.tsx` | Replaced the old "For You" tab |
| P06 | **Pharma — History tab** | `PharmaScreen.tsx` (`activeTab='History'`) — real placed orders merged from `useOrdersStore` (newest first), `PHARMA_RECENT_ORDERS` fixture only as the mock-mode first paint; honest empty state in remote | Active orders + consultations |

Additional Pharma routes (not in the Vite audit): `MedicalShopDetailsScreen.tsx`,
`prescription/PrescriptionFlowScreen.tsx`, `blood-donor/DonorDetailsScreen.tsx`,
`blood-donor/BloodRequestDescriptionScreen.tsx` — see Section 2.

#### Pharma Home Tab (P01) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| PH1 | Header (avatar, search, bell) | 543–583 | Peach gradient |
| PH2 | Promo Banner | 586–600 | 30% off |
| PH3 | Trust Badge | 602–620 | Certified Wellness |
| PH4 | Category Grid | 631–670 | 2×2: Vaccine, Vitamins, etc. |
| PH5 | Product Grid | 672–728 | Popular Wellness Matches |

### 1.8 Overlays & Modals

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| X01 | **Product Detail Modal** | `src/components/ProductDetailView.tsx` | full (554) | Full-screen sliding sheet |
| X02 | **Sub-App Exit Confirmation** | `src/components/SubAppWrapper.tsx` | 631–668 | Bottom sheet modal |

#### Product Detail Modal (X01) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| PD1 | Floating Top Nav | 270–299 | Close, share, favourite |
| PD2 | Hero Gradient | 304–321 | Emoji, rating, delivery tag |
| PD3 | Product Header | 323–348 | App badge, name, price |
| PD4 | Description | 350–352 | Text |
| PD5 | Key Highlights | 355–365 | Bullet list |
| PD6 | Bank Offer Banner | 367–375 | Promo |
| PD7 | Guarantee Badges | 378–394 | Quality, returns |
| PD8 | Specs Grid | 398–411 | 2-column |
| PD9 | Customer Reviews | 414–505 | Bar breakdown + individual reviews |
| PD10 | Sticky Add-to-Bar | 509–549 | Price + quantity selector |

---

## Section 2: React Native App — All User-Facing Pages

> **This is the authoritative RN page registry.** Every route in
> `client/mobile/src/navigation/types.ts` (plus `MainTabs`, `FoodStack` and the `SubAppWrapper`
> tabs) is listed once, tagged by sub-app scope, with its file and entry point — so no sub-page
> (vendor, category, restaurant, blood, Rx, rewards) can drift to "unknown". The legacy
> subsections that used to live here (`Types Defined But NOT Wired`, `Orphan Files`) were stale —
> every one of those routes is wired now — and are superseded by this registry. Section 1 (Vite)
> and Section 3 (Vite↔RN mapping) are historical audit records and should be read as such.

Scope tags:

| Tag | Meaning |
| --- | --- |
| **MAIN** | Hub / auth / shared checkout-account-search surface. Reached from Home or pushed on the root stack (boundary rule: cross-sub-app access only via Home). |
| **MART** | Sub-app `FA_MART` — `FaMartScreen` + header rail + Home/Search/You/Cart. Renders inside `SubAppWrapper`. |
| **FOOD** | Sub-app `FOOD` — `FoodStack`, bypasses `SubAppWrapper` (self-contained 2-tab Home/Search + You/Cart). |
| **PHARMA** | Sub-app `PHARMA` — renders inside `SubAppWrapper`, tabs Home/Search/Cart/History/Donor. |

### 2.1 Onboarding & auth (MAIN)

| # | Route | Screen | File | Entry |
| --- | --- | --- | --- | --- |
| RN1 | `Onboarding` | **OnboardingScreen** | `src/features/onboarding/OnboardingScreen.tsx` | Initial route when unauthenticated |
| RN2 | `Login` | **LoginScreen** | `src/features/auth/LoginScreen.tsx` | From Onboarding |
| RN3 | `LanguageSelection` | **LanguageSelectionScreen** | `src/features/onboarding/LanguageSelectionScreen.tsx` | After OTP (`replace`) |
| RN4 | `Location` | **LocationScreen** | `src/features/auth/LocationScreen.tsx` | After language |

Auth is the **mocked login** (`authStore.login()`, 3 SecureStore writes). No Supabase phone OTP.

### 2.2 Hub tabs (`MainTabs.tsx` — MAIN)

| # | Tab | Screen | File | Notes |
| --- | --- | --- | --- | --- |
| RN5 | Home | **HomeTabScreen** → `HomeView` sections | `src/features/home/HomeTabScreen.tsx` | Collapsing header + `HomeView` SDUI sections |
| RN6 | Favourites | **FavouritesTabScreen** | `src/features/favourites/FavouritesTabScreen.tsx` | Per-sector grid |
| RN7 | You | **AccountScreen** → `AccountView` | `src/features/profile/AccountScreen.tsx` | Account nav groups + rewards card |
| — | central Cart pill | pushes root `Cart` | `src/navigation/MainTabs.tsx` | `navigation.getParent().navigate('Cart', {})` |

### 2.3 Shared root-stack routes (MAIN)

| # | Route | Screen | File | Notes |
| --- | --- | --- | --- | --- |
| RN8 | `ProductDetail` | **ProductDetailScreen** | `src/features/product/ProductDetailScreen.tsx` | View = `CommonProductDetailView.tsx`. MART w/ `storeId` → store section + "View Vendor" → `SubApp{initialVendorStoreId}`; FOOD → "View Restaurant" deep-links into `FoodApp → RestaurantProfile` |
| RN9 | `Search` | **SearchRouteScreen** | `src/features/search/SearchRouteScreen.tsx` | `{ subApp: 'HOME'\|SubAppId; initialQuery?; initialMode? }`. Food keeps its own nested Search |
| RN10 | `Cart` | **CartScreen** → `CartView` | `src/features/cart/CartScreen.tsx` | `{ restaurantId?, restaurantName? }`; BAG→PAYMENT→RECEIPT. BAG carries the Delivery/Self-Pickup toggle |
| RN11 | `PaymentOptions` | **PaymentOptionsScreen** | `src/features/cart/payment/PaymentOptionsScreen.tsx` | Standalone picker + CartView PAYMENT step |
| RN12 | `CategoryDrillIn` | **CategoryDrillInScreen** | `src/features/catalog/CategoryDrillInScreen.tsx` | `{ tabId; title; app: 'FA_MART'\|'PHARMA' }`. Paid `CATEGORY_TOP` hero under the pill rail; store-grouped `CategoryDrillInPanel` body |
| RN13 | `VendorDetails` | **VendorDetailScreen** | `src/features/catalog/VendorDetailScreen.tsx` | `{ storeId; app: 'FA_MART'\|'PHARMA'; initialQuery? }`. Single-store search page; paid `STORE_TOP` hero under the profile. **Distinct from the in-wrapper Mart drill-in** (`VendorProfileView`, §2.5) — both read `GET /stores/{id}/products` |
| RN14 | `MedicalShopDetails` | **MedicalShopDetailsScreen** | `src/features/pharma/MedicalShopDetailsScreen.tsx` | Pharma store profile + live `storeId` inventory + `UploadPrescriptionFAB`; paid `STORE_TOP` hero |
| RN15 | `DealsLanding` | **DealsLandingScreen** | `src/features/ecommerce/DealsLandingScreen.tsx` | Four modes: `campaign` (Home "Deals of the day" → anon `GET /home/campaigns/{id}`, fixture fallback), `discounts` (Mart vendor "View All", server pool), `martDeals`/`martEssentials` (Mart rail "View All", catalog-resolved `productIds`). Paid `SECTOR_RAIL` header shelf |
| RN16 | `PrescriptionFlow` | **PrescriptionFlowScreen** | `src/features/pharma/prescription/PrescriptionFlowScreen.tsx` | `{ presetVendorId? }`. CAPTURE→NOTE→VENDORS→CONFIRMED; `presetVendorId` skips vendor selection |
| RN17 | `You` | **YouScreen** → `AccountView` | `src/features/profile/YouScreen.tsx` | Pushed from any app; back returns |
| RN18 | `UserDetails` | **UserDetailsScreen** | `src/features/profile/UserDetailsScreen.tsx` | Personal info / preferences / security |
| RN19 | `SavedAddresses` | **SavedAddressesScreen** | `src/features/profile/SavedAddressesScreen.tsx` | Add/edit/delete via `PUT/DELETE /profile/addresses` |
| RN20 | `MyOrders` | **MyOrdersScreen** | `src/features/profile/MyOrdersScreen.tsx` | `{ initialTab?; highlightOrderId? }`; `ordersStore` merged over `@data`; prescription cards |
| RN21 | `OrderDetails` | **OrderDetailsScreen** | `src/features/profile/OrderDetailsScreen.tsx` | `{ orderId }`; resolves `ordersStore` → `@data`; pickup card + rate card |
| RN22 | `Favourites` | **FavouritesScreen** → `FavouritesPageView` | `src/features/favourites/FavouritesScreen.tsx` | Search-results-style; `useFavoriteStore` |
| RN24 | `RateVendor` | **RateVendorScreen** | `src/features/profile/RateVendorScreen.tsx` | `{ vendorId; vendorName? }`; verified buyers only, gate re-checked |
| RN25 | `FaazioRewards` | **FaazioRewardsScreen** | `src/features/rewards/FaazioRewardsScreen.tsx` | Device-local coins + streak |
| RN26 | `SellWithUs` | **SellerRegistrationScreen** | `src/features/seller-onboarding/SellerRegistrationScreen.tsx` | Partner onboarding → `POST /sellers` |
| RN32 | `SellerRequests` | **SellerRequestsScreen** | `src/features/seller-onboarding/SellerRequestsScreen.tsx` | Admin application queue (role-gated); routes off the Account "Seller applications" card |
| RN33 | `SellerRequestDetail` | **SellerRequestDetailScreen** | `src/features/seller-onboarding/SellerRequestDetailScreen.tsx` | `{ sellerId }`; KYC doc view via presigned GET, platform-fee editor, verify/activate, reject |

### 2.4 Sub-app shell (`SubAppWrapper` — MART + PHARMA)

| # | Screen | File | Notes |
| --- | --- | --- | --- |
| RN27 | **SubAppScreen** | `src/features/sub-app/SubAppScreen.tsx` | Route `SubApp`; hosts `SubAppWrapper` |
| RN28 | **SubAppWrapper** | `src/components/SubAppWrapper.tsx` | Unified header + tab bar + scoped error boundary. Presets: `FA_MART` (Home/Search/You/Cart), `PHARMA` (Home/Search/Cart/History/Donor). FOOD is not rendered here |
| RN29 | Mart inline category grid | `src/components/SubAppWrapper.tsx` | Mart tab body (header category rail) |
| RN30 | Pharma inline Search / History | `src/components/SubAppWrapper.tsx` | Pharma search grid + recent-order History tab |
| RN31 | Blood Donor tab | `src/features/pharma/blood-donor/BloodDonorScreen.tsx` | Pharma "Donor" tab / root `BloodDonor` route |

### 2.5 Sub-app: MART (`FaMartScreen.tsx`)

`FaMartScreen` has three modes: **feed**, **search** (`gateway.searchProducts(q,'MART')`, 2-col grid),
and **in-place vendor drill-in** (`VendorProfileView` when `vendor != null`).

Feed order and paid/organic classification:

| # | Section | Component | Kind | Placement / fallback |
| --- | --- | --- | --- | --- |
| M1 | Hero carousel (top) | `CampaignHero` (`components/shared`) | **PAID** | `MART_HERO`; fallback = `martHero.banners` via `MartHouseHero` (non-interactive, no AD pill/events) |
| M2 | Sponsored picks shelf | `SponsoredRail` (`components/shared`, `MartProductCard variant="rail" showAdLabel`) | **PAID** | `SPONSORED_SHOWCASE`; empty/offline/error → `null` |
| M3 | Deals of the Day rail | `DealsOfDayRail` | Organic offer | SDUI `martDeals.productIds`; money server-joined |
| M4 | Daily Essentials rail | `DailyEssentialsRail` | Organic offer | SDUI `martEssentials.productIds` |
| M5 | Local Vendors Near You (footer) | `LocalVendorRail` | Organic directory | `gateway.getStores('MART')` |

Vendor drill-in (`VendorProfileView`, in-wrapper): All Products grid + **unlabelled** "Discounted
Products" rail (`isDiscounted`), "View All" → `DealsLanding{mode:'discounts'}`. Organic — only paid
surfaces carry the AD pill.

Rail "View All" → `DealsLanding{mode:'martDeals'|'martEssentials'}`; both grids resolve `productIds`
through `getProductsByIds` (no Home-owned fixture) and carry a paid `SECTOR_RAIL` header shelf.

The feed's paid/organic order is codified in
`src/features/ecommerce/services/martFeedSections.ts` (`MART_FEED_SECTIONS`, consumed by
`FaMartScreen`); see `docs/architecture/mobile-app.md` for the resilience/price-batch invariants.

### 2.6 Sub-app: FOOD (`FoodStack.tsx` — bypasses `SubAppWrapper`)

| # | Route | Screen | File |
| --- | --- | --- | --- |
| F1 | `FoodHome` | **FoodHomeScreen** | `src/features/food/screens/FoodHomeScreen.tsx` |
| F2 | `Search` | **FoodSearchScreen** | `src/features/food/screens/FoodSearchScreen.tsx` |
| F3 | `RestaurantProfile` | **RestaurantProfileScreen** | `src/features/food/screens/RestaurantProfileScreen.tsx` |
| F4 | `RestaurantOffers` | **RestaurantOffersScreen** | `src/features/food/screens/RestaurantOffersScreen.tsx` |
| F5 | `RestaurantMenu` | **RestaurantMenuScreen** | `src/features/food/screens/RestaurantMenuScreen.tsx` |

`FoodHome` = `FOOD_HERO` (paid, SDUI `foodHero` house fallback) + Top Rated + Today's Special +
"What's on your mind?" + Snacks & Beverages order rails + Restaurants grid. Food cart is
restaurant-scoped (one common cart, isolated by ownership) + Food `RateVendor`.

Feed order and paid/organic classification:

| # | Section | Component | Kind | Placement / fallback |
| --- | --- | --- | --- | --- |
| Fd1 | Hero carousel (top) | `CampaignHero` (`components/shared`) | **PAID** | `FOOD_HERO` (venue/product target); fallback = `foodHero.banners` via `FoodHouseHero` (non-interactive) |
| Fd2 | Top Rated carousel | `TopRestaurantCarousel` | Organic directory | `TOP_RATED_RESTAURANTS` ordered by SDUI `mostRatedDining.storeIds` (restaurant `tr-*` ids) |
| Fd3 | Today's Special rail | `FeaturedDishCarousel` | Organic offer | SDUI `foodSpecials.productIds`; `TODAYS_SPECIALS` fallback (fixture) |
| Fd4 | What's on your mind? | `MindGridRail` | Organic category | Fixture-owned (not server-driven) |
| Fd5 | Snacks & Beverages rail | `SnacksRail` | Organic offer | Fixture-owned (not server-driven) |
| Fd6 | Restaurants grid | `RestaurantGrid` | Organic directory | `gateway.fetchVenues('FOOD')` (server-only) merged with the `@data` venue fixture; authoritative empty → honest empty state (never stale fixture) |
| Fd7 | Restaurant-profile hero | `CampaignHero` (`components/shared`) | **PAID** | `STORE_TOP` scoped to the venue's `storeId`; whole band drops when no LIVE fill |
| Fd8 | Restaurant-profile offer slot | inline banner | Organic offer | live coupon `useBestCoupon('FOOD')` → tap opens cart; decorative `offerTag` fallback |

Rail "View All" → shared `RestaurantOffers` / `DealsLanding`; profile dish rows are the shared
`MenuItemRow`. The profile diet toggle is a **screen-local override** seeded once from
`foodFilterStore` and never written back (`dietFilter.ts` semantics). `FoodStack` "bypasses
`SubAppWrapper`" and escapes to **root** routes for PDP (`ProductDetail`), scoped `Cart`,
`RateVendor`. Restaurant-isolated cart + shared Food routes live in
`docs/architecture/mobile-app.md` (§ Food) and are linked from `FoodStack.tsx`.

### 2.7 Sub-app: PHARMA

`PharmaScreen` home = `PHARMA_HERO` (paid) + `PharmaHeroBanner` + QuickReorder + TopOffers +
PopularMedicines + HealthEssentials + FeaturedBrands + HealthCorner + LocalMedicals +
`UploadPrescriptionFAB`. Search / category-products / in-screen product detail are local states.
Pharma `RateVendor` shares the root route.

**Feed section order + kind** (mirrors the render order in `PharmaScreen.feedView`; only the top item
carries a paid placement — Pharma has no `SponsoredRail`/`SECTOR_RAIL`/`SPONSORED_SHOWCASE`):

| # | Section | Kind | Placement / source | GatewayClient |
| --- | --- | --- | --- | --- |
| PH1 | `CampaignHero` | **PAID** | `PHARMA_HERO` + `app='PHARMA'` | `getHeroAds('PHARMA_HERO',{app:'PHARMA'})` + `recordAdEvent` |
| PH2 | `PharmaHeroBanner` | ORGANIC (SDUI house) | `pharmaHero.banners` | `fetchPharmaSections` → `GET /sdui/pharma` |

> **PH2 honesty:** the hero's coupon pill renders **only** when `feed.heroCouponCode` resolves — the
> **first Top Offer's** code (the editorial fixture in mock, the top server-honoured `GET /coupons?app=PHARMA`
> code when online), else `null`; the old hardcoded "UP TO 50% OFF" badge was removed so the banner
> never advertises a code the rail below doesn't show or checkout can't settle.
| PH3 | Quick Reorder | ORGANIC (catalog) | real `ph-*` ids | `getProductsByIds` (+ discounts) |
| PH4 | Top Offers | ORGANIC (coupons) | live `GET /coupons?app=PHARMA` codes | `getCoupons('PHARMA')` |
| PH5 | Popular Medicines | ORGANIC (SDUI + discount overlay) | `pharmaPopular` | `fetchPharmaSections` + `getActiveDiscounts` |
| PH6 | Health Essentials | ORGANIC (SDUI) | `pharmaEssentials` | `fetchPharmaSections` |
| PH7 | Featured Brands | STATIC-EDITORIAL (`pfb-*`, no server owner) | fixture | — |
| PH8 | Health Corner | STATIC-EDITORIAL (`phc-*`, no server owner) | fixture | — |
| PH9 | Local Medicals | ORGANIC DIRECTORY | `directory.stores` app=PHARMA | `fetchStores('PHARMA')` |
| PH10 | `UploadPrescriptionFAB` | surface | — | — |

**In-wrapper states** (local to `PharmaScreen`, no route): header search results (`searchProducts`
+ `withActiveDiscounts`), `CATEGORY_PRODUCTS` grid, in-screen `PRODUCT_DETAIL` (both overlay
`useActiveDiscounts` for price parity with checkout settlement), History tab (real `useOrdersStore`
orders, `PHARMA_RECENT_ORDERS` fallback in mock only), Donor tab (embedded `DonorDashboard`).
View-all chevrons are hidden because Pharma has no rail landing page. PH7 Featured Brands and PH8
Health Corner are intentionally **STATIC-EDITORIAL** fixtures — the portal SDUI editor cannot author
new sections, so promoting them to server-owned layouts is deferred (see PENDING_WORK).

| # | Route / surface | Screen | File |
| --- | --- | --- | --- |
| P1 | `MedicalShopDetails` (`{ storeId }`) | **MedicalShopDetailsScreen** — `STORE_TOP` paid host + `useVendorProducts` inventory | `src/features/pharma/MedicalShopDetailsScreen.tsx` |
| P2 | `PrescriptionFlow` (`{ presetVendorId? }`) | **PrescriptionFlowScreen** — CAPTURE→NOTE→VENDORS→CONFIRMED | `src/features/pharma/prescription/PrescriptionFlowScreen.tsx` |
| P3 | `BloodDonor` | **BloodDonorScreen** — 5-step wizard / embedded dashboard | `src/features/pharma/blood-donor/BloodDonorScreen.tsx` |
| P4 | `BloodDonorDetails` (`{ donorId; requestCity; bloodGroup; source? }`) | **DonorDetailsScreen** | `src/features/pharma/blood-donor/DonorDetailsScreen.tsx` |
| P5 | `BloodRequestDescription` (`{ requestId; source? }`) | **BloodRequestDescriptionScreen** — a cold deep link (no `source`) waits for the live board before deciding the request is missing, so a fixture id never renders as a server row | `src/features/pharma/blood-donor/BloodRequestDescriptionScreen.tsx` |
| P6 | History tab | inline in `PharmaScreen` | recently ordered |
| P7 | in-wrapper Search tab → `Search { subApp:'PHARMA' }` | **SearchRouteScreen** | `src/features/search/SearchRouteScreen.tsx` |
| P8 | in-wrapper Cart tab → `Cart` | **CartScreen** | `src/features/cart/CartScreen.tsx` |
| P9 | product tap → `ProductDetail` | **ProductDetailScreen** | `src/features/product/ProductDetailScreen.tsx` |
| P10 | `RateVendor` (`{ vendorId; vendorName? }`) | **RateVendorScreen** | `src/features/profile/RateVendorScreen.tsx` |
| P11 | `MyOrders` / `OrderDetails` (prescription kind) | **MyOrdersScreen** / **OrderDetailsScreen** | `src/features/profile/` |

Pharma's home rails are **server-backed (W50)** (`src/features/pharma/services/pharmaService.ts`):
stores use `getStores('PHARMA')` and the "Popular Medicines"/"Health Essentials" rails + house hero
read the Pharma-only `GET /sdui/pharma` projection (allowlist `pharmaHero`/`pharmaPopular`/
`pharmaEssentials`, joined to the catalog), with the `@data`/feature fixtures as the offline
fallback. The section ids reference real, non-Rx `ph-*` catalog rows — see
`docs/architecture/mobile-app.md` and `PENDING_WORK.md` W50. The paid hosts on shared routes are
`CATEGORY_TOP` (`CategoryDrillInPanel`, app=`PHARMA`) and `STORE_TOP` (`VendorDetailScreen` +
`MedicalShopDetailsScreen`).

### 2.8 Web portal pages

The seller/state/super consoles are categorised in
`docs/architecture/web-portal.md` → "Routing contract" (full `app/**` list grouped by console +
sector). They are where paid ads, organic offers, SDUI layouts and all seller data are authored.

---

## Section 3: Vite ↔ React Native Mapping

### 3.1 Screens Present in Both

| Vite Screen | RN Screen | Notes |
|-------------|-----------|-------|
| O1–O4: Onboarding Slides (4) | RN1: OnboardingScreen | ✅ RN has 5 slides (4 matching + blood-donation finale) |
| O5: Login Phone Entry | RN2: LoginScreen | ✅ RN merges phone + OTP into one file |
| O6: OTP Verification | RN2: LoginScreen | ✅ Same file |
| O7: Loading Spinner | RN2: LoginScreen | ✅ RN dropped the "All-Done" phase: login awaits persistence then `replace`s to `LanguageSelection` |
| O8: Location Request | RN3: LocationScreen | ✅ Single file with step state |
| O9: Manual Location | RN3: LocationScreen | ✅ Same file |
| O10: Map Loader | RN3: LocationScreen | ✅ Simplified in RN, no SVG map animation |
| D1: Dashboard Shell | RN4: MainDashboardScreen | ✅ Both have header + bottom tabs |
| D2: Home Tab | RN5: HomeView | ✅ Same component |
| D3: Categories Tab | RN6: CategoriesView | ✅ Same component |
| D4: Favourites Tab | RN7: FavouritesView | ✅ Same component |
| D5: Cart Tab | RN9: CartView | ✅ Same component |
| D6: Account Tab | RN8: AccountView | ✅ Same component |
| S0: Sub-App Shell | RN10: SubAppWrapper | ✅ Same component |
| F01: Food Order Mode | RN11: FoodScreen | ✅ |
| M01: Mart Home | RN16: FaMartScreen | ✅ |
| G01: Grocery Home | RN18: GroceryScreen | 🗑️ Removed — Grocery merged into Mart (surfaces under RN16 FaMartScreen) |
| P01: Pharma Home | RN20: PharmaScreen | ✅ |
| X02: Exit Confirmation | RN10: SubAppWrapper | ✅ Built into SubAppWrapper |

### 3.2 Vite Screens MISSING from RN

| Vite Screen | Why Missing | Priority to Port |
|-------------|-------------|-----------------|
| **Food — Store Profile / Restaurant Detail** (F02) | RN FoodScreen has no store profile view | High |
| **Food — Restaurant Directory** (F03) | RN has no directory/filter bar | High |
| ~~**Food — Table Reservation Form** (F05)~~ | 🗑️ Removed — no table-booking feature exists | — |
| ~~**Food — "My Bookings" tab** (F07)~~ | 🗑️ Removed — no booking feature exists | — |
| **Food Menu View** (F06) | RN has only empty-state placeholder | Medium |
| **Mart — Store Profile** (M02) | RN FaMartScreen has no store profile | High |
| **Mart — "Offers" tab** (M04) | RN SubAppWrapper has no Offers tab | Low |
| **Grocery — "Fresh Club" tab** (G03) | Grocery sub-app removed (merged into Mart); Fresh Club no longer applicable | Removed |
| **Pharma — "For You" tab** (P05) | Replaced by the **Donor** tab (registration wizard + dashboard) | Shipped |
| **Pharma — "History" tab** (P06) | Shipped — `PharmaScreen.tsx` `activeTab='History'` | Shipped |
| **Pharma — All Categories Grid** (P02) | Category taps route to server search / `CategoryDrillIn` (app=`PHARMA`) | Shipped |
| **Pharma — Category Products** (P03) | Shipped inline (`PharmaScreen.tsx` `CATEGORY_PRODUCTS`, real `ph-*` ids) | Shipped |
| **Pharma — Product Detail (inline)** (P04) | Shipped inline + shared `ProductDetail` route | Shipped |
| **Cart — Step 2: Address** (CA2) | RN CartView missing address step | High |
| **Cart — Step 3: Payment** (CA3) | RN CartView missing payment step | High |
| **Cart — Step 4: Receipt** (CA4) | RN CartView missing receipt/confirmation step | High |
| **Product Detail Modal** (X01 / PD1–PD10) | RN ProductDetailView exists but is NOT rendered | High |
| **Sub-App — "Profile" tab** (F08) | RN uses AccountView instead | Low |

### 3.3 RN Orphan Screens (Not in Vite)

| RN File | Description | Action |
|---------|-------------|--------|
| ~~`features/home/HomeScreen.tsx`~~ | Alternative home view | 🗑️ Deleted |
| ~~`features/profile/ProfileScreen.tsx`~~ | Alternative profile UI | 🗑️ Deleted |
| ~~`features/ecommerce/EcommerceScreen.tsx`~~ | Standalone e-commerce catalog | 🗑️ Deleted |
| `components/ProductDetailView.tsx` | Full product detail — now rendered via `selectedProduct` state overlay | ✅ Wired (Page 16) |

### 3.4 Placeholder/Virtual Pages in RN

These tabs render with empty-state messages:

| Tab | File | Message Displayed |
|-----|------|-------------------|
| Food → Menu | `SubAppWrapper.tsx` | Gourmet menus load from the server (`getMenu`); no placeholder. |
| Pharma → History | `PharmaScreen.tsx` (`activeTab='History'`) | Recently ordered list (`PHARMA_RECENT_ORDERS`). |
| Pharma → Donor | `BloodDonorScreen` / `DonorDashboard` | Replaced the old "For You" placeholder. |

---

## Section 4: Quick Reference — File Index

### Vite Web App Files

| File | Pages/Screens |
|------|---------------|
| `src/App.tsx` | Onboarding (5 slides), Login (phone + OTP + spinner), Location (request + manual + map loader), Dashboard shell, Product Detail overlay |
| `src/components/HomeView.tsx` | Home tab (13 carousel/section blocks) |
| `src/components/CategoriesView.tsx` | Categories tab (filter pills, search, category grid, product grid) |
| `src/components/FavouritesView.tsx` | Favourites tab (per-sector grids, empty state) |
| `src/components/CartView.tsx` | Cart tab (4-step checkout) |
| `src/components/AccountView.tsx` | Account tab (profile, orders, settings, logout) |
| `src/components/SubAppWrapper.tsx` | Sub-app shell, exit modal, Food tab (Profile only — My Bookings removed, no booking feature), Mart tabs (Categories, Offers) — Grocery config preset removed (Grocery merged into Mart) |
| `src/components/ProductDetailView.tsx` | Product detail modal (hero, specs, reviews, add-to-cart) |
| `src/components/FoodPage.tsx` | Food Order mode, Store Profile (legacy Vite audit; no booking mode/reservation form) |
| `src/components/FoodMenuView.tsx` | Full food menu (category tabs, search, 2-column grid) |
| `src/components/FaMartPage.tsx` | Mart Home, Mart Store Profile |
| `src/components/GroceryPage.tsx` | ~~Grocery Home~~ — deleted/nonexistent (Grocery merged into Mart) |
| `src/components/PharmaPage.tsx` | Pharma Home, For You, History (including inline product detail) |
| `src/components/EnterpriseIcon.tsx` | Utility component — sector-specific colored icons | — |

### React Native App Files

| File | Pages/Screens | Status |
|------|---------------|--------|
| `App.tsx` | Root — NavigationContainer + StatusBar hidden (edge-to-edge) | ✅ Active |
| `src/navigation/AppNavigator.tsx` | Stack navigator: Onboarding, Login, Location, MainTabs | ✅ Active |
| `src/features/onboarding/OnboardingScreen.tsx` | 5-slide onboarding (blood-donation finale) | ✅ Active |
| `src/features/auth/LoginScreen.tsx` | Phone input + OTP (auto-submit state machine + Verify CTA, awaited login → `LanguageSelection`) | ✅ Active |
| `src/features/auth/LocationScreen.tsx` | 3-step: request / manual / loader | ✅ Active |
| `src/features/home/MainDashboardScreen.tsx` | Dashboard shell + hub tabs + SubAppWrapper | ✅ Active |
| `src/features/home/HomeScreen.tsx` | Alternative home view (orphan) | ❌ Unused |
| `src/features/profile/ProfileScreen.tsx` | Alternative profile (orphan) | ❌ Unused |
| `src/features/ecommerce/EcommerceScreen.tsx` | Standalone e-commerce (orphan) | ❌ Unused |
| `src/features/ecommerce/FaMartScreen.tsx` | Mart Home | ✅ Active |
| `src/features/ecommerce/GroceryScreen.tsx` | ~~Grocery Home~~ — deleted (Grocery merged into Mart) | 🗑️ Removed |
| `src/features/food/screens/FoodHomeScreen.tsx` | Food Home (order + restaurants) | ✅ Active |
| `src/features/pharma/PharmaScreen.tsx` | Pharma Home | ✅ Active |
| `src/components/HomeView.tsx` | Hub Home tab | ✅ Active |
| `src/components/CategoriesView.tsx` | Hub Categories tab | ✅ Active |
| `src/components/FavouritesView.tsx` | Hub Favourites tab | ✅ Active |
| `src/components/CartView.tsx` | Hub/Sub-app Cart tab | ✅ Active |
| `src/components/AccountView.tsx` | Hub/Sub-app Account tab | ✅ Active |
| `src/components/SubAppWrapper.tsx` | Sub-app shell + inline tabs | ✅ Active |
| `src/components/ProductDetailView.tsx` | Product detail modal (unwired) | ❌ Unused |
| `src/features/cart/CartScreen.tsx` | Central "Your Cart" checkout (wraps CartView) | ✅ Active |
| `src/features/cart/payment/PaymentOptionsScreen.tsx` | Payment picker (preferred card/UPI/cards/more; Swiggy-Money promo removed) | ✅ Active |
| `src/features/profile/MyOrdersScreen.tsx` | My Orders (sub-app rail + status filter + fulfillment chip; eligibility-gated **Rate** CTA per card) | ✅ Active |
| `src/features/profile/OrderDetailsScreen.tsx` | Per-order details (status/item/meta + "Rate your purchase" + View Product) | ✅ Active |
| `src/features/profile/RateVendorScreen.tsx` | Rate Vendor form (stars + ≤280-char comment; verified buyers only) | ✅ Active |
| `src/services/vendorRatings.ts` | Vendor rating seam (single owner of the derived gate + reviews merge) | ✅ Active |
| `src/state/vendorRatingStore.ts` | Persisted user vendor ratings (`faazio/vendor-ratings/v1`, reset on logout) | ✅ Active |
| `src/components/shared/VendorReviewsSection.tsx` | Reusable vendor reviews block (summary + rate CTA + public list) | ✅ Active |
| `src/components/shared/StarRatingInput.tsx` / `VendorRatingSummaryBar.tsx` / `VendorRateButton.tsx` | Rating input, aggregate bar, eligibility-gated rate CTA | ✅ Active |
| `src/features/catalog/CategoryDrillInScreen.tsx` | Category drill-in (subgroup rail + vendor sections + inline search) | ✅ Active |
| `src/features/catalog/VendorDetailScreen.tsx` | Single-store search (back + inline searchbar + product rows) | ✅ Active |
| `src/services/categoryVendors.ts` | Vendor-grouping + store-ad seam for the category drill-in / vendor details | ✅ Active |
| `src/features/ecommerce/DealsLandingScreen.tsx` | Shared deals page (`campaign` / `discounts` modes) | ✅ Active |
| `src/features/home/cards/AdProductCard.tsx` | Minimal ad product card (big square image + 'AD' pill, 2-line title, MRP + bold price) | ✅ Active |
| `src/features/home/cards/BrandCampaignCard.tsx` | Vendor campaign card (vendor title + "Up to X% off" label + 2 ad product cards) | ✅ Active |
| `src/features/product/CommonProductDetailView.tsx` | Shared product detail view (MART store section + related products + View Vendor) | ✅ Active |
| `src/navigation/FoodStack.tsx` | Nested food stack (incl. RestaurantProfile) | ✅ Active |
| `src/features/ecommerce/components/vendor/VendorProfileView.tsx` | Mart vendor drill-in ("Discounted Products" rail shows the shared 'AD' pill via `showAdLabel`; "All Products" grid unlabelled) | ✅ Active |
| `src/features/pharma/blood-donor/components/AskBloodSheet.tsx` | "Ask Blood" form sheet (blood group, units, hospital, city, contact, deadline, note → `bloodDonorStore.postAskRequest`) | ✅ Active |
| `src/features/pharma/blood-donor/components/UserBloodRequestCard.tsx` | Non-navigating feed card for a user "Ask Blood" request ("Your Request" chip) | ✅ Active |
| `src/components/FaazioLogo.tsx` | Brand logo component (shared); `variant="default"` vector badge (Home/Splash) + `variant="welcome"` wordmark (`logo-welcomepage.png`) for the onboarding header | ✅ Active |

---

## Section 5: Page Alignment Status

### Page 1 — Onboarding (RN → Vite Visual Alignment)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Replace plain text "Faazio" with FaazioLogo SVG | `src/components/FaazioLogo.tsx` (new) + `OnboardingScreen.tsx` | ✅ Done | SVG brand logo with blue gradient rect — exact match to Vite |
| 2 | Add slide-in animations (translate ±120px + opacity) | `OnboardingScreen.tsx` | ✅ Done | Animated API, 220ms ease-out, direction-aware |
| 3 | Fix accent colors to brand blue (#2c56f6) | `OnboardingScreen.tsx` | ✅ Done | Next button, active dot, subtitle, underline all use BRAND_BLUE |
| 4 | Add ChevronLeft/ChevronRight icons to buttons | `OnboardingScreen.tsx` | ✅ Done | ChevronLeft on Back, ChevronRight on Next/Get Started |
| 5 | Remove illustration background wrapper | `OnboardingScreen.tsx` | ✅ Done | Image now renders directly on white bg (no rounded colored container) |
| 6 | Fix Skip button to semi-transparent white | `OnboardingScreen.tsx` | ✅ Done | `rgba(255,255,255,0.8)` bg instead of solid gray |
| 7 | Fix Back button to semi-transparent + ChevronLeft icon | `OnboardingScreen.tsx` | ✅ Done | `rgba(226,232,240,0.8)` bg with icon |
| 8 | Add footer border-top divider | `OnboardingScreen.tsx` | ✅ Done | `borderTopWidth: 1, borderColor: rgba(226,232,240,0.5)` |
| 9 | Adjust dot sizes to match Vite (active 20×6, inactive 6×6) | `OnboardingScreen.tsx` | ✅ Done | |
| 10 | Per-step entry spring animations (scale/rotate/translate) | `OnboardingScreen.tsx` | ✅ Done | Springs match Vite's per-step visual effects |
| 11 | Swap header to badge-less welcome wordmark | `FaazioLogo.tsx` + `OnboardingScreen.tsx` | ✅ Done | `variant="welcome"` (829×227 content in a 855×292 canvas); `size` matches visible glyph height so optical weight is unchanged; source SVG kept at `assets/brand/` |

**Final Verdict:** Onboarding (Page 1) is now visually aligned with the Vite web app.

### Page 2 — Edge-to-Edge Fullscreen (Status Bar Hidden)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Remove `SafeAreaProvider` from root | `App.tsx` | ✅ Done | Replaced with plain `<View>` container |
| 2 | Hide StatusBar globally | `App.tsx` | ✅ Done | `<StatusBar hidden={true} />` |
| 3 | Replace `SafeAreaView` → `View` in OnboardingScreen | `OnboardingScreen.tsx` | ✅ Done | |
| 4 | Replace `SafeAreaView` → `View` in LocationScreen | `LocationScreen.tsx` | ✅ Done | |
| 5 | Replace `SafeAreaView` → `View` in MainDashboardScreen | `MainDashboardScreen.tsx` | ✅ Done | |
| 6 | Replace `SafeAreaView` → `View` in HomeScreen (orphan) | `HomeScreen.tsx` | ✅ Done | |
| 7 | Replace `SafeAreaView` → `View` in ProfileScreen (orphan) | `ProfileScreen.tsx` | ✅ Done | |
| 8 | Replace `SafeAreaView` → `View` in EcommerceScreen (orphan) | `EcommerceScreen.tsx` | ✅ Done | |
| 9 | Remove `react-native-safe-area-context` import | `App.tsx` | ✅ Done | No files reference this package anymore |
| 10 | Verify TypeScript compiles | — | ✅ Done | Clean compile, no errors |

**Result:** Status bar (time, battery, notifications) is now hidden on both iOS and Android. The app fills 100% of the screen edge-to-edge with no artificial safe-area gaps.

### Page 3 — Login Flow (Phone → OTP → Choose Language)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | `BrandGradient` helper: Svg `<Rect>` + `<LinearGradient>` `#2c56f6→#122bb3`; vertical for phone sheet, diagonal for OTP bg | `LoginScreen.tsx` | ✅ Done | `react-native-svg`, absolute-fill layer |
| 2 | Screen fade transitions: phone→OTP, →all-done (opacity 0→1 350ms easeInOut) | `LoginScreen.tsx` | ✅ Done | `Animated.timing` opacity on state swap via `fadeAnim` + `allDoneFade` |
| 3 | Keyboard morph animation (300ms): hero height 45%↔20%, sheet paddings, "Explore" font 42↔28px, OTP dome `top` offsets | `LoginScreen.tsx` | ✅ Done | `LayoutAnimation.configureNext({duration:300})` in keyboard listeners |
| 4 | Digit pop-in: scale 0.8→1 + opacity 0→1, spring overshoot (friction 6, tension 120) | `LoginScreen.tsx` | ✅ Done | Per-digit `Animated.spring` via `digitAnims` ref array, triggers on `otpCode` growth |
| 5 | Active track pulse: opacity loop 1↔0.4 over 1.6s cycle | `LoginScreen.tsx` | ✅ Done | `Animated.loop(sequence)` applied to current segment track |
| 6 | Error shake: translateX 0→−5→5→−5→5→0, 5×80ms=400ms, applied to segments + error toast | `LoginScreen.tsx` | ✅ Done | `Animated.sequence` of 80ms timings, triggered via `useEffect` on `otpError` |
| 7 | Spin the "Sending OTP..." 14px ring | `LoginScreen.tsx` | ✅ Done | `RotatingSpinner` component, `Animated.loop` rotate 0→360°, native driver |
| 8 | Replace `ActivityIndicator` with 48px custom spinner: slate `#f1f5f9` full ring + blue `#2c56f6` top-arc rotating | `LoginScreen.tsx` | ✅ Done | Two stacked ring Views (`AllDoneSpinner`), animated rotate |
| 9 | Green focus ring on phone input (border `#41E68F` while focused) + back-button press scale 0.9 | `LoginScreen.tsx` | ✅ Done | `isPhoneFocused` state + `phoneInputRowFocused` style with green border/shadow; `ScalePressable` component (`Animated.spring`) |
| 10 | Effects pixel pass: filled-track blue glow + error-track rose glow + segment 300ms LayoutAnimation transitions; then `tsc` check + log catalog | `LoginScreen.tsx` + `PAGE_CATALOG.md` | ✅ Done | Shadows/glows on filled/error tracks + error toast; `tsc --noEmit` clean |
| 11 | OTP submit resilience: submit derives from `otpCode` (auto-fires at 6 digits) + always-present **Verify** CTA; `await login()` then `replace('LanguageSelection')`; `otpError` shake/toast now reachable; two-step back (keyboard → phone entry, number preserved) via chevron + hardware back | `LoginScreen.tsx`, `AppNavigator.tsx` | ✅ Done | Removed the "All-Done" phase; `LanguageSelection`/`Location` made eager (no navigator-wide `<Suspense>` swap mid-flow) |

**Final Verdict:** Login Flow (Page 3) is visually aligned with the Vite web app; the RN implementation uses an explicit OTP submit state machine (no "All-Done" spinner) and advances directly to Choose Language.

### Page 4 — Location Flow (Request → Manual Search → Map Loader)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | O8 bg gradient (`white → #FAF7FF → #EBE4FC`, 3-stop vertical) | `LocationScreen.tsx` | ✅ Done | `LocationBgGradient` component with SVG `LinearGradient` 3 stops |
| 2 | O8 entry animations: screen fade 0.4s + illustration `scale 0.95→1, y 10→0` | `LocationScreen.tsx` | ✅ Done | `Animated.parallel` with `Animated.timing` and `Animated.spring` on mount |
| 3 | O8 swap ChevronRight→`ArrowRight` size 11 on manual CTA; add press-scale 0.95 to Allow button | `LocationScreen.tsx` | ✅ Done | `ArrowRight` from lucide; `Pressable` `transform: scale(0.95)` on allow button |
| 4 | O9 slide-in transition (`opacity + translateX 20→0`, 300ms) on step change | `LocationScreen.tsx` | ✅ Done | `Animated.timing` keyed on `step` with `slideAnim` interpolation |
| 5 | O9 search input focus state (border `#3D8CF2`, bg → white) | `LocationScreen.tsx` | ✅ Done | `isSearchFocused` state + `searchInputContainerFocused` style |
| 6 | O9 result-row press feedback (bg `#f1f5f9`) | `LocationScreen.tsx` | ✅ Done | `Pressable` style function: `backgroundColor: pressed ? '#f1f5f9' : 'transparent'` |
| 7 | O10 rebuild backdrop: delete GIF URL + overlay; port exact Vite SVG street map | `LocationScreen.tsx` | ✅ Done | `StreetMapSVG` component: `#FDFBF7` base, water/park paths, grid lines, curved avenues — all `react-native-svg` |
| 8 | O10 pulsing locator: 2 looping expand-fade rings (2.2s, 0.7s stagger) + green core | `LocationScreen.tsx` | ✅ Done | `PulsingLocator` component: two `Animated.loop`s with scale+opacity interpolations |
| 9 | O10 bouncing map-pin: black pin SVG + white/green circles, `translateY −14↔−28`, 1.6s easeInOut | `LocationScreen.tsx` | ✅ Done | `BouncingPin` component: SVG inside `Animated.View` with `Animated.sequence` loop |
| 10 | O10 replace card with Vite's "DELIVERING TO" card: uppercase label, pulsing green dot, address, entry `y 20→0` fade; `tsc` check + catalog update | `LocationScreen.tsx` + `PAGE_CATALOG.md` | ✅ Done | `deliveringCard` restyled with green dot + label; `Animated.timing` entry animation; `tsc --noEmit` clean |

**Final Verdict:** Location Flow (Page 4) is now visually and behaviorally aligned with the Vite web app.

### Page 5 — Dashboard Shell (MainDashboardScreen)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Gradient header: absolute overlay (`position:absolute`, zIndex:30), SVG 3-stop `#1162D3→#2F80ED→rgba(124,179,255,0.15)`, bottom radius 32, glow circles, shadow | `MainDashboardScreen.tsx` | ✅ Done | Absolute header; viewport has `paddingTop: vs(148)` for scroll-under |
| 2 | Header top row: hamburger, centered `FaazioLogo` pill + location selector, Bell with pulsing dot | `MainDashboardScreen.tsx` | ✅ Done | Bell pulse via `Animated.loop` opacity 1↔0.4 |
| 3 | In-header search bar: white rounded-full `TextInput` | `MainDashboardScreen.tsx` | ✅ Done | |
| 4 | Header collapse on scroll (`translateY: [0, -vs(52)]`, 300ms, hysteresis 40/10) | `MainDashboardScreen.tsx` | ✅ Done | Scroll-under works cleanly with absolute header |
| 5 | Liquid-glass tab bar: h-76, rounded top 30, 92% white, up-shadow | `MainDashboardScreen.tsx` | ✅ Done | |
| 6 | Active tab: per-tab colors, sliding droplet spring, glass capsule (4 label tabs only, droplet skips Cart) | `MainDashboardScreen.tsx` | ✅ Done | `dropletAnim` maps 4 label tab indices; droplet hidden on Cart |
| 7 | In-row raised Cart tab: `ms(64)` gold circle (SVG `#FFE066→#F2C94C→#F2994A`), 2px white border, `translateY: -vs(20)`, dark `ShoppingBag` + "CART" label, rose qty badge; corner FAB deleted | `MainDashboardScreen.tsx` | ✅ Done | Replaces old corner FAB; active state adds amber ring glow |
| 8 | Screen entrance: opacity 0→1 + translateY 10→0 (300ms) | `MainDashboardScreen.tsx` | ✅ Done | |
| 9 | `onScroll` prop on all 5 hub views → collapse driver | 5 hub view files | ✅ Done | |
| 10 | TypeScript validation | All files | ✅ Done | `npx tsc --noEmit` — 0 errors |

**Accepted delta:** no backdrop-blur (solid `rgba(255,255,255,0.92)` tab bar), no shared-element layout animation (translateX spring matches visually).

### Responsive Scaling Foundation

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | `src/utils/responsive.ts` with `hs`/`vs`/`ms`/`wp`/`hp` + `DOME_RADIUS` | `responsive.ts` | ✅ Done | Baseline 375×812; `Dimensions.get('screen')` |
| 2 | Phase A: `OnboardingScreen` — all pixel values to `hs`/`vs`/`ms` | `OnboardingScreen.tsx` | ✅ Done | |
| 3 | Phase A: `LocationScreen` — all values responsive | `LocationScreen.tsx` | ✅ Done | |
| 4 | Phase A: `LoginScreen` — interpolation math via `hp()`+`DOME_RADIUS`, styles scaled | `LoginScreen.tsx` | ✅ Done | Morph trajectories preserved |
| 5 | Phase B: `MainDashboardScreen` — built responsive from day one | `MainDashboardScreen.tsx` | ✅ Done | |
| 6 | Global validation | All files | ✅ Done | `npx tsc --noEmit` — 0 errors |

### Phase 1 — Page 5 Gap-Close

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1.1 | Header → absolute overlay (`position:absolute`, top/left/right:0, zIndex:30); viewport `paddingTop: vs(148)` | `MainDashboardScreen.tsx` | ✅ Done | Cards scroll under the rounded-bottom-32 gradient |
| 1.2 | Collapse fix: header is absolute, `-vs(52)` translateY collapses cleanly (no blank band) | `MainDashboardScreen.tsx` | ✅ Done | 300ms timing |
| 1.3 | In-row raised Cart: 5th tab slot → `ms(64)` gold circle (`#FFE066→#F2C94C→#F2994A`), `translateY: -vs(20)`, white border, dark icon+label, rose badge; corner FAB deleted | `MainDashboardScreen.tsx` | ✅ Done | |
| 1.4 | Droplet skips Cart: spring maps 4 label tab indices; droplet hidden when Cart active | `MainDashboardScreen.tsx` | ✅ Done | |
| 1.5 | Bell pulse: `Animated.loop` opacity 1↔0.4, 1s cycle | `MainDashboardScreen.tsx` | ✅ Done | |
| 1.6 | Validation + catalog | All files | ✅ Done | `npx tsc --noEmit` — 0 errors |

### Phase 2 — Home Tab Rebuild (HomeView.tsx)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Responsive conversion: local `Dimensions` removed, all styles → `hs`/`vs`/`ms` from `@/utils/responsive` | `HomeView.tsx` | ✅ Done | Single-pass conversion |
| 2 | Data reconciliation: replaced diverged arrays with Vite-exact data; added 6 new datasets (`popularDining`, `recentlyViewedMart`, `recentlyViewedGrocery`, `recentlyViewedPharma`, `faMartFinds`, `restaurantSpecials`) | `HomeView.tsx` | ✅ Done | Inline data, matches both apps' convention. Note: `recentlyViewedGrocery` has since been folded into `recentlyViewedMart`. |
| 3 | H2 Top Ad Carousel: 5s auto-rotate via `setInterval` (cleaned on unmount); video slide (index 0) → poster + Play overlay + "LIVE VIDEO CAM" badge + Zap pulse loop | `HomeView.tsx` | ✅ Done | |
| 4 | H4 Sponsored Showcase: video poster + Play overlay; `isMuted` toggle buttons (Volume2/VolumeX pill) | `HomeView.tsx` | ✅ Done | Ready for native player drop-in |
| 5 | H5 Recently Viewed: Add button swaps Plus→Check + emerald bg for 1.5s via `addedItemFeedback` | `HomeView.tsx` | ✅ Done | |
| 6 | H7 Recommended For You: horizontal carousel → 2-column grid; Sparkles slow-rotate loop on header | `HomeView.tsx` | ✅ Done | |
| 7 | EnterpriseIcon component: 25 emoji→lucide-icon registry, circle/flat/square variants, Tailwind→hex palette | `EnterpriseIcon.tsx` | ✅ Done | New file in `src/components/` |
| 8 | H8 Popular Dining: horizontal cards (h-128, gradient overlay, glass rating badge, heart FAB, footer) | `HomeView.tsx` | ✅ Done | Heart wired to `favoriteRestaurants` state |
| 9 | H9–H13: Recently Viewed Mart/Grocery/Pharma (EnterpriseIcon chips, sector dots), FA Mart Finds (blue tag, Discover pill), Restaurant Specials (amber Zap, Award bounce loop, Order Now btn) | `HomeView.tsx` | ✅ Done | Note: the Grocery rail has since been removed (grocery folded into the Mart rail). |
| 10 | Cleanup: deleted dead styles (~L917–1007 audit); Flame pulse on H6 header; `tsc --noEmit` | `HomeView.tsx` | ✅ Done | 0 errors |

### Page 7 — Categories Tab (CategoriesView.tsx)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Data fix: `exploreData.ts` L138 `" waffle"` → `🧇` | `exploreData.ts` | ✅ Done | Only divergence from Vite in otherwise byte-identical file |
| 2 | Responsive conversion: `Dimensions` removed, all styles → `hs`/`vs`/`ms` | `CategoriesView.tsx` | ✅ Done | |
| 3 | C1 pills: emoji → `EnterpriseIcon variant="flat"`, text uppercase + letterSpacing, active pill gets tinted shadow, badge fully rounded at `ms(8.5)` | `CategoriesView.tsx` | ✅ Done | |
| 4 | C2 search: `isFocused` state, focus border `#cbd5e1` + shadow, `fontSize: ms(10.5)`, icon via flex row (no absolute `top:13`) | `CategoriesView.tsx` | ✅ Done | |
| 5 | C3 category grid: bg `rgba(248,250,252,0.5)`, selected card → white + 2px ring + shadow + scale 1.03, emoji → `EnterpriseIcon variant="circle" 32px` | `CategoriesView.tsx` | ✅ Done | |
| 6 | C4 stack cards: `hs(165)` width, `ms(24)` radius, per-type SVG gradient bg, image `vs(112)`/`ms(16)` radius, EnterpriseIcon stamp, 2-line desc, `#FF4A6B` tint badge, Plus↔Check swap + pulse loop | `CategoriesView.tsx` | ✅ Done | |
| 7 | C5 product grid: image edge-to-edge `vs(128)` with card `overflow:hidden` `ms(24)` radius, content padded `vs(14/12)`, app badge 1px border, rating `ms(7.5)` amber, price `ms(10.5)`, Check swap | `CategoriesView.tsx` | ✅ Done | |
| 8 | C6 empty state: `#f8fafc` fill, `ms(28)` radius, dashed border, `vs(64)` py, 48px circular icon container with Search, "Let's try another one!" line appended | `CategoriesView.tsx` | ✅ Done | |
| 9 | Cleanup: removed unused `Star` + `Dimensions` + `SCREEN_WIDTH` + dead styles | `CategoriesView.tsx` | ✅ Done | |
| 10 | Gate: `tsc --noEmit` + catalog | All files | ✅ Done | 0 errors |

### Page 8 — Favourites Tab (FavouritesView.tsx)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Responsive conversion: `Dimensions` removed, all styles → `hs`/`vs`/`ms` | `FavouritesView.tsx` | ✅ Done | |
| 2 | F1 banner: SVG diagonal gradient `#4c0519→#0f172a→#172033`, 2 corner orbs (rose+blue rgba), `ms(26)` radius, `#1e293b` border, shadow | `FavouritesView.tsx` | ✅ Done | |
| 3 | F1 badge: fully rounded (`borderRadius: 999`), `ms(8)` font, letterSpacing 1, `hs(10)` pad; title letterSpacing -0.3 | `FavouritesView.tsx` | ✅ Done | |
| 4 | F2 sector headers: emoji → `EnterpriseIcon variant="flat" size={ms(11)}`; title `ms(11)` + letterSpacing 0.5 | `FavouritesView.tsx` | ✅ Done | |
| 5 | F3 card shell: wired `cardBg` tints, `ms(24)` radius, `hs(14)` grid gap | `FavouritesView.tsx` | ✅ Done | |
| 6 | F3 image: `vs(128)` height + bottom hairline; `ms(28)` heart circle with `hitSlop`; `ms(6)` rating radius; `EnterpriseIcon` overlay top-left with border+shadow | `FavouritesView.tsx` | ✅ Done | |
| 7 | F3 content: app badge +1px sector border + letterSpacing; name `ms(10)` `#020617`; desc `ms(8)` weight 600; footer hairline + `rgba(255,255,255,0.5)` bg; Check↔Plus swap, added bg `#059669` | `FavouritesView.tsx` | ✅ Done | |
| 8 | F4 empty state: `ms(32)` radius, `vs(64)` py; `ms(64)` rose circle with 2px `#fb7185` border; pulsing Heart via `Animated.loop`; title `ms(12)` + letterSpacing; desc `ms(10)` `#94a3b8` | `FavouritesView.tsx` | ✅ Done | |
| 9 | Cleanup: removed unused `Star`/`Dimensions`/`SCREEN_WIDTH`/desc fallback string | `FavouritesView.tsx` | ✅ Done | |
| 10 | Gate: `tsc --noEmit` + catalog | All files | ✅ Done | 0 errors |

### Page 9 — Cart Tab (CartView.tsx)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Responsive conversion: `Dimensions`/`SCREEN_WIDTH` removed, all styles → `hs`/`vs`/`ms` | `CartView.tsx` | ✅ Done | |
| 2 | `onScroll` + `scrollEventThrottle={16}` on the steps (BAG/PAYMENT/RECEIPT — the ADDRESS step was later removed) | `CartView.tsx` | ✅ Done | Was missing on PAYMENT + RECEIPT; header collapse now works mid-checkout |
| 3 | BAG empty state: icon `ms(56)`, inner-shadow approximation, `Animated.loop` bounce (translateY -6↔0, native driver); desc `maxWidth: hs(220)`; title `ms(12)`, desc `ms(9.5)`; Go-to-Hub padV `vs(10)`/padH `hs(20)`, label `ms(9)` + letterSpacing | `CartView.tsx` | ✅ Done | |
| 4 | BAG item rows: raw emoji → `<EnterpriseIcon variant="square" size={ms(34)}>` in bordered View; name `ms(11)`, price `ms(8)`; singular/plural count; items box bg `rgba(248,250,252,0.2)`; last row border removed; list `maxHeight: vs(260)`; qty btns `hitSlop` | `CartView.tsx` | ✅ Done | |
| 5 | BAG coupon + pricing: input height `Math.max(36, vs(36))`, focus border `#0f172a` via `isFocused`; applied discount gets `<Check size={ms(12)} strokeWidth={3}>`; free label → `"FREE (₹49 Saved)"` in `#56B821`; grand total `ms(12)`/`ms(14)` | `CartView.tsx` | ✅ Done | |
| 6 | Main CTA (all steps): height `Math.max(44, vs(44))`, radius `ms(16)`, bg `#020617`, shadow-lg, label `ms(12)` + letterSpacing, ArrowRight `strokeWidth={2.5}` | `CartView.tsx` | ✅ Done | |
| 7 | ADDRESS: selected card subtle shadow; ✓ marker `ms(16)` @ offset `hs(14)`; icon tile `ms(32)` radius `ms(12)`; dashed button 2px border; form/labels `ms()` pass | `CartView.tsx` | ✅ Done | **Removed 2026-09-16** — the ADDRESS step was deleted (fulfilment + live-location now on BAG) |
| 8 | PAYMENT: pay button green glow shadow `rgba(124,224,69,0.3)` when processing; Verified chip radius `ms(12)` bg `rgba(226,232,240,0.5)`; COD emoji `ms(20)`; method labels `ms(9)` + letterSpacing; SSL strip bg `rgba(236,253,245,0.5)` | `CartView.tsx` | ✅ Done | |
| 9 | RECEIPT: success disc `ms(48)` bg `#EBFBE5` + shadow, CheckCircle `strokeWidth={2.5}`; ETA pill `#EBFBE5`/`#56B821`; Truck `size={ms(10)}` + `Animated.loop` opacity pulse; tracking dots `ms(10)` both `#56B821` w/ 2px white border + emerald ring, second dot pulsing; receipt rows → `<EnterpriseIcon variant="flat" size={ms(10)}>`; list `maxHeight: vs(120)`; footer btns `Math.max(40, vs(40))`, Go-to-Hub shadow | `CartView.tsx` | ✅ Done | |
| 10 | Cleanup + gate: removed `Dimensions`/`SCREEN_WIDTH`; added `export { getAppLabel }`; `tsc --noEmit` | All files | ✅ Done | 0 errors |
| 11 | Delivery / Self Pickup toggle: `FulfillmentMode` state in `CartView`; segmented toggle on the **BAG** step (nothing selected by default → Proceed disabled until chosen); **ADDRESS step removed**; Delivery shows the **live GPS address** (`useLiveAddress`, saved-address fallback); `computeTotals` zeroes delivery fee for PICKUP; PaymentOptionsScreen/DeliveryInfoCard pickup variant; RECEIPT "Pickup From"; `MyOrder.fulfillment` drives My Orders Delivery/Self-Pickup chip | `CartView.tsx`, `utils.ts`, `payment/*`, `MyOrdersScreen.tsx`, `@data/*`, `src/hooks/useLiveAddress.ts` | ✅ Done | 0 errors (ts:check + check:boundaries) |
| 12 | Minimal My Orders cards → Order Details → View Product → Product Detail: order fixtures aligned to real products (`productId`); `getMyOrderById` + `getProductById` helpers; card reduced to date + status pill, one-line item, `View Details` now navigates; new `OrderDetailsScreen` (status/item/order-meta + View Product via `getProductById`, hidden on miss) | `MyOrdersScreen.tsx`, `OrderDetailsScreen.tsx`, `nav/types.ts`, `AppNavigator.tsx`, `data/account/orders.ts`, `data/catalog/products.ts`, `data/checkout/orders.ts` | ✅ Done | 0 errors (ts:check + check:boundaries) |
| 13 | Store-backed Self-Pickup (no more Faazio hub): `StoreProfile` gains `address`/`phone`/`hours`; all 15 MART/FOOD stores get pickup data; new GROCERY/PHARMA stores (`groceryStores`/`pharmaStores`); products linked to stores via `Product.storeId`; `getPickupPointsForItems` returns **one point per distinct store** (neutral hub fallback); `CartView` Self-Pickup lists derived points | `data/cart/pickup-resolver.ts`, `data/mart/stores.ts`, `data/food/stores.ts`, `data/grocery/stores.ts`, `data/pharma/stores.ts`, `data/directory/stores.ts`, `data/mart/products.ts`, `data/food/products.ts`, `data/types.ts`, `CartView.tsx` | ✅ Done | 0 errors (ts:check + check:boundaries). Note: `data/grocery/stores.ts` has since been deleted — grocery stores/products merged into `data/mart/stores.ts` (`app:'MART'`). |
| 14 | Food fulfilment UX: **Deliver/Self-Pickup toggle moved to the cart BAG step** (pickup-point radio cards + contact row render directly on BAG; ADDRESS step is delivery-only; Proceed to Pay skips straight to Payment for pickup; payment back → BAG). **Order Details "Pickup From" card** for `PICKUP` orders (via new `MyOrder.pickup` + 6 populated fixtures). **FOOD product-detail View Restaurant** (tappable store row + button → nested `FoodApp → RestaurantProfile` via new `getFoodRestaurantForProduct`) | `CartView.tsx`, `data/types.ts`, `data/account/orders.ts`, `OrderDetailsScreen.tsx`, `CommonProductDetailView.tsx`, `ProductDetailScreen.tsx`, `features/food/utils/restaurantForProduct.ts` | ✅ Done | 0 errors (ts:check + check:boundaries) |
| 15 | Kill add-mode popup + live-location delivery + vendor pickup addresses: `FoodAddModeSheet` deleted — all Food adds direct; `CartItem.fulfilment`/`CartFulfilment` removed; cart BAG = single Delivery/Self Pickup toggle (none chosen by default), **ADDRESS step removed entirely**; Delivery auto-fills live GPS (`useLiveAddress`, saved-address fallback); `PlacedOrder` gains `pickups` (all vendor points) + `location` (live fix); RECEIPT + **Order Details render one "Pickup From" card per vendor**; OrderDetails resolves via `ordersStore` first (fixes placed-order "not found") | `FoodAddModeSheet.tsx` (del), `CartView.tsx`, `utils.ts`, `cartStore.ts`, `ordersStore.ts`, `CommonProductDetailView.tsx`, `foodSearchConfig.tsx`, `SearchDishCard.tsx`, `RestaurantProfileScreen.tsx`, `RestaurantOffersScreen.tsx`, `FoodSearchScreen.tsx`, `OrderDetailsScreen.tsx`, `data/types.ts`, `data/home/seeds.ts`, `src/hooks/useLiveAddress.ts` | ✅ Done | 0 errors (ts:check + check:boundaries); `app.json` location text → needs native rebuild |
| 16 | Restaurant-isolated cart + profile UI: `CartItem.restaurantId?` + `addToCart(...,restaurantId?)` (adopts untagged line) + `clearRestaurantCart`; `Cart` params `{ restaurantId?, restaurantName? }` (all 7 sites pass `{}`/scope); `CartScreen` scope-filters + scope-aware `setCartItems`; `CartView` scoped title/Clear/trash/empty-state via optional props; `RestaurantProfileScreen` scoped footer count + − qty + stepper + full-width column menu search + white View Cart pill; `SearchDishCard.restaurantId` (offers tags adds) | `cartStore.ts`, `navigation/types.ts`, `CartScreen.tsx`, `CartView.tsx`, `RestaurantProfileScreen.tsx`, `SearchDishCard.tsx`, `RestaurantOffersScreen.tsx`, `FoodHomeScreen.tsx`, `FoodSearchScreen.tsx`, `FaMartScreen.tsx`, `SubAppScreen.tsx`, `ProductDetailScreen.tsx`, `MainTabs.tsx` | ✅ Done | 0 errors (ts:check + check:boundaries) |

**Accepted deltas:** no step fade-in entrance (instant swap; RN screen-level transition later if wanted); no hover states (`activeOpacity`); CSS spin → `ActivityIndicator`; inner shadow → light border + tint; active-scale → `activeOpacity 0.85`.

### Page 10 — Account Tab (AccountView.tsx)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Responsive conversion: `hs`/`vs`/`ms` imported; entire StyleSheet (L147–428) converted | `AccountView.tsx` | ✅ Done | Hairlines & shadow radii raw per convention; bottom padding `vs(64)` |
| 2 | Profile card: radius `ms(12)` (was 24); avatar `ms(64)` with SVG `#3b82f6→#4f46e5` gradient; initials `ms(20)`; name `ms(14)`; sub `ms(9)`; info boxes radius `ms(8)`, label `ms(7)`, value `ms(9)` `#1e293b` | `AccountView.tsx` | ✅ Done | Avatar pulse via `Animated.loop` on shadow opacity |
| 3 | Section header: `ms(10)` + `letterSpacing: 0.5` (was 9.5, no tracking) | `AccountView.tsx` | ✅ Done | |
| 4 | Active delivery banner: SVG `#2563eb→#4f46e5` gradient; radius `ms(12)` (was 20); icon circle `ms(40)` (was 32) + `Animated.loop` opacity pulse; badge `ms(7)` + letterSpacing; order id `ms(12)`; desc `ms(9)` `#dbeafe` | `AccountView.tsx` | ✅ Done | |
| 5 | Past orders: `app` field added to data (FOOD/MART); raw emoji square → `<EnterpriseIcon variant="circle" size={ms(32)}>` with sector `bgColor`; card radius `ms(12)` (was 16); status pill `#059669`/`#ecfdf5` (was `#16a34a`/`#f0fdf4`), drop uppercase; fonts `ms(8/10/8/10)` | `AccountView.tsx` | ✅ Done | |
| 6 | Settings group: radius `ms(12)` (was 20); icons `ms(13)` (were 14); labels `ms(10)`; badges pill radius 999; version `ms(8)` monospace | `AccountView.tsx` | ✅ Done | |
| 7 | Location row — dead tap fix: MainDashboardScreen L205 `setShowLocationRequestState={() => {}}` → `setShowLocationRequestState={() => navigation.navigate('Location')}` | `MainDashboardScreen.tsx` | ✅ Done | Now navigates to Location screen on tap |
| 8 | Logout button: height `Math.max(40, vs(40))` (was 38), radius `ms(12)` (was 16), label `ms(12)` + letterSpacing (was 10.5), border `rgba(254,205,211,0.5)` | `AccountView.tsx` | ✅ Done | |
| 9 | Vertical rhythm: uniform `vs(16)` gaps between all 4 sections (Vite space-y-4) | `AccountView.tsx` | ✅ Done | |
| 10 | Gate: `npx tsc --noEmit` | All files | ✅ Done | 0 errors |

**Accepted deltas:** animate-fade-in/animate-bounce-slow web CSS classes are undefined no-ops even in Vite → intentionally skipped; hover states → `activeOpacity`; press scale-95 → `activeOpacity 0.85`.

### Page 11 — SubAppWrapper Shell (SubAppWrapper.tsx)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Cleanup: removed `Image`, `Dimensions`/`SCREEN_HEIGHT`, `Percent`, `EcommerceScreen` imports; `accentBg` from all 4 configs; 8 dead styles (`searchBox*`, `modeToggle*` ×5) | `SubAppWrapper.tsx` | ✅ Done | |
| 2 | Config parity: PHARMA `#db2777` → `#FF7A59` (coral) everywhere; names `'FOOD'`→`'Food'`, `'FA GROCERY'`→`'FA Grocery'`, `'FA PHARMA'`→`'FA Pharma'` | `SubAppWrapper.tsx` | ✅ Done | Web casing match. Note: the GROCERY config preset has since been removed (Grocery merged into Mart). |
| 3 | Overlay layout model: root bg `#f8fafc`; header absolute top (zIndex 30, vs(64), shadow, no border); tab bar absolute bottom; viewport `paddingTop: vs(64)` / `paddingBottom: vs(72)` | `SubAppWrapper.tsx` | ✅ Done | Web's floating shell parity |
| 4 | Header fidelity: backBtn transparent (drop fill/border), `marginLeft: hs(-8)`, ArrowLeft `ms(22)` `strokeWidth={2.5}`; eyebrow `'FAAZIO APP HUB'` `ms(8)` spacing 1.2; title `ms(12)`; location pill bg `#f8fafc`, border `rgba(226,232,240,0.5)`, radius `ms(12)`, text `#475569` `ms(9)`, MapPin `#2F80ED` | `SubAppWrapper.tsx` | ✅ Done | |
| 5 | Bottom navbar shell: height `vs(72)`, bg `rgba(255,255,255,0.95)`, top radius `ms(28)`, shadow, `paddingHorizontal: hs(24)` with `justifyContent: 'space-between'`, tab buttons 56×56 | `SubAppWrapper.tsx` | ✅ Done | |
| 6 | Active tab pill: `ms(32)×4` rounded, `Animated.spring` translateX via `tabPositions` + `onLayout`; active icon `strokeWidth={2.5}` + `scale: 1.1`; inactive `#94a3b8` | `SubAppWrapper.tsx` | ✅ Done | |
| 7 | Cart badge: font `ms(8)`; `Animated.loop` bounce (translateY -3↔0, native driver) | `SubAppWrapper.tsx` | ✅ Done | |
| 8 | Exit sheet: top radius `ms(32)` (was 24), drag bar `hs(48)×6` (was 36×4), title `ms(14)` + 'Exit Food?' copy fix, subtitle `ms(10)`, exit button 'Exit to Main App' (was 'Exit to Hub'), drop border on Keep | `SubAppWrapper.tsx` | ✅ Done | |
| 9 | Wrapper-owned inline tabs: Mall Categories → 2-col grid; Aisles → color-coded cards no emoji (`#ecfdf5/#065f46`, etc.); My Bookings → VIP header + "Browse Partners" button; fallback → basket UI with steppers + totals + themed checkout | `SubAppWrapper.tsx` | ✅ Done | |
| 10 | Gate: full StyleSheet `hs`/`vs`/`ms` conversion; `tsc --noEmit` | All files | ✅ Done | 0 errors |

**Accepted deltas:** no backdrop blur (solid rgba); motion spring layout morphs → `Animated.spring` translate; animate-fade-in undefined even on web → skipped; web's pt-17 → `vs(64)`; edge-swipe exit → Android hardware-back (already wired); hover → `activeOpacity`.

### Page 12 — Food Sub-App (FoodScreen.tsx + FoodMenuView.tsx)

| # | Task | Files | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Foundation & cleanup: removed `ImageBackground`, `MapPin`, `Calendar`, `Dimensions`/`SCREEN_WIDTH`, orphan `useRef`/`useEffect`; typed props; `hs/vs/ms` import; `searchFocusedInitially` via `TextInput` ref + `useEffect` focus | `FoodScreen.tsx` | ✅ Done | activeSubMode fallback defaults 'order' |
| 2 | Mode toggle segment: `#F1F5F9` track, active white-on-`#1E5D44`, `ms(11)` 900 uppercase; crossfade `Animated` opacity/translateY 250ms | `FoodScreen.tsx` | ✅ Done | |
| 3 | Promo card redesign: `#F2F5F3` r24 card, "Discount 25%" chip (`#047857`/`#ECFDF5`), `ms(124)` circular image w/ 4px white border, working "Order Now" → addToCart + 1.5s `#059669` + Check | `FoodScreen.tsx` | ✅ Done | |
| 4 | Top of Week rail: 170px horizontal snap cards, 112px image, ADD→✓ `#10B981`, wired to search filtering; `onProductClick` payload normalized (`price/10`, `app:'FOOD'`) | `FoodScreen.tsx` | ✅ Done | |
| 5 | Restaurant directory: "Top Restaurants Near You" + count; Pure Veg / Under-30-mins toggles; 3-way sort segment; conditional rose Clear All; `foodStores` cards (cover+gradient, emoji, VEG badge, rating/delivery/distance/offer rows, chevron circle) | `FoodScreen.tsx` | ✅ Done | Data already mirrored |
| 6 | Store drill-in: `selectedStore` state; back pill; hero cover + floating rating; 56px emoji tile; pulsing offer tag; 2-col menu grid w/ "{firstWord} Special" badge and + Add → ✓ Added | `FoodScreen.tsx` | ✅ Done | |
| 7 | Booking mode fidelity: `#54B175` r28 full card header (avatar + dot, 🛒 `#FFA500` circle, back+search+⚙️ chip); tabs w/ "24" badge + animated underline; floating category bubbles card (Vegan/Pizza/Sushi/Hot Dog, active amber ring + ★ badge) overlapping header -24px; vertical Popular Food cards (176px image, heart circle, "Book Table" pill, tab+category filter w/ empty state) | `FoodScreen.tsx` | ✅ Done | |
| 9 | FoodMenuView port: header w/ pulsing bell dot, dark toast, sticky search + cat tabs w/ spring underline, 2-col `foodProducts` grid w/ floating Plus→Check badge, dashed empty state; SubAppWrapper Menu-tab placeholder replaced | `FoodMenuView.tsx` + `SubAppWrapper.tsx` | ✅ Done | |
| 10 | Gate: full `hs()`/`vs()`/`ms()` responsive sweep, container bg `#f8fafc`; `tsc --noEmit` | All files | ✅ Done | 0 errors |

**Accepted deltas:** Vite dead code (unused handlers, Bell/Filter orphans, animate-fade-in) skipped; web motion layout-id → `Animated.spring` translate.

### Page 13 — FA Mart Sub-App (FaMartScreen.tsx)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1 | Foundation & cleanup: dropped `ImageBackground`, `Dimensions`/`SCREEN_WIDTH`, `Percent`, unused `favorites`/`toggleFavorite` props; imported `martStores`/`StoreProfile`; added `matchCategory` helper + `filteredStores`; added `resolveBadgeBg` hex map (fixes latent invalid-color bug) | `FaMartScreen.tsx` | ✅ Done | |
| 2 | Live countdown: `timeLeft` state (2:14:45), 1s `setInterval` w/ cleanup, `formatCountdown` zero-padded `HHh : MMm : SSs` | `FaMartScreen.tsx` | ✅ Done | |
| 3 | Category chips rebuild: 9 consolidated chips (Mobile & Electronics, Toys & Gifts, Books & Stationery, Home Appliances, Furniture w/ proper icons), header "Explore Mall Categories", active `#1162D3` + scale-1.05, tap clears `selectedStore`; rendered FIRST | `FaMartScreen.tsx` | ✅ Done | |
| 4 | Banner rebuild: 3 banners (restored `photo-1550009158`, added Smart Home), accents `#1162D3`/`#E040FB`/`#10B981`, SVG diagonal `LinearGradient` overlay, category-specific banner on chip select, pulsing rose Timer countdown chip, CTA "Explore {category}", dots only on 'All', `Animated` crossfade | `FaMartScreen.tsx` | ✅ Done | |
| 5 | Flash Deals strip: header w/ `TrendingUp` + rotating `Clock` (4s loop) + "Ends in {countdown}" chip; 170px snap cards: 112px image + FLASH SALE badge, category/★ row, price + strikethrough ×1.3, "+ Add" `#1162D3`→emerald ✓; max 6 items | `FaMartScreen.tsx` | ✅ Done | |
| 6 | Vendors Directory: Store icon header + dynamic title/subtitle + count chip; store cards: 64px cover thumb w/ bottom gradient + emoji, amber ★ chip, `Clock`/`MapPin`/🔥 meta chips, 28px chevron circle → `setSelectedStore` | `FaMartScreen.tsx` | ✅ Done | |
| 7 | Store Profile drill-in: back pill "Back to {category}" + "Verified Partner" `ShieldCheck` chip; hero 140px cover @80% over slate-900 gradient; rating pill (solid `rgba`); 56px emoji tile −24px; pulsing 🔥 offerTag; meta row w/ categories • joined; "Store Product Catalog" header; 2-col grid w/ "Store Deal" badge, payload `{...product, app:'MART', shop: store.name}` | `FaMartScreen.tsx` | ✅ Done | |
| 8 | Product card redesign: grid gated to 'All' ("All Trending Products" + "100% Authentic" chip); `ms(24)` radius; `resolveBadgeBg` fallback "Trending"; boxed category tag + ★ rating; name 1-line/desc 2-line; `$price.toFixed(2)` + ×1.3 strikethrough; labeled "Add" (`#1162D3`) → "Added!" + `CheckCircle` (emerald); removed dark circle | `FaMartScreen.tsx` | ✅ Done | |
| 9 | Payload & polish: every `onProductClick` spreads `app:'MART'`; `activeOpacity` 0.8; `Animated.loop` pulses on offer/countdown chips | `FaMartScreen.tsx` | ✅ Done | |
| 10 | Gate: full `hs()`/`vs()`/`ms()` sweep; container bg `#f8fafc`; `tsc --noEmit` | All files | ✅ Done | 0 errors |
| 11 | Minimal deal card + "Flash Deals"→"Daily Essentials" rename: new presentational `MartDealCard` (portrait image, optional rating chip, 1-line name, strikethrough-MRP-then-price, optional green price note; no `+`/badge/heart) used by both `DealsOfDayRail` and `DailyEssentialsRail`; cart wiring removed from both rails; feed/section renamed (`flashSales`→`dailyEssentials`, `flashSaleToProduct`→`essentialToProduct`, `MART_FLASH_SALES`→`MART_DAILY_ESSENTIALS`); per-item `rating`/`priceNote` added; `remainingTimeSec` removed | `FaMartScreen.tsx` | ✅ Done | |

**Accepted deltas:** `$xx.xx` currency (Vite spec, though data is ₹-scale); Vite dead code (motion/AnimatePresence, unused icons, animate-fade-in) skipped; backdrop-blur → solid `rgba`; no wrapper change (Offers tab replaced by Cart/Profile in RN config).

### Page 14 — Grocery Sub-App (GroceryScreen.tsx) — REMOVED (merged into Mart)

> **Note:** `GroceryScreen.tsx` and the `grocery-home/` component directory have been deleted. The
> Grocery sub-app was removed and merged into Mart (grocery products/stores/categories now live
> under `app:'MART'`). The audit rows below document the historical build of that now-deleted screen.

| # | Task | Files | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Data fix (critical): deleted inline 3-product fallback + stale comment + unused `martProducts` import; imported canonical `groceryProducts` (7 items, byte-identical in data file) | `GroceryScreen.tsx` | ✅ Done | |
| 2 | Typed props: replaced `any` with `GroceryScreenProps` interface (`addToCart`, `cartItems`, `updateCartQuantity`, `onProductClick?`); kept RN null-guards | `GroceryScreen.tsx` | ✅ Done | |
| 3 | Aisle chips fidelity: Vite taxonomy/emojis (All 🍏, Fresh Produce 🥦, Dairy & Eggs 🥚, Bakery 🍞, Beverages 🥛, Snacks 🍿); active chip scale-1.05 + shadow; header "Supermarket Aisles" | `GroceryScreen.tsx` | ✅ Done | |
| 4 | Banner rebuild: directional SVG `LinearGradient` overlay (emerald-950 `#022c22` → slate-900/95 → transparent); badge text `#56B821` on `rgba(255,255,255,0.1)`; content `maxWidth 70%`; shadow + `#f1f5f9` border | `GroceryScreen.tsx` | ✅ Done | |
| 5 | Card tap-target restructure: split into pressable image+content block (fires `onProductClick` w/ `app:'GROCERY'`) and non-propagating price/action row — eliminates qty-button tap conflict | `GroceryScreen.tsx` | ✅ Done | |
| 6 | Card detail fidelity: badge fully-rounded pill; name `numberOfLines={1}`; desc `minHeight: vs(22)`; price `toLocaleString('en-IN')` (guarded try/catch); footer `borderTop #f8fafc` | `GroceryScreen.tsx` | ✅ Done | |
| 7 | ADD pulse animation: success state (`#059669` + `CheckCircle`) gets `Animated.loop` opacity pulse (1↔0.6, 800ms) during the 1200ms feedback window | `GroceryScreen.tsx` | ✅ Done | |
| 8 | Wrapper Aisles tab: title "Aisle Map" + subtitle "Fresh organic foods categorized perfectly"; renamed cards Greens & Orchard→Fresh Produce, Sweet Beverages→Beverages (12 Refreshing Drinks) | `SubAppWrapper.tsx` | ✅ Done | |
| 9 | Responsive sweep: full `hs()`/`vs()`/`ms()` conversion; card width via responsive math `(SCREEN_W - hs(36)) / 2` | `GroceryScreen.tsx` | ✅ Done | |
| 10 | Gate: `npx tsc --noEmit` | All files | ✅ Done | 0 errors |

**Accepted deltas:** Vite dead code (6 unused lucide imports, motion/AnimatePresence, animate-fade-in, "Fresh Club" unreachable tab) skipped; hover states → `activeOpacity`; `toLocaleString('en-IN')` guarded for Hermes Intl; wrapper primaryColor keeps `#10B981` (already decided in Page 11).

### Page 15 — Pharma Sub-App (PharmaScreen.tsx + SubAppWrapper.tsx)

| # | Task | Files | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Data & foundation: replaced 4-item DB with full 12-item `PHARMA_PRODUCTS_DB` (correct `ph-f1` ₹45, restored `ph-s1` Whey Protein, added `ph-t3/t4/f2/v1/a1/h1/as1/d1`, bullets on all); typed `PharmaScreenProps` matching Vite's 7-prop interface; dropped `Dimensions`; page bg `#FAF9F6` | `PharmaScreen.tsx` | ✅ Done | |
| 2 | View state machine: `currentView` (`HOME`/`ALL_CATEGORIES`/`CATEGORY_PRODUCTS`/`PRODUCT_DETAIL`) + `selectedCategoryId`/`selectedProduct`/`quantity`/`searchQuery`/`addedAnimationId`/`localFavorites`; handlers `toggleLocalFavorite`, `handleAddWithFeedback`, `handleAddMultipleToCart` | `PharmaScreen.tsx` | ✅ Done | |
| 3 | Peach gradient header: SVG `LinearGradient` `#FFF0E8→#FFD5C8`, radius `ms(42)`; avatar row 44px circle (photo-1534528741775), "Camberline" 15px 800; Search pill (`rgba(255,255,255,0.7)`); bell 32px white circle + 6px `#E05B35` dot; banner 21px/900 + "Shop now" pill → vitamin drill-in; trust card `rgba(255,255,255,0.95)` r16 w/ `ShieldCheck` coral on `#FFF0E8` circle | `PharmaScreen.tsx` | ✅ Done | |
| 4 | Dots + Category grid: 3 pagination dots (active 14×6 pill `#FF7A59`); "Category" 14px/900 + "View all"; 2×2 grid (first 4), cards r22 white, 40px icon circle border `#FFEAE5` bg `#FFF5F2` | `PharmaScreen.tsx` | ✅ Done | Emoji icons (not custom SVGs) |
| 5 | Popular Wellness Matches: 2×2 grid (first 4 products); functional heart toggle (rose fill when fav); separate pressable content block (→ `PRODUCT_DETAIL` internally) vs isolated price/add row (fixes nested-touchable conflict); image 80% contain in `#FFFBF9` box; rating ★ coral 9px; 24px dark circle Plus → emerald Check | `PharmaScreen.tsx` | ✅ Done | `onProductClick` unused — all taps navigate internally (matches Vite) |
| 6 | `ALL_CATEGORIES` + `CATEGORY_PRODUCTS` views: back bar (`ChevronLeft` 16/3 in 32px white circle, uppercase title); full 8-category grid; filtered product grid honoring `searchQuery`, 2-line name min-h `vs(28)`, empty state 💊 card | `PharmaScreen.tsx` | ✅ Done | |
| 7 | `PRODUCT_DETAIL` view: hero SVG gradient `#FFF2EE→#FFF7F4` r36 w/ back + heart buttons, 192px centered image; name 18px/900, 5 amber stars + reviews; quantity selector bar (30px white circles, `Minus`/`Plus` 11/3); Description; bullets w/ 16px `#FFEAE5` circles + coral `Check` 8/4; total bar + full-width dark "Add to Cart" → emerald "Added to Cart!" | `PharmaScreen.tsx` | ✅ Done | |
| 8 | For You tab: coral `Sparkles` header + subtitle; curated grid `ph-t1/t2/t4/f1/f2`; `#E05B35` discount badges (guarded); strikethrough `originalPrice` (guarded); tapping product → detail + `setActiveTab('Home')` | `PharmaScreen.tsx` | ✅ Done | |
| 9 | History tab: coral `ClipboardList` header; Active Medicine Deliveries card (`ORD-93821`, ₹90, pulsing green dot via `Animated.loop`); Scheduled Doctor Consultations list w/ amber "Upcoming"/grey "Completed" badges, `Calendar`/`Clock` 9px meta, grey directive box | `PharmaScreen.tsx` | ✅ Done | |
| 10 | Wrapper delegation fix + gate: PHARMA route delegates Home/For You/History all to `<PharmaScreen …7 props />` via early return before switch; deleted both placeholder blocks; full `hs()`/`vs()`/`ms()` sweep; `tsc --noEmit` | `SubAppWrapper.tsx`, `PharmaScreen.tsx` | ✅ Done | 0 errors |

**Accepted deltas:** consultation engine (Vite L354–522) skipped; decorative 144px blur-xl → semi-transparent rounded Views (no blur dep); search focus-width grow → fixed-width; Vite dead code (unused icons, motion/AnimatePresence) skipped; hover → `activeOpacity`; latent RN bugs (unguarded `discountBadge`/`originalPrice` "undefined", decorative no-op heart) fixed by rebuild.

### Page 16 — ProductDetail Modal (X01) + M04/G03 Closure

| # | Task | Files | Status | Notes |
|---|------|-------|--------|-------|
| A1 | Vite-parity wiring: added `selectedProduct` state + `handleProductClick` in MainDashboardScreen; renders `<ProductDetailView>` conditionally in both hub AND sub-app branches (overlays everything like Vite's z-50); replaced all 3 `navigation.navigate('ProductDetail')` calls; passed `onProductClick` to HomeView | `MainDashboardScreen.tsx` | ✅ Done | |
| A2 | Phantom routes removed: dropped `ProductDetail`, `BookingConfirmation`, `PrescriptionUpload`, `Cart`, `Checkout` from `RootStackParamList` (none had `<Stack.Screen>` entries) | `AppNavigator.tsx` | ✅ Done | |
| B3 | Hero rebuild: fixed `vs(256)` height (not 30% screen); per-brand SVG vertical LinearGradient; circle `ms(160)`; emoji `ms(64)`; rating badge inside bottom-right | `ProductDetailView.tsx` | ✅ Done | |
| B4 | Nav buttons: X `ms(20)/sw2.5`, Share2 `ms(18)`, Heart `ms(18)`; heart button `40×40` while close/share stay `48×48` (Vite's intentional asymmetry) | `ProductDetailView.tsx` | ✅ Done | |
| B5 | Color/copy corrections: sheet bg `#f8fafc`; tax `#56B821` "Incl. of all taxes"; highlights → `Check` icon `ms(11)/sw3.5` `#059669`; `ShieldCheck` `#059669`; `RotateCcw` `#2563eb`; reviews-avg badge text `#1e293b`; name `ms(20)`, price `ms(24)`, desc `ms(11)` | `ProductDetailView.tsx` | ✅ Done | |
| B6 | Reviews parity: restored 3rd review for FOOD (Vikram Singh) & MART (Kunal Kapoor); replaced initial-letter circles with 28px Unsplash avatar `Image`s; comment indent `hs(36)` | `ProductDetailView.tsx` | ✅ Done | |
| B7 | Footer parity: height `vs(80)`; Add-to-Bag `Math.max(44, vs(44))`/r16/px24, Plus `ms(12)/sw2.5`; stepper buttons `ms(32)`/r12, Minus/Plus `ms(14)/sw3` | `ProductDetailView.tsx` | ✅ Done | |
| B8 | Responsive sweep: full `hs()`/`vs()`/`ms()` conversion of entire StyleSheet; interface fields made optional with fallback guards (`emoji ?? '🛍️'`) | `ProductDetailView.tsx` | ✅ Done | |
| C9 | M04 (Mart Offers) + G03 (Grocery Fresh Club) closed as "parity by omission" — both tab names absent from both apps' configs; RN matches what users actually see | `PAGE_CATALOG.md` | ✅ Closed | Zero code — Vite parity by omission |
| 10 | Gate: `npx tsc --noEmit` | All files | ✅ Done | 0 errors |

**Accepted deltas:** M04/G03 unreachable in Vite (tab names absent from both configs) → parity by omission; consultation engine (Vite dead code) skipped; decorative blur-xl → semi-transparent rounded Views; hover → `activeOpacity`.

---

## ✅ Vite → RN Alignment Complete

All **40 top-level pages** from Section 1 are now visually aligned with the RN app. Final summary:

| Phase | Pages | Status |
|-------|-------|--------|
| Pages 1–4: Onboarding, Login, Location | 10 (O1–O10) | ✅ |
| Page 5: Dashboard Shell | 1 (D1) | ✅ |
| Pages 6–10: Home, Categories, Favourites, Cart, Account tabs | 5 (D2–D6) | ✅ |
| Page 11: SubAppWrapper Shell | 1 (S0) | ✅ |
| Pages 12–15: Food, FA Mart, Pharma sub-apps | 21 (F01–F08, M01–M04, G01–G03, P01–P06) | ✅ |
| Page 16: ProductDetail Modal | 1 (X01) + (X02) | ✅ |

**40/40 pages aligned. `npx tsc --noEmit` — 0 errors.**
