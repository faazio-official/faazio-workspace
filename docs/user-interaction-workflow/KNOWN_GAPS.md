# Known gaps and incomplete workflows

**Status:** living audit of the flows documented in this folder.
**Rule:** an entry stays here until the gap is fixed in code. When you fix one, delete the entry in
the same change (see [README.md](./README.md) → sync rule). Never hide a partial flow behind a
"shipped" page; state it here and mark the page **Status: Partial**.

Scope: customer (`index.js`), seller (`index.seller.js` + `client/web/platform`), delivery
(`index.delivery.js`), and the shared auth surfaces. All paths are relative to the repo root.

## Customer

| Gap | Evidence | Impact |
|---|---|---|
| `PaymentOptions` is a registered but dead route | `client/mobile/src/navigation/AppNavigator.tsx:146-149`; the component is rendered inline by `client/mobile/src/features/cart/CartView.tsx:1184` and never navigated to | Dead route in the stack; checkout uses the inline sheet instead |
| Basket "Checkout" CTA in `SubAppWrapper` is unreachable | `client/mobile/src/components/SubAppWrapper.tsx:332-334` — `TouchableOpacity` has no `onPress` | Mart/Food/Pharma basket CTA does nothing |
| Root `Search` renders the wrong config for `FOOD` | `client/mobile/src/features/search/SearchRouteScreen.tsx:29-42` handles only `FA_MART`/`PHARMA` and falls back to the home config; `foodSearchConfig.tsx` exists but is not selected | Food search shows the generic home search shell |
| `Search` route drops `initialMode` | Route type carries `initialMode` but `SearchRouteScreen.tsx:19` reads only `subApp` and `initialQuery` | Deep links cannot preselect a search mode |
| Invoice PDF is never generated | Gateway `invoiceURL` returns `""` when `tax.tax_invoices.pdf_key` is empty (`server/gateway/internal/checkout/handler.go:220-228`); nothing writes `pdf_key` | Mobile shows the on-screen invoice but "Download PDF invoice" is never offered (`OrderDetailsScreen.tsx:179,403`) |
| Order cancellation is a support hand-off, not an API | `client/mobile/src/features/profile/OrderDetailsScreen.tsx:188-199` opens a `mailto:` | No in-app cancel state or cancellation endpoint |
| Dev-only placeholder login | `client/mobile/src/features/auth/LoginScreen.tsx` `submitOtp` path under `__DEV__` when Firebase is unconfigured | Not a release path, but it is a mock session seam |
| Food PDP has no restaurant affordance | `client/mobile/src/features/food/utils/restaurantForProduct.ts:46-57` is an intentional server-only stub returning `undefined` | Deliberate no-fabrication choice; do not "fix" with a fixture |
| Stale home-feed mock seam | `client/mobile/src/services/homeFeed.ts` exports fixture-backed `getHomeSections` / `getFilterFeedPage` / `getFilterChips`, but no live screen imports it | Dead mock seam; remove it |
| Blood-donor `StepPlaceholder` dead code | `client/mobile/src/features/pharma/blood-donor/BloodDonorScreen.tsx:95` renders a placeholder for an unknown step id | Defensive dead path; add the step or remove it |
| Stale prescription mock comments | `client/mobile/src/features/pharma/prescription/PrescriptionFlowScreen.tsx:106-107,120` mention a fixture fallback that no longer exists | Misleading; the code is server-only |

## Seller (portal + partner app)

| Gap | Evidence | Impact |
|---|---|---|
| Fake loading latency | `client/web/platform/src/lib/api/hooks.ts:56-58` (`useMockLoading`, 320 ms) is used by 37 files under `app/` | Violates the no-mocks rule; pages exercise loading states with fabricated delay |
| Local-only seller surfaces | `app/seller/notifications/page.client.tsx:12` (`INITIAL` list), `app/seller/support` (local tickets), `hub` checklist, `restaurant-status`, `rush-hour` (client-only store in `src/lib/sellerUi.ts`) | These screens are not persisted/DB-backed yet |
| "Simulate scan" toast | `client/web/platform/app/seller/orders/page.client.tsx:264` | Demo affordance, not a real scan/handover flow |
| Toast-only admin actions | District `content` publish, `orders` escalate, `pricing-audit` contact, super `settings` save | UI reports success without a gateway write |
| District-admins page is district-locked | `app/admin/super/district-admins/page.client.tsx:63-85` (`TTC_CODE = "TTC"`) | Cannot provision admins outside Tiruchirappalli |
| Native seller auth is unused | `GatewayClient.portalLogin/portalRefresh/portalLogout` exist (`src/services/api/GatewayClient.ts:826-866`) but the seller app is a WebView shell (`SellerPartnerNavigator.tsx`); the portal owns the session | Intentional today; prune or wire if native seller auth is ever built |
| Product name/description edit and delete are local-only | `client/web/platform/src/lib/api/index.ts:468-481` (`updateProduct`) and `:520-530` (`deleteProduct`) mutate the Zustand store/audit only; there is no `DELETE /seller/products/{id}` route | Edits/deletes do not persist to the gateway (price/image updates do) |
| Hardcoded tax constants on new-product display | New-product page shows GST/TCS/TDS constants | Display-only; the server remains the money authority |

## Delivery

