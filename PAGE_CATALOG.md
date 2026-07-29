# Faazio SuperApp — Page Catalog

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
| H3 | 4-Sector Gateway Grid | 620–667 | 2×2: MART, FOOD, GROCERY, PHARMA |
| H4 | Sponsored Showcase Carousel | 669–755 | Full-width banner, video/image, mute toggle |
| H5 | Recently Viewed Strip | 757–804 | Horizontal scrollable history |
| H6 | Today's Offers | 806–865 | Deal cards with "Claim Deal" CTA |
| H7 | Recommended For You | 867–909 | 2-column AI curated grid |
| H8 | Popular Dining Restaurants | 911–979 | Horizontal cards with heart toggle |
| H9 | Recently Viewed — Mart | 982–1039 | Horizontal carousel with Add/Added |
| H10 | Recently Viewed — Grocery | 1041–1087 | Horizontal carousel with Add/Added |
| H11 | Recently Viewed — Pharma | 1089–1135 | Horizontal carousel with Add/Added |
| H12 | FA Mart Curated Finds | 1138–1188 | "Discover" CTA cards |
| H13 | Restaurant Specials | 1190–1255 | "Order Now" CTA cards |

#### Categories Tab (D3) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| C1 | Filter Pills | 150–182 | ALL/FOOD/MART/GROCERY/PHARMA |
| C2 | Search Bar | 184–194 | Instant search input |
| C3 | Category Grid | 196–243 | 3-column visual grid |
| C4 | Explore Stacks (curated) | 263–407 | Horizontal carousels grouped by stack |
| C5 | Product Grid (list mode) | 408–499 | 2-column product cards |
| C6 | Empty State | 501–512 | No matching products |

#### Favourites Tab (D4) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| F1 | Header Banner | 143–159 | Dark gradient |
| F2 | Per-Sector Product Grids | 161–287 | FOOD/MART/GROCERY/PHARMA |
| F3 | Empty State | 288–303 | No favourites yet |

#### Cart Tab (D5) — 4 Checkout Steps:

| # | Step | Lines | Description |
|---|------|-------|-------------|
| CA1 | **Bag** (items, promo, pricing) | 159–358 | Grouped by app source, quantity controls, coupon code, price breakdown |
| CA2 | **Address** (select or add) | 362–467 | Saved addresses list + add custom form |
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
| S0 | **Sub-App Shell** | `src/components/SubAppWrapper.tsx` | full (671) | Header, viewport, bottom tabs, exit modal |

#### Sub-App Shell sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| SW1 | Exit Confirmation Modal | 631–668 | Slide-up bottom sheet |
| SW2 | Sub-App Bottom Navbar | 584–628 | Dynamic tabs per app |

### 1.4 Sub-App: Food

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| F01 | **Food Order Mode** | `src/components/FoodPage.tsx` | 237–663 | Full order mode view |
| F02 | **Store Profile / Restaurant Detail** | `src/components/FoodPage.tsx` | 399–511 | Cover image, menu grid, offers |
| F03 | **Restaurant Directory** | `src/components/FoodPage.tsx` | 512–661 | Filter bar + store list |
| F04 | **Food Booking Mode** | `src/components/FoodPage.tsx` | 664–1128 | Full booking mode view |
| F05 | **Table Reservation Form** | `src/components/FoodPage.tsx` | 892–1125 | Full-screen: date, time, guests, confirm |
| F06 | **Food Menu View** | `src/components/FoodMenuView.tsx` | full (211) | Search, category tabs, 2-column grid |
| F07 | **My Bookings (SubAppWrapper tab)** | `src/components/SubAppWrapper.tsx` | 185–301 | Reservation list + empty state |
| F08 | **Food Profile (SubAppWrapper tab)** | `src/components/SubAppWrapper.tsx` | 303–329 | Account details |

