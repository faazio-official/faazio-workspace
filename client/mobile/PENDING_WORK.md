# W106 — Checkout, login, and UI cleanups per user complaints (audio 1-6)

**Status:** 🟢 Shipped. No DB migration, no gateway change.

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

### Verification
-**Typecheck:** `npm run ts:check` PASS (0 errors)
-**Boundaries:** `npm run check:boundaries` PASS (dependency cruised)
- Build via CI only (Gradle locally OOMs); deploy via `gh workflow run android-debug.yml`

**Files impacted:**
- `features/auth/LoginScreen.tsx` (name input, validation)
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