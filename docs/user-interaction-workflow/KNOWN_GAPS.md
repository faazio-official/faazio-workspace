# Known gaps and incomplete workflows

**Status:** living audit of the flows documented in this folder.
**Rule:** an entry stays here until the gap is fixed in code. When you fix one, delete the entry in
the same change (see [README.md](./README.md) → sync rule). Never hide a partial flow behind a
"shipped" page; state it here and mark the page **Status: Partial**.

Scope: customer (`index.js`), seller (`index.seller.js` + `client/web/platform`), delivery
(`index.delivery.js`), and the shared auth surfaces. All paths are relative to the repo root.

## Documented determinations (verified — not gaps)

Recorded here so a future contributor does not "fix" something that is not broken.

| Determination | Evidence | Effect |
|---|---|---|
| ATT not required | `ios/Faazio/PrivacyInfo.xcprivacy` `NSPrivacyTracking = false`; no `ATTrackingManager` / `requestTrackingAuthorization` / `NSUserTrackingUsageDescription` anywhere in `client/mobile/src/` or `ios/Faazio/Info.plist`; no ad SDK / IDFA / `AD_ID` in `package.json` or `android/app/src/main/AndroidManifest.xml` | No ATT prompt or tracking usage description is needed for the iOS release. First-party closed-loop ads (`/ads/*`) are slot-based only, not tracking — do **not** add `NSUserTrackingUsageDescription`. See `docs/architecture/mobile-app.md` → "App Tracking Transparency (ATT)". |

## Customer

| Gap | Evidence | Impact |
|---|---|---|
| `PaymentOptions` is a registered but dead route | `client/mobile/src/navigation/AppNavigator.tsx:146-149`; the component is rendered inline by `client/mobile/src/features/cart/CartView.tsx:1184` and never navigated to | Dead route in the stack; checkout uses the inline sheet instead |
| `POST /orders/{id}/payments` (COD pay / switch-to-COD) is **not idempotent** | `server/gateway/internal/checkout/handler.go:590-647` inserts a new `checkout.payments` row on every call with no dedup key; captured by `server/gateway/internal/checkout/place_order_integration_test.go` `TestPayOrderRepeatedRecordsSecondPayment_KNOWN_GAP` | A retried or duplicated pay call (switch-to-COD after a partial UPI attempt, network re-send, double-tap) records a **second** PAID ledger row, so the payment ledger over-counts. Needs an idempotency key/guard like `POST /orders` |
| Basket "Checkout" CTA in `SubAppWrapper` is unreachable | `client/mobile/src/components/SubAppWrapper.tsx:332-334` — `TouchableOpacity` has no `onPress` | Mart/Food/Pharma basket CTA does nothing |
| Root `Search` renders the wrong config for `FOOD` | `client/mobile/src/features/search/SearchRouteScreen.tsx:29-42` handles only `FA_MART`/`PHARMA` and falls back to the home config; `foodSearchConfig.tsx` exists but is not selected | Food search shows the generic home search shell |
| `Search` route drops `initialMode` | Route type carries `initialMode` but `SearchRouteScreen.tsx:19` reads only `subApp` and `initialQuery` | Deep links cannot preselect a search mode |
| Invoice PDF is never generated | Gateway `invoiceURL` returns `""` when `tax.tax_invoices.pdf_key` is empty (`server/gateway/internal/checkout/handler.go:220-228`); nothing writes `pdf_key` | Mobile shows the on-screen invoice but "Download PDF invoice" is never offered (`OrderDetailsScreen.tsx:179,403`) |
| Order cancellation is a support hand-off, not an API | `client/mobile/src/features/profile/OrderDetailsScreen.tsx` opens a `mailto:` | No in-app cancel state or cancellation endpoint |
| PSTN bridging is wired but unprovisioned | `server/gateway/internal/delivery/call_provider.go` (Exotel Connect, `provider_call_ref`), `PSTN_*` / `EXOTEL_*` env, `render.yaml` | The bridge, webhook and reconciliation exist, but no provider credentials are set, so a deployment without them keeps the dial-only masked handoff. Needs a real account + a publicly reachable `PSTN_WEBHOOK_URL` to verify answer/terminal events |
| Dark mode is partial | `client/mobile/src/theme/theme.ts` (`darkPalette`) + `useThemeMode` are wired into the shell, tab bar, `Screen`, `SplashFallback`, `OfflinePage`, `ErrorBoundary`, and Account/Appearance surfaces. Home, Mart/Food/Pharma sub-apps, search, orders and modals still hardcode light colours | Selecting Dark/Auto-dark renders a dark shell around light screens; per-screen token conversion is the follow-up. Mechanism/default/persistence are complete (see `customer/profile/theme.md`) |
| Dev-only placeholder login | `client/mobile/src/features/auth/LoginScreen.tsx` `submitOtp` path under `__DEV__` when Firebase is unconfigured | Not a release path, but it is a mock session seam |
| Food PDP has no restaurant affordance | `client/mobile/src/features/food/utils/restaurantForProduct.ts:46-57` is an intentional server-only stub returning `undefined` | Deliberate no-fabrication choice; do not "fix" with a fixture |
| Food search card / shared PDP add skips the add-on picker | `client/mobile/src/features/food/components/SearchDishCard.tsx:39-41` and `CommonProductDetailView.tsx:142-148` call `addToCart` directly; the picker is wired on `RestaurantMenuScreen` / `RestaurantProfileScreen` where dish → venue is known | A dish with extras can still be added from search, just without extras. The picker needs the venue id to fetch `GET /venues/{venueId}/menu/{dishId}/addons` |
| Category Tamil copy is not searched | `taxonomy.categories.name_ta`/`description_ta` (`0107`) are display-only; only `catalog.products` has Tamil FTS | Typing a Tamil category name does not match the category rail/drill-in (the products under it still match by their own Tamil titles). Category search runs on `search_query`/`name`, so matching Tamil would need a Tamil folder term in `taxonomy.categories` — unstarted. Scope: `client/mobile/PENDING_WORK.md` → W99 |
| Pull-to-refresh can return the same cached doc for ~300 s | Gateway reads are Valkey-cached (e.g. `GET /sdui/*` at 300 s; see `docs/architecture/caching-cloudflare-valkey.md`). `useHomeFeed`/`useRestaurantFeed`/`usePharmaFeed`/`useCategoryVendors`/`useCategoryTree`/`usePagedRail` re-read the cache, not a bypass | A pull may show identical content until the key lapses. A true "live" pull needs a gateway cache bypass (`Cache-Control: no-cache` or `?fresh=1`) — a server-side decision, out of client scope; the client still refreshes correctly and never fabricates |