#### Food Order Mode (F01) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| FO1 | Mode Toggle | 212–233 | Food Order / Dinner Booking segmented control |
| FO2 | Search Input | 247–258 | "Search on Food" |
| FO3 | Address Card | 260–285 | Emerald green delivery card |
| FO4 | Promo Card | 287–325 | Chicken Teriyaki with Order Now |
| FO5 | Top of Week Carousel | 327–395 | Weekly specials |

#### Food Booking Mode (F04) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| FB1 | Header + Cart | 674–696 | Green gradient, avatar, greeting |
| FB2 | Search Bar | 699–717 | |
| FB3 | Category Tabs | 719–750 | Breakfast/Dinner/Lunch |
| FB4 | Category Bubbles | 753–785 | Vegan/Pizza/Sushi/Hot Dog |
| FB5 | Booking Dish Cards | 809–888 | "Book Table" CTA |
| FB6 | Empty State | 830–836 | No active tables |

### 1.5 Sub-App: FA Mart

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| M01 | **Mart Home** | `src/components/FaMartPage.tsx` | 307–604 | Full mart landing page |
| M02 | **Mart Store Profile** | `src/components/FaMartPage.tsx` | 135–296 | Cover, rating, offer, product catalog |
| M03 | **Mart — Categories (SubAppWrapper tab)** | `src/components/SubAppWrapper.tsx` | 336–357 | 2-column category grid |
| M04 | **Mart — Offers (SubAppWrapper tab)** | `src/components/SubAppWrapper.tsx` | 359–380 | Promo code list |

#### Mart Home (M01) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| MT1 | Category Pills | 307–336 | Horizontal scrollable |
| MT2 | Category Banner + Countdown | 338–382 | Full-width with timer |
| MT3 | Flash Deals Strip | 384–447 | Horizontal with countdown |
| MT4 | Featured Stores Grid | 449–511 | Store cards |
| MT5 | All Products Grid | 513–604 | 2-column product grid |

### 1.6 Sub-App: Grocery

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| G01 | **Grocery Home** | `src/components/GroceryPage.tsx` | full (215) | Full grocery landing |
| G02 | **Grocery — Aisles (SubAppWrapper tab)** | `src/components/SubAppWrapper.tsx` | 387–407 | Aisle directory grid |
| G03 | **Grocery — Fresh Club (SubAppWrapper tab)** | `src/components/SubAppWrapper.tsx` | 408–425 | Membership card |

#### Grocery Home (G01) sub-sections:

| # | Sub-Section | Lines | Description |
|---|-------------|-------|-------------|
| GR1 | Promo Banner | 58–74 | Full-width gradient |
| GR2 | Subcategory Pills | 76–97 | Fresh Produce, Dairy, Bakery, etc. |
| GR3 | Product Grid | 112–213 | 2-column with +/- quantity stepper |

### 1.7 Sub-App: Pharma

| # | Screen | File | Lines | Description |
|---|--------|------|-------|-------------|
| P01 | **Pharma — Home Tab** | `src/components/PharmaPage.tsx` | 535–1004 | Full pharma home |
| P02 | **Pharma — All Categories Grid** | `src/components/PharmaPage.tsx` | 735–777 | 8 categories |
| P03 | **Pharma — Category Products** | `src/components/PharmaPage.tsx` | 779–857 | Product grid per category |
| P04 | **Pharma — Product Detail (inline)** | `src/components/PharmaPage.tsx` | 859–1001 | Full product detail within page |
| P05 | **Pharma — "For You" Tab** | `src/components/PharmaPage.tsx` | 1006–1095 | Curated recommendations |
| P06 | **Pharma — "History" Tab** | `src/components/PharmaPage.tsx` | 1097–1181 | Active orders + consultations |

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

