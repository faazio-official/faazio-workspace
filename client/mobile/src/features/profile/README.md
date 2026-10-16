# User Profile Module

This directory handles the user account surface. The **My Account** screen lives
exclusively on the main root tab bar (`MainTabs` → `You`). The Mart sub-app wrapper
now also exposes a **"You"** tab (left of Cart) that pushes the account page; other
sub-app wrappers (Pharma / Food) intentionally have no Account/Profile tab.

## 📁 Key Files
- `AccountScreen.tsx` / `YouScreen.tsx`: Thin wrappers rendering the shared
  presentational `AccountView`. `AccountScreen` (tab) omits the back arrow;
  `YouScreen` (pushed) wires `onBack`.
- `AccountView.tsx`: Presentational "My Account" page — header,
  FaazioCoins streak card (7-day fire streak + balance), grouped navigation list
  (incl. **My Orders**, **Favourites** and **Sell with us** rows), and logout. Reads content from
  `@data/account/*`; the FaazioCoins card reads `rewardsStore`.
- `FavouritesScreen.tsx` / `FavouritesPageView.tsx` (in `features/favourites/`): the
  search-results-style **Favourites** page opened from My Account — a static header pill,
  All/Mart/Food/Pharma segmented toggle, sort-only rail, and a list resolved from
  `useFavoriteStore` via the catalog index (hearts toggle favourites live).
- `SellWithUsScreen.tsx`: "Sell with us" partner onboarding — collects the required
  details (`SELLER_SETUP_FIELDS` from `@data/seller/sellerSetup.ts`) and submits them via
  `GatewayClient.submitSellerApplication` (`POST /sellers` → `sellers.sellers`,
  created `PENDING_REVIEW`; fixture fallback confirms offline).
- `MyOrdersScreen.tsx`: "My Orders" — a **sub-app chip rail** (All / Mart / Food /
  Grocery / Pharma) plus a status **filter sheet**. Orders are filtered by
  sub-app × status (AND). Status counts are derived at runtime from `myOrders`.
- `MyOrdersAppRail.tsx`: Presentational sub-app chip rail (reuses `SECTOR_VISUALS`
  from `@/theme/sectorVisuals`).
- `MyOrdersFilterSheet.tsx`: Bottom sheet (on shared `SlideUpSheet`) to filter by
  order status — single-select, staged then applied.
- `RateVendorScreen.tsx`: Root `RateVendor` route — the vendor rating form (stars +
  optional ≤280-char comment; submit/update). Reachable from My Orders, Order Details,
  and every vendor surface; verified-buyer-only (gate re-checked on open). One live
  rating per `(user, vendor)`, latest wins. Public display is full name only; nothing
  rating-related is logged.
- **Rating CTA in orders:** `MyOrdersScreen` cards and the `OrderDetailsScreen` "Rate
  your purchase" card render the shared `VendorRateButton`, which hides itself unless
  the signed-in user is eligible. Eligibility/state come from `services/vendorRatings.ts`
  + `state/vendorRatingStore.ts` (see `docs/architecture/mobile-app.md`).

## 🛠️ Implementation Standards
- **Data-driven**: Screen is presentational; profile / orders / nav content comes
  from `@data/account/*` (`profile.ts`, `orderStatus.ts`, `accountNav.ts`,
  `orders.ts`); seller setup details come from `@data/seller/sellerSetup.ts`.
- **Single owner**: Account lives only on the root tab bar — never inside a
  sub-app wrapper. Logout clears the cart store (and the vendor-rating store) and
  resets navigation to Login.
- **Responsive**: Uses `hs`/`vs`/`ms` scale helpers and `AppText` throughout.
- **Reuse**: Sub-app visuals come from `@/theme/sectorVisuals` (shared with Home's
  `ExploreSectorsSection`); the status filter sheet reuses `@/components/shared/SlideUpSheet`.
