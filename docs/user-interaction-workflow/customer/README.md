# Customer app — interaction workflows

**Product:** Faazio SuperApp (consumer)
**Entry:** `client/mobile/index.js` → `App.tsx` → `src/navigation/AppNavigator.tsx`
**Root routes:** `Onboarding`, `Login`, `LanguageSelection`, `Location`, `MainTabs` (`Home`,
`Favourites`, `Cart`, `You`), `SubApp`, `FoodApp` (`FoodStack`), `ProductDetail`, `Search`,
`Cart`, `CategoryDrillIn`, `VendorDetails`, `DealsLanding`, `MyOrders`, `OrderDetails`,
`Notifications`, `SavedAddresses`, `UserDetails`, `FaazioRewards`, `PrescriptionFlow`,
`MedicalShopDetails`, `BloodDonor*`, `SellWithUs`, `SellerRequests*`, `FeeChangeRequests`,
`PaymentOptions`, `PaymentCallback`.

**State:** `src/state/` (auth, cart, favorite, orders, rewards, location, language, onboarding,
pharma, bloodDonor, search, foodFilter, vendorRating, remoteConfig, connectivity).
**Data:** `GatewayClient` (`src/services/api/GatewayClient.ts`) is the only online origin.
`@data/*` is an offline/error shell or type source, never substituted on a live failure.

## Flow inventory

| Domain | Flow | Route(s) / screen | Doc |
|---|---|---|---|
| Onboarding | First-run carousel | `Onboarding` (`features/onboarding/OnboardingScreen.tsx`) | [onboarding/index.md](./onboarding/index.md) |
| Onboarding | Phone OTP login | `Login` (`features/auth/LoginScreen.tsx`) | [phone-otp-login.md](./onboarding/phone-otp-login.md) |
| Onboarding | Language selection | `LanguageSelection` | [onboarding/index.md](./onboarding/index.md) |
| Onboarding | Location picker | `Location` (`features/auth/LocationScreen.tsx`) | [location-picker.md](./onboarding/location-picker.md) |
| Home | SDUI home feed | `MainTabs` → `Home` (`features/home/HomeTabScreen.tsx`) | [home-feed.md](./home/home-feed.md) |
| Home | Sponsored rail | Home sections | [sponsored-rail.md](./home/sponsored-rail.md) |
| Discovery | Mart / Food / Pharma browse | `SubApp`, `FoodApp`, `CategoryDrillIn`, `VendorDetails` | [store-drillin.md](./discovery/store-drillin.md) |
| Discovery | Product detail | `ProductDetail` | [product-detail.md](./discovery/product-detail.md) |
| Cart | Add to cart | Cart tab / product cards | [add-to-cart.md](./cart-checkout/add-to-cart.md) |
| Checkout | Delivery-fee quote | `Cart` → FULFILLMENT step | [delivery-fee-quote.md](./cart-checkout/delivery-fee-quote.md) |
| Checkout | Place order + payment | `Cart` → PAYMENT → RECEIPT, `PaymentCallback` | [place-order.md](./cart-checkout/place-order.md) |
| Orders | Order history | `MyOrders`, `OrderDetails` | [order-history.md](./orders/order-history.md) |
| Profile | Account / profile | `MainTabs` → `You`, `UserDetails` | [profile/index.md](./profile/index.md) |
| Profile | Saved addresses | `SavedAddresses` | [saved-addresses.md](./profile/saved-addresses.md) |
| Profile | Rewards ledger | `FaazioRewards` | [rewards-ledger.md](./profile/rewards-ledger.md) |
| Pharma | Prescription upload | `PrescriptionFlow` | [prescription-upload.md](./pharma/prescription-upload.md) |
| Pharma | Blood donor | `BloodDonor`, `BloodDonorDetails`, `BloodRequestDescription` | [blood-donor.md](./pharma/blood-donor.md) |

## Cross-cutting rules

- **Auth gate:** the root navigator starts at `MainTabs` when authenticated, `Login` when onboarding
  was seen, else `Onboarding` (`AppNavigator.tsx` initial route).
- **Offline:** `connectivityStore` probes `GET /health`; offline navigation is blocked/replayed by
  `navigation/offlineNavigationGuard.ts`. Offline is not a mock mode.
- **No fabricated state:** empty carts, empty orders, and empty feeds render honest empty states.
  There is no client-generated demo order, balance, or coin ledger.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Customer-specific gaps currently include the dead
`PaymentOptions` route registration, the unreachable `Checkout` button in `SubAppWrapper`, the
invoice-PDF stub, and the root `Search` `FOOD` config mismatch.