### 2.1 Active Navigation (AppNavigator.tsx)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN1 | **OnboardingScreen** | `src/features/onboarding/OnboardingScreen.tsx` | 331 | ✅ Active | 4 slides, single component |
| RN2 | **LoginScreen** | `src/features/auth/LoginScreen.tsx` | 546 | ✅ Active | Combines phone + OTP + loading |
| RN3 | **LocationScreen** | `src/features/auth/LocationScreen.tsx` | 245 | ✅ Active | 3 steps: request/manual/loader via state |
| RN4 | **MainDashboardScreen** | `src/features/home/MainDashboardScreen.tsx` | 382 | ✅ Active | Renders hub tabs + SubAppWrapper |

### 2.2 Dashboard Hub Tabs (rendered inside MainDashboardScreen)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN5 | **HomeView** | `src/components/HomeView.tsx` | - | ✅ Active | Hub Home tab |
| RN6 | **CategoriesView** | `src/components/CategoriesView.tsx` | - | ✅ Active | Hub Explore tab |
| RN7 | **FavouritesView** | `src/components/FavouritesView.tsx` | - | ✅ Active | Hub Saved tab |
| RN8 | **AccountView** | `src/components/AccountView.tsx` | - | ✅ Active | Hub Profile tab |
| RN9 | **CartView** | `src/components/CartView.tsx` | - | ✅ Active | Hub Bag tab |

### 2.3 Sub-App Wrapper & Sub-Apps (rendered inside SubAppWrapper)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN10 | **SubAppWrapper** | `src/components/SubAppWrapper.tsx` | 799 | ✅ Active | Shell + exit modal + tabs |

#### Sub-App: Food (rendered by SubAppWrapper)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN11 | **FoodScreen — Order Mode Home** | `src/features/food/FoodScreen.tsx` | 553 | ✅ Active | Search, promos, top of week |
| RN12 | **FoodScreen — Booking Mode Home** | `src/features/food/FoodScreen.tsx` | - | ✅ Active | Categories, dish cards |
| RN13 | **Food — "Menu" tab** | `src/components/SubAppWrapper.tsx` (inline) | 228–237 | ⚠️ Placeholder | "Gourmet Menus" empty state |
| RN14 | **Food — "Search" tab** | `src/features/food/FoodScreen.tsx` | - | ✅ Active | Reuses FoodScreen with search focus |
| RN15 | **Food — "My Bookings" tab** | `src/components/SubAppWrapper.tsx` (inline) | 239–253 | ⚠️ Placeholder | Empty state only |

#### Sub-App: FA Mart (rendered by SubAppWrapper)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN16 | **FaMartScreen — Home** | `src/features/ecommerce/FaMartScreen.tsx` | 497 | ✅ Active | Banner, sub-categories, product grid |
| RN17 | **Mart — "Categories" tab** | `src/components/SubAppWrapper.tsx` (inline) | 185–212 | ✅ Active | Inline category grid |

#### Sub-App: Grocery (rendered by SubAppWrapper)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN18 | **GroceryScreen — Home** | `src/features/ecommerce/GroceryScreen.tsx` | 507 | ✅ Active | Categories, products, stepper |
| RN19 | **Grocery — "Aisles" tab** | `src/components/SubAppWrapper.tsx` (inline) | 268–295 | ✅ Active | Inline aisle directory |

#### Sub-App: Pharma (rendered by SubAppWrapper)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN20 | **PharmaScreen — Home** | `src/features/pharma/PharmaScreen.tsx` | 354 | ✅ Active | Categories, products |
| RN21 | **Pharma — "For You" tab** | `src/components/SubAppWrapper.tsx` (inline) | 303–312 | ⚠️ Placeholder | Empty state |
| RN22 | **Pharma — "History" tab** | `src/components/SubAppWrapper.tsx` (inline) | 314–324 | ⚠️ Placeholder | Empty state |

#### Sub-App Shared (rendered by SubAppWrapper)

| # | Screen | File | Lines | Status | Notes |
|---|--------|------|-------|--------|-------|
| RN23 | **Cart** (reuses CartView) | `src/components/CartView.tsx` | - | ✅ Active | Shared across all sub-apps |
| RN24 | **Profile** (reuses AccountView) | `src/components/AccountView.tsx` | - | ✅ Active | Shared across all sub-apps |

