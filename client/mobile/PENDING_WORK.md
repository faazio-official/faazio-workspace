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

### Login: two-step name → phone, name persisted server-side (W107)
- `LoginScreen` is now three steps (`authStep`: `name` → `phone` → `otp`): name + **Continue**, then
  the `+91` phone field + **Send code**, then the unchanged OTP screen. `otpState` is derived
  (`authStep === 'otp'`).
- **Fixed "Send code" doing nothing**: `requestOtp` was missing `name` in its `useCallback` deps, so
  the closure always read the first render's `''` and hit the name guard before `sendOtp`.
- Typed name is kept in the login payload (`displayName()` only as a fallback) **and** persisted by
  `GatewayClient.updateProfileName()` → `PUT /profile` (`{name}`), a new checkout endpoint writing
  `checkout.users.name` + `accounts.profile.name` in one transaction.
- Back from phone → name preserves the typed name; OTP → phone unchanged; hardware back follows the
  same steps.

### Verification
-**Typecheck:** `npm run ts:check` PASS (0 errors)
-**Boundaries:** `npm run check:boundaries` PASS (dependency cruised)
- Build via CI only (Gradle locally OOMs); deploy via `gh workflow run android-debug.yml`

**Files impacted:**
- `features/auth/LoginScreen.tsx` (three-step name/phone/OTP, stale-closure fix, name write-through)
- `services/api/GatewayClient.ts` (`updateProfileName`)
- `server/gateway/internal/checkout/{repo,handler}.go` (`UpdateProfileName`, `PUT /profile`)
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
