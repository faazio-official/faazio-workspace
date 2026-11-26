# Customer app — interaction workflows

**Product:** Faazio SuperApp (consumer)
**Entry:** `client/mobile/index.js` → `App.tsx` → `src/navigation/AppNavigator.tsx`
**Root routes:** `Onboarding`, `Login`, `LanguageSelection`, `Location`, `MainTabs` (`Home`,
`Favourites`, `Cart`, `You`), `SubApp`, `FoodApp` (`FoodStack`), `ProductDetail`, `Search`,
`Cart`, `CategoryDrillIn`, `VendorDetails`, `DealsLanding`, `MyOrders`, `OrderDetails`,
`Notifications`, `SavedAddresses`, `UserDetails`, `FaazioRewards`, `PrescriptionFlow`,
`MedicalShopDetails`, `BloodDonor*`, `SellWithUs`, `SellerRequests`, `SellerRequestDetail`,
`SellerPlatformFeeRequest`, `FeeChangeRequests`, `RateVendor`, `DeleteAccount`,
`RequestDataDeletion`, `Theme`, `PaymentCallback`,
`ActiveCall` (masked call to the delivery partner).

**State:** `src/state/` (auth, cart, favorite, orders, rewards, location, addresses, serviceability,
language, onboarding, pharma, bloodDonor, search, foodFilter, vendorRating, remoteConfig,
connectivity, theme, call).
**Data:** `GatewayClient` (`src/services/api/GatewayClient.ts`) is the only online origin.
`@data/*` is an offline/error shell or type source. Home/Food/Pharma online rails render server
rows or honest empty/error states (fixtures only when the gateway is disabled).

## Flow inventory

Domain indexes are the entry point for each area; every flow page is linked from them.

| Domain | Flow | Route(s) / screen | Doc |
|---|---|---|---|
| Onboarding | First-run carousel | `Onboarding` (`features/onboarding/OnboardingScreen.tsx`) | [onboarding/index.md](./onboarding/index.md) |
| Onboarding | Phone OTP login | `Login` (`features/auth/LoginScreen.tsx`) | [phone-otp-login.md](./onboarding/phone-otp-login.md) |
| Onboarding | Language selection | `LanguageSelection` | [onboarding/index.md](./onboarding/index.md) |
| Onboarding | Location picker | `Location` (`features/auth/LocationScreen.tsx`) | [location-picker.md](./onboarding/location-picker.md) |
| Onboarding | Service-area gate | App-level `ServiceAreaBlockedPage` (no route) | [service-area-gate.md](./onboarding/service-area-gate.md) |
| Home | SDUI home feed | `MainTabs` → `Home` (`features/home/HomeTabScreen.tsx`) | [home/index.md](./home/index.md) · [home-feed.md](./home/home-feed.md) |
| Home | Sponsored rail | Home sections | [sponsored-rail.md](./home/sponsored-rail.md) |
| Discovery | Mart / Food / Pharma browse | `SubApp`, `FoodApp`, `CategoryDrillIn`, `VendorDetails` | [discovery/index.md](./discovery/index.md) · [store-drillin.md](./discovery/store-drillin.md) |
| Discovery | Food search | `FoodApp` → `Search` (`FoodSearchScreen`) | [discovery/food-search.md](./discovery/food-search.md) |
| Discovery | Product detail | `ProductDetail` | [product-detail.md](./discovery/product-detail.md) |
| Discovery | Product review | `ProductDetail` → `RateProduct` | [product-review.md](./discovery/product-review.md) |
| Cart | Add to cart | Cart tab / product cards | [cart-checkout/index.md](./cart-checkout/index.md) · [add-to-cart.md](./cart-checkout/add-to-cart.md) |
| Checkout | Delivery-fee quote | `Cart` → FULFILLMENT step | [delivery-fee-quote.md](./cart-checkout/delivery-fee-quote.md) |
| Checkout | Place order + payment | `Cart` → PAYMENT → RECEIPT, `PaymentCallback` | [place-order.md](./cart-checkout/place-order.md) |
| Orders | Order history | `MyOrders`, `OrderDetails` | [orders/index.md](./orders/index.md) · [order-history.md](./orders/order-history.md) |
| Orders | Order feedback | `OrderDetails` → `OrderFeedback` | [order-feedback.md](./orders/order-feedback.md) |
| Calling | Outgoing masked call (customer → rider) | `OrderDetails` → `ActiveCall` | [calling/index.md](./calling/index.md) · [calling/outgoing.md](./calling/outgoing.md) |
| Calling | Incoming masked call (rider → customer) | `ActiveCall` (FCM full-screen-intent ring on Android; PushKit + CallKit on iOS) | [calling/incoming.md](./calling/incoming.md) · [calling/edge-cases.md](./calling/edge-cases.md) |
| Profile | Account / profile | `MainTabs` → `You`, `UserDetails` | [profile/index.md](./profile/index.md) |
| Profile | Profile details | `UserDetails` (`UserDetailsScreen.tsx`) | [profile/user-details.md](./profile/user-details.md) |
| Profile | Saved addresses | `SavedAddresses` | [saved-addresses.md](./profile/saved-addresses.md) |
| Profile | Rewards ledger | `FaazioRewards` | [rewards-ledger.md](./profile/rewards-ledger.md) |
| Profile | Rate vendor | `RateVendor` | [rate-vendor.md](./profile/rate-vendor.md) |
| Profile | Language (English / Tamil) | `Language` (`features/profile/LanguageScreen.tsx`) | [profile/language.md](./profile/language.md) |
| Notifications | In-app inbox + badge | `Notifications` (`features/notifications/NotificationsScreen.tsx`) | [profile/notifications.md](./profile/notifications.md) |
| Pharma | Prescription upload | `PrescriptionFlow` | [pharma/index.md](./pharma/index.md) · [prescription-upload.md](./pharma/prescription-upload.md) |
| Pharma | Blood donor | `BloodDonor` | [blood-donor.md](./pharma/blood-donor.md) |
| Pharma | Blood donor detail / request description | `BloodDonorDetails`, `BloodRequestDescription` | [pharma/blood-donor-details.md](./pharma/blood-donor-details.md) |