### 2.4 Navigation Types Defined But NOT Wired

The following routes are typed in `RootStackParamList` but have NO `<Stack.Screen>` entry:

| Route | Type | Status |
|-------|------|--------|
| `ProductDetail` | `{ productId: string }` | ❌ Not rendered |
| `BookingConfirmation` | `{ bookingId: string }` | ❌ Not rendered |
| `PrescriptionUpload` | `undefined` | ❌ Not rendered |
| `Cart` | `undefined` | ❌ Not rendered |
| `Checkout` | `undefined` | ❌ Not rendered |

### 2.5 Orphan Files (Exist But NOT Referenced Anywhere)

| File | Lines | Description | Why Orphan |
|------|-------|-------------|------------|
| `src/features/home/HomeScreen.tsx` | 411 | Standalone service hub landing (different from HomeView) | Not imported by any navigator or parent |
| `src/features/profile/ProfileScreen.tsx` | 231 | Standalone profile page with different UI from AccountView | Not imported by any navigator or parent |
| `src/features/ecommerce/EcommerceScreen.tsx` | 442 | Standalone e-commerce page | Not imported by SubAppWrapper or any parent (SubAppWrapper imports FaMartScreen, GroceryScreen, FoodScreen, PharmaScreen — NOT EcommerceScreen) |
| `src/components/ProductDetailView.tsx` | - | Full product detail modal component | Rendered nowhere (MainDashboardScreen calls `navigation.navigate('ProductDetail')` but route not registered) |

---

## Section 3: Vite ↔ React Native Mapping

### 3.1 Screens Present in Both

| Vite Screen | RN Screen | Notes |
|-------------|-----------|-------|
| O1–O4: Onboarding Slides (4) | RN1: OnboardingScreen | ✅ Both have 4-slide onboarding |
| O5: Login Phone Entry | RN2: LoginScreen | ✅ RN merges phone + OTP into one file |
| O6: OTP Verification | RN2: LoginScreen | ✅ Same file |
| O7: Loading Spinner | RN2: LoginScreen | ✅ Same file |
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
| F04: Food Booking Mode | RN12: FoodScreen | ✅ |
| M01: Mart Home | RN16: FaMartScreen | ✅ |
| G01: Grocery Home | RN18: GroceryScreen | ✅ |
| P01: Pharma Home | RN20: PharmaScreen | ✅ |
| X02: Exit Confirmation | RN10: SubAppWrapper | ✅ Built into SubAppWrapper |

### 3.2 Vite Screens MISSING from RN

| Vite Screen | Why Missing | Priority to Port |
|-------------|-------------|-----------------|
| **Food — Store Profile / Restaurant Detail** (F02) | RN FoodScreen has no store profile view | High |
| **Food — Restaurant Directory** (F03) | RN has no directory/filter bar | High |
| **Food — Table Reservation Form** (F05) | RN has no full-screen reservation form | High |
| **Food — "My Bookings" tab** (F07) | RN has only empty-state placeholder | Medium |
| **Food Menu View** (F06) | RN has only empty-state placeholder | Medium |
| **Mart — Store Profile** (M02) | RN FaMartScreen has no store profile | High |
| **Mart — "Offers" tab** (M04) | RN SubAppWrapper has no Offers tab | Low |
| **Grocery — "Fresh Club" tab** (G03) | RN SubAppWrapper has no Fresh Club tab | Low |
| **Pharma — "For You" tab** (P05) | RN has only empty-state placeholder | Medium |
| **Pharma — "History" tab** (P06) | RN has only empty-state placeholder | Medium |
| **Pharma — All Categories Grid** (P02) | RN has no full category grid view | Low |
| **Pharma — Category Products** (P03) | RN has no per-category product view | Low |
| **Pharma — Product Detail (inline)** (P04) | RN has no inline product detail in Pharma | Medium |
| **Cart — Step 2: Address** (CA2) | RN CartView missing address step | High |
| **Cart — Step 3: Payment** (CA3) | RN CartView missing payment step | High |
| **Cart — Step 4: Receipt** (CA4) | RN CartView missing receipt/confirmation step | High |
| **Product Detail Modal** (X01 / PD1–PD10) | RN ProductDetailView exists but is NOT rendered | High |
| **Sub-App — "Profile" tab** (F08) | RN uses AccountView instead | Low |