| Gap | Evidence | Impact |
|---|---|---|
| Offer modal is not navigated from a screen | `AcceptReject` is registered in `DeliveryPartnerNavigator.tsx:43` but no screen calls `navigate('AcceptReject')` | Offers arrive only via push/deep link |
| Re-upload request endpoint is retired | `PUT /delivery/register/{id}/reupload-request` always returns `410 Gone` (`server/gateway/internal/delivery/handler.go:428-434`); admins use `.../documents/{docType}/reupload` | Old clients get a hard failure |
| iOS background limits | Documented in `client/mobile/PENDING_WORK.md` | Force-quit/background location is best-effort |
| Multi-vendor orders are not auto-dispatched | `docs/architecture/server-gateway-plan.md:340-342` | Orders spanning >1 store need manual allocation |
| Payout splitting is not implemented | `docs/architecture/server-gateway-plan.md:336-338`; `delivery.delivery_orders.payout_amount_paisa` is display-only (`server/supabase/migrations/0042_delivery.sql:144-146`) | Rider/seller/platform transfers are not automated |

## Server / data

| Gap | Evidence | Impact |
|---|---|---|
| `inventory.stock_reservations` has no Go reader/writer | Created in `server/supabase/migrations/0001:119`; only the SQL expiry sweep in `0003:24-40`; no non-test Go reference | Reservation rows are swept, not used by checkout |
| PDF invoice generation is absent | See customer invoice row above | No downloadable GST invoice |
| Legacy tables kept read-only | `checkout.coupons` (superseded by `promo.coupons`), `payments.settlement_ledger` (live payouts compute from orders), `sellers.seller_vendor_counts` (no Go reference), `/state-admins` aliases | Not user-flow breakage; do not add new writes |
| Media/Razorpay/FCM degrade honestly when unconfigured | R2 unset → media disabled; Razorpay unset → `503 payments_disabled`; FCM unset → push disabled | Honest failure, not mocked success — keep it that way |
| Inline fixture copies still exist in screens | `data/DATA_CONTROL.md:480-489` (`PharmaScreen`, `FaMartScreen`, `ProductDetailView`) | Must be labelled offline/error shells or removed |
| `SDUINode` is aspirational | `data/schema.ts` (`@aspirational`) | Type contract only; no data file produces SDUI trees |

## Shared auth

The two authorities are documented in [shared/auth-otp.md](./shared/auth-otp.md). No known gap in
the gateway verifier order (Firebase RS256 → portal HS256 → legacy Supabase HS256), but the
`__DEV__` placeholder login above remains a client-side mock seam.

## Documentation coverage gaps (routes without a flow page yet)

These routes exist in code but do not have a dedicated page in this folder yet. They are tracked
here so the folder never claims full coverage it does not have. Add a page before changing the flow.

### Customer

| Route / surface | Screen | Notes |
|---|---|---|
| `Favourites` tab | `features/favourites/FavouritesScreen.tsx`, `FavouritesTabScreen.tsx` | `GET/PUT/DELETE /favourites*` → `favourites.items` |
| `Search` | `features/search/SearchRouteScreen.tsx` | See the FOOD-config gap above |
| `RateVendor` | `features/profile/RateVendorScreen.tsx` | `PUT /vendors/{id}/rating` |
| `DeleteAccount`, `RequestDataDeletion` | `features/profile/DeleteAccountScreen.tsx`, `RequestDataDeletionScreen.tsx` | `DELETE /users/me`, `POST /users/me/data-deletion` |
| `Notifications` | `features/notifications/NotificationsScreen.tsx` | `GET /notifications`, read/read-all |
| `SellerRequests`, `SellerRequestDetail`, `SellerPlatformFeeRequest`, `FeeChangeRequests` | `features/seller-onboarding/` | Seller application/fee-change boards |
| `DealsLanding` | `features/ecommerce/DealsLandingScreen.tsx` | Mart deals |
| `RestaurantProfile`, `RestaurantOffers`, `RestaurantMenu` | `FoodStack.tsx:25-27` | Food venue screens (only the Food feed is covered) |

### Delivery

| Route / surface | Screen | Notes |
|---|---|---|
| `SubmissionSuccess` | `screens/SubmissionSuccessScreen.tsx` | Pending-application terminal state referenced from onboarding |

### Seller web portal

| Domain | Routes | Notes |
|---|---|---|
| Ads | `/seller/ads` | `GET/POST /ads/*`, campaigns/slots |
| Promotions | `/seller/promotions` | `GET /seller/promotions`, opt-in |
| Analytics | `/seller/analytics` | `GET /analytics/series|ranks` |
| Reviews | `/seller/reviews` | `GET /vendors/{id}/reviews*` |
| Prescriptions | `/seller/prescriptions` | `GET /seller/prescriptions*`, quotes |
| Settings / outlet info | `/seller/settings`, `/seller/outlet-info` | Store fee/live/cover |
| Hub / explore | `/seller/hub`, `/seller/explore` | Checklist + discovery surfaces (partly local-only) |
| District admin | `/admin/district/*` | Documented only where a seller flow references it (KYC review, payouts) |
| Super admin | `/admin/super/*` | Documented only where a seller flow references it |

## How to close a gap

1. Fix the code (or explicitly retire the surface).
2. Update the flow page (Status → Shipped/Gap as appropriate) and this file in the same change.
3. Run the verification contract from `client/mobile/`:
   ```bash
   npm run ts:check
   npm run check:boundaries
   ```
4. Never run Gradle locally — Android builds are CI-only.

## Linked docs

- `docs/user-interaction-workflow/README.md`
- `data/DATA_CONTROL.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md`
- `docs/architecture/server-gateway-plan.md`