## Cross-cutting rules

- **Auth gate:** the root navigator starts at `MainTabs` when authenticated and the origin is in an
  enabled coverage district, `Login` when onboarding was seen, else `Onboarding` (`AppNavigator.tsx`
  initial route). An authenticated origin outside coverage renders the app-level
  `ServiceAreaBlockedPage` instead of the navigator.
- **Offline:** `connectivityStore` probes `GET /health`; offline navigation is blocked/replayed by
  `navigation/offlineNavigationGuard.ts`. Offline is not a mock mode.
- **No fabricated state:** empty carts, empty orders, and empty feeds render honest empty states.
  There is no client-generated demo order, balance, or coin ledger.
- **Bottom nav overlay:** the hub pill dock (`MainTabs` `HubTabBar`) is an absolute transparent
  overlay, so Home / Favourites / Cart / You content scrolls behind and around the capsule. Tab
  screens reserve its measured height via `hooks/useTabBarClearance()` for their scroll tails and
  fixed footers (`BottomPayBar`, the BAG footer); the hook returns `0` on pushed routes, where the
  same view renders without a tab bar.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Customer-specific gaps currently include the
invoice-PDF stub, the `@mock` self-pickup resolver, and
**calling is end-to-end on Android, with the iOS PushKit/CallKit ring implemented but not yet
verified on a device**: the customer-initiated server endpoint and the APNs VoIP push sender exist,
while the PSTN provider bridge is unprovisioned
([calling/index.md](./calling/index.md)).
The Home header category rail reads the server taxonomy only (`GET /categories/rail`) — there is no
fixture substitution.

## Not yet documented (tracked in KNOWN_GAPS.md)

`Favourites`, root `Search`, `DeleteAccount`, `RequestDataDeletion`, `Notifications`,
`SellerRequests` / `SellerRequestDetail` / `SellerPlatformFeeRequest` / `FeeChangeRequests`,
`DealsLanding`, and the Food venue screens (`RestaurantProfile`, `RestaurantOffers`,
`RestaurantMenu`). `MedicalShopDetails` and `SellWithUs` are described only inside their domain
indexes. See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md) → "Documentation coverage gaps".