### 3.3 RN Orphan Screens (Not in Vite)

| RN File | Description | Action |
|---------|-------------|--------|
| `features/home/HomeScreen.tsx` | Alternative home view with different layout | Either delete or reconcile with HomeView |
| `features/profile/ProfileScreen.tsx` | Alternative profile with different UI | Either delete or reconcile with AccountView |
| `features/ecommerce/EcommerceScreen.tsx` | Standalone e-commerce with different product catalog | Either delete or merge into FaMartScreen |
| `components/ProductDetailView.tsx` | Full product detail — identical to Vite but never rendered | Wire it into navigation ASAP |

### 3.4 Placeholder/Virtual Pages in RN

These tabs render with empty-state messages:

| Tab | File | Message Displayed |
|-----|------|-------------------|
| Food → Menu | `SubAppWrapper.tsx:228–237` | "Gourmet Menus — Vetted menus of local restaurant partners..." |
| Food → My Bookings | `SubAppWrapper.tsx:239–253` | "No Reservations Yet" |
| Pharma → For You | `SubAppWrapper.tsx:303–312` | "Health Matrix Recommendations..." |
| Pharma → History | `SubAppWrapper.tsx:314–324` | "Prescription logs — No clinical review histories..." |

---

## Section 4: Quick Reference — File Index

### Vite Web App Files

| File | Pages/Screens |
|------|---------------|
| `src/App.tsx` | Onboarding (4 slides), Login (phone + OTP + spinner), Location (request + manual + map loader), Dashboard shell, Product Detail overlay |
| `src/components/HomeView.tsx` | Home tab (13 carousel/section blocks) |
| `src/components/CategoriesView.tsx` | Categories tab (filter pills, search, category grid, product grid) |
| `src/components/FavouritesView.tsx` | Favourites tab (per-sector grids, empty state) |
| `src/components/CartView.tsx` | Cart tab (4-step checkout) |
| `src/components/AccountView.tsx` | Account tab (profile, orders, settings, logout) |
| `src/components/SubAppWrapper.tsx` | Sub-app shell, exit modal, Food tabs (My Bookings, Profile), Mart tabs (Categories, Offers), Grocery tabs (Aisles, Fresh Club) |
| `src/components/ProductDetailView.tsx` | Product detail modal (hero, specs, reviews, add-to-cart) |
| `src/components/FoodPage.tsx` | Food Order mode, Food Booking mode, Store Profile, Reservation Form |
| `src/components/FoodMenuView.tsx` | Full food menu (category tabs, search, 2-column grid) |
| `src/components/FaMartPage.tsx` | Mart Home, Mart Store Profile |
| `src/components/GroceryPage.tsx` | Grocery Home |
| `src/components/PharmaPage.tsx` | Pharma Home, For You, History (including inline product detail) |
| `src/components/EnterpriseIcon.tsx` | Utility component — sector-specific colored icons | — |

### React Native App Files