## Seller (portal + partner app)

| Gap | Evidence | Impact |
|---|---|---|
| Store fee/cover have no seller UI | `PUT /seller/stores/{id}/fee` is admin-only (`server/gateway/internal/directory/handler.go:500-503`); no client calls `PUT /seller/stores/{id}/cover` | Sellers can only file a fee-change request (`/seller/fee-change-request`); cover image cannot be set from the console |
| Fee-change request has no cancel | No endpoint sets `CANCELLED` although the schema allows it | A pending request can only be resolved by an admin |
| Local-only seller surfaces | `app/seller/support` (local tickets), `hub` checklist, `restaurant-status`, `rush-hour` (client-only store in `src/lib/sellerUi.ts`) | These screens are not persisted/DB-backed yet |
| Toast-only admin actions | District `content` publish, `orders` escalate, `pricing-audit` contact, super `settings` save | UI reports success without a gateway write |
| District-admins page is district-locked | `app/admin/super/district-admins/page.client.tsx:64` (`TTC_CODE = "TTC"`, used through `:124`) | Cannot provision admins outside Tiruchirappalli |
| District fixtures are a manual mirror of the DB master | `data/districts.ts` (+ `client/web/platform/src/data/districts.ts`) vs `admins.district_master` (authoritative since `0114`) | A district created through **District coverage** is valid everywhere server-side immediately, but the offline fixtures do not know it until edited. Mobile pickers read the live `GET /geo/districts`; the fixture is only the offline shell — keep it in step until a generated snapshot lands |
| Native seller auth is unused | `GatewayClient.portalLogin/portalRefresh/portalLogout` exist (`src/services/api/GatewayClient.ts:826-866`) but the seller app is a WebView shell (`SellerPartnerNavigator.tsx`); the portal owns the session | Intentional today; prune or wire if native seller auth is ever built |
| Admin dispatch boards have no dedicated flow page | Manual allocation (`app/admin/district/delivery/manual-allocation/page.client.tsx`, `app/admin/super/delivery/manual-allocation/page.client.tsx`) and delivery-boy boards (`app/admin/*/delivery-boys/page.client.tsx`) write through `server/gateway/internal/delivery/handler.go:90-99` but are only mentioned in passing | Flow under-documented; add a delivery-admin page before changing it |
| Hardcoded tax constants on new-product display | New-product page shows GST/TCS/TDS constants | Display-only; the server remains the money authority |
| Invite delivery is a manual link | No transactional-email provider exists in the repo; `POST /seller/sub-users` returns a one-time `/accept-invite?token=…` link the owner copies and shares | The lifecycle is complete (credential + accept + login), but delivery is out of band until a mail provider is configured |
| `lowStock` / `campaigns` toggles have no producer | `notifications.EnqueueSeller` gates on all four preference columns, but only `SELLER_ORDER_NEW` and `SELLER_SLA_BREACH` are emitted today | Those two toggles persist and will take effect as soon as a producer emits `SELLER_LOW_STOCK`/`SELLER_CAMPAIGN` |
| Government KYC validation is not linked | `internal/sellers/compliance.go` `FormatComplianceValidator` checks shape/checksum only and leaves `compliance_status = PENDING`; `Handler.WithCompliance` is the provider seam | GSTIN/PAN/FSSAI/bank are not verified against government databases; accounts stay PENDING after format checks |
| Compliance `PENDING` still allows activation | `setStatus` / `verifyKYC` only block `FAILED` | A district admin's manual review remains the verification authority until a provider is wired |
| Rejected applicant cannot resubmit via the edit endpoint | `POST /sellers/{id}/edit` requires the `SELLER` role + matching `seller_id` (`internal/sellers/handler.go`); a rejected shopper still has no seller role, so the customer app falls back to `POST /sellers` and hits `409 email_taken` | Rejected applicants cannot cleanly resubmit from the customer app |
| Contract tiers are seed-only | `sellers.contract_tiers` is populated by migration 0100; no portal admin surface edits commission/settlement | A rate-card change needs a migration/DB change until an admin screen exists |

