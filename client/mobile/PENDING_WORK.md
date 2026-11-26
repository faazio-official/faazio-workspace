# W108 — Guest browsing (no forced login, App Store 5.1.1(v))

**Status:** 🟢 Shipped (JS-only; no gateway or native change). Remainder: persist the guest cart across app restarts (currently in-memory, merges on sign-in).

- Signed-out returning users land on `MainTabs` (guest browsing); first launch keeps the skippable
  onboarding carousel. **Skip** on onboarding and login returns to the catalogue.
- Account-bound actions (checkout continue/place order, favourites tab + every heart, prescription
  upload, orders/rewards/wallet entry points) call `runAuthGate` → root `Login` with the action
  remembered and resumed after sign-in.
- Guest cart is device-local (`canSyncCart()` skips auth-scoped `/cart` writes) and is merged into
  the account by `hydrateUserStores()` before the signed-in hydrate.
- Guest account tab shows a sign-in card + Preferences; sign-out and dead sessions reset to
  `MainTabs` as a guest and clear local per-user caches.
- Location is optional for guests (`Browse without a location`); the authenticated district gate
  still runs after sign-in.

**Verification:** `npm run ts:check` PASS; `npm run check:boundaries` PASS; Android + iOS Metro
bundles built with `react-native bundle` (no native rebuild needed — shared JS).

**Files impacted:**
- `navigation/{AppNavigator,types}.tsx|ts`, `services/authGate.ts` (new)
- `features/auth/{LoginScreen,LocationScreen}.tsx`, `features/onboarding/OnboardingScreen.tsx`
- `state/{cartStore,favoriteStore}.ts`, `services/sessionStores.ts`
- `features/cart/CartView.tsx`, `features/favourites/{FavouritesTabScreen,FavouritesScreen}.tsx`
- `features/profile/{AccountView,AccountScreen,YouScreen,useAccountNav,DeleteAccountScreen}.tsx|ts`
- `components/shared/GuestGate.tsx` (new), product/food favourite buttons + Pharma prescription FABs

# W106 — Checkout, login, and UI cleanups per user complaints (audio 1-6)

**Status:** 🟢 Shipped (W106: no DB migration, no gateway change; W107 adds `PUT /profile`, no DB migration).

### Checkout flow simplification (Audio 1)
- **Moved fulfilment choice** from separate FULFILLMENT step into PAYMENT before Pay button
- **Wizard steps** now: BAG → PAYMENT (fulfillment toggle → payment method → coupon) → RECEIPT
- Coupon field now present on PaymentOptionsScreen for both DELIVERY and PICKUP
- BreakdownCard initially shows only total + ordered value; expandable "See price breakdown" reveals delivery fees/surges

### Pharmacy fulfilment at end (Audio 3)
- PharmaFulfilmentSheet now triggered from PAYMENT screen within pharmacy checkout, not after vendor selection
- VENDORS → BUYER → Pharmacy Checkout → FULFILLMENT → CONFIRMED

### Star rating simplification (Audio 4)
- Removed review counts from all rating displays
- Ratings always render as star + one decimal (e.g., "★ 4.9")
- Updated: StoreCardBase (rail + card), SearchDishCard, RestaurantProfileScreen, all pharma & mart vendor cards
- Existing stars + formatRating() already one decimal—no change needed

### Offline screen + brand placement (Audio 5)
- Added FaazioLogo at top of OfflinePage (already present, keeping it as brand mark)
- Simplified branding—no scattered "Fasio" text boxes; consistent logo placement on welcome/onboarding pages
- Added inline cartoon character SVG above WifiOff icon

### Login: name field mandatory + English-only (Audio 6)
- Added **name input** (placeholder: "Enter your name") alongside phone in LoginScreen
- Name validation blocks OTP send if empty
- **Removed Tamil language**: only English works; Tamil fonts/font registration issue prevents proper rendering
- Name stored in user object during completeLogin and passed to session
- Tamil listed for removal from languages.ts and native font files

### Login: phone → OTP → conditional name (W107)
- `LoginScreen` steps (`authStep`): `phone` → `otp` → `name`; `otpState` is derived
  (`authStep === 'otp'`). The name step is conditional, not part of the happy path.
- After `verifyOtp`, `completeLogin` reads `GET /profile` with the fresh token. A returning customer
  (`hasName: true`) signs in with the stored name; a first-time customer (`hasName: false`) sees the
  name step. `hasName` is a server-derived field (`name != 'Faazio User'`), not a client heuristic.
- The verified session is held in memory until the name is submitted (`submitName`), so abandoning
  the name step does not leave a signed-in, unnamed session. The chosen name is then persisted by
  `GatewayClient.updateProfileName()` → `PUT /profile` (`{name}`), writing `checkout.users.name` +
  `accounts.profile.name` in one transaction.
- OTP → phone back is unchanged; the phone step keeps **Skip**/X; the post-verification name step
  is mandatory (no back control, hardware back consumed).

### Verification
-**Typecheck:** `npm run ts:check` PASS (0 errors)
-**Boundaries:** `npm run check:boundaries` PASS (dependency cruised)
- Build via CI only (Gradle locally OOMs); deploy via `gh workflow run android-debug.yml`

**Files impacted:**
- `features/auth/LoginScreen.tsx` (phone/OTP/conditional-name flow, profile lookup, name write-through)
- `services/api/GatewayClient.ts` (`getProfile(accessToken?)`, `updateProfileName`)
- `server/gateway/internal/checkout/repo.go` (`Profile.hasName`, `ProfileByUser`, `UpdateProfileName`)
- `features/cart/CartView.tsx` (checkout flow restructure)
- `features/cart/utils.ts` (CheckoutStep type)
- `features/cart/payment/PaymentOptionsScreen.tsx` (coupon field)
- `features/cart/payment/components/BreakdownCard.tsx` (expandable breakdown)
- `components/shared/StoreCardBase.tsx` (remove review counts)
- `components/shared/OfflinePage.tsx` (brand logo + cartoon)
- `components/shared/OfflineToast.tsx` (optional character)
- `lib/languages.ts` (English only)

**Data flow inputs → outputs:**
- **Login:** phone → OTP → ✅ deliver → state = name + phone → LanguageSelection → App
- **Checkout (PICKUP):** cartItems + coupon → PAYMENT (fulfilment PICKUP) → breakdownDelivery: undefined → Apply Coupon → Place Order
- **Checkout (DELIVERY):** cartItems + coupon → PAYMENT (fulfilment DELIVERY) → breakdownDelivery {...} → Address Input → Apply Coupon → Address Valid → Place Order

**Date:** 2026-11-22

## W108 — Navigation/search gap cleanups (KNOWN_GAPS)

**Status:** 🟢 Shipped. No DB migration, no gateway change.

- **Removed the dead `PaymentOptions` route** from `AppNavigator`/`RootStackParamList`; checkout still
  renders `PaymentOptionsScreen` inline from `CartView` (the only path).
- **Basket "Checkout" CTA** in `SubAppWrapper` now calls the existing `onCartPress` handoff instead of
  being a no-op `TouchableOpacity`.
- **FOOD search config**: `SearchRouteScreen` selects `foodSearchConfig` for the FOOD sub-app (with the
  dish → PDP press handler), and forwards the route's `initialMode` so deep links can preselect a mode.

**Verification:** `npm run ts:check` · `npm run check:boundaries` · `npm test` (85/85) all pass.