| File | Pages/Screens | Status |
|------|---------------|--------|
| `App.tsx` | Root — NavigationContainer + StatusBar hidden (edge-to-edge) | ✅ Active |
| `src/navigation/AppNavigator.tsx` | Stack navigator: Onboarding, Login, Location, MainTabs | ✅ Active |
| `src/features/onboarding/OnboardingScreen.tsx` | 4-slide onboarding | ✅ Active |
| `src/features/auth/LoginScreen.tsx` | Phone input + OTP + loading spinner | ✅ Active |
| `src/features/auth/LocationScreen.tsx` | 3-step: request / manual / loader | ✅ Active |
| `src/features/home/MainDashboardScreen.tsx` | Dashboard shell + hub tabs + SubAppWrapper | ✅ Active |
| `src/features/home/HomeScreen.tsx` | Alternative home view (orphan) | ❌ Unused |
| `src/features/profile/ProfileScreen.tsx` | Alternative profile (orphan) | ❌ Unused |
| `src/features/ecommerce/EcommerceScreen.tsx` | Standalone e-commerce (orphan) | ❌ Unused |
| `src/features/ecommerce/FaMartScreen.tsx` | Mart Home | ✅ Active |
| `src/features/ecommerce/GroceryScreen.tsx` | Grocery Home | ✅ Active |
| `src/features/food/FoodScreen.tsx` | Food Order + Booking modes | ✅ Active |
| `src/features/pharma/PharmaScreen.tsx` | Pharma Home | ✅ Active |
| `src/components/HomeView.tsx` | Hub Home tab | ✅ Active |
| `src/components/CategoriesView.tsx` | Hub Categories tab | ✅ Active |
| `src/components/FavouritesView.tsx` | Hub Favourites tab | ✅ Active |
| `src/components/CartView.tsx` | Hub/Sub-app Cart tab | ✅ Active |
| `src/components/AccountView.tsx` | Hub/Sub-app Account tab | ✅ Active |
| `src/components/SubAppWrapper.tsx` | Sub-app shell + inline tabs | ✅ Active |
| `src/components/ProductDetailView.tsx` | Product detail modal (unwired) | ❌ Unused |
| `src/components/FaazioLogo.tsx` | Brand logo SVG component (shared) | ✅ Active |

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

### Page 3 — Login Flow (Phone → OTP → All-Done)

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

**Final Verdict:** Login Flow (Page 3) is now visually and behaviorally aligned with the Vite web app.

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
| 2 | Data reconciliation: replaced diverged arrays with Vite-exact data; added 6 new datasets (`popularDining`, `recentlyViewedMart`, `recentlyViewedGrocery`, `recentlyViewedPharma`, `faMartFinds`, `restaurantSpecials`) | `HomeView.tsx` | ✅ Done | Inline data, matches both apps' convention |
| 3 | H2 Top Ad Carousel: 5s auto-rotate via `setInterval` (cleaned on unmount); video slide (index 0) → poster + Play overlay + "LIVE VIDEO CAM" badge + Zap pulse loop | `HomeView.tsx` | ✅ Done | |
| 4 | H4 Sponsored Showcase: video poster + Play overlay; `isMuted` toggle buttons (Volume2/VolumeX pill) | `HomeView.tsx` | ✅ Done | Ready for native player drop-in |
| 5 | H5 Recently Viewed: Add button swaps Plus→Check + emerald bg for 1.5s via `addedItemFeedback` | `HomeView.tsx` | ✅ Done | |
| 6 | H7 Recommended For You: horizontal carousel → 2-column grid; Sparkles slow-rotate loop on header | `HomeView.tsx` | ✅ Done | |
| 7 | EnterpriseIcon component: 25 emoji→lucide-icon registry, circle/flat/square variants, Tailwind→hex palette | `EnterpriseIcon.tsx` | ✅ Done | New file in `src/components/` |
| 8 | H8 Popular Dining: horizontal cards (h-128, gradient overlay, glass rating badge, heart FAB, footer) | `HomeView.tsx` | ✅ Done | Heart wired to `favoriteRestaurants` state |
| 9 | H9–H13: Recently Viewed Mart/Grocery/Pharma (EnterpriseIcon chips, sector dots), FA Mart Finds (blue tag, Discover pill), Restaurant Specials (amber Zap, Award bounce loop, Order Now btn) | `HomeView.tsx` | ✅ Done | |
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