**By design — not gaps:** seller registration is intentionally mobile-only (`POST /sellers` from
the customer app's `SellWithUs`). On approval (`POST /sellers/{id}/verify-kyc`, or
`PATCH /sellers/{id}/status` → `ACTIVE`) the seller's portal login is auto-provisioned from
`contact_email` as a `SELLER` row scoped to `seller_id` (`must_change=true`); the one-time temporary
password is returned to the approving admin and never logged, and an existing login is reused
idempotently. Every approving surface renders that one-time credential with copy + WhatsApp
hand-over, and unused logins can be re-passworded and shared from **Ready to share** on
`/admin/super/credentials`; a superadmin can also issue or reset credentials there at any time
(HS256 JWT in HttpOnly cookies) — used when `contact_email` is already owned by another account.
The seller app is a WebView shell over the same portal. This is the completed design, not a partial
flow — see [`seller/onboarding/index.md`](./seller/onboarding/index.md),
[`seller/web-portal/credential-handover.md`](./seller/web-portal/credential-handover.md) and
[`shared/auth-otp.md`](./shared/auth-otp.md). Native seller auth is likewise intentionally unused
while the WebView owns the session.

## Delivery

| Gap | Evidence | Impact |
|---|---|---|
| Background-location limits | Documented in `client/mobile/PENDING_WORK.md` | Force-quit/background location is best-effort on Android (the app is Android/Play only; see `delivery/availability/index.md`) |
| Multi-vendor orders are not auto-dispatched | `docs/architecture/server-gateway-plan.md:340-342` | Orders spanning >1 store need manual allocation |
| No dedicated rider order-history endpoint | `server/gateway/internal/delivery/handler.go` (no history route); see `delivery/more/index.md` | `OrderHistory` is derived from the earnings ledger (`GET /delivery/payouts`), so it shows completed (paid-ledger) orders, not a full failed/ongoing log |
| Delivery calling is end-to-end on Android; iOS ring is device-unverified | `delivery/calling/index.md`; `customer/calling/index.md`; both clients share `features/call/`. Server: rider `POST /delivery/{orderId}/call`, customer `POST /orders/{orderId}/delivery-call`, one shared `startCall`, plus a data-only high-priority `incoming_call` push to the callee (APNs `apns-push-type: voip` for the iOS customer when `APNS_*` is set) | Both directions create a `delivery.calls` row, mint a VOIP token / open the PSTN leg, and push the callee, so an Android app rings with the screen off or the app swiped away. `0105` stores the PushKit `voip` token beside the FCM token; `MultiSender` routes it to APNs and the drain never selects it when APNs is unconfigured. The PSTN bridge is wired (Exotel config + fail-closed `/delivery/calls/pstn-webhook` reconcile + `provider_call_ref`, bridged on fallback too) but dormant until credentials are provisioned. Remaining gap: the iOS PushKit/CallKit code exists but was never compiled/installed on a device — a macOS `pod install` (the 100ms pod must link) and a build with the PushKit entitlement are required |
| GSM-busy / proximity not handled | `delivery/calling/edge-cases.md` | Incoming ring is not pre-checked against an existing GSM call; no proximity wake-lock during an earpiece call |
| Rider cannot read own application detail | `GET /delivery/register/{id}` is admin/superadmin-gated (`handler.go:83`) | `RiderProfile` shows the rider's own `GET /delivery/me` record only; documents are admin-reviewed |
| Rider row is never linked to the shared user identity | `checkout.ProvisionUserID` (`server/gateway/internal/checkout/repo.go:227`) writes `checkout.users` + `accounts.profile` only; nothing updates `delivery.delivery_boys.user_id` / `auth_uid` | Login still works (rider identity resolves by phone via `RiderByPhone`), but `notifyRider` (`handler.go:1477`) returns early when `rider.UserID == ""`, so order-ping push notifications never fire for a phone-OTP rider. A seeded test rider is unlinked by design. Second consequence: the account-deletion scrub (`checkout/repo.go:1887`) clears `delivery_orders.route_sequence` only for riders reached through `delivery_boys.user_id`, so an unlinked rider's retained route id lists are not reset (the stop rows themselves are scrubbed separately by the customer-order statement above it, so this is a dangling-id list, not a PII leak) |

Payout disbursement is **intentionally manual**: the server-derived amounts are accurate, but a
state/super admin records the transfer via `mark-paid` (no Razorpay Route). See
[`delivery/earnings/index.md`](./delivery/earnings/index.md).

## Code hygiene (non-flow, no partial user workflow)

These are code-misleading items, not partial user flows; they do not downgrade a page's status.

| Item | Evidence | Action |
|---|---|---|
| Blood-donor `StepPlaceholder` dead code | `client/mobile/src/features/pharma/blood-donor/BloodDonorScreen.tsx:95` | Defensive dead path; add the step or remove it |
| Open blood board relies on push to learn of another device's post | `server/gateway/internal/blood/handler.go` `notifyNewRequest`; `client/mobile/src/services/pushRefresh.ts` | Correct when FCM/APNs is configured (the normal production state). With push unconfigured a board only refreshes on refocus/post — no polling fallback by design, so it never guesses freshness. Same honest degradation as every other push-driven surface (`KNOWN_GAPS` §Server/data, FCM unset → push disabled) |
| Re-upload request endpoint is retired | `PUT /delivery/register/{id}/reupload-request` always returns `410 Gone` (`server/gateway/internal/delivery/handler.go:428-434`); admins use `.../documents/{docType}/reupload` | Old clients get a hard failure; current clients use the admin path |
| `src/services/homeFeed.ts` fixture seam | Removed — it had zero live importers | Done |

## Server / data

| Gap | Evidence | Impact |
|---|---|---|
| `inventory.stock_reservations` has no Go reader/writer | Created in `server/supabase/migrations/0001:119`; only the SQL expiry sweep in `0003:24-40`; no non-test Go reference | Reservation rows are swept, not used by checkout |
| PDF invoice generation is absent | See customer invoice row above | No downloadable GST invoice |
| Legacy tables kept read-only | `checkout.coupons` (superseded by `promo.coupons`), `payments.settlement_ledger` (live payouts compute from orders), `sellers.seller_vendor_counts` (no Go reference), `/state-admins` aliases | Not user-flow breakage; do not add new writes |
| Media/Razorpay/FCM degrade honestly when unconfigured | R2 unset → media disabled; Razorpay unset → `503 payments_disabled`; FCM unset → push disabled | Honest failure, not mocked success — keep it that way |
| Inline fixture copies still exist in screens | `data/DATA_CONTROL.md:481-486` (`PharmaScreen`, `FaMartScreen`, `CommonProductDetailView`) | Must be labelled offline/error shells or removed |
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
| `DeleteAccount`, `RequestDataDeletion` | `features/profile/DeleteAccountScreen.tsx`, `RequestDataDeletionScreen.tsx` | `DELETE /users/me`, `POST /users/me/data-deletion` |
| `Notifications` | `features/notifications/NotificationsScreen.tsx` | `GET /notifications`, read/read-all |
| `SellerRequests`, `SellerRequestDetail`, `SellerPlatformFeeRequest`, `FeeChangeRequests` | `features/seller-onboarding/` | These are **customer-SuperApp** screens (Account tab), not the Seller Partner app — the seller app is a WebView over the portal. Seller-facing equivalents: `/seller/fee-change-request`, `/seller/fee-history`, admin boards `/admin/{district,super}/fee-change-requests`; see `seller/web-portal/fee-change-requests.md` |
| `DealsLanding` | `features/ecommerce/DealsLandingScreen.tsx` | Mart deals |
| `RestaurantProfile`, `RestaurantOffers`, `RestaurantMenu` | `FoodStack.tsx:25-27` | Food venue screens (only the Food feed is covered) |
| `MedicalShopDetails` | `features/pharma/MedicalShopDetailsScreen.tsx` | Described only in `customer/pharma/index.md`; needs a page |
| `SellWithUs` | `features/seller-onboarding/SellerRegistrationScreen.tsx` | Seller application entry; covered by `seller/onboarding/seller-registration.md` |
| `FoodHome` | `features/food/screens/FoodHomeScreen.tsx` | Covered by `customer/discovery/store-drillin.md` (step 2), no standalone page |

### Seller web portal

| Domain | Routes | Notes |
|---|---|---|
| Ads | `/seller/ads` | `GET/POST /ads/*`, campaigns/slots |
| Promotions | `/seller/promotions` | `GET /seller/promotions`, opt-in |
| Offers | `/seller/offers` | product-first festival opt-in for Mart/Pharmacy; `GET /promo/sector-caps`, `POST /seller/promotions/optin`; seller write does not yet state-scope the campaign |
| Analytics | `/seller/analytics` | `GET /analytics/series|ranks` |
| Reviews | `/seller/reviews` | `GET /vendors/{id}/reviews*` |
| Prescriptions | `/seller/prescriptions` | `GET /seller/prescriptions*`, quotes |
| Settings / outlet info | `/seller/settings`, `/seller/outlet-info` | Settings = profile/bank/notifications/appearance/security + full sub-user invite lifecycle (link → accept → login → revoke) — see `seller/web-portal/settings.md` and `accept-invite.md`; outlet-info = read-only store summary |
| Platform fee | `/seller/fee-change-request`, `/seller/fee-history` | Seller files a per-vendor fee-change request and reads its own history — see `seller/web-portal/fee-change-requests.md` |
| Hub / explore | `/seller/hub`, `/seller/explore` | Checklist + discovery surfaces (partly local-only) |
| Order history / returns | `/seller/order-history`, `/seller/returns` | Referenced from `seller/orders/index.md`; no dedicated page |
| Product list / edit | `/seller/products`, `/seller/products/[id]/edit` | Product list and edit surface; no dedicated page |
| Local-only seller surfaces | `/seller/support`, `/seller/restaurant-status`, `/seller/rush-hour` | Client-local; see the seller gaps table above |
| District admin | `/admin/district/*` | Documented only where a seller flow references it (KYC review, payouts) |
| Super admin | `/admin/super/*` (categories + users + products documented) | Category taxonomy + header labels / main app header ([web-portal/super-admin-categories.md](./seller/web-portal/super-admin-categories.md)), global catalog + seller product requests ([web-portal/super-admin-products.md](./seller/web-portal/super-admin-products.md)), all orders ([web-portal/super-admin-orders.md](./seller/web-portal/super-admin-orders.md)) and the customer directory ([web-portal/super-admin-users.md](./seller/web-portal/super-admin-users.md)) have dedicated pages; the rest are documented only where a seller flow references them |

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
