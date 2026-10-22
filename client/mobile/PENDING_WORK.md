# Pending Work

Scoped, dated backlog entries for features intentionally deferred until their
dependencies exist. Do not build the backend/seller flows until told to.

---

## W63 — Delivery Partner app (P0)

**Status:** 🟢 Shipped (mobile + gateway + Supabase + portal). Phase 5 payouts intentionally not built.

- **Separate product, one native shell:** `APP_VARIANT=delivery` (generated `src/lib/appVariant.ts`)
  makes `index.js` mount `src/DeliveryPartnerApp.tsx` — the customer navigator is never mounted.
  Android flavors `customer`/`delivery` (`com.faazio.customer` / `com.faazio.deliverypartner`) and
  iOS `Delivery-Debug`/`Delivery-Release` configurations give the partner its own listings/labels.
- **Flow:** phone OTP → KYC application (live camera capture for Aadhaar/selfie and motorized
  DL/RC/insurance; private R2 keys only) → admin per-document verify/reject/re-upload → super-admin
  activation → Go Online/Offline + 120 s foreground heartbeat → 45 s order offers → server-ordered
  multi-stop route → pickup/drop statuses → hashed customer-OTP handover → optional rating.
- **Gateway:** `internal/delivery` + migration `0042` (tables, enums, RLS, audit). Dispatch scores
  ACTIVE/available/under-capacity riders by Google Routes road time (Valkey-cached legs, 300 s),
  falls back to Haversine without `GOOGLE_ROUTES_API_KEY`; capacity is hard-capped by vehicle
  (bicycle 1 / two-wheeler 2 / four-wheeler 5). Live coordinates are Valkey-only
  (`delivery:rider:{id}:location`, TTL 300 s).
- **Portal:** state/super "Delivery partners" queues with state scoping, KYC image previews,
  per-document verification, profile approve/reject, activation, active-rider list with
  load/capacity and on-demand location.

**Still pending (not built):**
- **Phase 5 payout engine** — order-level seller/platform/rider split, COD reconciliation, TDS and
  payout frequency. `delivery_orders.payout_amount_paisa` is display-only; do **not** create
  `delivery.payouts*` tables or payout screens until the product decision is approved.
- **Background location** — heartbeats stop when the app is backgrounded/terminated. Add the Android
  foreground service (`FOREGROUND_SERVICE_LOCATION` + notification) + `react-native-background-fetch`,
  and iOS `UIBackgroundModes`/`NSLocationAlwaysAndWhenInUseUsageDescription`, behind an explicit
  rider consent. Current Android manifest is deliberately foreground-only.
- **FCM order pings (bridge + deep link)** — the partner app now requests notification permission,
  registers its FCM token through `POST /notifications/register` and refreshes offers on a foreground
  message / notification tap. End-to-end delivery still needs the gateway `PUSH_WEBHOOK_URL` bridge
  configured, and a tap opens the dashboard rather than deep-linking straight to the offer card.
- **Rider document re-upload** — an admin re-upload request is recorded/audited and support contacts
  the rider on the registered phone; there is no in-app per-document replacement flow yet (a rejected
  application can re-apply in full).
- **Dispatch fallback on reject** — `POST /delivery/{id}/reject` terminally marks the job `REJECTED`
  instead of re-running the candidate chain; add bounded retries + automatic reassign.
- **Cross-order re-sequencing** — a rider carrying multiple jobs gets each job's stops appended, not
  a globally optimised sequence; add the insertion/reorder pass after acceptance.
- **Checkout → dispatch auto-trigger** — `POST /dispatch/assign` is implemented and admin-gated but
  the checkout order-ready transition does not call it yet; wire the trigger (or an outbox event) so
  a ready order is dispatched without a manual call.
- **Admin per-stop state tabs** — the portal board splits Applications vs Active riders with
  load/capacity; At Pickup / At Delivery / Busy categories are not projected from stop state yet.
- **Partner Firebase entries (ops)** — register the partner Android app + iOS bundle id in the
  Firebase project, add `android/app/src/delivery/google-services.json` and
  `ios/Faazio/GoogleService-Info-Delivery.plist`, and store the Android JSON as the
  `GOOGLE_SERVICES_DELIVERY_JSON` CI secret. Without them a `delivery` build fails fast.
- **Legal/trust** — independent-contractor + police-assistance clause still needs adding to the
  Terms; suspension/blacklist endpoints and audit already exist (`PUT /delivery/boys/{id}/suspend|blacklist`).
- **Bundle split** — `index.js` statically imports both roots, so the partner APK still carries the
  customer modules (unmounted, but dead weight). Move to per-flavor entry files (Metro
  `entryFile`/Gradle variant) once the partner UI stabilises. Low risk, size-only.

**Date:** 2026-10-22

## W62 — Live-location nearby retrieval (P0)

**Status:** 🟢 Shipped (mobile + gateway + migration `0041`).

- **Origin:** `state/locationStore.ts` + `hooks/useLiveLocation.ts` (foreground-only 10 s coarse poll,
  50 m reverse-geocode threshold, no launch prompt, no background permission). Location screen asks
  for real consent and uses Places API (New) autocomplete when configured.
- **UI:** Mart local vendors, Pharma outlets, Food top-rated/dining, category drill-in and search
  Relevance results sort nearest-first and show live distance; seller onboarding has a native map pin
  picker and submits `latitude`/`longitude`.
- **Gateway:** `GET /stores/nearby` and `GET /products/nearby` (bounding box + Haversine, public
  projections), cached 120 s under `faazio:v1:geo:nearby:*`; `directory.stores`/`directory.dining_venues`
  gained coordinates and partial geo indexes; `sellers.sellers` gained the shop pin.
- **Ops remaining:** provision restricted `GOOGLE_MAPS_API_KEY_ANDROID` + `GOOGLE_PLACES_API_KEY`
  (and run `npm run configure`); add the iOS Pod (`cd ios && pod install`) during the first iOS build.

**Date:** 2026-10-21

## W60 — Firebase phone OTP replaces Supabase GoTrue (P0)

**Status:** 🟢 Shipped (mobile + gateway + Render config). W23's Supabase GoTrue flow is replaced
end to end; the mobile app no longer talks to Supabase Auth.

- **Mobile auth:** `services/firebaseAuth.ts` uses the native `@react-native-firebase/auth` SDK
  (`sendOtp` → `signInWithPhoneNumber`, `verifyOtp` → `confirm`, `refreshIdToken` →
  `getIdToken(true)`, `signOutRemote`). `LoginScreen` UI is unchanged; `authStore` + `secureSession`
  still own the Keychain session and `GatewayClient` forces one ID-token refresh on 401.
- **Native config (public, committed):** `android/app/google-services.json` +
  `ios/Faazio/GoogleService-Info.plist`; Android applies the `com.google.gms.google-services`
  plugin (`4.5.0`). iOS has `UIBackgroundModes → remote-notification`; APNs/Play Integrity
  anti-abuse is **not** configured yet (Part 6 blocked: Firebase project not linked to GCP) — see
  `docs/RUNBOOKS/FIREBASE_AUTH.md`.
- **Gateway:** `platform/auth.FirebaseVerifier` verifies RS256 Firebase ID tokens with Google's
  x509 cert set (no firebase-admin dependency); `iss`/`aud`/`exp`/`sub` checked. `FIREBASE_PROJECT_ID`
  enables it; the legacy Supabase HS256 verifier remains as a portal fallback. `ProvisionUserID`
  still links the verified subject to `checkout.users.auth_uid` on first call; migration `0031`
  widens that column from `UUID` to `TEXT` because Firebase UIDs are not UUIDs (apply it in
  Supabase before deploying the new gateway).
- **Prod:** `render.yaml` pins `FIREBASE_PROJECT_ID` + `AUTH_DISABLED=false`; the mobile `.env`
  points at `https://faazio-workspace.onrender.com`; the debug/release workflows default
  `GATEWAY_URL` to the same Render origin. Release still requires `CERT_PINS`.
- **Ops remaining (not code):** Part 6 — enable Play Integrity (Android) + APNs key (iOS) and App
  Check enforcement once the Firebase project is linked to Google Cloud; register the release
  keystore SHA-1/SHA-256 in Firebase for SMS auto-retrieval.

**Date:** 2026-10-20

## W61 — Seller onboarding + Razorpay Route split (P0)

**Status:** 🟢 Shipped (mobile + gateway + portal review).

- Mobile `features/seller-onboarding/SellerRegistrationScreen` replaces the old onboarding form:
  location-derived state, platform fee, payout account, private-bucket passbook (+ FSSAI for food)
  and an OTP digital signature. `GatewayClient.uploadSellerDocument` + `submitSellerApplication`.
- **Server-side OTP binding:** the gateway now rejects a client-asserted `otpVerified:true` unless the
  bearer Firebase ID token's `phone_number` claim matches the application's `contactPhone`
  (`auth.OTPSigned`, `401 otp_unverified`). The signed-phone (`+91…`) matches the shopper's primary
  session, so `submitSellerApplication` still rides the normal bearer header.
- **Mobile admin review** (new): `SellerRequestsScreen` + `SellerRequestDetailScreen`
  (`src/features/seller-onboarding/`), role-gated by the decoded `app_role` claim on `authStore.user`
  (`src/lib/tokenClaims.ts`). Entry is the Account "Seller applications" card. KYC images render via
  `GatewayClient.getPrivateMediaUrl` (`GET /media/private/{assetId}` — creator/admin presigned GET).
- Gateway `0039` + `internal/sellers` extended create/review endpoints and
  `internal/platform/razorpayroute` (linked accounts, held transfers, release/reverse, webhook HMAC).
- Portal state/super seller detail: full registration, fee editor, per-document verification,
  reject with history, Verify KYC → Route linked account + ACTIVE.
- Settlement `POST /payouts/holds` holds the seller share for 14 days; the gateway releaser releases
  due holds every 15 minutes (Route credentials required). `POST /payouts/{id}/reverse` claws a
  refund/return back, and `POST /webhooks/razorpay/route` reconciles `transfer.released/failed/reversed`
  (`0040`).

**Remaining (ops):** configure `RAZORPAY_ROUTE_*` in Render, apply `0039` + `0040`, and set the Route
webhook endpoint (`/webhooks/razorpay/route`) + secret in the Razorpay dashboard. Cart-order payments
are still recorded locally (no Razorpay capture), so the automatic post-capture split trigger is not
wired yet; holds are created via the super-admin endpoint. **AVIF is deliberately deferred:** KYC
captures upload as JPEG (`uploadSellerDocument` default) — the media allowlist accepts `image/avif`
but no lightweight RN encoder exists without a native/CGO dependency, so it stays allowlisted for
future use.

**Date:** 2026-10-21

## W23 — Real phone-OTP auth + secured single-server flip (P0)

**Status:** ⚪ Superseded by W60 (was 🟢 Shipped). This entry replaced the placeholder session with
a real Supabase GoTrue phone-OTP session, so every `auth.Require` write (`/cart`, `/orders`, `/favourites`,
`PUT /vendors/{id}/rating`, `POST /ads/events`) works against an `AUTH_DISABLED=false` gateway.

- **Auth (historical):** `services/supabaseAuth.ts` (GoTrue REST, no SDK, deleted in W60) + `LoginScreen` send/verify/resend;
  `secureSession.ts` remains the single Keychain owner (with an in-memory mirror) and
  `GatewayClient` sends the real bearer, refreshing once on 401 and clearing a dead session.
- **Server link:** `auth.UserProvisioner` → `checkout.Repo.ProvisionUserID` upserts
  `checkout.users.auth_uid` on first authenticated call (`0030` adds `last_login_at`), so no manual
  portal row is needed. `auth_uid → user_id` stays read-through cached for 1 h. W60 swaps the
  verifier to Firebase and widens `auth_uid` to `TEXT` (`0031`).
- **Honesty:** with `STRICT=true`, cart/favourite/address/booking/Rx/order writes fail loudly instead
  of echoing a local fixture. `configure.js` refuses a release that embeds a mock-login build.
- **Ops (not code):** Firebase native config is committed (superseded by W60); Render env
  `AUTH_DISABLED=false`, `ALLOWED_ORIGINS`; Cloudflare proxied + Full SSL + Render inbound origin lock;
  rotate cert pins with a 2-pin overlap ≥30 days before expiry (see `docs/RUNBOOKS/RELEASE.md`).
- **Docs:** `mvp-backend.md` §1, `db-schema.md` §7.1, `mobile-app.md` Services/Login,
  `caching-cloudflare-valkey.md` §5.

**Date:** 2026-10-19

---

## W59 — Pharma residual honesty + routing closure (P0/P1)

**Status:** 🟢 Shipped (app + docs). Auth is now real Supabase phone OTP (see W23). Closes the
remaining Pharma gaps from the sub-app audit; several plan items were **already fixed by W57** (the
discount overlay + live Top Offers codes) and one (**P0-3** portal wizard) was a **false alarm** — see
below.

- **P0-1 hero coupon honesty.** `PharmaHeroBanner` never advertised a code it couldn't stand behind:
  `PharmaFeed` now exposes `heroCouponCode` — the **first Top Offer's** code (the editorial fixture in
  mock, the top server-honoured `GET /coupons?app=PHARMA` code when online, else `null`) — the coupon
  pill is render-gated on it, and the hardcoded "UP TO 50% OFF" badge + its styles were deleted. Hero
  and Top Offers now share one source, so they can never disagree.
- **P1-1 History is real.** The History tab merges actual `useOrdersStore` orders (newest-first,
  PHARMA-scoped) ahead of the `PHARMA_RECENT_ORDERS` fixture; the fixture is the mock-mode first paint
  only and a remote-empty result shows an honest empty state. Tapping an order opens `MyOrders`
  (`highlightOrderId`).
- **P1-3 Health Corner dead tap.** The card renders as a static `View` (no `TouchableOpacity`, no
  "Read More") when it carries no `onPress`.
- **P1-7 PDP store section + View Vendor.** `CommonProductDetailView` resolves PHARMA stores
  (`pharmaStores`), pulls PHARMA related products (`serverRelated` runs for MART|PHARMA, fixture
  fallback `pharmaProducts`), renders the store's real `address`/`hours` (was a hardcoded Chennai
  string) and tags its "More from store" grid `appBrand='PHARMA'`. `ProductDetailScreen.handleViewVendor`
  opens `MedicalShopDetails` for a PHARMA product (Mart keeps the `SubApp` vendor drill-in). Price was
  already canonical from W57.
- **P0-4 (latent) CategoryDrillIn routing.** `CategoryDrillInScreen.handleVendorPress` maps
  `app='PHARMA'` → `MedicalShopDetails` (defensive; no live caller passes PHARMA today — both hardcode
  `FA_MART`).
- **P1-9/P1-5 blood deep-link provenance + distance honesty.** `BloodRequestDescription` gained an
  optional `source` param and `useBloodRequests` now returns `settled`; a **cold deep link** (no
  `source`) holds a spinner until the board settles before showing "no longer available", so a fixture
  id is never rendered as a server row. `NearbyRequestCard` omits the distance instead of printing
  "0 km away" for live rows that carry no geo.

**False alarm / intentionally unchanged:** **P0-3** (portal campaign wizard) — steps 2–3 are generic
`Products`/`Stores` and the target's app is derived **per row** (`p.sector`/`s.sector`); a PHARMA
seller (`sel-4` + `store-p1` + `ph-1/ph-2`) already gets `PHARMA_HERO`/`CATEGORY_TOP`/`STORE_TOP`
via `eligiblePlacementsFor(row.sector, type)`, and the server derives `targetApp` from the owning row
— **no code change needed**. **P1-4** (Promote Featured Brands / Health Corner to SDUI) is **skipped**:
the portal SDUI editor cannot author new sections, so PH7/PH8 stay intentional `STATIC-EDITORIAL`
fixtures (documented). **P1-8** best-effort ratings were already honest — documented, not changed.

**Rollback:** revert `features/pharma/services/pharmaService.ts`,
`components/pharma-home/PharmaHeroBanner.tsx`, `PharmaScreen.tsx`,
`components/pharma-home/cards/HealthCornerCard.tsx`,
`features/catalog/CategoryDrillInScreen.tsx`, `features/product/{CommonProductDetailView,ProductDetailScreen}.tsx`,
`features/pharma/blood-donor/{DonorDashboard,BloodRequestDescriptionScreen}.tsx` +
`components/NearbyRequestCard.tsx` + `hooks/useBloodRequests.ts`, and `navigation/types.ts`. No
migration, endpoint, cache key, or `GatewayClient` method added.

**Docs:** `docs/architecture/mobile-app.md`, `PAGE_CATALOG.md`, `data/DATA_CONTROL.md`.
`monolith-breakdown.md`/`server-gateway-plan.md`/`caching-cloudflare-valkey.md` unchanged — **no
server function, handler, package, table, cache key, endpoint, or `GatewayClient` method changed**.
**Date:** 2026-10-19

---

## W58 — Food menu authority + Offers authoring (P0/P1)

**Status:** 🟢 Shipped (app + web + server + db + docs). App auth stays **mocked** (no Supabase phone
OTP). Closes the remaining Food gaps from the sub-app audit: the seller could not author the MRP
strike the "Recommended & Offers" rail requires (P0-3), a delisted/emptied menu never cleared (P1-6),
the offer banner's coupon was never applied (P1-4), loose Food route params (P1-8/P1-10), and dead
UI/catalog pollution (P1-9).

- **P0-3 seller authors the menu MRP (the Offers rail's source of truth).** `directory.menus.mrp_paisa`
  (`0022`) was read-only: no portal field and `POST`/`PUT /seller/menus/{venueId}/{dishId}` had no MRP,
  so a seller-created dish never struck and the Offers rail stayed honestly empty regardless of intent.
  Added the MRP to the seller menu form (`client/web/platform/app/seller/menus`), `MenuDto`/
  `MenuItemRecord.mrpPaisa`, the `pushWrite` body, and the server (`menuRequest.mrp` → `SellerMenu.MRP`
  → `repo.UpsertMenu`/`SellerMenus`/`SetMenuStatus`). The gateway rejects `mrp < price` (400) so the
  authored strike is always `mrp_paisa > price_paisa`; a menu with no MRP shows no strike (never
  synthesized).
- **P1-6 menu is authoritative (seller empties a venue → it clears).** New server-only
  `GatewayClient.fetchMenu(venueId)` (throws `GatewayOfflineError`, mirrors `fetchVenues`); the
  public `GET /venues/{id}/menu` now serves **`status = 'ACTIVE'`** rows only, so a delisted/DRAFT dish
  no longer leaks to shoppers. `useRestaurantMenu` uses `fetchMenu`: a live `[]` clears the fixture
  seed and shows the honest empty menu; only a real failure keeps the seed (never blank offline). The
  seed generator emits menu rows `ACTIVE` (mirrors `catalog.products`).
- **P1-4 offer banner applies its coupon.** The profile offer banner now passes the live coupon code
  to the scoped cart (`Cart` route param `couponCode` → `CartView.initialCouponCode`), which
  auto-applies once the coupon list contains it, re-validating server-side and surfacing the real
  `invalid_coupon`/`min_order` error — the banner no longer promises a code the shopper must re-enter.
- **P1-8/P1-10 typed Food routes.** `FoodStackParamList` `RestaurantProfile` is now
  `{ restaurant: DiningRestaurant }` and `RestaurantOffers` `{ restaurant: DiningRestaurant; offers:
  SpecialDish[] }` (were `any`), so a field rename breaks at typecheck instead of silently. Casts
  removed in the three screens.
- **P1-9 dead code.** Removed the dead `Share2` toolbar button (no `onPress`) and the no-op See-All on
  the "What's on your mind?" / "Snacks & Beverages" headers (they opened an empty search). Removed the
  unorderable `BOOKING_DISHES_DB` (`bd-*`, no `storeId`, price parsed from a `₹` string) from
  `catalogIndex` + the `@data` export, deleting the fixture — it only added "Dining Reservations" rows
  no store could fulfil to the FOOD FTS pool (also dropped from the seed).

**Intentionally unchanged / accepted:** paid-ad measurement (`POST /ads/events`) and the auth-gated
bookings/rating writes stay inert under a production `AUTH_DISABLED=false` gateway with mocked login
(W49 decision — real session or anon rate-limit is out of scope). `mostRatedDining` remains an
ID-only contract (a dev `console.warn` now flags an unresolved curated id instead of a silent no-op).
The fixture-first mind/snack rails, thin server-only dining cards, and the `sp-*` base-price PDP stay
as previously documented.

**Rollback:** revert `internal/directory/{handler,repo}.go` + `manage_test.go`, the seed
generator + regenerated `0001_seed.sql`, `client/web/platform` (menus page/types/api/sync), the mobile
`GatewayClient.fetchMenu` + `useRestaurantMenu`, `RestaurantProfileScreen`/`FoodHomeScreen`/
`RestaurantOffersScreen`/`RestaurantMenuScreen`/`navigation/types`, `CartScreen`/`CartView`, and the
`data/catalog/products.ts` + `data/index.ts` + `bookingDishes.ts` removal; behaviour resumes (no data
loss — `mrp_paisa`/`status` remain populated). No new migration, route, or cache key.

**Docs:** `docs/architecture/{mobile-app,web-portal,db-schema,monolith-breakdown}.md`,
`data/DATA_CONTROL.md`. `caching-cloudflare-valkey.md` unchanged — the `directory:menu:{venueId}`
key/TTL and its edit invalidation are reused. **Date:** 2026-10-18

---

## W57 — Pharma price parity + residual workflow closure (P0/P1)

**Status:** 🟢 Shipped (app + data + docs). No server/DB/cache/route change; app auth was then
**mocked** (now Firebase phone OTP — W60). Closes the last P0/P1 items from the PHARMA sub-app audit that
W53–W55 left open.

- **Price parity (P0-4).** The inline `CATEGORY_PRODUCTS` grid + in-screen `PRODUCT_DETAIL` now
  overlay `useActiveDiscounts` (one batch per category) on the authored `PHARMA_PRODUCTS_DB` rows,
  and Quick Reorder overlays the same server discount batch in `pharmaService`. Every Pharma surface
  now shows the same shopper price `internal/checkout` settles via `contracts.DiscountReader` —
  previously the category grid/PDP/Quick Reorder showed base `catalog.products.price_paisa`.
- **Top Offers (P0-2).** `livePharmaOfferCodes()` returns a Set (possibly empty) whenever the
  gateway is enabled, so a failed/empty `GET /coupons?app=PHARMA` hides the rail instead of
  advertising fixture codes (`MED20`/`FREEDEL`/…) `contracts.CouponValidator` would reject. Mock mode
  (`REMOTE_ENABLED=false`) keeps the editorial offers as a demo.
- **Popular fallback (P0-3).** `PHARMA_POPULAR_MEDICINES` ids repointed `ppm-*` → real `ph-*` rows
  (`ph-f1`/`ph-t3`/`ph-f2`/`ph-t4`/`ph-as1`/`ph-s1`) so an offline add-to-cart is priceable; online
  still reads the `pharmaPopular` SDUI section.
- **Rx durability (P0-5).** `GatewayClient.createPrescription` is now remote-loud: in remote mode a
  failed `POST /prescriptions` propagates (the flow keeps the draft + shows an error) instead of
  fabricating a durable-looking `RX-LOCAL-*` record. Mock mode keeps the local placeholder for dev.
- **Medical shop deep-link (P1-4).** `MedicalShopDetailsScreen` resolves a single store via
  `gateway.getStore(id)` when the directory list misses it (Mart W43 pattern), with a loading state
  so a valid deep-link no longer flashes "not found".
- **Rx vendor error (P1-7).** A `404`/`422` on create maps to a "Pharmacy unavailable — pick another"
  alert instead of the generic "try again".
- **Dead-end View-all (P1-2).** The Pharma feed rails' "View all" chevrons are hidden: Pharma has no
  rail landing page and the labels (`Quick Reorder`, `Featured Brands`, …) never match the search
  FTS, so the affordance was a dead-end. Re-add with a Pharma `DealsLanding` when one exists.
- **Dead export (P1-6).** `BLOOD_DONOR_UNREAD_ALERTS` (unused since the honest bell in W54) removed.

**Intentionally unchanged / accepted:** the inner category search stays a local filter within the
authored category rows (P1-3 — a scoped browse, not the global FTS). Server-redacted blood fields
render omitted, not "N/A" (P1-5, PII-safe). The two editorial rails stay fixture-owned (`@static-editorial`).

**Rollback:** revert the `PharmaScreen`/`pharmaService`/`pharmaHomeFeed`/`QuickReorderCard`/
`MedicalShopDetailsScreen`/`PrescriptionFlowScreen` hunks + `GatewayClient.createPrescription` +
the `BLOOD_DONOR_UNREAD_ALERTS` removal; fixtures/behaviour resume. No migration.

**Docs:** `PAGE_CATALOG.md` §2.7 (paid/organic registry), `docs/architecture/web-portal.md`
(seller/ads `CATEGORY_TOP`), `data/DATA_CONTROL.md`. **Date:** 2026-10-18

---

## W56 — Food sub-app production-readiness pass (P0/P1 gaps + doc truth-up)

**Status:** 🟢 Shipped (app + server comment + docs). No new screens/routes/tables/migrations/keys;
app auth was then **mocked** (now Firebase phone OTP — W60). Closes the money/UX gaps from the FOOD audit.
The audit's suspected "seed has no Food SDUI sections" (P0-4) was **false** — the checked-in
`server/supabase/seed/mongo/sdui_layouts.json` already carries `foodHero`/`foodSpecials`/
`mostRatedDining`, matching the `internal/sdui` allowlist, so no seed change was needed.

- **P0-2 no dead festival request on menus.** `useRestaurantMenu` no longer calls
  `fetchActiveDiscounts` for `directory.menus` rows (per-open `GET /promo/active-discounts`) nor
  overlays a festival discount — `promo.festival_optins` keys on `catalog.products.product_id` and
  checkout ignores menus, so the overlay was always `{}` (or, worse, a display price the cart could
  not settle). The authored `mrp_paisa > price_paisa` strike (`0022`) remains the only menu discount.
- **P0-3 / P1-7 booking holds are strict.** `GatewayClient.createBooking`/`attachBookingPayment`
  now use `withStrict` and their offline mock throws: no fabricated `BKG-LOCAL-*` hold, no Razorpay
  sheet on a fee that was never held. `getBookingAvailability`'s offline fallback returns
  `bookable:false` (was `bookable:true` @ ₹50 09:00–21:00), so a venue whose availability can't be
  read simply hides the Book card.
- **P1-1 authoritative-empty venues.** New server-only `GatewayClient.fetchVenues` (throws
  `GatewayOfflineError`, mirrors `fetchStores`/`fetchBloodDonors`). `diningService.fetchDiningFeed`
  gains `diningAuthoritative`: a real failure keeps the `@data` fixture (never blank), but a live
  `200 []` drops the fixture grid + Top Rated rail and the screen shows an honest
  "No restaurants available right now" state — delisted venues no longer linger as stale profiles.
- **P1-2 hollow server-only cards.** Dining cards + the Top Rated hero now suppress `0.0 km` /
  `₹0 for two` / blank address and show a **"New"** chip instead of `0.0` when a venue's public row
  has no rating yet.
- **P1-4 removed dead See-All affordances.** The "Top Rated Restaurants" and "Today's Special Near
  You" headers no longer render a See-All that went nowhere (no restaurant-list Search exists).
- **P1-6 offers page refetch.** `RestaurantOffersScreen` now re-reads the venue menu through
  `useRestaurantMenu(restaurant)` (keyed by venue id) and only uses the nav `offers` param as an
  instant seed, so a price/MRP/expiry change between the profile and the "View All" page can't leave
  a stale strike.
- **P2-1 comment truth.** `cache.go` `SduiFood` comment corrected (`diningSpecials` →
  `foodSpecials`) to match the `internal/sdui` allowlist.

**Still deferred / documented-only:** P0-1 paid-event measurement (`POST /ads/events` is behind
`auth.Require`; with mocked login it only lands on an `AUTH_DISABLED` gateway) — needs a product
decision (anon rate-limited path vs honest dev-only stub), not a screen. P1-3 `mostRatedDining` join
is a **deliberate ID-only contract** (client reads raw `storeIds`); P1-5 unclassifiable server-only
dishes stay hidden under an active Veg/Non-Veg filter (conservative — never mislabels); P1-8/P1-9
portal VENUE targeting/menu media are enhancements (the DISH → `STORE_TOP` path already resolves a
venue server-side via `ResolveOwnedTarget(..., "VENUE", ...)`); P1-10 rating write is inert in prod
until a real session or anon rate-limit decision; P1-11 mind-tile search already merges the remote
pool over the `TODAYS_SPECIALS` fallback in the shared `SearchScreen`.

**Rollback:** revert `features/food/hooks/useRestaurantMenu.ts`,
`features/food/services/diningService.ts`, `features/food/screens/{FoodHomeScreen,RestaurantOffersScreen}.tsx`,
`features/food/components/{RestaurantGrid,RestaurantCard,TopRestaurantCarousel}.tsx`,
`services/api/GatewayClient.ts` (`fetchVenues` + booking strict + availability fallback) and the
`cache.go` comment; fixtures/behaviour resume. No data loss.

**Docs:** `docs/architecture/mobile-app.md`, `data/DATA_CONTROL.md`, `docs/architecture/monolith-breakdown.md`
§1, `docs/architecture/caching-cloudflare-valkey.md` §5, `docs/architecture/db-schema.md` §menus.
**Date:** 2026-10-18

---

## W55 — Donor-directory provenance (P1) + un-interest propagation

**Status:** 🟢 Shipped (app + server + docs). No new screens/routes/tables/keys; app auth was then
**mocked** (now Firebase phone OTP — W60). Closes the last Pharma read without provenance (W53b deferred it).

- **Donor-directory reads carry provenance (P1 privacy).** New no-fallback
  `GatewayClient.fetchBloodDonors`/`fetchDonorProfile` (throwing `GatewayOfflineError`) mirror
  `fetchBloodRequests`. `findMatchingDonors` now returns `{ donors, source }`
  (`live`/`empty-authoritative`/`offline-fallback`): a live `200 []` is an honest "no consented
  donors right now" rather than being masked by `BLOOD_DONORS`, and an offline fetch shows the
  fixture filtered to the query behind a "Showing saved donors — offline" chip in `AskBloodSheet`
  — never blank, never a fixture donor presented as consented live.
- **Redaction-safe detail resolution.** The search `source` rides the `BloodDonorDetails` route so
  `getDonorById(id, source)` resolves only from server rows for a live/empty search (an unknown id =
  the existing honest "no longer available" screen); the fixture is consulted only for an offline
  fallback. `bloodDonorStore.hydrateFromServer` reads `fetchDonorProfile` (a live `null` = not
  registered, distinct from offline).
- **Un-interest propagates.** `bloodDonorStore.toggleInterested` removal now calls
  `clearBloodInterest` (`DELETE /blood-requests/{id}/interest`, idempotent) and queues an
  `interest-remove` outbox op when non-durable, flushed on hydration + foreground — no longer
  device-local only. No schema change: `blood.interests` PK `(request_id, donor_user_id, kind)`
  keys the mark, so un-interest is a plain `DELETE`. No cache change: the public `blood.requests`
  projection carries no interest data.

**Intentionally unchanged:** the `BLOOD_DONORS` fixture remains the never-blank offline fallback
(now always labelled). `getBloodDonors`/`getDonorProfile` stay as mock-mode wrappers.

**Rollback:** revert `services/api/GatewayClient.ts` (2 fetch* + `clearBloodInterest`),
`services/donorDirectory.ts`, `components/AskBloodSheet.tsx`, `DonorDetailsScreen.tsx` +
`navigation/types.ts`, `state/bloodDonorStore.ts`, and the server `internal/blood` handler/repo
hunks + the compose `0029` mount; fixtures resume. No data loss.

**Docs:** `data/DATA_CONTROL.md`, `docs/architecture/mobile-app.md`, `monolith-breakdown.md` §1,
`mvp-backend.md`, `db-schema.md` §12.6. `caching-cloudflare-valkey.md` unchanged — no key/TTL
change (interest is not cached). **Date:** 2026-10-18

---

## W53 — Pharma production-readiness pass (P0/P1 gaps + doc truth-up)

**Status:** 🟢 Shipped (app + docs). No new screens; app auth stays **mocked** (no Supabase OTP).
No server/DB/cache change — closes the P0/P1 gaps from the PHARMA sub-app audit.

- **P0-1 donor discovery is remote-first.** `services/donorDirectory.ts` reads `GET /donors`
  (auth-scoped, `blood.donor_directory` exposes `consent AND available` rows only) with the
  `@data/pharma` `BLOOD_DONORS` fixture as offline fallback — Ask Blood matches consented donors
  instead of always the seed.
- **P0-2/P0-3 blood writes are durable + hydration is consent-gated.** `bloodDonorStore` mirrors
  registration to `PUT /donors/me`, interest to `setBloodInterest`, targeted asks to
  `createDonorMatch` (best-effort; AsyncStorage remains the optimistic UX cache); the dashboard
  feed hydrates from `GET /blood-requests` and never backfills a redacted/absent server
  `contact`/`address` with a fixture lookalike (P1-7 redaction-safe blanks).
- **P0-4 dead Pharma surface removed.** `DealsLanding`'s `app:'PHARMA'` param (no routes used it)
  was dropped; Pharma rails' "View all" opens the first-class Search route.
- **P0-5 Rx enum drift — verified non-issue.** `0018` adds `QUOTED`/`READY` to
  `prescription_status`; the gateway's `allowedRxStatus` matches. Documented in `db-schema.md` §12.5.
- **P0-6 Rx capture hardened.** `PrescriptionFlowScreen` strict-mode + try/catch around
  create/upload (no silent fixture success).
- **P1-3 med-shop inventory is server-backed.** `MedicalShopDetailsScreen` uses
  `useVendorProducts` (`getStoreProducts`, now app-agnostic via `getCatalogEntriesByStore`).
- **P1-4/P1-7** as noted above; orders/tracking label the PHARMA sector on `OrderDetails`.

**P1 merchandising (this pass):** `pharmaService` resolves Quick Reorder through
`getProductsByIds` (real `ph-*` ids — checkout rejects `pqr-*` fixtures), overlays
`getActiveDiscounts` on the Popular rail (shared `services/pricing`), and filters Top Offers to
live `getCoupons('PHARMA')` codes when online (never advertises a code checkout can't settle).
`PopularMedicineCard` gained MRP strikethrough; the header search bar is server-backed
(`searchProducts` + `withActiveDiscounts`).

**Intentionally unchanged:** `pharmaService`/`usePharmaStores` keep the fixture fallback so the
feed never blanks mid-migration.

**Rollback:** revert the `features/pharma/**`, `services/donorDirectory.ts`, `state/bloodDonorStore.ts`,
`hooks/useBloodRequests.ts`, `services/api/GatewayClient.ts` (`getStoreProducts`), and
`navigation/{types,SubAppWrapper}.tsx` hunks; fixtures resume. No migration.

**Docs:** `docs/architecture/mobile-app.md`, `monolith-breakdown.md` §1, `db-schema.md` §12.5,
`web-portal.md`, `PAGE_CATALOG.md`, `data/DATA_CONTROL.md`. **Date:** 2026-10-18

---

## W53b — Blood write authority (P0-2b/P0-3b) + read transparency (P1-1b)

**Status:** 🟢 Shipped (app + docs). No new screens/routes/tables/keys; app auth stays **mocked**
(no Supabase phone OTP). Follow-up to W53 (which left blood writes best-effort `void …catch` and
reads unable to tell a live empty from a fixture). The `submitVendorRating` outcome pattern is
applied to blood.

- **Write authority (P0-2b/P0-3b).** `GatewayClient.saveDonorProfile`/`setBloodInterest`/
  `createDonorMatch` now return `BloodWriteOutcome` (`synced`/`offline`/`signed-out`) instead of a
  fabricated mock row; `bloodDonorStore.register`/`toggleInterested`/`acceptRequest`/`requestDonor`
  are async and return `{ ok, status }` (`synced`/`offline`/`queued`/`signed-out`). The store keeps
  the optimistic AsyncStorage commit, tags the row `pendingSync`, and queues a `PendingDonorOp` in
  the same `faazio/bloodDonor/v1` blob when non-durable; the outbox flushes on hydration + app
  foreground and `hydrateFromServer` reconciles server-wins-by-id (local-only preserved, synced
  mirrors de-duped). Mock mode keeps the device mirror as final (no pointless queue). UI:
  `DonorDashboard` shows "Not yet synced — we'll retry" / "Signed out" banner; `DonorDetailsScreen`
  button reads "Request Saved — will retry"; `BloodRequestDescriptionScreen` shows an inline sync note.
- **Read transparency (P1-1b).** New no-fallback `GatewayClient.fetchBloodRequests`/`fetchStores`/
  `fetchPharmaSections` (+ `GatewayOfflineError`, `ReadSource`) let `useBloodRequests` and
  `usePharmaStores` return `{ data, source }` (`live`/`empty-authoritative`/`offline-fallback`/
  `cache-stale`) and `pharmaService.fetchPharmaFeed` carry `source`. A live `200 []` renders an
  honest empty (dashboard) instead of the fixture; an error keeps the fixture/cache with a
  "Showing saved — offline" chip. The fixture stays the never-blank guarantee, now always labelled.
- **Not `withStrict`.** Blood writes deliberately stay out of `withStrict` (money/Rx fail loudly);
  an offline registration must not be blocked — outcome + retry is the correct contract.

**Intentionally unchanged (now closed by W55):** `donorDirectory`/`getDonorProfile`/`getBloodDonors`
reads kept their internal fixture fallback in this pass; W55 gives donor discovery the same
`{ donors, source }` provenance as the board. `reset()`/logout clears the outbox.

**Rollback:** revert `state/bloodDonorStore.ts` + the `services/api/GatewayClient.ts` blood-read/write
hunks + the blood UI read/source hunks; the blob drops `pendingOps` and best-effort writes resume.

**Docs:** `data/DATA_CONTROL.md` (blood contract), `docs/architecture/mobile-app.md` (blood section +
stores table), `docs/architecture/monolith-breakdown.md` §1 (blood/directory/sdui rows). **Date:** 2026-10-18

---

## W50 — Campaign + Pharma merchandising de-mock (the two deferred anon reads)

**Status:** 🟢 Shipped (server + data + seed + web + app + docs). Resolves the W47/W48 deferrals.
App auth stays **mocked** (no Supabase phone OTP) — these are anon merchandising reads, independent
of the auth-gated writes.

**1. Editorial campaigns (Home "Deals of the day").** The ID-only campaign defs
(`{id,storeId,productIds,carousel}`) now live on the SDUI `hotBrandDeals.campaigns[]` leaf
(`data/home/sdui.ts` ← `adCampaigns`). The gateway compiles them into the anon
`GET /home/campaigns` + `GET /home/campaigns/{id}` (`internal/sdui`, `contracts.CampaignView`,
store + products joined via `ProductReader`/`StoreReader`), cached
`faazio:v1:home:campaigns:{locale}` (+ `:{id}`) 600 s and purged by prefix on publish — distinct
from the seller-scoped `GET /ads/campaigns` hero control plane (no id-space conflation, no leak of
seller rows to anon shoppers). `GatewayClient.getHomeCampaigns`/`getHomeCampaign` (fixture
fallback), `HomeView` threads the defs into `BrandCampaignsSection`, and `DealsLanding` `campaign`
mode reads the server-joined store + products (fixture fallback). Super-admin SDUI editor edits the
campaign leaf.

**2. Pharma SDUI parity.** Pharma gained its own `GET /sdui/pharma` projection (allowlist
`pharmaHero`/`pharmaPopular`/`pharmaEssentials`, own compiled cache/ETag, purged with the other
feeds). `pharmaHero.banners` is the organic house-hero (paid `PHARMA_HERO` wins); the
`pharmaPopular`/`pharmaEssentials` rails are real, **non-Rx** `ph-*` catalog rows (asserted by the
seed generator) joined to the catalog. `GatewayClient.getPharmaFeed` + `fetchPharmaFeed` map them
into the Pharma card shapes (fixture fallback). No portal page change — the same super-admin SDUI
doc owner edits the Pharma sections.

**Seed/validator:** `generate.mjs` carries the campaign + Pharma sections into `sdui_layouts` and
asserts campaign `storeId`/products and Pharma rail ids exist in `catalogIndex`.

**Rollback:** revert the `internal/{contracts,sdui,reco,platform/cache}`, `data/home/{sdui,sections}.ts`,
seed, `GatewayClient`, `BrandCampaignsSection`/`HomeView`/`DealsLanding`, `pharmaService`/
`usePharmaFeed`/`PharmaHeroBanner`/`PharmaScreen`, and web `sdui/page.client.tsx` hunks; the
`@data`/feature fixtures resume. No migration.

**Docs:** `mobile-app.md`, `data-layer-sdui.md`, `db-schema.md`, `monolith-breakdown.md` §1,
`caching-cloudflare-valkey.md` §5, `server-gateway-plan.md`, `data/DATA_CONTROL.md`. Seed: assert
`ph-t1` etc. are non-Rx. **Date:** 2026-10-18

---

## W49 — Honest handling for the two auth-gated writes (no anon endpoint, no Supabase OTP)

**Status:** 🟢 Shipped (app + docs). No server / DB / cache change at the time. **Superseded by
W23:** app auth is now real Supabase phone OTP, so both auth-gated writes are reachable in prod;
the honest client handling below still applies.

- **Dev identity is explicit + dev-only.** `GatewayClient.authHeader()` sends `X-Dev-User` **only
  when `__DEV__` and `DEV_USER` is set** (mirrors the portal's `X-Dev-*` guard), so the
  mocked app exercises an `AUTH_DISABLED=true` gateway deterministically instead of relying on the
  server's `DEV_USER_ID` fallback. Never attached in a release build; a `AUTH_DISABLED=false`
  gateway ignores it. New `GatewayClient.authStatus()` (`dev-bypass` / `mock` / `enterprise` /
  `none`) is diagnostic only.
- **Paid-ad measurement is observable, never fabricated.** `GatewayClient.recordAdEvent` now
  returns `boolean` (true only when the ad-server confirmed; no local mock fallback) and logs a
  dev-only warning with the HTTP status + auth status on failure. `SponsoredRail` / `CampaignHero`
  mark an impression reported **only on `true`**, so a failed send (offline / no identity) can retry
  on remount while a success is never re-POSTed.
- **Vendor rating is durable-or-honest.** `submitVendorRating` is now async and returns
  `{ ok, status }` (`synced` / `offline` / `signed-out` / `not-verified` / `invalid`); the
  device-local optimistic write is unchanged (offline still succeeds locally). `RateVendorScreen`
  awaits it, shows a "Saving…" state, and surfaces an inline error on `signed-out` / `not-verified`
  instead of silently pretending the server row was written.
- **No new `VendorRatingOutcome` divergence:** `GatewayClient.rateVendor` returns the outcome union
  rather than a bare `boolean`; `withFallback` no longer fabricates a `false` rating.

**Resolved by W23:** the real GoTrue session satisfies `auth.Require`, so `POST /ads/events`
(portal ad KPIs) and `PUT /vendors/{id}/rating` (server-durable ratings) are now reachable in prod.
No anon event endpoint was opened (KPI-poisoning surface avoided). Local dev can still use
`AUTH_DISABLED=true` + `user-1`.

**Rollback:** revert the `GatewayClient` (`authHeader` / `authStatus` / `recordAdEvent` /
`rateVendor`), `SponsoredRail`, `CampaignHero`, `vendorRatings`, `RateVendorScreen` hunks and the
`.env.example` line. No migration.

**Docs:** `docs/architecture/mobile-app.md`, `docs/architecture/mvp-backend.md`,
`docs/architecture/monolith-breakdown.md` §5, `data/DATA_CONTROL.md`,
`docs/DEVELOPER_ONBOARDING.md`, `docs/RUNBOOKS/TROUBLESHOOTING.md`.
`caching-cloudflare-valkey.md` needs no change — every cache key/TTL is reused.

**Date:** 2026-10-17

---

## W48 — Mart production-readiness pass: one vendor pool, server drill-in, no fabricated PDP

**Status:** 🟢 Shipped (app + docs). No server / DB / cache change.

Closes the W47-listed Mart P0/P1 correctness gaps without new screens or endpoints:

- **One vendor-inventory owner (`P0-2`).** New `features/catalog/hooks/useVendorProducts` (server
  `GET /stores/{id}/products` + festival overlay + offline fallback) replaces the separate effects in
  `FaMartScreen` (in-wrapper drill-in) and `VendorDetailScreen` (pushed page). The pushed page no
  longer reads the local `getVendorProducts` fixture pool in remote mode, so the two vendor surfaces
  and the deals landing render identical rows/prices.
- **Server-backed category drill-in (`P0-1`).** New `features/catalog/hooks/useCategoryVendors`
  groups `GET /search?q=&app=` by `storeId`, joins `GET /stores?app=`, and overlays the festival
  discount. New seller `ACTIVE` rows now appear and prices match checkout; the local
  token-containment grouping stays the offline / multi-word safety net (never regresses to empty).
- **No fabricated PDP price (`P0-5`).** `CommonProductDetailView` no longer falls back to the demo
  `FALLBACK_PRODUCT` (which showed an invented ₹204/₹999 row); a missing product renders an honest
  empty state. "More from store" already reads `getStoreProducts` with only an offline local filter.
- **Feed robustness (`P1-6/8/10`).** `useMartFeed` exposes `refresh` (pull-to-refresh / retry); the
  offline feed body falls back to the `martStores` fixture so the "Local Vendors" footer never blanks;
  `DealsLanding` shows a loading / error state instead of a silent "No deals right now".

**Still deferred (deliberately safe options):**

- **Paid-ad measurement is auth-gated.** `POST /ads/events` is behind `auth.Require`; app auth is the
  **mocked** login, so impression/click events only reach the ad-server when the gateway runs
  `AUTH_DISABLED=true` (topic-1 dev identity) — under a production `AUTH_DISABLED=false` gateway
  they stay inert and portal KPIs undercount to zero. W49 made the client-side path honest +
  observable (boolean result, dev warning, no fabricated success) without opening an anon endpoint.
- **`DealsLanding` `campaign` mode stays Home-owned `@data`** (no `GET /ads/campaigns/{id}` read;
  reachable only from Home). Unchanged from W38/W40/W44/W47. **(Resolved in W50** — now the anon
  `GET /home/campaigns(/{id})` projection.)
- **Vendor ratings remain device-local on display** — the server `PUT /vendors/{id}/rating` is
  mirrored and now reports its outcome (`synced`/`offline`/`signed-out`/`not-verified`) so the screen
  is honest (W49); a fully server-durable row still waits on a real session (auth mocked).
- **Pharma SDUI parity** — no `GET /sdui/pharma`; Pharma rails stay feature-mock (stores are
  server-backed). **(Resolved in W50** — `GET /sdui/pharma` shipped.)

**Rollback:** revert the two new hooks + the `FaMartScreen`/`VendorDetailScreen`/`CategoryDrillInPanel`/
`CommonProductDetailView`/`DealsLandingScreen`/`useMartFeed`/`martService` hunks. No migration.

**Docs:** `docs/architecture/mobile-app.md`, `data/DATA_CONTROL.md`, `PAGE_CATALOG.md`;
`monolith-breakdown.md` / `caching-cloudflare-valkey.md` need no change — no server/cache surface
moved (reuse of existing `GET /search`, `GET /stores`, `GET /stores/{id}/products`).

**Date:** 2026-10-17

---

## W47 — Page registry + Mart paid/organic contract (docs-first)

**Status:** 🟢 Shipped (docs + one app refactor). No server / DB / cache change.

Closes the "unknown pages" gap: `PAGE_CATALOG.md` §2 is now the authoritative RN page registry
(one row per route in `navigation/types.ts` + `MainTabs` + `FoodStack` + `SubAppWrapper` tabs,
tagged **MAIN / MART / FOOD / PHARMA** with file + entry point; §1/§3 flagged historical). The
Mart feed's paid/organic section order is now codified in
`features/ecommerce/services/martFeedSections.ts` (`MART_FEED_SECTIONS`, consumed by
`FaMartScreen`) — a paid section without a placement trips a dev guard.

Verified (no code change needed):

- **CATEGORY_TOP / STORE_TOP hosts exist** on every MART/PHARMA category/store surface —
  `CategoryDrillInPanel` (CATEGORY_TOP); `VendorDetailScreen`, `MedicalShopDetailsScreen` and the
  Food `RestaurantProfileScreen` (STORE_TOP). Seller wizard offers match rendered hosts.
- **W43/W44 guards intact** — `SponsoredRail` returns `null` on empty fill + local impression
  dedupe; `CampaignHero` renders its fallback only when there is no LIVE fill; one price batch on
  the Mart page. Do not regress.

**Still deferred (deliberately not changed — safer options):**

- **`DealsLanding` `campaign` mode stays Home-owned `@data`.** It is reachable only from the Home
  "Deals of the day" carousel; there is no `GET /ads/campaigns/{id}` campaigns read and the `camp-*`
  rows are not seeded in the gateway, so migrating would break the Home section and retiring would
  remove a live Home surface. Tracked since W38/W40/W44. **(Resolved in W50** via the anon
  `GET /home/campaigns(/{id})` projection + seeded `fm-*` refs.)
- **Vendor-surface inventory hook** — `VendorProfileView` and `VendorDetailScreen` fetch
  `GET /stores/{id}/products` in separate effects. Share one hook to guarantee single-owner parity.
- **Pharma SDUI parity** — `GET /sdui/pharma` does not exist; Pharma home rails stay feature-mock
  (stores already server-backed). Add only if Pharma merchandising gets a portal owner. **(Resolved
  in W50** — the same super-admin SDUI doc owns the Pharma sections.)

**Docs:** `PAGE_CATALOG.md`, `docs/architecture/mobile-app.md`, `docs/architecture/web-portal.md`.

**Date:** 2026-10-17

---

## W46 — Food "Today's Special" on SDUI (Food-only section)

**Status:** 🟢 Shipped (app + server + data + seed + docs). No migration.

Closes the W45 deferral: the "Today's Special Near You" rail is now super-admin-merchandisable.

- New Food-only SDUI section `foodSpecials` (`data/home/sdui.ts`, raw `sp-*` ids) served by
  `GET /sdui/food` — the allowlist is now `foodHero`/`foodSpecials`/`mostRatedDining` (the shared
  Home `diningSpecials` store rail is no longer served to Food; `HomeView` skips the new id, so
  Home's own rail is unchanged and there is no cross-surface impact).
- `diningService.fetchDiningFeed` orders `TODAYS_SPECIALS` by `foodSpecials.productIds` (unknown ids
  ignored, remaining dishes keep fixture order; empty/offline → untouched).
- Seed validator now checks `foodSpecials` ids against `catalogIndex` (`sp-*` are real seeded
  products); portal mock seed mirrors the section; docs updated.

**Still deferred:** Food menu festival discounts remain MRP-only at display
(`promo.festival_optins` targets `catalog.products`, not `directory.menus`; settlement already
ignores menus — no migration).

**Date:** 2026-10-17

---

## W45 — Food sub-app ads/offers rebuild: truthful offers, coupon surface, hero parity, `/sdui/food`

**Status:** 🟢 Shipped (app + server + data + seed + docs). No migration.

Six Food correctness fixes, all reusing existing authorities (`ads.campaigns` + `promo.*` +
`directory.*`); no new ad/discount table:

- **O-1 offer truth.** "Recommended & Offers" now lists only `mrp > price` dishes
  (`getOfferDishes` in `features/food/utils/menu.ts`, shared by the profile rail and the
  `RestaurantOffersScreen` "View All" page) and the rail hides when nothing is on offer. The false
  `AdLabelBadge` on organic dishes (previously on every own dish) is removed.
- **O-2 coupon surface.** The profile offer slot shows the **authoritative live coupon**
  (`useBestCoupon('FOOD')` → `GET /coupons?app=FOOD`, strict) as `CODE · value/min-order`; tapping
  opens the cart coupon sheet. The store `offerTag` is a decorative fallback only.
- **O-3 hero fallback + collapse.** `FOOD_HERO` gained the SDUI `foodHero.banners` house fallback
  (`FoodHouseHero`, non-interactive, no AD pill/events, mirrors `MartHouseHero`); the profile's
  `STORE_TOP` band now drops entirely (grey slab + overlap removed) when there is no LIVE fill.
- **O-4 no dead taps.** `FoodHomeScreen.openVenue` resolves an unknown venue via `gateway.getStore`
  (Mart W43 pattern) so a `FOOD_HERO` tap on a delivery kitchen (`store-f*`, never in the dining
  grid) opens its profile instead of no-op. `STORE_TOP` venue taps stay no-op (the placement is
  seller-scoped to the current store; product/dish taps still go to PDP).
- **O-5 `GET /sdui/food`.** New public read (`internal/sdui`, cache
  `faazio:v1:gateway:sdui:{locale}:/food` 300 s, purged with `/home`/`/mart` on publish) serving only
  `foodHero`/`foodSpecials`/`mostRatedDining`; `GatewayClient.getFoodFeed` reads it. The feed drives
  the house hero and drops delisted venues from Top Rated (server `directory.dining_venues` is the
  authority). Two LIVE `FOOD_HERO` demo creatives + `foodHero` banners were seeded so the placement is
  locally testable.
- **O-6 menu hygiene.** `getMenuForRestaurant`/`menuForVenueName` no longer pads an unseeded venue
  with the shared `TODAYS_SPECIALS` cuisine-match (which could surface another restaurant's dishes);
  unseeded venues show an honest empty menu. `useRestaurantMenu` trusts the server list as the venue's
  own (no name re-filter), so a rename can't drop rows; an empty remote menu still keeps the fixture
  seed so the profile is never blank.

**Still deferred:** Food menu festival discounts are MRP-only at display
(`promo.festival_optins` targets `catalog.products`, not `directory.menus`; settlement already
ignores menus — no migration; the per-open overlay call was removed in **W56**). Editing
`foodSpecials`/`mostRatedDining` in the shared Home doc also affects Home's rails.

**Rollback:** revert the `features/food` + `GatewayClient.getFoodFeed` + `data/home/sdui.ts`/`sections.ts`
+ `internal/sdui`/`cache` hunks; re-run `node server/supabase/seed/generate.mjs`.

**Docs:** `mobile-app.md`, `data-layer-sdui.md`, `monolith-breakdown.md`, `caching-cloudflare-valkey.md`,
`server-gateway-plan.md`, `data/DATA_CONTROL.md`.

**Date:** 2026-10-17

---

## W44 — Mart merchandising unification: Deals on SDUI, `/sdui/mart`, one price batch, View All

**Status:** 🟢 Shipped (server + app + seed + docs). No migration.

Closes the P0 merchandising split and Mart/Home coupling on the Mart page:

- **Deals → SDUI.** `martDeals.productIds` now lives in the same Mongo SDUI doc as `martEssentials`
  (single owner, portal-editable, no release). `@data/home/sdui.ts` owns all three Mart sections, so
  the mock/remote shapes match; `@data/mart/deals` + `mocks/martHomeFeed.ts` are offline fallbacks.
  The seed generator maps `@data/home/sdui.ts` verbatim (no more `MART_SDUI` splice) and validates the
  Mart id lists + banner bounds.
- **`GET /sdui/mart`.** New public read (`internal/sdui`, cache `faazio:v1:gateway:sdui:{locale}:/mart`
  300 s, purged with `/home` on publish) serving only `martHero`/`martDeals`/`martEssentials`. The app
  reads it via `GatewayClient.getMartFeed`; `fetchMartFeed` no longer downloads the whole Home feed.
- **One price batch.** `FaMartScreen` issues a single `useActiveDiscounts` for Deals + Essentials +
  the vendor pool and passes the map to `SponsoredRail` (new optional `discounts` prop; self-serves
  only when absent). `SponsoredRail` also gained a local impression guard.
- **View All + canonical taps.** Both Mart rails wire `onViewAll` → `DealsLanding` catalog-resolved
  `martDeals`/`martEssentials` modes; deal/essential taps resolve the canonical row via the new
  `openCatalogTarget` (local projection offline).
- **Seed fill.** Three LIVE `SPONSORED_SHOWCASE` rows (was one) so the Mart paid shelf demonstrates a
  real multi-card fill.

**Still deferred:** Mart `DealsLanding` **campaign** mode stays Home-owned `@data` (only reachable
from Home, not Mart).

**Rollback:** revert the `martService`/`FaMartScreen`/`DealsLandingScreen`/`SponsoredRail`/`GatewayClient`
hunks and the `sdui`/`seed` changes; drop the `martDeals` section.

**Docs:** `mobile-app.md`, `data-layer-sdui.md`, `monolith-breakdown.md`, `caching-cloudflare-valkey.md`,
`server-gateway-plan.md`.

**Date:** 2026-10-17

## W43 — Mart ads/offers: house hero fallback, resilient feed, price parity, deep-link resolve

**Status:** 🟢 Shipped (app + docs). No migration / endpoint / cache-key change.

Four Mart feed correctness fixes:

- **I-1 hero.** `CampaignHero` (`MART_HERO`) now takes the SDUI `martHero.banners` as its house
  fallback via the new presentational `MartHouseHero` (shared `AdBannerCarousel`, **no AD pill, no
  impression/click POST, non-interactive**); `martService.fetchMartFeed` reads `martHero` through
  `getHomeFeed()`. Paid → house → nothing; never fabricated.
- **I-2 resilience.** `fetchMartFeed` degrades each leg independently (per-leg `catch` + a body guard
  returning fixtures) and `useMartFeed` catches; a failing `GET /stores`/`GET /sdui/home` no longer
  blanks the whole feed into a stuck skeleton.
- **I-3 price parity.** Deals + Daily-Essentials rails overlay the approved festival discount
  (`priceDeals`/`priceEssentials` + `useActiveDiscounts`), matching the paid shelf + vendor drill-in.
- **I-4 deep-link.** `SubAppWrapper` resolves the initial vendor via `getStore(id)` (same id-space as
  the rail + ad targets) with the local `@data` fixture fallback, so a renamed/redacted server row
  still opens.

**Rollback:** revert `MartHouseHero` + the `martService`/`FaMartScreen`/`SubAppWrapper` hunks
(drop the `fallback` prop; restore the sync `martStores.find` seed).

**Docs:** `mobile-app.md`, `data/DATA_CONTROL.md`, `data-layer-sdui.md`.

**Date:** 2026-10-17

## W42 — Self-serve hero ads: no admin approval, all six hero hosts

**Status:** 🟢 Shipped (server + web portal + app + docs). Migration `0028_ads_selfserve.sql`.

The admin approval queue is gone. A verified seller publishing their **own** item on a fitting
placement goes `LIVE` in seconds; a computer does the checks an admin used to (ownership, placement↔app
fit, R2-CDN-only poster, length bounds, ≤90-day window, ≤3 LIVE per (seller, placement), ≤10
publishes/seller/day), and a human admin only takes abuse down after a report.

- **Server:** `ads.campaigns.status` defaults `LIVE`; new `reports`/`takedown_reason` columns + a
  `campaigns_window_max` (≤90d) guard and cap/read indexes. `POST /ads/campaigns` is now
  `publishCampaign` (resolves ownership against `catalog.products`/`directory.menus`/`directory.stores`/
  `directory.dining_venues`, ignores the client `targetApp`, derives it, enforces cap + rate). Admin
  `PUT /ads/campaigns/{id}/status` is takedown (`REJECTED`+reason)/restore (`LIVE`) only. New
  authenticated `POST /ads/campaigns/{id}/report` (deduped per user, no PII). Valkey adds
  `faazio:v1:ads:report:*` (24 h) and `faazio:v1:ads:publish:*` (daily counter) + `Cache.Incr`.
- **Web:** wizard reordered to **what → where → creative → when → review**, "Publish now" (optimistic
  `LIVE` `requestHeroCampaign`), `eligiblePlacementsFor`/`PLACEMENT_REACH_NOTE`, Food/Pharma placements
  enabled; `admin/super/ads` becomes a **live monitor** (Live/Reported/CTR; Takedown/Restore, no
  Approve); `reportHeroAd`.
- **App:** every hero is now paid — `HOME_HERO` replaces the static Home `topAdSlides`,
  `FOOD_HERO`/`PHARMA_HERO` hosts added, `STORE_TOP` covers `RestaurantProfileScreen`, and the organic
  `MartHeroCarousel`+`MART_HERO_BANNERS` are retired. `CampaignHero` adds a one-impression guard +
  `accessibilityLabel="Sponsored"`; `GatewayClient.reportHeroAd`. Paid ads still never fabricate offline
  (empty fill → `null`); impressions/clicks reuse `POST /ads/events`.

**Still deferred:** seller-side Pause/Resume (needs a seller-scoped window mutation — deliberately not
shipped half-baked); `VENUE` in-app deep-link resolves to the vendor page (no restaurant-menu anchor for
a dish without a catalog row); App auth remains the mocked login (no Supabase phone OTP).

**Docs:** `mobile-app.md`, `data/DATA_CONTROL.md`, `PAGE_CATALOG.md`, `caching-cloudflare-valkey.md` §5a,
`db-schema.md §12.17`, `monolith-breakdown.md §1`, `mvp-backend.md`, `web-portal.md`.

**Date:** 2026-10-17

## W41 — Seller-run paid hero campaigns (Mart / category / store)

**Status:** 🟢 Shipped (server + web portal + app + docs). Migration `0027_ads_campaigns.sql`.

The seller Ads console is now end-to-end: a seller composes a hero campaign (`image_url` creative +
server-resolved `PRODUCT`/`DISH`/`STORE`/`VENUE` deep-link target) in the web portal, a super-admin
approves/activates it, and the app shows it as a labelled 16:9 hero.

- **Server:** `ads.campaigns` (one row per campaign × placement; PK `placement_id`, grouped by
  `campaign_id`), new `ad_placement` values `MART_HERO`/`PHARMA_HERO`/`FOOD_HERO`/`CATEGORY_TOP`/
  `STORE_TOP`/`HOME_HERO`, enums `ad_creative_type`/`ad_target_type`. Endpoints: `GET /ads/hero`,
  `POST/GET /ads/campaigns`, `PUT /ads/campaigns/{id}/status`. `RecordEvent`/`AttributeOrder` now bump
  both `ads.sponsored_slots` and `ads.campaigns` in one CTE. Valkey `faazio:v1:ads:hero:{placement}:
  {app}:{category}:{store}` 300 s (+ `DelPrefix` purge on status change). Demo seed `DEMO_HEROES`.
- **Web:** seller `app/seller/ads` wizard (5 steps) + KPI/campaign list, super-admin hero moderation
  (`app/admin/super/ads`), `useHeroCampaigns`/`useHeroAds`, `heroCampaigns` store slice.
- **App:** `GatewayClient.getHeroAds` + `HeroAd`, shared `components/shared/CampaignHero` (thin over
  `AdBannerCarousel`, `slideKey` prop added) + `hooks/useCampaignHero` + `services/adsTarget.ts`
  resolver. Wired at `MART_HERO` (`FaMartScreen`, SDUI `martHero` house fallback), `CATEGORY_TOP`
  (`CategoryDrillInPanel`, scoped by `category`), `STORE_TOP` (`VendorDetailScreen` +
  `MedicalShopDetailsScreen`, scoped by `storeId`). Removed the fake store-derived `SPONSORED` ad
  slides (`getAdsForQuery`/`VendorAdSlide` in `services/categoryVendors.ts`). Paid ads never fabricate
  offline (empty fill → fallback/`null`); impressions/clicks reuse `POST /ads/events`.

**Still deferred:** (superseded by W42 — `FOOD_HERO`/`PHARMA_HERO`/`HOME_HERO` hosts and the
self-serve/no-admin workflow shipped there) `VENUE` targets resolve to the vendor page (no
restaurant-menu anchor). App auth remains the mocked login (no Supabase phone OTP).

**Docs:** `mobile-app.md`, `data/DATA_CONTROL.md`, `PAGE_CATALOG.md`, `caching-cloudflare-valkey.md` §5a,
`db-schema.md §12.17`, `monolith-breakdown.md §1`, `mvp-backend.md`, `web-portal.md`.

**Date:** 2026-10-17

---

## W40 — Mart residual de-mock + checkout festival-discount settlement

**Status:** 🟢 Shipped (app + server + docs). No migration.

Closing the last `@mock`/trust gaps from the Mart slice after W37–W39:

- **PDP "More from store"** (`features/product/CommonProductDetailView.tsx`): the related-products
  grid now reads `GatewayClient.getStoreProducts(storeId)` (`GET /stores/{id}/products`,
  `catalog.products` by `store_id` + `ACTIVE`) and keeps the local `martProducts` filter only as the
  offline fallback — the last local Mart product pool on the PDP.
- **`VendorHighlights`** now takes the vendor and derives its badges (`deliveryTime`, `rating`)
  instead of the hardcoded `HIGHLIGHTS` const, so it can't advertise a delivery/rating the server
  didn't send.
- **Ad-label fix:** the organic "Discounted Products" rail no longer passes `showAdLabel` (it is
  merchandising, not paid placement — only sponsored surfaces carry the 'AD' pill).
- **Checkout money trust:** `internal/checkout` now applies approved festival discounts at
  settlement via a new `contracts.DiscountReader` (implemented by `internal/promo.Repo`, aliasing
  `ActiveDiscount` to the shared contracts type). Previously the app overlaid `promo.active-discounts`
  on the price but `CreateOrder` charged the base `catalog.products.price_paisa`, so a shopper could
  be charged more than displayed. `discountedUnitPaisa` ignores an out-of-range percent; a promo read
  failure aborts the order rather than silently overcharging. Unit test `TestDiscountedUnitPaisa`.
- **Web:** the seller listing editor (`seller/products/[id]/edit`) now persists price/MRP through
  `upsertPrice` (`PUT /seller/products/{id}`) — previously only the primary image reached the
  gateway and money edits stayed local.

**Still deferred:** Mart media path (product photos are seller-owned; R2 backfill blocked on creds),
`DealsLanding` **campaign** mode stays Home-owned `@data`, and the portal catalog/store seed divergence
(`hydrateFromGateway` still omits products/stores).

**Docs:** `docs/architecture/mobile-app.md`, `monolith-breakdown.md §1`, `web-portal.md`.

**Date:** 2026-10-17

---

## W39 — Mart impression events + cart seed gate (production-readiness)

**Status:** 🟢 Shipped (app only). No server change.

Two production-testing gaps from the Mart slice:

- **Passive Mart `view` impressions.** `services/productViews.trackProductView` reports a `view`
  behavior event at most once per product per session (`user_events` has no dedupe), reset on logout.
  Wired through `hooks/useViewableTracking` to the Mart **search-result grid**, both feed rails
  (`DealsOfDayRail`/`DailyEssentialsRail`, now optional `onItemView`), and the vendor drill-in
  **"All Products" grid** (converted from a `ScrollView` to a viewable `FlatList`, handlers threaded
  from `FaMartScreen`). PDP opens still emit their own `view`; `cart_add` + ad impression/click were
  already live.
- **Cart seed gate.** `cartStore.hydrate()` now clears the local `seedCartItems` on the **first**
  remote hydrate when the server cart is empty, so a shopper never sees/checks out fixture lines the
  server doesn't have. Later empty responses leave the current cart alone.

**Media:** the portal SDUI editor can now **upload** a Mart hero banner image (stored as a resolved
public Supabase Storage URL; seed mode rejects the data-URL fallback). **Still deferred:** product
photos (seller-owned) and the mobile Unsplash fallbacks, and `DealsLanding` **campaign** mode
(Home-owned `@data`).

**Docs:** `docs/architecture/mobile-app.md`.

**Date:** 2026-10-16

---

## W38 — Mart hero + Daily Essentials server-controlled via SDUI (de-mock slice, M2–M4)

**Status:** 🟢 Shipped (server + Mongo + app + web). Docs-only otherwise.

The two remaining 100%-mock Mart rails — the **hero carousel** (`hb-*`) and the **Daily Essentials**
rail (`mf-*` ghost ids) — had no backing table, no endpoint and no web control. Rather than invent a
per-rail SQL table (rejected: duplicates SDUI, needs new cache/TTL + CRUD), both are now sections in
the existing Mongo `sdui_layouts/home` doc.

- **Server/Mongo (`internal/contracts`, `internal/reco`, `internal/sdui`).** `SduiSection` gained
  optional `banners[]` (`SduiBanner{id,title,subtitle,accent,imageUrl}`) — the only non-ID leaf in
  the doc (copy + image URL, **never money**). Handler bounds: ≤8 banners/section, `imageUrl` ≤512
  chars (tests: banner publish + overlong-URL reject). Seed adds `martHero` (3 banners) and
  `martEssentials` (real `gr-p3..p7` catalog ids).
- **App (`martService.fetchMartFeed`).** Reads `martHero.banners` / `martEssentials.productIds` via
  `gateway.getHomeFeed()`; the `mocks/martHomeFeed.ts` fixture is now offline first-paint only and
  the retired `mf-*` ghost ids were replaced with real `gr-*` ids.
- **M3.** `DealsLandingScreen` **`discounts` mode** now reads the vendor pool from the server
  (`getStoreProducts`), matching the drill-in; `campaign` mode stays Home-owned `@data` (out of the
  Mart slice — deleting it would regress Home's `BrandCampaignsSection`).
- **M4.** Mart **feed search** now emits the `search` behavior event (anchored to the top result,
  mirrors `SearchScreen`). Checkout re-pricing was already server-authoritative
  (`checkout.Service` snapshots `catalog.products`; client price is display-only) — no change.
- **Web (`admin/super/sdui`).** Sections with `banners` render an inline title/subtitle/image-url
  editor; publishing flows through the existing `saveSduiLayoutHome` → `PUT /admin/sdui/home`.

**Still deferred:** the R2 media backfill (Unsplash seed URLs stay as the offline fallback until
`generate.mjs`/backfill emits `r2:` keys; `0025` is the durable home) and card-impression `view` events
(PDP already emits `view`; only `search` + `cart_add` + ad events fire for Mart surfaces). Its
`DealsLanding` **campaign** mode is Home-owned. Mobile needs no media plumbing: the gateway now
resolves `image_key` → CDN URL on every catalog/directory/SDUI read, and Rx images stay behind the
unchanged signed-URL endpoint (backend repointed to R2).

**Docs:** `docs/architecture/db-schema.md §8.1`, `data-layer-sdui.md`, `mobile-app.md`,
`web-portal.md`, `data/DATA_CONTROL.md`.

**Date:** 2026-10-16

---

## W37 — Mart vendor inventory server-linked (de-mock slice, M1)

**Status:** 🟢 Shipped (server + DB + app). No web change.

The Mart vendor drill-in (`VendorProfileView`) was 100% local — `martProducts.filter(storeId)` — and
the feed **search mode** filtered the local fixture pool even in remote mode. The server already had
`catalog.products.store_id` + `status`, but no list endpoint.

- **Server (`internal/catalog`).** New anonymous `GET /stores/{id}/products`
  (`Repo.ByStorePage`) — `store_id = $1 AND status = 'ACTIVE'`, keyset-paginated
  (`rating DESC, id ASC`, `X-Next-Cursor`), PII-free product projection. First page cached
  `faazio:v1:catalog:store-products:{storeId}` 300 s; purged on `PRODUCT_EDIT` / status change.
  `SellerProduct` now carries `storeId` (for the purge). Tests: `TestByStorePageActiveOnly`,
  `TestStoreProductsEndpoint`.
- **DB (`0024_mart_vendor_list.sql`).** Composite `products_store_status_idx (store_id, status)` and a
  backfill of sellerless `DRAFT` seed rows → `ACTIVE` (the ACTIVE-only endpoint would otherwise be
  empty). `generate.mjs` now writes `status = 'ACTIVE'` for seed rows.
- **App.** `GatewayClient.getStoreProducts` (fixture fallback `getCatalogEntriesByStore`);
  `FaMartScreen` fetches the drill-in inventory + feed search (`searchProducts(q,'MART')`) asynchronously;
  `VendorProfileView` props widened to `Product[]`. Vendor header now fetches the single store
  (`getStore`) so an authed caller sees the real address/hours (anon stays redacted) instead of the old
  hardcoded location. `categoryVendors.getVendorProducts` marked `@deprecated` (offline/Pharma fallback).

**Still mocked (next slices):** ~~`MartHeroCarousel` (`hb-*`) + `DailyEssentialsRail` (`mf-*` ghost
ids)~~ (shipped in W38 — Mongo SDUI doc); `DealsLandingScreen` **campaign mode** stays Home-owned
`@data` (no campaigns read endpoint — out of the Mart slice); Mart **view event emission** for the
reco funnel (W38 shipped `search`; card-impression `view` still open, M4).

**Docs:** `db-schema.md §12.15`, `monolith-breakdown.md §1`, `caching-cloudflare-valkey.md §5/§7a`,
`mobile-app.md`, `data/DATA_CONTROL.md`.

**Date:** 2026-10-16

---

## W36 — Web takes control of the Home SDUI (publish pipeline)

**Status:** 🟢 Shipped (server + web). No app or DB change.

Before this, the portal's `admin/super/sdui` page mutated a local-only `setSduiLayoutStatus()`
(no `pushWrite`, no server endpoint) whose record shape didn't match the gateway doc — and the
`/sdui/home` hydrate was dead code (it expected `{version, sections}`, the endpoint returns an
array). Web could not change a single Home pixel.

- **Server (additive, `internal/sdui`).** Super-admin `GET /admin/sdui/home` returns the raw
  ID-only layout (`{layoutId, locale, version, sections}`); `PUT /admin/sdui/home` validates bounds
  (≤40 sections, ≤100 id refs, ids ≤64, ≤20 chips) and publishes via `contracts.LayoutWriter` →
  `reco.Repo.SaveHome` (atomic `$inc version` + `updatedAt`), purges `faazio:v1:gateway:sdui:en:/home`
  and audits `SDUI_PUBLISH`. New tests: section validation, super-admin gate, service version bump.
- **Portal.** `SduiSection`/`SduiLayout` now mirror the gateway doc (ID-only, no `path`/`status`);
  `SDUI_LAYOUTS` seeds the real 15-section Home doc; `saveSduiLayoutHome` pushes to the gateway
  (`pushWrite`, optimistic + rollback); hydrate reads `/admin/sdui/home` for super-admins; the page
  edits section titles + `productIds` and publishes.
- **Not in this slice (needs new data surfaces, still fixture-backed):** `adBanner` (image banners —
  no slot table), `hotBrandDeals` (vendor campaigns — no campaigns read), the header category rail
  (`GET /categories/rail` — no categories table), and personalized Recently Viewed (H4). The
  `nearbyOffers`/demographic rails already read the SDUI feed (W35), so web edits to their
  `productIds` now reach the app.

**Rollback:** revert the `internal/sdui` admin routes + `contracts.LayoutWriter`/`reco.SaveHome`,
and the portal `SduiLayout`/`saveSduiLayoutHome`/page changes. No migration.

**Date:** 2026-10-16

---

## W35 — Home SDUI cutover: feed drives every data-backed rail (Home slice 1)

**Status:** 🟢 Shipped (app) + 🟢 Shipped (server, additive).

The Home feed (`GET /sdui/home`) previously drove only the sponsored rail and half of
`DealsOfDay`; the other rails rendered their `@data/home/*` fixtures directly while the
server doc sat unused. This slice makes the SDUI doc the single source of truth for every
Home section whose doc carries the data, with each fixture kept as the offline first-paint.

- **Server (additive).** `sdui.Service.Home` now also joins each section's `storeIds` via
  the (previously unused) `contracts.StoreReader`, exposing `HomeSection.stores`; a new
  `directory.Repo.ByIDs` reads the PII-free store-list projection. No new endpoint, table,
  column or cache key — the same `faazio:v1:gateway:sdui:{locale}:/home` value (`TTLSdui`
  300 s) now carries the store join.
- **App.** `HomeView` threads the feed's `products`, `stores` and `chips[].productIds` into
  the sections, which accept them as props and fall back to their fixtures when absent:
  `NearbyOffersSection`, `Mens/Womens/ChildrensSection`, `HairSkinCareSection`
  (`getHomeFeedMock` also joins `storeIds` for offline parity), `MostRatedDiningSection`
  (server-joined `directory.stores`), `DiningSpecialsSection` and `FilterFeedSection`
  (resolves the active chip's `productIds` through `getProductsByIds`).
- **Still fixture-owned (unchanged, needs new server surfaces).** `adBanner` (paid
  `HOME_HERO` slot), `hotBrandDeals` (vendor-campaign carousels — no campaigns Home read),
  and the editorial copy inside the migrated rails. Tracked below.
- **Docs:** `docs/architecture/monolith-breakdown.md` §1, `docs/architecture/mobile-app.md`,
  `docs/architecture/data-layer-sdui.md`, this file.

**Rollback:** revert the `HomeView` prop threading + the section `products`/`stores`/
`chipProducts` props (fixtures resume), and the `contracts.StoreReader.ByIDs` /
`directory.Repo.ByIDs` / `sdui.Service` store join. No migration.

**Date:** 2026-10-16

---

## W34 — Server quench + strict money reads (Phase 0/1/2 of production-readiness plan)

**Status:** 🟢 Shipped (server) + 🔵 Partial (app).

- **Server (additive, existing contexts):** `GET /venues/{id}` (directory), `GET
  /seller/prescriptions/{id}` (pharma, name-only-until-READY; cross-seller 404), `GET
  /orders/tracking/{id}` (checkout, owner-scoped lightweight status), admin `POST
  /notifications/drain` (`contracts.Drainer`, 503 without a push provider). Pharma quote
  `price<=mrp` + idempotent `READY`. Migration `0023` (seller-queue index + `NOT VALID` quote
  CHECKs).
- **App:** `GatewayClient` money-critical reads are now **strict** (no fixture on a remote error):
  `getProduct`, `getStock`, `getProductsByIds`, `getMenu`, `getCoupons`, `validateCoupon`,
  `getOrderTracking`. New client methods `getVenue(id)` and `getOrderTracking(orderId)` expose the
  new endpoints. `MyOrdersScreen` polls `GET /notifications` every 60 s while mounted (MVP monitoring
  without FCM). Offline behaviour is unchanged when `USE_GATEWAY`/`STRICT` are unset/non-true.
- **Web portal:** every money/status/Rx/menu/booking/rewards mutation is now an awaited write with
  store-snapshot rollback + error toast (`pushWrite` → `writeAwaited`), replacing the silent
  `writeBehind` fallback.
- **Still mocked / not de-mocked (remaining Phase 2/4):** app auth (`authStore.login()`), cart +
  favourites + rewards + orders stores remain device-local-first (gateway mirrors best-effort), and
  there is no FCM/APNs sender (in-app inbox is poll-based).

**Date:** 2026-10-16

---

## W33 — De-mock slice 1: Mart home deals + Food delivery-store menus

**Status:** 🟢 Shipped (finish-and-cutover pass, Phase A+B slice 1).

Scope was the first slice of the "de-mock → single DB source" plan: Mart home and the
Food delivery menus. Auth stays mocked (no Supabase phone OTP) by product decision.

- **Mart home deals de-mock.** `features/ecommerce/services/martService.ts`
  `fetchMartFeed` now resolves the `md-*` deal ids through the catalog
  (`GatewayClient.getProductsByIds`) and overlays the server **name/price/MRP/rating/image**
  onto the `@data/mart/deals` `MART_DEALS` row (which keeps only the editorial
  brand/size/discountTag/priceNote copy). `dealToProduct` is now the offline first-paint
  fallback, matching the Home `DealsOfDaySection` behavior. `mocks/martHomeFeed.ts` is tagged
  `@static-editorial` — hero banners and the `mf-*` daily-essentials rail have no backing
  table and stay for offline/SDUI-doc migration.
- **Food delivery-store menus (seed gap closed).** `data/food/menus.ts` now derives
  `storeMenus` (`Record<storeName, SpecialDish[]>`) from `foodProducts` via `storeId`, plus
  `menuForVenueName(name)` (dining menu first, then delivery). `GatewayClient.getMenu` and
  `features/food/utils/menu.ts` `getMenuForRestaurant` use the resolver, so the 12
  `store-f1…f12` kitchens no longer fall back to the shared `TODAYS_SPECIALS` cuisine-match.
  The seed generator emits `directory.menus` rows for both pools — **88 dishes / 30 venues**
  (was 61 / 18). Additive only, no DDL.
- **Docs:** `data/DATA_CONTROL.md` (food `storeMenus`/`menuForVenueName`; `MART_DEALS`
  server-priced; gap #5 resolved), `docs/architecture/db-schema.md` §12.4,
  `docs/architecture/data-layer-sdui.md`, `docs/architecture/mobile-app.md` (service log +
  restaurant/delivery menu), this file.

**Rollback:** revert `martService`/`mocks/martHomeFeed.ts` and the `menus.ts`/`GatewayClient`/
`utils/menu.ts` resolver; re-run `node server/supabase/seed/generate.mjs` (seed is generated, so
dropping the `storeMenus` derivation regenerates the 61-dish file). No migration to revert.

**Date:** 2026-10-16

---

## W31 — Shopper price + discount integrity

**Status:** 🟢 Shipped (Phases 1–2 of the discounted-items/ads plan). Phases 3–5 landed as **W32**.

Enterprise rule: a discount % is always derived from an authoritative source, never invented
on-device; a festival opt-in only reaches the app after an admin approves it.

- **Food (integrity).** Removed the on-device `price × 1.2` synthesis in
  `RestaurantProfileScreen`/`RestaurantOffersScreen`. `directory.menus` gained an authored
  `mrp_paisa` (`0022`), exposed as `MenuDish.mrp` → `SpecialDish.mrp`; only `mrp > price` shows a
  strike-through (no MRP ⇒ no discount label).
- **Mart deals join.** Home `DealsOfDaySection` resolves its `md-*` ids through the catalog
  (`getProductsByIds`); `dealToProduct` is the offline first-paint/fallback. The `md-*` rows were
  already seeded into `catalog.products`.
- **Festival → shopper price.** Anon `GET /promo/active-discounts?ids=` (`internal/promo`) —
  best live `festival_optins` per product (campaign `LIVE` + in-window, opt-in `APPROVED`, clamped by
  the effective `sector_caps` row), cached `faazio:v1:promo:active:{productId}` 300 s, invalidated on
  opt-in/campaign status change. Consumed by `GatewayClient.getActiveDiscounts` +
  `services/pricing.ts` (`useActiveDiscounts`/`fetchActiveDiscounts`/`withActiveDiscounts`/
  `applyActiveDiscount[s]`). Mock/offline returns none — base prices stand.
- **Overlay coverage.** The shopper pays the same price on every surface: Mart vendor rail +
  `DealsLanding` (full-pool overlay then `isDiscounted`), search results (Mart + Home configs via the
  `fetch` seam → `withActiveDiscounts`), category/vendor drill-in (`VendorDetailScreen`), PDP
  (`ProductDetailScreen` re-resolves the canonical row before overlaying once, so a pre-overlaid
  object is never double-discounted), favourites (`FavouritesPageView`), and the Home product
  surfaces (`usePricedProducts` in `AudienceGrid`/`HairSkinCare`/`RecentlyViewed`/`FilterFeed`/
  `NearbyOffers`/`SponsoredRail`).
- **Portal.** `seller/promotions` gained a **Live price** column + approval hint (cap enforced
  server-side).
- **Auth unchanged** — the app keeps its mocked login (no Supabase phone OTP by product decision).

---

## W32 — Coupon settlement + closed-loop ads (Phases 3–5)

**Status:** 🟢 Shipped.

- **Coupon validate → settle.** `POST /checkout/validate-coupon` (auth) previews a code via
  `contracts.CouponValidator` (pure `DecideCoupon`: not-found/inactive/expired/wrong-sector/
  wrong-state/min-order). `POST /orders` re-validates **before** the stock decrement and settles
  `paid = subtotal − couponDiscount − coins` (`ErrInvalidCoupon` → 400 `invalid_coupon`), so the
  display-only cart sheet can never discount an unsanctioned order. Cart consumes it via
  `GatewayClient.validateCoupon`.
- **Ads closed loop.** Authenticated `POST /ads/events` records impression/click
  (`internal/ads.RecordEvent`); impressions de-dupe per user via
  `faazio:v1:ads:seen:{userId}:{slotId}` 300 s. `contracts.AdAttributor.AttributeOrder` bumps
  `orders_attributed` best-effort after the order commits, using the last-clicked slot
  (`services/adsAttribution.ts`). Portal ads KPIs are now live (they read the counters that the app
  increments).
- **Placement expansion.** The paid shelf moved to the boundary-safe
  `components/shared/SponsoredRail` (fill + events + AD disclosure + "Why sponsored?" sheet) with a
  caller-supplied card. Consumed at `HOME_TOP` (Home), `SPONSORED_SHOWCASE` (Mart home), `SECTOR_RAIL`
  (vendor deals landing). Seed adds one demo LIVE slot per placement.
- **Portal write robustness.** `writeAwaited` + optimistic rollback + `sonner` toast replace
  fire-and-forget `writeBehind` for `requestAdSlot`/`setAdStatus`/`createCoupon`/`toggleCoupon`/
  `upsertOptin`/`setOptinStatus`, so a failed promo/ads write is visible and reverted.
- **No schema change** — settlement reuses `promo.coupons`; ads reuse the existing
  `ads.sponsored_slots` counters.

**Still open (future):** `BrandCampaignCard` preview products are deliberately not festival-overlaid
(a brand campaign promo is not a festival discount); `DiningSpecialsSection` renders `showPrice=false`
so it is N/A; standalone `SDUIRenderer` ProductCard nodes are not overlaid.

**Rollback:** revert `services/pricing.ts` + `getActiveDiscounts` + the rail overlays; server = drop
the `/promo/active-discounts` route/`ActiveDiscounts`/`OptinProductIDs` + cache key; migration `0022`
is additive (`mrp_paisa` nullable) so it can stay.

**Date:** 2026-10-16

---

## W30 — Sponsored live-ads rail (HOME_TOP)

**Status:** 🟢 Shipped.

A new, **separately-labelled** paid rail on Home — editorial (`hotBrandDeals` /
`BrandCampaignsSection` → `DealsLandingScreen`) stays `@static-editorial` and untouched.

- **Server.** Seed `sel-3` (ACTIVE MART seller) + three LIVE `HOME_TOP` `ads.sponsored_slots`
  (`ad-demo-home-*` → `fm-m1`/`fm-m2`/`fm-gad10`) in `0001_seed.sql`; `assertLeanContract` now fails
  if a slot's product is not in `catalog.products` or its seller is not seeded. Served by the anon
  `GET /ads/live?slot=HOME_TOP` (`ads:live:{placement}` 600 s, invalidated on status change).
- **Client seam.** `GatewayClient.getLiveAds(placement?)` + `getSponsoredProducts(placement)` (ID-only
  `LiveAd` → `getProductsByIds` catalog join). Paid placements have **no** fixture fallback — empty
  collapses the rail.
- **UI.** `features/home/sections/SponsoredRailSection.tsx` (added to `homeSections` + `homeSdui`
  after `dealsOfDay`): horizontal rail of `UniversalFeedCard variant="rail" showAdLabel`, header (i)
  opens a "Why sponsored?" `SlideUpSheet`. No LIVE rows / offline / error → renders `null` (fill-rate
  collapse), never an empty shelf; no change to `DealsLanding`/`BrandCampaigns`.
- **Events/attribution + placement expansion shipped in W32.** The rail now delegates to the shared
  `components/shared/SponsoredRail`; impression/click reporting and last-click attribution are live,
  and `SPONSORED_SHOWCASE`/`SECTOR_RAIL` are consumed.

**Rollback:** delete the `getLiveAds`/`getSponsoredProducts` methods + `SponsoredRailSection` + the
HomeView case + the `sponsoredRail` registry entries; seed revert = drop the two inserts. No migration
(table `0015` already shipped).

**Date:** 2026-10-16

---

## W29 — Full-stack readiness cleanup (P0–P4)

**Status:** 🟢 Shipped.

- **Rx address fix.** `PrescriptionFlow` now resolves the delivery `addressId` from
  `GatewayClient.getAddresses()` (server-owned) instead of the `@data/cart/addresses` fixture, so a
  `DELIVERY` Rx never stores a phantom fixture FK.
- **Strict writes.** `STRICT=true` disables the fixture fallback for `placeOrder`,
  `createPrescription`, `payForOrder` and `saveAddress` — a failed remote write fails loudly instead
  of fabricating a local success (`GatewayClient.strictWritesEnabled`).
- **Coupon read.** `GatewayClient.getCoupons` + cart coupon sheet hydration (see Home rails entry).
- **Rewards** documented as device-local writes for MVP.
- Web portal seed-keep is removed in production (empty gateway slice clears the slice, so sellers
  never see phantom demo rows) and the customers page gained an **activity-trail** panel fed by the
  admin-only `GET /admin/user-trail`.

**Date:** 2026-10-16

---

## W22 `@mock` → `@server` — food, dining, addresses, blood + seat bookings shipped

**Status:** 🟢 Shipped (profile reads, W25/W26/W27; seat bookings W28).

**Shipped:** `GatewayClient.getDetails()` now flattens the server's nested
`accounts.details` blob (`{userId, accountId, data}` → `DetailsTable`); new
`GatewayClient.getAddresses()` reads `GET /profile/addresses` (server `label` → app `tag`).
`UserDetailsScreen` hydrates `getProfile`+`getDetails` and `SavedAddressesScreen` hydrates
`getAddresses`, each keeping the `@data/*` fixtures as mock/error fallback (the seam pattern).
**(W25)** Pharma store rails + vendor picker flipped to `getStores('PHARMA')` via
`usePharmaStores`; My Orders notification badge now reads the inbox count
(`gateway.getNotifications()`).
**(W26)** Food restaurant menus now read `directory.menus` via `useRestaurantMenu`
(`GatewayClient.getMenu(venueId)`, `MenuDish → SpecialDish` mapper, fixture fallback) in
`RestaurantProfileScreen` + `RestaurantMenuScreen`; the FoodHome dining grid is driven by
`directory.dining_venues` via `diningService` → `getVenues('FOOD')` (fixture-enriched, neutral
defaults for server-only venues); `SavedAddressesScreen` now has a full add/edit/delete
`AddressEditor` wired to `GatewayClient.saveAddress` (`PUT`) / `deleteAddress` (`DELETE
/profile/addresses/{id}`, new server route); the blood donor dashboard feed is now server-backed
(`useBloodRequests` → `getBloodRequests`, fixture-enriched display extras, detail renders redacted
rows gracefully).

**Remaining — needs an explicit screen build, not just wiring:**
- **Razorpay native checkout.** `BookingSheet` runs the full hold → **mock authorize** → `attachBookingPayment`
  flow through `services/payments/checkout.ts` (a `PaymentCheckout` seam with a mock adapter — no
  `react-native-razorpay` install, no network). To go live: install the SDK, implement a `PaymentCheckout`
  adapter, and register it once via `setPaymentCheckout()`; no screen change. The mock refuses to
  fabricate a payment when a real publishable key is present (fails loudly).

**Dropped by product decision:** mobile auth stays **mocked** (`authStore.login()`) — no Supabase
phone-OTP/JWT cutover. `GatewayClient` still attaches a bearer when a session is present.

**Date:** 2026-10-14

---

## Home rails — editorial content stays fixture-owned (open product decisions)

**Status:** 🟡 By design — not a wiring gap.

The DB-backed parts of every home are already migrated: Mart/Food/Pharma **vendors** (`getStores`),
food **dining** (`getVenues('FOOD')`) and **menus** (`getMenu`), the Home **SDUI** doc, search,
product detail, stock and reviews all read the gateway with `@data/*` fallback.

What remains on `@data` is **editorial/marketing** content that has no table yet:
`MART_HERO_BANNERS`/`MART_DAILY_ESSENTIALS`, food `TOP_RATED_RESTAURANTS`/`TOP_FOODS_TO_ORDER`,
and the Pharma rails. Their product ids (`mf-*`, `pm-*`, `pe-*`) are presentation-only and are
**not** catalog rows, so they cannot be swapped to `getProductsByIds` without either seeding
them into `catalog.products` or replacing them with real catalog picks. That is a product/design
call, and the correct long-term home is the SDUI layout doc
(`docs/architecture/data-layer-sdui.md`). On Home the same now applies to the `adBanner`
(needs a paid `HOME_HERO` slot) and `hotBrandDeals` (needs a campaign read) sections (W35);
`MART_DEALS` is server-priced via `getProductsByIds` (W33) and the Home rails otherwise read
the SDUI doc.

**Resolved / still open (W29):**
- **Public promo/ads reads — shipped.** `0021` adds `title`/`min_order_paisa`/`free_delivery` to
  `promo.coupons`; the gateway serves anon `GET /coupons?app=&state=` (cached 600 s) and
  `GET /ads/live?slot=`. `GatewayClient.getCoupons` feeds the cart coupon sheet (fixture fallback);
  LIVE ads are consumed by the Home `SponsoredRailSection` (W30).
  The brand-campaign/hero rails stay **`@static-editorial`** — no ceiling on the SDUI layout doc.
- **Food-order bookings — removed.** `GatewayClient.createFoodBooking`/`getFoodBookings`,
  `state/foodBookingStore`, the `/food-bookings` routes and `contracts.FoodBooking` were dead code
  (no screen/route); deleted. `bookings.food_orders` stays a reserved, unseeded table seam.
- **Rewards writes — local by decision.** `rewardsStore.recordOrder`/`redeemCoins` stay device-local
  for MVP; the server view (`GET /rewards`) is reconciled on read only.
- **Razorpay native checkout.** Still the mock adapter seam (`services/payments/checkout.ts`); needs
  the SDK adapter, no screen change (see the W22 entry above).

**Date:** 2026-10-16

---

## Phone-auth OTP — typed full code stuck + broken back (fixed)

**Status:** 🟢 Shipped (code); on-device verification pending.

**Symptom:** entering the 6th OTP digit left the user on the OTP screen — no advance, no error,
no slide — and back erased the typed phone number.

**Root cause:** submit was a one-shot side effect inside the 6th keystroke's `onChangeText`
(no retry, no guard), `login()` was **not awaited** and had no `.catch` (silent rejection),
`otpError` was dead code (only ever set to `''`), there was no Verify button, and the target
`LanguageSelection` route was `React.lazy` behind a navigator-wide `<Suspense>` so the first push
swapped the whole native tree for `SplashFallback` mid-navigation.

**Fix:**
- `submitOtp` derives from `otpCode` via `useEffect` (fires however 6 digits arrive), guarded by
  `submitRef`; it dismisses the keyboard, `await`s `login()`, then `navigation.replace`s
  (guarded by `navigationRef.isReady()`). Failures set `otpError` (shake + toast now reachable)
  and reset the guard for retry.
- Always-present **Verify** CTA (enabled at 6 digits, spinner while awaiting) as the manual fallback.
- Input hardening: clamp to 6 digits instead of dropping over-length values; verified/retried
  focus; guarded phone auto-advance timer + keyboard dismiss.
- Two-step back (keyboard → phone entry, number preserved) wired to chevron + hardware
  `BackHandler`; `replace` removes the consumed OTP screen so back from Choose-language lands on
  Welcome.
- `LanguageSelection` + `Location` are now eager imports (first-run chain); other pushed screens
  stay lazy.

---

## Onboarding — welcome wordmark ships as raster

**Status:** 🟢 Shipped (PNG); design follow-up open.

The onboarding header wordmark (`variant="welcome"`) ships as a 99 KB raster
(`src/assets/logo-welcomepage.png`), extracted from `assets/brand/logo-welcomepage.svg`
because that SVG wraps a base64 PNG (an `<image>` child) rather than vector paths.
Rendering it via react-native-svg's `<Image>` is fragile on the New Architecture, and the
base64 would inline ~132 KB into the eagerly-loaded JS bundle. **Follow-up:** ask design
for a true vector export (no badge, transparent background) to cut ~100 KB from the app.

---

## Vendor ratings & reviews — phase 1 (client-side, derived gate)

**Status:** 🟢 Shipped (phase 1). Server build is deferred (see below).

**Feature:** Verified buyers rate the vendor they bought from, from five entry points
(My Orders card, Order Details, Mart vendor profile, Pharma shop, Food restaurant
profile). The rating form is a root `RateVendor` route.

**Design (locked):**
- **Eligibility = any non-cancelled order** (Delivered / Shipped / Processing); the
  server later tightens to `DELIVERED`. **Derived, never a stored flag**, permanently
  true for a `(user, vendor)` pair once it exists ("old customer keeps the ability").
- Vendor identity resolved once via `resolveVendorForProduct`
  (`data/directory/vendors.ts`) and snapshotted at placement (`PlacedOrder.storeIds`,
  `OrderRow.vendorStoreIds`, `MyOrder.storeId`).
- `hasPurchasedFromVendor` (`data/checkout/orders.ts`) + in-session `ordersStore` merge
  (`services/vendorRatings.ts`) drives all five entry points; the rating screen re-checks.
- One live rating per `(user, vendor)`, latest wins; `orderIds[]` kept as
  verified-purchase provenance; revisiting shows "Update your rating".
- Public display full name only (no id, phone, order id, avatar); nothing rating-related logged.
- Food dining-venue identity table (`data/food/diningVenues.ts`) holds ids/names only —
  full venue-data migration remains a separate task.

**Deferred:** the `DELIVERED`-only tightening; moderation on the public review list. **Now built
(server):** the Go reviews endpoints (`GET /vendors/:id/reviews`, `GET /vendors/:id/reviews/summary`,
`PUT /vendors/:id/rating`) with the server-side derived purchase gate, plus the `GatewayClient`
seam (`getVendorReviews`, `rateVendor`). The screen migration waits on Supabase phone OTP replacing
`authStore.login()`.

---

## Food — Restaurant menu category rail clipped (shared MenuCategoryRail)

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** On `RestaurantMenuScreen` the horizontal category chip rail rendered as a ~12–15px
sliver — every glyph half-cut, pills not positioned properly.

**Root cause:** RN injects `flexGrow: 1, flexShrink: 1` into every ScrollView
(`ScrollView.js` `baseHorizontal`). The menu page stacked the rail and the tall vertical menu list as
plain siblings in one `flex: 1` column with neither overriding those injected styles. A ScrollView
has no measure override (`ScrollViewShadowNode::layout`), so its base size is its content: the list's
basis ≈ thousands of px, the rail's ≈ ~50px. Yoga weights shrink by flex-basis, so the large negative
free space squeezed the ~50px rail by roughly the list's ratio → collapse. A ScrollView clips to its
frame (`overflow: scroll`) and the rail's content container centers its chips, so only a horizontal
band of each glyph survived. `RestaurantProfileScreen` nests the identical rail inside a single
vertical ScrollView (no sibling to compete with) — hence the bug was unique to the full-menu page.

**Changes:**
- New shared `features/food/components/MenuCategoryRail.tsx` (exported from the food components
  index): owns the pill chip metrics (`hs/vs/ms`, `gap`, `alignItems: 'center'`) and the layout
  contract — `flexGrow: 0` / `flexShrink: 0` on the rail box (plain `flex: 0` is insufficient, it
  leaves `flexShrink: 1`).
- `RestaurantMenuScreen.tsx`: consumes `MenuCategoryRail`; the vertical list ScrollView now owns
  `style={styles.list}` (`flex: 1`), so exactly one child takes the leftover space. Kept
  `keyboardShouldPersistTaps="handled"` (now in the shared rail) so the first chip tap is still not
  swallowed by the autofocused search keyboard.
- `RestaurantProfileScreen.tsx`: consumes the same rail (passing `marginBottom` via `style`),
  removing the duplicated inline chip styles. `flexGrow/flexShrink: 0` is a no-op for a child of a
  ScrollView content container.
- Natural rail height (padding + chip) rather than a fixed `height` — stays correct at larger system
  font scale and with long category names.

**Verification:** `npm run ts:check` and `npm run check:boundaries` pass (278 modules, no
violations). On-device pass pending: pills render fully and flush under the search box, rail scrolls
clean, first chip tap registers with the keyboard open, diet toggle shrink/grow does not clip, list
scrolls independently, and `RestaurantProfileScreen` chips look unchanged.

**Docs:** `docs/architecture/mobile-app.md` (Food — Restaurant profile vs full menu).

**Date:** 2026-09-30

---

## Category drill-in — pill rail + single ad + one-per-row product cards

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** Refined the category drill-in page (`CategoryDrillIn`) to a pill-chip
title rail, a single ad carousel, and a continuous one-per-row product list per
vendor — replacing the text/underline rail, per-store ads and horizontal product rails.

**Changes:**
- **Pill title rail** (`features/catalog/components/CategoryTitleRail.tsx`): chips mirror the
  shared filter-chip metrics (`height: vs(32)`, `paddingHorizontal: hs(14)`, `borderRadius: ms(16)`,
  `gap: hs(8)`). Inactive chips are transparent with dark (`#111827`) text; the active chip is
  filled with the accent and white text. The underline bar was removed.
- **Faazio-blue page accent** (`CategoryDrillInPanel.tsx`): added `FAAZIO_BLUE = '#1162D3'` and
  use it for the rail on this (brand-surface) page only — `MART_ACCENT`/`PHARMA_ACCENT` stay in
  `@data` for the Master Categories / vendor theme. Selecting a chip clears the search query and
  snaps the body `ScrollView` back to the top.
- **Single ad section**: the top title-contextual `AdBannerCarousel` under the rail is now the only
  ad placement; per-store ads were removed.
- **`StoreProductSection`**: store-name heading is a full-width tap target → vendor page (rating ·
  distance kept, **no chevron circle**), followed by a plain vertical list (`gap: hs(10)`,
  `paddingHorizontal: hs(16)`) of the new `ProductRowCard`s.
- **New `ProductRowCard.tsx`** (feature-local, catalog): white bordered card (`borderColor
  #EFEFEF`, `borderRadius ms(12)`, `padding hs(10)`), 96px square `AppImage` on the left, and a
  body with name / one-line desc / price + strike-through + green % off, plus the add / quantity
  stepper on the right — cart wired via `useCartProductActions`, row tap → `ProductDetail`.
- **Dead code**: `getVendorAds` removed from `services/categoryVendors.ts` (no remaining callers);
  `getAdsForQuery` unchanged and still feeds the single ad.

**Decisions:** rating star stays amber (`#F59E0B`); inactive pills transparent + black text, active
filled brand blue; per-row add-to-cart stepper kept.

**Verification:** `npm run ts:check`, `npm run check:boundaries` (277 modules, no violations) and
`npm run check:drillin` (112 titles, 0 unresolved) pass. On-device visual pass pending (pill rail,
ad swap + scroll reset on title switch, product → detail, heading → vendor, add/stepper → cart).

**Docs:** `docs/architecture/mobile-app.md` (category drill-in), `PAGE_CATALOG.md`.

**Date:** 2026-09-30

---

## Category drill-in — seed catalog so every taxonomy title resolves vendors

**Status:** 🟢 Shipped (data + guard); on-device visual verification pending.

**Root cause:** the category drill-in page renders `No vendors yet` (and hides the ad carousel)
whenever the auto-selected title's `MASTER_CATEGORIES.searchQuery` matches no product via
`services/categoryVendors.ts` `matchesQuery` (per-token AND over name + category + desc +
attributes). The taxonomy had outgrown the fixtures: **80 of 112 titles (71%)** resolved zero
vendors, so most tabs opened empty even though the screen wiring was correct (this was a data
coverage bug, not a component bug — `matchesQuery` is shared with `VendorDetailScreen`, and
Search parity matters, so the matcher was left as-is).

**Fix (data, not code):**
- `data/mart/products.ts` +74 rows and `data/pharma/products.ts` +11 rows (plus `STORE_BY_CATEGORY`
  keys `allergy` → `store-p2`, `personal-care` → `store-p4`) seed every title: each new row keeps
  the exact query tokens (incl. plurals/gender/number words) in one product's searchable text.
- Thin first-of-tab titles gained depth (second product ± store): Bluetooth Headphones, Fresh
  Apples, Fresh Milk, BP Monitor, Multivitamin, Nebulizer.
- No new stores and no component/service changes; existing 13 Mart + 6 Pharma outlets cover all
  titles.

**Guard:** `client/mobile/scripts/check-drillin-coverage.mjs` (`npm run check:drillin`) re-runs
the predicate over the raw fixtures and exits 1 if any title resolves 0 vendors or a product id is
duplicated.

**Verification:** `npm run check:drillin` → `112 titles, 0 unresolved`; `npm run ts:check` +
`npm run check:boundaries` pass. On-device pass still needed (open several tabs, confirm each shows
store heading → product rail → 16:9 ad and the top ad carousel).

**Docs:** `data/DATA_CONTROL.md`, `docs/architecture/data-layer-sdui.md`,
`docs/architecture/mobile-app.md`, `docs/DEVELOPER_ONBOARDING.md`,
`docs/RUNBOOKS/DATA_FIXTURES.md`, `docs/RUNBOOKS/TROUBLESHOOTING.md`.

**Date:** 2026-09-30

---

## Category drill-in — flat rail + store product rails + 16:9 store ads

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** Redesigned the category drill-in page (`CategoryDrillIn`) from
grouped vendor rows into a flat title rail with store-grouped horizontal product
rails and contextual 16:9 store ads.

**Changes:**
- **Titles rail flattened** (`features/catalog/components/CategoryTitleRail.tsx`, renamed from
  `SubgroupTextRail`): fed `subgroups.flatMap(s => s.items)` — every sub-category title in one
  long, ungrouped horizontal scroll; first item auto-selected, accent tint + underline unchanged.
  `CategoryDrillInPanel` state moved from `activeSubgroupId` to `activeItemId`.
- **New store-grouped body** (`features/catalog/components/StoreProductSection.tsx`): per matching
  store, a big store-name heading (tap → `VendorDetails` with the title query), a horizontal
  product rail built directly on shared `ProductCardBase` (`variant="rail"`, `appBrand` MART/PHARMA,
  cart wired via `useCartProductActions`, card tap → `ProductDetail`; keeps the
  `catalog → features/*/cards/` boundary green), then a 16:9 store ad.
- **Contextual store ads** (`services/categoryVendors.ts`): new `getVendorsWithProducts(app, q)`
  (vendor + matching product rows), `getAdsForQuery(app, q)` (top-ranked stores → `VendorAdSlide`s)
  and `getVendorAds(storeId, app)` (single-store ad). Ads derive from the real store rows
  (`coverImage` + `offerTag`/`desc`, `badge: 'SPONSORED'`, `storeId` retained for tap-through) — no
  new `@data` fixtures, so `data/DATA_CONTROL.md` is unchanged.
- **`AdBannerCarousel`** (`components/shared/`): fixed height `vs(156)` → `aspectRatio: 16/9`;
  added optional `showAdLabel` (AD pill, top-right) used by the Home top ad and the drill-in ads.
- **16:9 heroes**: `MartHeroCarousel` (dropped `BANNER_H`) and `PharmaHeroBanner` (`vs(180)` →) now
  `aspectRatio: 16/9`; both stay unlabelled organic heroes.
- **Removed** the now-unused `VendorRowCard.tsx` (no dead code).

**Interpretation notes (per approved plan):** the top ad carousel sits immediately below the titles
rail and is contextual to the selected title; each store's product rail gets its own 16:9 store ad;
the inline searchbar still filters stores by name/locality; the section "deep search" arrow was
removed along with the per-subgroup sections (the app-wide `Search` route is unchanged).

**Verification:** `npm run ts:check` + `npm run check:boundaries` pass (276 modules, no violations).
On-device pass still needed (rail length + auto-select, ad swap on title switch, product → detail,
heading → vendor, add/stepper → cart, 16:9 banners on Home/Mart/Pharma/restaurant hero).

**Docs:** `docs/architecture/mobile-app.md` (AdBannerCarousel + category drill-in + services seam),
`PAGE_CATALOG.md`.

**Date:** 2026-09-30

---

## Vertical-spacing reduction pass — canonical `SPACE` tokens

**Status:** 🟢 Shipped (code); on-device visual verification pending.

**Feature:** Tightened the vertical rhythm across every page by replacing per-screen
spacing magic numbers with a single token scale.

**Changes:**
- **New `src/theme/spacing.ts`** — `SPACE.SECTION` (`vs(14)`), `SPACE.BLOCK` (`vs(8)`),
  `SPACE.ITEM` (`vs(6)`), `SPACE.LIST_BOTTOM` (`vs(24)`). One owner per section boundary:
  a header owns its top gap (`SECTION`), parents no longer double-pad the same boundary,
  and headers no longer own a bottom gap beyond `BLOCK`.
- **Shared components first** (propagates to ~30 screens): `home/sections/common.tsx`
  `SectionHeader`, `home/cards/SDUIRenderer.tsx`, the food/mart/pharma `*SectionHeader`s,
  `food/components/SectionHeader.tsx` (`minHeight vs(40) → vs(32)`, `hitSlop` retained),
  `HomeView` list tail, and `components/SubAppWrapper.tsx` block/section gaps.
- **Per-page pass** across cart/checkout, auth (location/login), onboarding, pharma
  (home/prescription/blood-donor), favourites, profile, search, rewards, food
  (profile/home/offers), ecommerce (deals/vendor/mart-home), catalog, product, and Home
  sections — oversize section gaps downshifted to `SECTION`, list tails to
  `LIST_BOTTOM`, header→content to `BLOCK`, intra-block rows to `ITEM`. Skeletons
  (`MartHomeSkeleton`, `PharmaHomeSkeleton`, `VendorProfileSkeleton`, food
  `LoadingSkeleton`) mirror the tightened real layout so loading → loaded does not jump.
- `features/food/constants/theme.ts` `sectionGap` 28 → 14 (dead code, aligned).
- `-vs(40)`/`paddingTop vs(24)` hero-overlap pair in `RestaurantProfileScreen` → `-vs(24)`
  / `SPACE.SECTION`.

**Deferred — consolidate the 5 section headers (not executed):** `common/SectionHeader`,
`food/SectionHeader`, `food/FoodSectionHeader`, `MartSectionHeader` and
`PharmaSectionHeader` differ only by accent color + See-all label. Collapsing them into
one parameterized component would enforce the rhythm in one place, but touches many
imports (higher regression surface) and the token pass already fixes every page. Do it
as a follow-up.

**Verification:** `npm run ts:check` + `npm run check:boundaries` pass. On-device visual
pass still needed (Home/Food/Mart/Pharma feeds; cart + location multi-step forms;
short-device `SCREEN_H < 700`; skeleton → loaded frames).

**Docs:** `docs/architecture/mobile-app.md` "Vertical rhythm" section.

**Date:** 2026-09-28

---

**Status:** 🟢 Shipped (client-side).

**Feature:** The Home top-ad banner is extracted into a shared carousel and reused as the restaurant
profile's hero; the Food home header drops its address block.

**Changes:**
- **`components/shared/AdBannerCarousel.tsx`** (new, exported from `components/shared/index.ts`):
  the Home top-ad banner extracted byte-for-byte — 156-high rounded card (`AppImage` bg + overlay +
  badge + title/tagline), 4.5s auto-advance, paging dots, momentum resync, timer cleanup, re-anchor
  on `width`, plus a `< 2 slides` timer/dots guard. Presentation-only: `slides: AdSlide[]`,
  optional `onSlidePress`, optional `style` (no built-in margins) — so it is boundary-safe
  (`components/shared` may not import features).
- **`features/home/sections/AdBannerSection.tsx`** is now a thin wrapper over it: passes
  `topAdSlides`, the `targetApp → subAppIdFor → onLaunchSubApp` press mapping and the hub's margins
  (`marginHorizontal hs(16)`, `marginTop vs(4)`, `marginBottom vs(12)`) — pixel-identical to before.
- **`RestaurantProfileScreen.tsx`**: the `RemoteImage` hero + 40% dark overlay are replaced by a solid
  `#F3F4F6` band (`paddingTop: insets.top + 52`, `paddingHorizontal hs(16)`, `paddingBottom vs(52)`)
  holding `<AdBannerCarousel slides={topAdSlides} />` with no press handler (taps are a no-op inside
  Food). The pinned toolbar, `−40` white-board overlap, menu, offers rail and cart pill are unchanged.
- **`DiningHeader.tsx`**: removed the address section (area + "Delivering to Home", `area` /
  `onAreaPress` props, `MapPin`/`ChevronDown`/`ChevronRight`, location styles, second `dietRow`). The
  row is now back chevron · centered `DietToggle` (`flex-1`, `alignItems: 'center'`) · equal-width
  right spacer; the toggle stays uncontrolled and still writes the shared `foodFilterStore`.
  `FoodHomeScreen` needs no change.

**Docs:** `docs/architecture/mobile-app.md` (shared carousel, RestaurantProfile hero, Food home
header), `data/DATA_CONTROL.md` (`topAdSlides` consumer row).

**Date:** 2026-09-27

---

## Food — "Today's Special" home-card parity + Restaurant menu header / category rail fixes

**Status:** 🟢 Shipped (client-side).

**Feature:** Three parity/UX fixes in the Food sub-app.

**Changes:**
- **Food "Today's Special Near You" = Home card.** `SpecialDishCard.tsx` is now a thin adapter over
  `features/food/cards/FoodProductCard` → shared `ProductCardBase`, passing the Home rail's exact
  props (`variant="rail"`, `hs(116)`, `imageAspect: 1`, `roundedImageBottom`, rating/price/badge/
  heart/add hidden). `FeaturedDishCarousel` rail padding aligned to Home
  (`paddingLeft hs(16)` / `paddingRight hs(4)` / `paddingBottom vs(8)`). One row of all diet-filtered
  specials (Home stacks two) — accepted delta, and the food cards lose the old restaurant/price
  lines to match Home strictly.
- **Restaurant menu header.** `RestaurantMenuScreen` toolbar title is now just **"Menu"**; the full
  restaurant name renders below the toolbar, above the search bar (full-width, two-line wrap) instead
  of being truncated in the toolbar.
- **Category rail.** The chip `ScrollView` sets `keyboardShouldPersistTaps="handled"` (the autofocused
  search keyboard previously swallowed the first chip tap); chips are now derived from the menu's
  actual dish cuisines via the new `getMenuCategories` in `utils/menu.ts` (venue `restaurant.cuisines`
  carried labels no dish matched → dead chips), with the selected chip falling back to `Bestsellers`.
  Applied to `RestaurantMenuScreen` and `RestaurantProfileScreen`; the data fixtures are untouched.
  This supersedes the Food half of the earlier "Smaller Today's Special cards" entry.

**Date:** 2026-09-27

---

## Food — dedicated Restaurant Menu page + shared menu row / cart pill, central bottom inset

**Status:** 🟢 Shipped.

**Feature:** The restaurant profile's inline menu search is replaced by a dedicated **RestaurantMenu**
page with its own autofocused full-width search bar and diet toggle. Menu rows and the white View
Cart pill are extracted into shared components, and the bottom safe-area inset is now reserved once
at the app root instead of per screen/navbar.

**Changes:**
- **`features/food/screens/RestaurantMenuScreen.tsx`** (new): full restaurant menu — autofocused
  search bar (dish name/description), `Bestsellers` + cuisine chips, `DietToggle` in the toolbar
  (via `FoodDetailTopBar.right`), shared `MenuItemRow` list and `ViewCartPill`. Adds/steppers write
  to the same restaurant-scoped cart slice as the profile.
- **`features/food/components/MenuItemRow.tsx`** (new): shared dish row (thumb, name/desc/price,
  outlined **Add** → **− qty +** stepper), used by the profile and the menu page.
- **`features/food/components/ViewCartPill.tsx`** (new): shared restaurant-scoped white View Cart
  pill; absolute, right-aligned, no per-screen inset math.
- **`features/food/utils/menu.ts`** (new): `getMenuForRestaurant` / `getOwnDishes` extracted from
  `RestaurantProfileScreen` so both screens share one menu builder.
- **`navigation/types.ts` / `FoodStack.tsx`**: new `RestaurantMenu` route
  (`{ restaurant: DiningRestaurant; dietFilter: DietFilter }`).
- **`RestaurantProfileScreen.tsx`**: dropped the live menu `TextInput`, the `onLayout`
  scroll-and-focus jump and the `MoreVertical` action; the in-menu box is now a **"Search in menu"**
  button and the toolbar Search icon both push `RestaurantMenu` (threading `dietFilter`).
- **`App.tsx`**: new `AppLayout` reserves `useBottomInset()` once for the whole app, so bottom
  navbars/sticky footers/scroll paddings use base heights. Removed the now-redundant per-screen
  inset handling in `MainTabs` (`HubTabBar`), `SubAppWrapper`, `FoodBottomNav`, `RestaurantGrid`,
  `MedicalShopDetailsScreen`, `DonorDashboard`, `DonorDetailsScreen`, `PharmaVendorList`,
  `PrescriptionNoteStep` and `PrescriptionOrderConfirmedView`.

**Date:** 2026-09-27

---

## Food — Restaurant-isolated cart, bigger menu search, − qty + stepper, white View Cart pill

**Status:** 🟢 Shipped.

**Feature:** Adds from a restaurant are scoped to that restaurant on the cart page, the menu search
bar is enlarged to full width, menu rows get a real − qty + stepper, and the restaurant footer is a
plain white "View Cart" pill.

**Changes:**
- **One cart, scoped by ownership** (`state/cartStore.ts`): `CartItem.restaurantId?`; `addToCart`
  gained an optional 5th `restaurantId` arg (adopts an untagged line on re-add via `i.restaurantId ??
  restaurantId`); new `clearRestaurantCart(id)` removes only that restaurant's lines. No second
  store — checkout/payment/orders stay single-sourced.
- **Nav** (`navigation/types.ts`): `Cart` params are now `{ restaurantId?; restaurantName? }`
  (kept `| undefined` — a required-param object breaks React Navigation's composite `navigate`
  typing). All 7 call sites pass a params object explicitly: `{}` for the common cart,
  `{ restaurantId, restaurantName }` from `RestaurantProfileScreen.openCart`.
- **`CartScreen.tsx`**: reads `route.params`, filters to the scoped slice, and its `setCartItems` is
  **scope-aware** (replaces only the scoped slice) so placing an order / clearing can't wipe other
  lines. Wires `onClearItems` (`clearRestaurantCart`) and `onDeleteItem` (`removeFromCart`) only in
  scoped mode.
- **`CartView.tsx`**: new optional `restaurantName` / `onClearItems` / `onDeleteItem` props
  (presentational, no cart imports). Scoped title (`{restaurant} Cart`), red **Clear** in the BAG
  top bar, per-row **trash** delete, and a scoped empty state ("No items from {restaurant} yet").
  Common cart is unchanged (no Clear/trash).
- **`RestaurantProfileScreen.tsx`**: cart selectors now derive from
  `cart.filter(i => i.restaurantId === restaurant.id)` (footer count + `dishQuantity`); menu rows
  render a bordered **− qty +** stepper once added; the menu search header is a full-width **column**
  (title above, larger `ms(14)` input below) and its `onLayout` feeds a new `menuSearchYRef` so the
  toolbar's search-icon jump still lands on the input; the footer is a white **View Cart** pill
  (icon + label + item count + arrow, no ₹ amount / orange card). Dead footer styles + `cartTotal`
  memo removed.
- **`SearchDishCard.tsx`**: optional `restaurantId` prop passed to `addToCart`;
  `RestaurantOffersScreen` passes `restaurant.id` (its adds count toward that restaurant). Food
  search keeps not passing it → search adds stay common-cart only.

**Out of scope:** tagging adds made from `CommonProductDetailView` / `FoodSearchScreen`, and any
Mart/Pharma cart UX change.

**Date:** 2026-09-27

---

## Food — Restaurant details local diet toggle + menu-search jump

**Status:** 🟢 Shipped.

**Feature:** The restaurant profile now carries its own All/Veg/Non-Veg toggle in the pinned
toolbar and the toolbar's Search icon jumps to (and focuses) the in-menu search bar.

**Changes:**
- `DietToggle.tsx` is now **optionally controlled** (`value?` + `onChange?`): no props keeps the
  existing shared-store behavior for the home/Search headers; passing both drives a screen-local
  value. When controlled it does not subscribe to the store (no wasted re-renders).
- `RestaurantProfileScreen.tsx` seeds a screen-local `dietFilter` once from
  `foodFilterStore.getState().dietFilter` and never writes back — the restaurant toggle follows
  home by default (re-seeded on each open) and overriding it leaves home/search untouched. The
  toggle sits between the back button and the search/share/more actions (`alignItems: 'center'`).
- The Menu-search `TextInput` and the main `ScrollView` are now ref'd; `focusMenuSearch` measures
  `mainBoard` + `menuHeaderContainer` via `onLayout` (same pure-JS convention as `RestaurantGrid`)
  and scrolls the search bar under the pinned toolbar, then focuses it. Works from any offset.
- Main `ScrollView` gained `keyboardShouldPersistTaps="handled"` so the toggle/icons stay tappable
  while the keyboard is open.
- Honest empty states: the menu empty text now distinguishes a search miss from a diet filter that
  emptied the list; the "Recommended & Offers" header + rail hide entirely when the active filter
  leaves no dishes (so "View All" can't navigate to an empty page).

**Scope:** `foodFilterStore`, `FoodHomeScreen`, `DiningHeader`, and `FoodSearchScreen` unchanged.

**Date:** 2026-09-27

---

## Bottom navbars hidden behind Android's gesture bar

**Status:** 🟢 Shipped.

**Symptom:** The Main app tabs (`HubTabBar`), the Mart/Pharma wrapper bar, and (less visibly) their
labels sat under Android's gesture pill / 3-button bar because the window is edge-to-edge
(`android:navigationBarColor` is transparent) and those bars used a fixed height with no
`paddingBottom`.

**Cause:** React Navigation's default tab bar reserves `insets.bottom`; our custom `tabBar` render
prop bypassed it. Only `FoodBottomNav` was correct (it already used
`Math.max(insets.bottom, vs(8))` and measured its real height via `onLayout`).

**Changes:**
- New `useBottomInset()` in `src/utils/responsive.ts` (`Math.max(insets.bottom, vs(8))`) — one
  canonical formula alongside `useTopInset`, mirrored from the Food bar.
- `navigation/MainTabs.tsx` — `HubTabBar` grows by the inset (`height: TAB_BAR_H + inset`,
  `paddingBottom: inset`); fixed `height` removed from `tabBarWrap`; `NavbarHomeShortcut` gets the
  total height.
- `components/SubAppWrapper.tsx` — `navBarH = vs(72) + inset` feeds the absolute bar, the viewport
  `paddingBottom`, and the Home shortcut; the two dead `height: vs(72)` / `paddingBottom: vs(72)`
  style entries removed.
- `features/food/components/FoodBottomNav.tsx` — inline formula swapped to `useBottomInset()`
  (identical output; the `onLayout` height measurement is unchanged).
- `features/food/components/RestaurantGrid.tsx` — food-feed clearance now tracks the inset
  (`vs(104) + useBottomInset() - vs(8)`) so the last row stays clear on 3-button / iOS.

**Future / honest gaps:** No navigation/state/native/API change; purely inset wiring.

**On-device checklist** (Settings → System → Navigation mode; build via
`gh workflow run android-debug.yml`):
- Gesture nav (inset ≈24) + 3-button nav (inset ≈48): Main tabs, Mart (4 tabs), Pharma (5 tabs,
  adaptive width) — labels fully above the pill, bar background reaches the screen bottom, items
  centered.
- Mart/Pharma feed last row scrolls clear of the taller bar; Mart vendor drill-in still hides
  chrome (`isChromeHidden`).
- `NavbarHomeShortcut` still overlaps ~¼ of every bar.
- Food unchanged (regression); iOS home indicator (~34) now clears all bars too.

**Date:** 2026-09-27

---

## OTA / differential update delivery

**Status:** 🔴 Backlog — not chosen or implemented.

**Gap:** The app ships as a single Metro bundle with no over-the-air JS update channel. There is
no OTA provider (CodePush or self-hosted) or Play Feature Delivery wiring in `package.json`.
`React.lazy` routes only defer module *evaluation* — they neither reduce download size nor deliver
features on demand (see "Home feed scroll & startup performance").

**Options considered:**
- **CodePush or a self-hosted OTA provider (pragmatic path)** — OTA JS-bundle updates; no store resubmit for
  JS-only changes. Whole-bundle (not per-feature); needs hosted channel/config setup.
- **Play Feature Delivery / dynamic feature modules** — per-feature native delivery, but requires
  splitting the single Android module (significant Gradle work).
- **Flipkart-style per-feature OTA** — custom infrastructure (their plugin system); out of scope.

**Decision:** not adopted yet. If adopted, add the OTA-promote step to `docs/RUNBOOKS/RELEASE.md`
and record the update channel here.

**Date:** 2026-09-21

---

## Pharma local medicals, medical shop details & navbar Home shortcut

**Status:** 🟢 Shipped.

**Feature:** Pharma home now ends with a **Local Medicals Near You** rail. Tapping a medical opens
`MedicalShopDetails`, a pharma-local shop profile with contact/hours/pickup information, live
store-product search, and the existing prescription FAB. The FAB opens `PrescriptionFlow` with the
shop preset, so the vendor picker is skipped and fulfilment opens after the note step. A shared
Faazio-blue Home shortcut now floats above every visible bottom navbar: Favourites/You, Mart/Pharma,
and both Food tabs; it is hidden on main Home and Mart vendor drill-in chrome.

**Changes:**
- Added `LocalMedicalsRail`/`LocalMedicalCard`, the `MedicalShopDetails` root route and lazy screen,
  `presetVendorId` typing/branching in the prescription flow, and conditional Pharma section
  "View all" rendering.
- Added shared `NavbarHomeShortcut`; wired its measured geometry into `MainTabs`, `SubAppWrapper`,
  and the dynamic-height `FoodBottomNav`.
- Reused `pharmaStores`, `getVendorProducts`, `matchesQuery`, `SearchPharmaProductCard`, and
  `PharmaImage`; no new data shapes or duplicate product pools.

**Future / honest gaps:**
- Medical inventory and prescription photos remain fixture/in-session data until the Go Chi gateway
  and upload API are wired.

**Date:** 2026-09-17

---

## Kill the add-mode popup — fulfilment moves to the cart, live-location delivery, vendor pickup addresses

**Status:** 🟢 Shipped.

**Feature:** Adds are instant everywhere (no dining/pickup popup). Fulfilment is chosen on the
cart BAG step as a **Delivery / Self Pickup** toggle (nothing selected by default → Proceed to
Pay stays disabled). Delivery auto-fills the **live GPS address** (no manual ADDRESS step);
Self Pickup needs no address UI. Self-pickup orders record **all vendor pickup addresses** and
show them on the order-success receipt and on Order Details.

**Changes:**
- **Remove the gate** — deleted `FoodAddModeSheet.tsx`. `RestaurantProfileScreen`,
  `RestaurantOffersScreen`, `FoodSearchScreen` (config `foodSearchConfig.tsx`), and
  `CommonProductDetailView` now `addToCart(id, name, price, emoji)` directly. Dropped
  `onDishAdd`/`onAdd` from the search config + `SearchDishCard`.
- **Store/data** — `CartItem.fulfilment`, `CartFulfilment`, and the `addToCart(…, opts)`
  param removed (`cartStore.ts`, `data/types.ts`, `@data/home/seeds.ts`).
- **Cart BAG** (`CartView.tsx`) — single Delivery / Self Pickup toggle; the pickup-point
  radio list, contact row, "Deliver to" row, and the whole **ADDRESS step** are removed.
  Delivery shows the live address (or a "using saved address" fallback). Proceed to Pay is
  disabled until a mode is chosen; both modes go to PAYMENT.
- **Live location** — new `src/hooks/useLiveAddress.ts` (`@react-native-community/geolocation`:
  consent → `getCurrentPosition` → native `FaazioGeocoder` reverse geocode; no PII logged). Delivery
  capture is stored on the order (`PlacedOrder.location`); the Android/iOS location permission text
  was updated (needs a native rebuild).
- **Vendor pickup addresses** — `ordersStore` gained `PlacedOrder.pickups` (one point per
  vendor, derived from `getPickupPointsForItems`). The RECEIPT and **Order Details**
  (`OrderDetailsScreen.tsx`) render one "Pickup From" card per vendor. Order Details now
  resolves via `ordersStore.getOrderById` first, falling back to `@data getMyOrderById` —
  fixing the placed-order "not found" gap.

**Native:** Android `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` + iOS
`NSLocationWhenInUseUsageDescription` cover checkout auto-fill. Requires a CI debug build
(`gh workflow run android-debug.yml`).

**Future / honest gaps:**
- The live location is captured on the order but nothing uploads it yet (future Go backend).

**Date:** 2026-09-16

---

## Pharma prescription flow + unified receipt tracking & My Orders merge

**Feature:** New full-bleed **PrescriptionFlow** (route `PrescriptionFlow`, `features/pharma/prescription/`):
`PrescriptionCameraStep` (full-screen `react-native-vision-camera` `Camera` with a consent dialog before mount,
flash, thumbnail strip with per-photo delete, "n/10" counter, `Confirm(n)` at ≥1, 10-page hard cap)
→ `PrescriptionNoteStep` (optional pharmacist note) → `PharmaVendorList`/`PharmaVendorCard`
(search filters name/categories/desc/offerTag; "Order" pill CTA; pharma-local — cannot import
`features/ecommerce`) → `PharmaFulfilmentSheet` (Delivery/Self-Pickup on the shared `SlideUpSheet`)
→ `PrescriptionOrderConfirmedView` (unified tracking box + prescription-details card + Track My Order/Done).
The flow holds its draft locally and writes to the new **`ordersStore`** (prescription kind); it
bypasses the cart entirely. The `UploadPrescriptionFAB` now navigates to it.

**Receipt rework (`CartView`):** the ETA badge and both step-row variants are replaced by one unified
**Real-Time Tracking Status** box — a pulsing "Order has been placed" row, plus a "Pickup from:
{store}, {address}" line for PICKUP. `handlePlaceOrder` also writes `ordersStore.recordOrder` (items
kind). Items Purchased rows drop the icon: name is ¾-width ellipsized (`maxWidth: '75%'`) with a grey
"x {qty}" and right price. A primary **Track My Order** button (new optional `onTrackOrder` prop,
wired in `CartScreen` → `MyOrders` with `highlightOrderId`) joins the receipt actions.

**My Orders (`MyOrdersScreen`):** merges `ordersStore.orders` (newest first) above `@data myOrders`
(rail counts recompute); prescription placed orders render a distinct 📄 "Prescription order" card
("N pages • {vendor}", Delivery/Self-Pickup chip, Processing pill); the `highlightOrderId` route
param auto-selects that order's sub-app and rings its card.

**Data:** `data/pharma/stores.ts` expanded 1 → 6 pickup-capable outlets (`store-p1…p6`); new
`src/state/ordersStore.ts` (`PlacedOrder` with `kind: 'items' | 'prescription'`).

**Native:** `react-native-vision-camera` installed; Android `CAMERA` permission + iOS `NSCameraUsageDescription`. Requires
a CI debug build (`gh workflow run android-debug.yml`).

**Future / honest gaps:**
- Photos are captured and shown only in-session; nothing uploads them yet (future Go backend).

---

## Data layer — catalog depth, reviews, per-restaurant menus, orders/account, home rails

**Status:** 🟢 Shipped (data + mock).

**Feature:** A data-depth pass across `@data/*` so every store, dish, review and order list
looks populated (no empty outlets/buckets, no empty review sets).

**Changes:**
- **Catalog depth** — `data/mart/products.ts`: +8 products (Vibe Apparel `store-m4` fm-v1..fm-v4,
  ProArena Sports `store-m9` fm-pa1..fm-pa4), so every mart store has ≥2 products.
  `data/food/products.ts`: dishes for previously-empty stores (Paradise Biryani `store-f1`,
  La Paris `store-f5`, Midnight Dhaba `store-f6`). `data/pharma/products.ts`: `storeId` now set
  via a `STORE_BY_CATEGORY` map (vitamin→p4, supplements→p6, fever→p2, antiseptic→p2,
  hypertension→p3, asthma→p1, diarrhea→p5, cough→p5, default p1) so all 6 pharma outlets
  `store-p1…p6` hold real inventory.
- **Per-product reviews** — `data/reviews/reviews.ts` is product-keyed: `PRODUCT_REVIEWS` maps
  real catalog ids (e.g. `fm-m1`, `gr-p1`, `sp-1`, `m-italian-margherita`, `ph-f1`) to 3-4 reviews
  each; `avatarMap` extended to ~20 Indian profiles. `getReviewsByProductId` returns keyed rows
  or falls back to the app's representative set (never empty); representative ids changed to
  FOOD→`sp-1`, MART→`fm-m1`, PHARMA→`ph-f1`.
- **Per-restaurant menus (new `data/food/menus.ts`)** — `restaurantMenus: Record<string,
  SpecialDish[]>` keyed by the 18 dining-restaurant names (~5 dishes each) + `allRestaurantMenuDishes`.
  `RestaurantProfileScreen.getMenuForRestaurant()` reads `restaurantMenus[restaurant.name]` first,
  falling back to the old `TODAYS_SPECIALS` cuisine-match + padding logic. Exports registered in
  `data/index.ts`.
- **Explore & search depth** — `data/explore/stacks.ts`: +2 stacks (`pharma-wellness` PHARMA,
  `monsoon-essentials` MART, 4 items each). `data/categories/searchDatabase.ts`: `cat-pb-3`
  (Snail Repair Eye Cream) added to the ph-beauty bucket. `data/food/bookingDishes.ts`: 10 → 16
  dishes (bd-11..bd-16) across Breakfast/Lunch/Dinner.
- **Orders & account** — `data/account/orders.ts`: `pastOrders` 2 → 12 (all Delivered except one
  Cancelled FOOD); `myOrders` 15 → 20 (id 16-20: Cancelled FOOD `sp-6`, Delivered PHARMA pickup
  `ph-dev5` MediTrust, Processing FOOD `m-mughlai-biryani`, Delivered MART `fm-pa1`, Shipped
  PHARMA pickup `ph-otc3` Wellness Plus). `data/account/orderStatus.ts` `orderStatusCounts`
  corrected to match (All 20 / Processing 3 / Shipped 4 / Delivered 10 / Cancelled 3).
  `data/cart/coupons.ts`: +MONSOON25 (25%, min 899), +HEALTH10 (10%, min 399).
- **Seeds & favourites** — `data/home/seeds.ts` `seedFavorites` 6 → 15 (adds `fm-m1`, `fm-e1`,
  `fm-f1`, `gr-p1`, `sp-1`, `m-italian-pasta`, `m-korean-fc`, `ph-t3`, `cat-pw-1`, all resolvable
  in `catalogIndex`). `favourites/mocks.ts` `FavItem` gained a `productId` linking each of the 8
  tab items to a real `@data` catalog id (e.g. `g1→gr-p1`, `f2→cat-fd-1`, `p2→ph-f1`).
- **De-dup (Phase 7)** — new `data/pharma/recentOrders.ts` exports `PHARMA_RECENT_ORDERS`
  (`PharmaRecentOrder[]`, 4 rows, optional `productId` → `ph-f1`/`ph-t3`/`ph-d1`) + type,
  registered in `data/index.ts`. `PharmaScreen` dropped its inline `RECENT_ORDERS` array + local
  `RecentOrder` interface and now imports `PHARMA_RECENT_ORDERS` (resolves the known gap).
  `data/food/specials.ts` gained the missing `@mock` status banner.
- **Home rails & campaigns** — `data/home/campaigns.ts`: +4 vendor campaigns (thread-labs
  `store-m3`, vibe-apparel `store-m4` in carousel 1; scholars-bookland `store-m6`, wood-steel
  `store-m8` in carousel 2), carousels now rotate 3-4 cards each. `data/home/rails.ts`:
  `recentlyViewedMart` +rvm-5 (Floral Maxi Summer Dress), `recentlyViewedFood` +rvf-4
  (Chicken Dum Biryani).

**Date:** 2026-09-15

---

## Food fulfilment UX — cart toggle, order pickup address, restaurant navigation

**Status:** 🟢 Shipped.

**Feature:** Decide fulfilment on the cart page itself; show the pickup address on order
details; let the food product-detail page open the restaurant profile.

**Changes:**
- **Cart BAG** (`CartView.tsx`): the order-level **Delivery / Self Pickup** toggle lives on the
  BAG step (a "How do you want your order?" card). Nothing is selected by default — Proceed to
  Pay stays disabled until a mode is chosen. Delivery shows the **live location** (GPS +
  reverse geocode via `useLiveAddress`); Self Pickup adds no address UI. There is **no ADDRESS
  step** — the manual saved-address page was removed. Proceed to Pay goes to PAYMENT in both
  modes. `computeTotals` still zeroes the fee for pickup.
- **Order Details** (`OrderDetailsScreen.tsx` + `data/account/orders.ts` + `data/types.ts`):
  new optional `MyOrder.pickup` (`PickupAddress` snapshot) drives a **"Pickup From"** card
  (store name, address, `Open {hours}`, pickup contact). The 6 PICKUP fixtures were populated
  from real store addresses.
- **Food product-detail** (`CommonProductDetailView.tsx`, `ProductDetailScreen.tsx`,
  `features/food/utils/restaurantForProduct.ts`): new `onViewRestaurant` prop makes the FOOD
  restaurant store row tappable + adds a **View Restaurant** button, deep-linking into nested
  `FoodApp → RestaurantProfile`. `getDiningRestaurantForProduct` resolves by `storeId` →
  `foodStores`, then `shop` → dining mocks, then `shop` → `foodStores`, else `undefined`.

**Data:** `@data/types` `PickupAddress` + `MyOrder.pickup`; `data/account/orders.ts`.

**Date:** 2026-09-14

---

## Cart — item selection checkboxes + food fulfilment labels

**Status:** 🟢 Shipped.

**Feature:** The cart BAG step lets the user tick/untick items before paying.

**Changes:**
- **Shared `Checkbox`** (`components/shared/Checkbox.tsx`, exported from
  `components/shared/index.ts`): rounded square, grey border → green `#118C4F` with a
  white check; `indeterminate` renders a white minus (partial group).
- **Selection-driven totals** (`CartView.tsx`): a screen-scoped `deselectedIds` set keeps
  new items ticked by default. To Pay / savings / coins estimate / pickup points / payment
  item count all compute from the selected subset. Category headers (Mart/Food/Pharma) got
  a tri-state **group checkbox** replacing the old icon chip (icons removed from
  `CATEGORY_META`). Placing an order snapshots only selected items on the receipt and
  **keeps unticked items in the cart**. Proceed is disabled when nothing is ticked.
- **Layout:** removed the "Review Items" heading; the 3 category cards are now **full-bleed**
  (edge-to-edge, no gutters/borders; savings card keeps its 16px inset); item thumbnails
  bumped 48 → 64px.

**Data:** `@data/types` `CartFulfilment` + `CartItem.fulfilment`; `@data/home/seeds.ts`.
> **Removed (2026-09-16):** per-item FOOD fulfilment is gone — the mode moved to an order-level
> **Delivery / Self Pickup** toggle on the cart BAG step (nothing chosen by default). The
> `FoodAddModeSheet` add-gate, `CartItem.fulfilment`, the `CartFulfilment` type, the FOOD
> per-row label, and `addToCart(…, { fulfilment })` were deleted across the four add sites.

**Date:** 2026-09-14

---

## Food — dishes-only search + fulfilment sheet gating first-adds

**Status:** 🟢 Shipped.

**Feature:** Simplified Food search to dishes-only and gated every Food first-add
behind a fulfilment chooser.

**Changes:**
- **Dishes-only search** (`foodSearchConfig.tsx`): removed the Restaurants mode,
  `SearchRestaurantCard`, and the Restaurants/Dishes toggle — a single seeded
  "Dishes" toggle with `showToggles: false`. Placeholder is now
  "Search dishes or cuisines…". `SearchRestaurantCard.tsx` deleted.
- **Edge-to-edge dish cards** (`SearchDishCard.tsx`): the card is edge-to-edge by
  default (`marginHorizontal: 0`) and the now-redundant `fullWidth` prop was removed;
  the offers page no longer passes it. Card `onAdd` is now overridable (the screen
  supplies it to gate the add) — qty stepper stays direct.
- **Fulfilment sheet** (`FoodAddModeSheet.tsx`, new, on the shared `SlideUpSheet`):
  step 1 asks Dining / Food order (Dining confirms immediately); "Food order"
  advances to step 2 (Delivery / Self pickup) with a back affordance. The chosen
  mode only gates the add — it is **not persisted** on the cart item (no cart-store
  change). Wired into the dishes-only search results, the restaurant offers page,
  the restaurant profile menu "Add", and the FOOD product-detail footer + related-
  dish grid adds.
- **Product detail** (`CommonProductDetailView.tsx`): removed the "Free Delivery /
  COD / 10-Day Return / Assured" trust block (shared component, applies to
  MART/PHARMA/FOOD). Added a FOOD vendor card (resolved by `product.shop` against
  `@data/food/stores`, name-only header when unmatched) + a "More from {restaurant}"
  2-col grid of the restaurant's other specials; card tap pushes another detail page
  (`onOpenProduct`), and FOOD footer/grid first-adds go through the fulfilment sheet.

**Scope notes / deferred:**
- Food home promo / Top-of-Week add buttons remain **direct** (unchanged) — only
  search, offers, restaurant menu, and product-detail first-adds are gated.
- The chosen fulfilment mode was originally not persisted; **it is now persisted**
  on the cart item (`CartItem.fulfilment`, via `addToCart(…, { fulfilment })`) and
  shown as a per-row label in the cart for FOOD rows (see the Cart item-selection
  entry below).
> **Removed (2026-09-16):** the `FoodAddModeSheet` fulfilment gate is deleted. Every Food
> add (search, offers, restaurant menu, product-detail) now adds **directly**; the
> order-level Delivery / Self Pickup toggle moved to the cart BAG step.

**Date:** 2026-09-14

---

## Food — RestaurantProfile UX pass + offers page wiring

**Status:** 🟢 Shipped.

**Feature:** Polished the restaurant profile screen UX and wired the previously
unreachable "View All" offers page.

**Changes (`RestaurantProfileScreen.tsx`):**
- Fixed a crash bug — `getOffers(menu)` → `getAllOffers(menu)` (was a runtime
  `ReferenceError` that crashed the profile screen on open).
- Pinned the back/search/share/more toolbar to the top as an absolute overlay
  (safe-area-inset driven) so it no longer scrolls away with the hero image.
- Offers rail: removed the 'SPECIAL' image label, made the dish image square
  (3:3), allowed titles to wrap to 3 lines, and removed the per-card '+' button.
- "View All" now navigates to the (pre-existing) `RestaurantOffersScreen`.
- Removed the veg/non-veg square markers from menu list cards (diet filtering on
  dish data is unaffected).
- Extra breathing room above the "Menu" header.

**Date:** 2026-09-14

---

## Food — RestaurantOffers page: restaurant-only filtering + search + edge-to-edge

**Status:** 🟢 Shipped.

**Feature:** Polished the "View All" offers page so it shows only the current
restaurant's own dishes, added an in-page search bar, and made result rows
render edge-to-edge.

**Changes:**
- `RestaurantProfileScreen.tsx`: the "Recommended & Offers" rail and the
  "View All" navigation both use only the current restaurant's own dishes
  (`menu.filter(d => d.restaurant === restaurant.name)`); other restaurants'
  dishes are no longer shown. The old "every 3rd item" offers derivation
  (`getAllOffers`) was removed.
- `RestaurantOffersScreen.tsx`: added a search box (filters by dish name /
  description), an empty state for restaurants with no own offers, and a
  "no matches" state when the search finds nothing.
- `SearchDishCard.tsx`: made the card **edge-to-edge by default** (no horizontal
  margin) and deleted the now-redundant `fullWidth` prop — food search results and the
  offers page share one behavior (see the later "Food fulfilment sheet + dishes-only
  search" entry, which removed the prop).

**Note:** restaurants with no dishes under their exact catalog name (e.g.
"Cafe Corretto") show no rail cards (the section header stays) and an empty
"No current offers" state on the offers page.

**Date:** 2026-09-14

---

## Food — dining-first home; Dining/FoodOrder tabs retired

**Status:** 🟢 Shipped.

**Feature:** Consolidated the Food sub-app into a **dining-first home** on a single scroll
surface. `FoodHomeScreen` now renders the former Dining content (DiningHeader with `DietToggle`,
"Top Rated Restaurants" carousel, "Today's Special Near You" carousel) plus the two rescued
Order rails ("What's on your mind?" `MindGridRail`, "Snacks & Beverages" `SnacksRail`) all as
the `RestaurantGrid` list header, with the "Restaurants For Dining" grid as the body. The
 Food stack is now `FoodHome → Search → RestaurantProfile`, and the bottom nav is **2 tabs
 (Home / Search)** + You/Cart.
**Removed (files deleted):**
- Screens: `DiningScreen.tsx`, `DiningDetailScreen.tsx`, `OrderDetailScreen.tsx`.
- Components: `FoodHeader`, `HeroCardPair`, `CategoryRail`, `PopularSpotRail`, `TopFoodRail`,
  and the `order/` folder (`OrderHeader`, `PromoCarousel`, `PopularDishRail`, `PopularDishCard`,
  `CuisineRail`, `MealsComboRail`).
- Dead code (pre-existing, unreferenced): `Header.tsx`, `PromoBannerPair.tsx`,
  `features/food/FoodMenuView.tsx`.
- Mock data: `mocks/orderFeed.ts` (snacks moved to `mocks/homeFeed.ts`).
- Assets: `src/assets/food/*.avif` hero banners + the `DINING_BANNER`/`ORDER_FOOD_BANNER`/
  `FALLBACK_MODE_BANNER_*` constants.

**Behavior changes:**
- Search result taps (`FoodSearchScreen`) now open `RestaurantProfile` (restaurants) or
  `ProductDetail` via `dishToProduct` (dishes) instead of the old `OrderDetail` feed.
- `DiningFeed` slimmed to `{ topRated, specials, dining, topFoods }`; `restaurantToProduct` /
  `nearbyToRestaurant` mappers removed.
- `NearbyRestaurantRow` + `NearbyRestaurant` retained (still used by the Home hub's
  "Most Rated Dining" rail).

**Date:** 2026-09-14

---

## Home "Deals of the day" brand campaigns + Deals landing page

**Status:** 🟢 Shipped (client-side, mock data).

**Feature:** Two display-only renames on the main-app Home hub, the old "Hot Brand Deals"
grid → a two-carousel **brand-campaign section**, and a new shared **Deals landing page**:
- **Renamed `DealsOfDaySection` title** "Deals of the Day" → **"Daily Essentials"** (display-only;
  section id `dealsOfDay` and the Mart sub-app's own `DealsOfDayRail` are untouched).
- **Renamed `HotBrandDealsSection` → `BrandCampaignsSection`** (section id `hotBrandDeals` kept):
  keeps the `#EDE9FE` container but renders **two stacked, auto-playing paging carousels** of white
  `BrandCampaignCard`s (bold **vendor-name title** + "View all →", a computed **"Up to X% off"**
  discount label below — derived from the products' max discount, no `offerTag`/EMI text — and a
  2-product row of bigger minimal `AdProductCard`s laid out flexibly: a large **square** image with
  an `AdLabelBadge` 'AD' pill bottom-right, a bigger 2-line title, slashed grey MRP + bold black
  price; no plus/badge/rating). Carousels auto-play every ~4.5s (pattern lifted from `AdBannerSection`) with
  paging dots and clean up timers on unmount. Campaign fixtures in `@data/home/campaigns.ts`
  (`adCampaigns` split into `carouselOneCampaigns`/`carouselTwoCampaigns`), each referencing a
  **real Mart vendor by `storeId`** (via `getCampaignStore`) plus products **by id only**, resolved
  via `getProductById`.
- **New `DealsLanding` route + `features/ecommerce/DealsLandingScreen.tsx`** — one page, two
  modes: `campaign` (full brand hero + 2-col product grid, from the Home carousel "View all") and
  `discounts` (vendor's discounted products, from the Mart vendor profile "View All"). Full cart
  wiring + empty/unknown-id fallbacks.
- **Vendor profile "View All" now navigates** — `VendorProfileView` gained an optional
  `onViewAllDiscounts` (hidden when absent/empty); `FaMartScreen` passes it via `SubAppWrapper`.
- **De-duplicated the discount predicate** — `isDiscounted(product)` lives in the
  `services/categoryVendors.ts` repository seam; `FaMartScreen` and the landing page share it
  (the `getDiscountedProducts` list helper was folded in during W31 — both now overlay the full
  vendor pool with server festival discounts and filter afterwards).

**Data:** `data/home/campaigns.ts` (new, vendor/`storeId`-based), `data/types.ts` (`AdCampaign`),
`data/index.ts` exports (`getCampaignStore` added); `data/home/sdui.ts` + `docs/architecture/db-schema.md`
sample titles updated to match.

**Fix note (2026-09-15):** The SmartHome Emporium card (`camp-smarthome`, `store-m7`) rendered only **1**
product instead of 2 because 5 `martProducts` rows had `storeId` accidentally nested inside `attributes`
instead of at the top level — `fm-e1`/`fm-e2`/`fm-e3` (`store-m2`) and `fm-ha1`/`fm-ha2` (`store-m7`).
`getCampaignProducts` filters by **top-level** `storeId`, so those rows resolved but were dropped, leaving
only `fm-ha3`. Moved the 5 `storeId`s to the top level in `data/mart/products.ts` and made
`MartProduct.storeId` **required** in `data/types.ts` so any future malformed row fails `ts:check`. Also
added a dev-only authoring guard in `data/home/campaigns.ts` that `console.warn`s any campaign resolving
<2 products. No component changes — the cards behaved as designed.

**Date:** 2026-09-14

## Categories cleanup + Mart vendors pill filter

**Status:** 🟢 Shipped (client-side, mock data).

**Feature:** Retired the classic categories surfaces and added a vendor category pill filter:
- **Removed the main-app "Categories" bottom tab** (`navigation/MainTabs.tsx`, `MainTabParamList`,
  deleted `features/catalog/CategoriesTabScreen.tsx`). Bottom tabs are now Home · Favourites · You.
- **Removed the Mart navbar "Categories" element** (`SubAppWrapper` FA_MART preset) — Mart navbar is
  now Home · Search · You · Cart.
- **Removed Pharma's "Shop by Category" rail + dead code** (`PharmaScreen`: dropped
  `CategoryCardRail` block, `handleCategoryPress`/`handleViewCategories`, the unreachable
  `ALL_CATEGORIES` view, `onCategoryViewChange`; deleted `shared/CategoryCardRail.tsx` and
  `services/categoryRail.ts`).
- **Retired Master Categories entirely**: `HeaderCategoryRail` no longer renders "View All"
  (removed `onViewAll`), deleted `features/catalog/MasterCategoriesScreen.tsx` and
  `shared/CategoriesDualPanel.tsx`, removed the `MasterCategories` route/params and the
  `HomeTabScreen`/`SubAppWrapper` view-all handlers. The rail + `CategoryDrillIn` are the only
  remaining categories surfaces; the taxonomy still backs them via `masterCategories.ts`.
- **New vendor pill filter** ("Local Vendors Near You"): `VendorCategoryPills` (same feed as the
  Mart header rail via `usePagedRail` + a leading "All" pill) filters the vendor list in place,
  AND-combined with the free-text search. `data/categories/railFeed.ts` gained a `vendorTags`
  array per rail item (`TAB_VENDOR_TAGS` mapping rail tab ids to `StoreProfile.categories` tags).

**Data:** `data/categories/railFeed.ts` — `CategoryRailItem` now carries `vendorTags`.

**Date:** 2026-09-13

## Wire GatewayClient → production tables (per mvp-backend.md / db-schema.md)

**Status:** 🟢 Shipped (client wiring + MVP monolith). Screens still read `@data/*` and migrate
incrementally.

**Feature:** `src/services/api/GatewayClient.ts` is wired to the MVP **Go Chi modular monolith**
(`server/gateway`, `docs/architecture/mvp-backend.md` + `docs/architecture/monolith-breakdown.md`)
over Supabase (Postgres) + MongoDB + Aiven Valkey. Set `GATEWAY_URL` +
`USE_GATEWAY=true` (in `.env.local`, then `npm run configure`) to go remote; otherwise it reads `@data/*` and every remote call
**falls back to fixtures on error**, so screen migration can't regress. Cache keys/TTLs follow
`docs/architecture/caching-cloudflare-valkey.md` (unchanged). Caveat: local dev is auth-open
(`AUTH_DISABLED=true`); phone-OTP → gateway JWT still to be exercised end-to-end on device.

**Wiring order** (`docs/architecture/data-layer-sdui.md`): `searchProducts` → `getProduct` →
`getHomeFeed` → `getReviews` → `getOrders`/`getProfile` — all implemented.

**MVP endpoint checklist** (`mvp-backend.md` §3) — all shipped server-side:
- [x] `GET /health`
- [x] `GET /search?q=&app=` → `searchProducts`
- [x] `GET /product/:id` (+ `/product/:id/reviews`) → `getProduct`
- [x] `GET /sdui/home` → `getHomeFeed`
- [x] `GET /vendors/:id/reviews` (+ `/summary`, `PUT /rating`) → `getReviews` / `rateVendor`
- [x] `GET /stores`, `/store/:id` → `getStores` / `getStore`
- [x] `GET /orders`, `/profile` (+ `/membership`, `/order-status`, `/account-nav`, `/profile/details`)
- [x] writes: `/cart…`, `POST /orders`, `POST /events`

**Sweetspot pass (server-side, wire-compatible):** migrations `0004`–`0006` (lean indexes +
JSONB guards + vendor rating counter, non-money type byte diet, checkout idempotency); slim
product/store list projections, one-batch SDUI join, `auth_uid → user_id` cache, bounded product
reviews, `/sdui/home` ETag. Cache keys/TTLs and `GatewayClient` signatures are unchanged, so no
client change is required. Authority: `docs/architecture/{db-schema,caching-cloudflare-valkey,monolith-breakdown}.md`.

**Date:** 2026-10-13 (updated: MVP monolith built + sweetspot pass)

---

## `@mock` → `@server` per-module migration (W22)

**Status:** 🟡 In progress. Mart feed, catalog vendor detail, favourites, product search, the Home
SDUI section registry, the cart/checkout path, the Pharma Rx capture/upload/create path, the orders
history, vendor-review reads and the `search` analytics event are migrated to the gateway; the
remaining modules still read `@data/*` directly.

**Feature:** Flipping `USE_GATEWAY=true` only helps modules that call `GatewayClient`.
This item routes each module through it, one at a time, keeping the built-in fixture fallback.

- [x] **mart feed** — `features/ecommerce/services/martService.ts` hydrates `localVendors` from
      `gateway.getStores('MART')` (`directory.stores`); curated banners/deals stay local until SDUI.
- [x] **catalog/directory vendor detail** — `features/catalog/VendorDetailScreen.tsx` renders the local
      `getStoreById` fixture immediately, then upgrades to `gateway.getStore(id)` (no loading flash,
      no regression offline).
- [x] **favourites** — `features/favourites/FavouritesPageView.tsx` resolves the shelf locally first,
      then upgrades to `gateway.getProductsByIds(favorites)`; a toggle removes the card immediately.
- [x] **search** — `SearchScreen` gains an optional `SearchModeConfig.fetch`: when remote, the
      committed query loads from `gateway.searchProducts` and the server pool replaces `mode.data`
      (local predicate/facets still refine; the substring predicate is skipped for server FTS hits).
      Wired in the mart/pharma/home product configs; food search stays local (dining venues aren't in
      `directory.stores`), and Food's `getMenu` is already remote.
- [x] **home/SDUI** — new `features/home/hooks/useHomeFeed.ts` loads the server SDUI doc
      (`gateway.getHomeFeed`) and `HomeView` renders its ordered sections, threading the doc's joined
      rail products into the Recently-Viewed sections; the static `@data/home/sections` registry is the
      offline/first-paint fallback. Bespoke hero sections (ad/brand/dining/filter-feed) keep their local
      fixtures until the SDUI doc is extended to carry their content.
- [ ] **dining** — blocked: the `tr-*`/`dn-*` dining venues are identity-only in `data/food/diningVenues.ts`
      and are **not** in `directory.stores`, so `diningService` cannot be server-backed until the
      dining-venue profile data is seeded. `gateway.getMenu(venueId)` (dish lists) is already remote-ready.
- [x] **cart durability** — `state/cartStore.ts` mirrors every mutation to `inventory.carts`
      best-effort and `hydrate()`s the durable cart at startup (remote mode; empty server cart is a
      no-op). Local state stays the optimistic model.
- [x] **checkout/orders** — `CartView.handlePlaceOrder` calls `gateway.placeOrder(...)` and keys the
      local order by the **server-returned id** (server prices + decrements stock + holds the
      idempotency lock); purchased lines are dropped from the durable server cart. `paymentMethod` is
      not sent (payment deferred).
- [x] **pharma Rx** — `PrescriptionFlowScreen.handleConfirm` uploads photos to the private bucket via
      signed URLs (`gateway.uploadPrescriptionImage` → object key), then creates the Rx with
      `gateway.createPrescription` (real `imagePaths` + `addressId`), keyed by the server id.
- [x] **pharma Rx quote view** — Order Details (`features/profile/OrderDetailsScreen.tsx`) polls the
      durable Rx (`usePrescriptionDetail`, remote mode only) and renders the seller quote line items +
      total, the customer-facing status label (Awaiting quote / Quote ready / Ready / Fulfilled) and
      the recent status history; polling stops on a terminal status.
- [x] **orders history** — `state/ordersStore.ts` hydrates a separate `serverOrders` slice from
      `gateway.getOrders()` at startup (remote mode); `MyOrdersScreen` renders that durable history
      (server status wins — `NEW`/`PACKED`→`Processing`, `RETURNED`→`Cancelled`) instead of the `@data`
      fixtures and dedupes in-session placements by order id. `OrderDetails` resolves hydrated rows via
      `getOrderById`, and the rating gate counts durable orders too. Mapping lives in
      `services/orderHistory.ts`.
- [x] **vendor reviews read** — `useVendorReviews` upgrades to `gateway.getVendorReviews` +
      `getVendorReviewSummary` (the server `reviews.vendor_summary` aggregate) in remote mode; the
      local derivation is the fallback and the user's own rating stays first.
- [x] **search analytics** — `SearchScreen` fires `gateway.trackEvent(topResultId, 'search')` once the
      server result pool lands; the allowlisted `search` event is anchored to the top result id.
- [ ] **profile reads** — `GET /profile` hydrates the header safely, but `/profile/details` returns the
      nested `{userId, accountId, data}` blob (not the flat `DetailsTable`), and seeded
      `checkout.addresses` include non-tag labels — wire these when the projection is aligned.
- [ ] **rewards, blood, bookings** — stores already call `GatewayClient`; verify on-device with
      `AUTH_DISABLED=true` before flipping the flag for release.

**Date:** 2026-10-14 (updated: orders history + vendor reviews + search analytics)

---

## Faster release builds + lighter APK (CI caching, ABI trim, R8 minify)

**Status:** 🟢 Shipped (workflow + docs). Numbers not yet measured on a fresh run.

**Feature:** Speed/size hardening of the release pipeline in `.github/workflows/release-apk.yml`:
- **Gradle cache:** `gradle/actions/setup-gradle` caches `~/.gradle` (Maven deps, wrapper dists,
  transform outputs) **and** the Gradle build cache across runs — no more ~1–2 GB re-download +
  re-transform on every cold run.
- **CI-only Gradle tuning:** a "Tune Gradle for CI runner" step writes `~/.gradle/gradle.properties`
  (`-Xmx6144m`, `workers.max=4`, `parallel=true`, `caching=true`). `GRADLE_USER_HOME` takes
  precedence over the generated `android/gradle.properties`, so it lifts the laptop memory caps only
  on the runner; the repo's `gradle.properties` stays laptop-capped by design (systemd-oomd).
- **2-ABI build:** `REACT_NATIVE_ARCHS=arm64-v8a,armeabi-v7a` passed as
  `-PreactNativeArchitectures` — halves native (C++) work + `.so` payload vs the old 4-ABI build.
- **R8 minify + resource shrink ON:** `-Pandroid.enableMinifyInReleaseBuilds=true` +
  `-Pandroid.enableShrinkResourcesInReleaseBuilds=true`. Smaller dex + obfuscation (security win).
  `mapping.txt` uploaded as a **private** artifact (`faazio-mapping-<run_id>`) for retracing.
- **Workflow hygiene:** `concurrency: group: release-apk` (no parallel builds), versioned APK
  artifact name (`faazio-<version>-apk`).

**Font note:** audited `fontWeight` usage — `'800'` (110×) and `'900'` (159×) are both heavily used,
so **no Roboto weight trimming** is possible; `fonts.ts` already loads exactly the used weights.
Fresco GIF/WebP decoders remain enabled because the shared `AppImage` wrapper (RN `Image`) is the
renderer and the safe-disable audit wasn't completed.

**Future / honest gaps:**
- **Measure before/after on a real run** (`gh workflow run release-apk.yml`): record step timings,
  APK size, and APK Analyzer dex/native-lib breakdown; paste here. Expected: CI ~43 min → ~18–26 min,
  GitHub APK download ~−50%.
- **Smoke test the minified APK on a device** (Home → Cart → Checkout → Pharma) before trusting an
  R8 release — keep-rule gaps only show at runtime.
- **AAB / Google Play** still not wired into the workflow (input-gated plan only); Play App Signing
  enrollment is a one-time manual step before adopting it.
- **`proguard-android-optimize.txt`** (more aggressive shrinking) not adopted yet — staying on the
  default `proguard-android.txt` first until the device smoke test passes.
- Consider disabling unused Fresco decoders once every image path is confirmed to use
  `AppImage` (~0.1–0.3 MB).
- Larger/self-hosted runner or ccache for C++ remain optional if caching + tuning aren't enough.

**Date:** 2026-09-12

---

## Search type-ahead suggestions (Flipkart-style)

**Status:** 🟢 Shipped (client-side, local fixture data).

**Feature:** While the user types but hasn't committed, the shared `SearchScreen` now swaps
everything below the header for a suggestion list built by `features/search/suggestions.ts`
(`buildProductSuggestions` — name prefix > name substring > category match, dedupe, cap 8)
and rendered by `features/search/SearchSuggestions.tsx` (thumbnail · name · blue "In
\<category\>" subtitle · ArrowUpLeft, plus a "Search for '\<query\>'" fallback row). Tapping a
row commits the term, records it in recents and blurs. Wired via the optional
`buildSuggestions` on `SearchScreenConfig` for Mart / Pharma / Home-Hub. The header pill gets
a focused accent-tint border.

**Deferred:** no debounce (local fixture data). Once the Go Chi backend ships a `/suggest`
endpoint, swap the client-side engine for a debounced server suggest call (and add Food
suggestions — its item shape differs from `Product`).

**Date:** 2026-09-12

---

## Cart "To Pay" banner + Payment promo cleanup & Mart Product Detail store section

**Status:** 🟢 Shipped.

**Feature:** Three targeted UI changes:
- **Cart (`CartView`) — removed the "View Detailed Bill" link and its Bill Details
  sheet.** The To Pay banner is now a static `View` (amounts kept); the `showBillSheet` state,
  the whole `SlideUpSheet`, and the sheet-only styles (`billBannerRight`, `viewBillText`,
  `billLine`, `billTotalLine`, `pricingLabel`, `pricingValue`, `grandTotalLabel`,
  `grandTotalValue`) were deleted. `deliveryFee` stays (still used by the free-delivery coupon).
- **Payment (`PaymentOptionsScreen`) — removed the "Introducing Swiggy Money" promo.**
  `PromoBanner.tsx` deleted (single consumer), the `<PromoBanner />` render dropped, and the
  `PROMO` const removed from `payment/paymentData.ts`.
- **Mart Product Detail (`CommonProductDetailView`) — added a store section** below "Product
  Details" for MART products with a resolvable `storeId`: a store card (cover + rating chip,
  name + verified badge, location line, open/closes row), a "More from {store.name}"
  2-column related-products grid (same-store `martProducts` via the shared `ProductCardBase`
  — boundary-safe; only Add/steppers interactive), and a "View Vendor" button that pushes
  `SubApp` with `initialVendorStoreId` so `SubAppWrapper` opens the vendor drill-in directly.

**Date:** 2026-09-12

---

## Grocery → Mart merge + Home header category rail

**Status:** 🟢 Shipped (data + UI). Home header is a fixed-height **transform-only collapsing
overlay** (no per-frame height animation) with an inset-aware collapse cap (search bar rests below
the status bar, rail pinned) — see the on-device checklist below.

**Feature:** The standalone Grocery sub-app was removed and merged into Mart.
- **Data:** `data/grocery/` deleted; grocery products (`gr-p*`) + outlet `store-g1` merged into
  `mart/products.ts` / `mart/stores.ts` as `app: 'MART'`; `storeId` normalized to top-level on
  the phone products; grocery categories merged under the Mart tree; `recentlyViewedGrocery`
  folded into `recentlyViewedMart`; `GROCERY` dropped from `AppBrand` / `CartCategory` /
  `SubAppId` / `CategoryAppId` / `CategoryRailId`.
- **UI:** `GroceryScreen`, `grocery-home/`, `GroceryProductCard`, `SearchGroceryProductCard`,
  `CatalogGroceryProductCard`, `useGroceryFeed`, `groceryService`, `groceryHomeFeed`,
  `GroceryHomeSkeleton`, `grocerySearchConfig` and the grocery search/favourites toggles removed.
  Grocery items now surface under Mart in Home / Mart / search / cart / favourites / orders.
- **Header rail:** the Home hub header now pins a `HeaderCategoryRail` below the search bar
  (`components/shared/HeaderCategoryRail.tsx` — moved out of `features/home` to be reusable +
  `hooks/usePagedRail.ts` over
  `@data/categories/railFeed`). Tapping a chip deep-links the Master Categories sidebar; the rail
  stays **visible and interactive on collapse** (mirroring the search bar — no fade, no ghost-touch
  guard) since `collapsedVisibleHeaderH` already reserves its space below the search bar. Only the
  logo/sectors block above fades. The rail is a plain horizontal
  `ScrollView` (not a FlashList) since this region animates every frame, chips keyed by
  `item.id` in the map (`HEADER_RAIL_H`). The **Mart sub-app header** (`SubAppWrapper` →
  `SubAppHeader` `belowSearchSlot`) now pins the same shared rail below its searchbar, replacing the
  old in-feed "Shop by Category" `CategoryCardRail` (which remains in Pharma only).
- **Sub-app header searchbar:** the `SubAppHeader` address pill ("Anna Nagar, Chennai / Delivering
  to Home") was removed — Mart & Pharma now always render the live white searchbar (filtering the
  in-place feed via `searchQuery`, which is now actually wired). Food's `FoodHeader` location row was
  replaced by a fake searchbar pill that navigates to its `Search` screen (same as the main home bar).
- **Vendor rail search:** the Mart feed's "Local Vendors Near You" rail now renders `martStores`
  (`StoreProfile[]` from `@data/mart/stores`) instead of the retired `MART_LOCAL_VENDORS` mock,
  with a **live in-place search bar** (dining `RestaurantGrid` pattern) filtering by
  name/categories/desc/offerTag + an empty state. Tapping a store opens the vendor drill-in whose
  inventory derives from `martProducts` by `storeId` (replacing the hardcoded `lv-*` product map);
  `MartLocalVendor`/`MART_LOCAL_VENDORS` were removed.

**Future / honest gaps:**
- **On-device checklist (was: "pinned-rail collapse math not device-verified"):** the Home header
  now collapses by **transform only** — `headerOuter` is a fixed-height `position:absolute` overlay
  (`height = expandedHeaderH(top)`, never animated) whose inner stack slides up via `translateY`
  (`headerSlideStyle`); the list is full-screen with `contentContainerStyle.paddingTop =
  expandedHeaderH(top)`, and `collapseCap = expandedHeaderH - collapsedVisibleHeaderH` slides the
  search bar to exactly `insets.top`. The header is an **opaque overlay** with UI-thread fades:
  top block (logo/location + sectors) fades out by half-collapse, rail fades out by 0.85·cap, and
  the faded rail zone stops catching taps. Verify on device: (1) at rest the first section is
  flush below the header with no ghost overlap/gap and no gradient bleed-through under the header
  (opaque — content must not ghost through); (2) on scroll down the header collapses, the top
  block and rail **fade out** smoothly, the search bar stops just below the status bar with no
  clipped sectors sliver poking under it, and the gradient blend completes just below the
  search bar so the collapsed header reads as search bar + slate padding (no blue slab below
  it; (3) on scroll up it re-expands with the fades reversing
  (no jump, no octagon/shadow artifacts on the search bar); (4) top spacing is consistent on
  Mart/Food/Pharma/Favourites/Categories/You; (5) on iOS the notch/Dynamic Island spacing is
  correct (was broken — inset is now `useSafeAreaInsets().top` everywhere).
- `usePagedRail` pages the static `@data/categories/railFeed`; the Go backend owns the real
  paged endpoint once wired.
- Cart category inference still keys on id prefixes (`gr-*` / `cat-gr*` / `cat-fb*`) which now
  map to Mart — harmless, but a data-driven category source would be cleaner.

**Date:** 2026-09-10

---

## Home feed scroll & startup performance

**Status:** 🟢 Implemented (code), pending **release-build** verification.

**Feature:** Removes the scroll-time JS re-render storm and trims first-load work on the Home hub.
- **No scroll→state mirroring:** `HomeView` deletes the `scrollYState`/`setScrollYState` emit
  (was ~every 40px → full list reconcile → Discover grid re-render). `scrollY`/`viewportH` are
  now Reanimated `SharedValue`s and `renderItem` has a stable identity, so mounted cards never
  re-render because of scrolling.
- **Edge-triggered batch load + prefetch:** `FilterFeedSection` loads the next 8-item batch via a
  UI-thread `useDerivedValue` + `runOnJS` at the **60%** visible threshold (was 80%) and
  prefetches the next batch's image URLs via `Image.prefetch(...)` (through `AppImage`) so
  cards decode ahead of the fold, never mid-fling. A `lastLoadH` SharedValue guards against
  re-firing until the grid grows. Card handlers (`onPress`/`onAdd`) are stable `useCallback`s;
  `UniversalFeedCard`/`ProductCardBase` + the 3 brand skins accept `(product) => void` handlers
  (widened, backward-compatible with existing zero-arg call sites).
- **Recycling list engine:** the Home feed's outer list currently runs on **`Animated.FlatList`**
  (reanimated-wrapped `FlatList`) with the flat-list tuning already applied
  (`initialNumToRender=2`, `maxToRenderPerBatch=6`, `windowSize=5`,
  `updateCellsBatchingPeriod=50`, `scrollEventThrottle=16`) and no `removeClippedSubviews`
  (redundant with virtualization, a Fabric blank/flicker source). Migrating to
  **`@shopify/flash-list@2.0.2`** (recycling + `maintainVisibleContentPosition` scroll anchoring
  on by default) remains a **follow-up** — see the honest-gap note below.
- **1:1 header collapse (transform-only):** `DAMPING 0.5 → 1.0` in `HomeView` — the collapsing
  header now moves with the finger like native toolbars (kills the "content outruns my finger"
  surge). The header collapse was rebuilt to **transform-only**: `headerOuter` is a fixed-height
  `position:absolute` overlay (`height = expandedHeaderH(top)`, never animated) whose inner stack
  slides via `translateY`, with the list full-screen and padded by `expandedHeaderH(top)` — so
  scrolling never triggers a per-frame layout pass (kills the lag + "violent up/down jumping").
  The top-of-list **overscroll teleport** (`if (y <= 0) clamp = 0`) was removed so the header
  re-opens interpolated, not slammed open.
- **Images:** shared `ProductCardBase` + `AdBannerSection` render network images through
  `AppImage` (`resizeMode="cover"`, native HTTP cache, neutral loading bg) instead of a raw
  per-component `Image` — matches the existing `HeaderCategoryRail` convention.
- **Repository seam:** `src/services/homeFeed.ts` exposes `getHomeSections()` /
  `getFilterFeedPage(chip, page)` / `getFilterChips()` as promise-based, paginated reads from
  `@data/*` — the contract the future Go Chi gateway will fulfil (one-file backend swap). Not
  wired into the hot synchronous path yet: in-memory fixtures resolve in microseconds and an
  async first frame would add skeletons without rendering benefit.
- **Startup deferral:** non-initial routes are `React.lazy` (eager kept: `Onboarding`, `Login`,
  `MainTabs`/`Home`; lazy: Categories/Favourites/You tabs + all pushed screens). Fonts trimmed to
  the used Roboto weights `400`–`900` and gated to Android (iOS uses `System`, `useAppFonts`).

**Future / honest gaps:**
- **Release-build verification is REQUIRED** — dev mode exaggerates jank and TTI. Measure before
  vs after on a CI **release** build (`gh workflow run "Release APK"`): (1) fling the home feed through the
  collapse zone + to bottom — no Discover-grid hitch, no mid-fling stalls, header collapse 1:1
  with the finger; (2) cold start → interactive Home; first section paints without a long blank;
  (3) re-verify the layout fixes (search bar below status bar, no content under header);
  (4) **FlashList v2 behavioral edge cases** (horizontal+RTL/headers aren't used here; verify the
  heterogeneous section feed renders and scrolls correctly, incl. scroll anchoring on loadMore) —
  fallback is the current `Animated.FlatList` + the transform-only header (which already removes
  the per-frame layout churn).
- **Scroll lag / violent jumping fix (was: on-device):** the header-collapse overhaul (fixed-height
  overlay + transform-only collapse, no overscroll teleport) and the
  `preventShadowTreeCommitExhaustion` native flag (enabled in `MainApplication.kt` via
  `ReactNativeFeatureFlags.override`, RN 0.86 defaults it to `false`) target the two remaining
  jitter sources. Reanimated flags the commit-pause flag as the documented fix for
  `useAnimatedScrollHandler` headers on the New Architecture. Verify on device (debug + release):
  fast repeated up/down flings show no oscillation; top overscroll re-opens the header smoothly
  (no teleport); the collapsed state is the search bar under the status bar with the rail pinned;
  taps near the header edge still register (overlay hit-testing changed); no ghost gap under the
  header at rest. The native flag requires a rebuild to take effect; one-line revert in
  `MainApplication.kt` if it regresses.
- `useDerivedValue` + `runOnJS` edge-trigger relies on Reanimated 4.5.1/worklets on Fabric
  (same runtime patched for the frozen-object bug). Fallback if it misbehaves: coarse JS emit
  (~250px) — still ~6× better than the old 40px emit.
- **Lazy routes may be marginal** (Metro ships one bundle; this defers module *evaluation*, not
  size). If release profiling shows no TTI win, collapse 5.1 to just the tab screens.
- `SearchProductRowCard` still uses RN `Image` (search surface, out of the home-feed scope).
- The repository seam is not yet consumed by the screens; wire it (or the `GatewayClient`) once
  the backend exists.

**Date:** 2026-09-11

---

## Blood Donor — dashboard UI, backend

**Status:** 🟢 Wizard closed-loop + dashboard + request-details page shipped (Donor tab, in-wrapper).

**Feature:** Blood Donor (`src/features/pharma/blood-donor/`), entered from the Pharma
navbar `Droplet` tab. A 5-step registration wizard (registry in `data/pharma/bloodDonor.ts`)
plus a registered-donor dashboard.

**Shipped:**
- Step 1 `BloodDetailsStep` (blood-group chip grid only — Rh factor and last-donation date
  were removed per design).
- Step 2 `HealthInfoStep` (age range select, weight field, four Yes/No eligibility
  questions), driven by `AGE_RANGES` / `YES_NO_OPTIONS` / `HEALTH_YESNO_QUESTIONS` /
  `WEIGHT_LIMITS`. Validation via `stepValidation.ts`. Yes/No radios start unselected —
  health claims are never pre-seeded.
- Step 3 `AvailabilityStep` (location field with real GPS via `@react-native-community/geolocation`, willing-to-
  travel Yes/No, donation type radios — the radio row wraps so all three options stay
  visible), driven by `DONATION_TYPES` / `LOCATION_MIN_LENGTH`. The multi-date calendar
  ("Availability") and "Preferred Time Slot" select were removed per design; the step now
  collects only location, travel willingness, and donation type.
- Step 4 `NotificationsStep` (three alert-preference switch rows + an info banner), driven
  by `NOTIFICATION_SOURCES` / `NOTIFICATIONS_BANNER`. Toggles **default ON** (an opt-out
  preference, not a claim). **Decision: the design's "Primary Purpose" section was
  intentionally dropped** — the step was renamed from Purpose to Alerts (id `notifications`)
  so the stepper/title stay truthful. Do not restore it without revisiting this decision.
- Step 5 `ReviewStep` — "Your Details" card (pencil → back to step 1), consent checkbox
  (defaults unchecked), "Complete Registration" CTA with privacy note. **Review rows are an
  honest mapping, not the mock's**: no "(Positive)" Rh suffix (never asked), age shown as
  the collected range, four real health Yes/No rows instead of "Good"/last-donation date
  (never collected), no Purpose row (dropped). Complete is gated on all prior steps +
  explicit consent.
- **Workflow closing**: draft + registration persist to AsyncStorage
  (`faazio/bloodDonor/v1`, hand-rolled hydration per repo pattern — no persist middleware).
  Mid-fill exits survive restarts (wizard resumes at `firstIncompleteStep`); a completed
  registration persists so the Donor tab always opens the Registered view. The
  "Edit Registration" re-entry path was **removed** — editing returns with the future
  Registered UI redesign.   `register()` snapshots `accountPhone` (from `authStore`, null if
  none) for the future server upsert.
- `bloodDonorStore` holds the in-progress `draft` + committed `registration`
  (`registration.profile` snapshots the full draft at submit); mode-gated screen flips to
  the dashboard on submit; reset on logout.
- **Registered-donor dashboard** (`DonorDashboard.tsx`): greeting ("Hi, …" from
  `authStore.user.name`), bell with unread-badge seed, red gradient impact banner, filter
  chips (Donation Requests / Nearby / Urgent) + real search over hospital/city/state/blood
  group, targeted **Requests for You** filtered by the active account's `user.id`, and the
  `BLOOD_REQUESTS` seed feed via `BloodRequestCard`. The Donor tab renders
  it **inside the Pharma wrapper** (pharma navbar visible, gradient header hidden — header
  hiding decoupled from navbar hiding in `SubAppWrapper`); the wizard completion moment
  shows it in-route (navbar-less). `RegisteredDonorView` was deleted (fully replaced).
  Card taps push `BloodRequestDescription` — the full request-details page (see below).
- **Request-details page shipped** (`BloodRequestDescriptionScreen`): hospital card (photo,
  verified chip, location, phone FAB), 2×2 info grid (Blood Group / Units / Needed Within /
  Posted On), Purpose + Additional Information sections, save-a-life banner, and
  **Mark Interested** + **Accept & Proceed** actions backed by `bloodDonorStore`
  (`interestedRequestIds` / `acceptedRequestIds`, persisted in the existing AsyncStorage
  blob, cleared on logout). "Other Requests Nearby" lists the other requests sorted by
  `distanceKm`; nearby taps push the same route per request. Share/phone/map are real
  device integrations (RN `Share`, `tel:` dialer, Google Maps search by address).
- The "Every drop counts" banner is now `showBanner`-driven (step 1 only); the header
  chevron steps back within the wizard (exits only on step 1); the footer is a full-width
  Next on every step (back-nav via chevron + hardware back).
- **Targeted "Ask Blood" shipped** (`components/AskBloodSheet.tsx` on the shared
  `SlideUpSheet`): a floating FAB on both the wizard and dashboard opens a two-stage flow.
  The user enters only city and blood group, taps Continue, and receives matching available
  donors from the async `services/donorDirectory.ts` mock repository. Tapping a donor opens
  `DonorDetailsScreen`, where `Request This Donor` creates one `DonorMatchRequest` addressed
  to that donor's `donorUserId`. Requests are persisted in the existing blood-donor blob
  and render only in the selected donor's dashboard under **Requests for You**; they are not
  inserted into the common hospital request feed or broadcast to all donors.
- **Cross-device incoming + accept/decline shipped (W54)**: the recipient's dashboard reads the
  server's incoming set (`getIncomingDonorMatches` → `GET /donor-match-requests/incoming`), so a
  targeted ask arrives on the recipient's own device. `IncomingDonorRequestCard` accepts/declines
  while `pending` (`respondToMatch` → `PUT /donor-match-requests/{id}/status`, recipient-only,
  outcome-returning, queued `match-status` outbox op when non-durable); the server enqueues a
  PII-free `MATCH_ACCEPTED`/`MATCH_DECLINED` notification to the requester, and the
  requester's outgoing row shows the real status (`BloodDonorDetails` → "Donor Accepted" / re-request
  after decline). Contact is **not** disclosed on acceptance (reveal-gated future).
- **Post to the public board shipped (W54)**: `AskBloodSheet` posts city + blood group to
  `POST /blood-requests` via the outcome-returning `createBloodRequest` and reloads the board; it
  never fabricates a local row (offline/mock → honest "couldn't post").
- **Honest bell + funnel shipped (W54)**: the bell is a non-interactive indicator (live server
  notification count + pending incoming — no seed, no dead tap); the funnel opens a `FilterSheet`
  (blood group / urgency / city) over the existing filters. "Nearby" now states it is city-match,
  not GPS.

**Future / honest gaps:**
- **Interested/Accepted are local-only** (persisted AsyncStorage) — the actual
  hospital-contact flow, matching and donor-detail sharing are backend future (Go Chi).
  Accept's confirmation dialog states the sharing contract; delivery is not built.
- **Distance (`distanceKm`) is mock seed data** — no real geo between donor and hospital
  yet; the nearby sort is a real sort over the seeded values.
- **Notification inbox screen is not built** — the bell is an honest non-interactive indicator
  (live `GET /notifications` count + pending incoming; no `BLOOD_DONOR_UNREAD_ALERTS` seed). A tap
  target / inbox screen and push delivery (`notifications.outbox` drain + `PUSH_WEBHOOK_URL`) remain
  ops + a future UI pass.
- **"Nearby" is city-matching, not geo**: request `city` vs the donor's registered
  `preferredLocation` (case-insensitive contains); the chip now says so. Real geo (device coords +
  an earthdistance/lat-lng index on `blood.donors`/`blood.requests`) swaps the matcher, not the UI.
- **Request feed is a static seed** (`BLOOD_REQUESTS`, 5 fixtures) — the Go Chi backend
  owns the real feed; `BloodRequest` shape documented as the interim contract.
- **Contact disclosure after acceptance is not built** — an accepted match updates status but
  contact details stay redacted (no reveal gate yet). Follow the Rx `revealed_at/by` pattern
  (`0023_rx_privacy.sql`) once the status flow settles.
- **AD label is not on `RestaurantOffersScreen`** ("View All") — scope-limited to the
  restaurant profile rail; add the same `AdLabelBadge` there as a one-line follow-up if
  wanted.
- **Registered UI is a minimal scaffold** — redesign pending (own design pass). Editing
  donor details will return inside that UI, not via wizard re-entry.
- **At-rest security tradeoff (accepted for mock stage):** persisted draft/registration
  includes health data in plain AsyncStorage. Small payload, never logged, cleared on
  logout — but it must move server-side (encrypted at rest) with the Go Chi backend.
- **Server contract (documented, not built):** future donor registry upserts are keyed by
  `registration.accountPhone` → idempotent, one donor row per account. `accountPhone` is
  `null` when the account has no phone on file (no fabrication).
- Notification **delivery** is not built: no push-notification library, no push infra, no
  backend. Targeted Ask Blood matching currently uses the mock donor repository and local
  persistence; matching, push, authorization, and request status will live in the Go Chi
  backend (`server/`) once wired.
- Age is a **range select**, not a real date-of-birth — a data-layer swap is needed for
  true eligibility (DOB-based).
- **No medical deferral logic** (e.g. underweight or chronic = Yes → block). Not in the
  design; a backend/Review-layer decision.
- Reverse geocoding relies on the device geocoder (Google Play services on Android);
  emulator geocoding is often unavailable — honest alert shown, manual entry always works.
- Persist `BloodDonorRegistration` via the Go Chi backend (`server/`) once wired
  (currently local-only per account). Backend also owns the real donor registry.

**Interim contract:** Keep the `BloodDonorDraft` / `BloodDonorRegistration` shapes stable so
server wiring is a store + data-layer change only.

**Date:** 2026-09-09

---

## Store Offers — seller-managed (future backend)

**Status:** 🟡 Static seed in production UI. Backend-dependent.

**Feature:** The Home **Store Offers** section (`features/home/sections/StoreOffersSection.tsx`)
currently reads a static seed array from `data/home/storeOffers.ts`.

**Future:** Must be backed by seller/store-owner dashboard writes — a store owner
creates/edits/expires their own offer, which flows into this Home section per-store,
geofenced/ranked by relevance. This will likely be served by the Go Chi backend in
`server/` (MVP modular monolith: `docs/architecture/mvp-backend.md`).

**Blocked by:**
- Seller/store-owner write APIs (the MVP monolith exists; this seller surface is not modelled yet).
- Auth/roles for store owners.
- An admin/seller app or web portal (out of scope for `client/mobile/`).

**Interim contract:** Keep the `StoreOffer` data shape (`data/types.ts`) stable. The
section's `profileFor` mapping is the only boundary that touches the data; swapping the
static array for an API call should be a one-file change inside
`StoreOffersSection.tsx`.

**Date:** 2026-08-01

---

## Nearby Offers — product-level, from nearby stores (live geo)

**Status:** 🟡 Static seed. Data shape stable.

**Feature:** The Home **Nearby Offers** section (`features/home/sections/NearbyOffersSection.tsx`)
shows product-level deals (`NearbyOffer` in `data/types.ts`) surfaced from stores physically
near the user. Currently seeded statically in `data/home/nearbyOffers.ts`.

**Future:** Rank/geofence by live user location and per-store availability once the backend
exists.

**Interim contract:** `NearbyOffer extends Product` + `distance`. Keep the shape stable so
swapping in a geo-ranked API response is a data-layer change only.

**Date:** 2026-08-01

---

## Food — Veg / Non-Veg diet filter

**Status:** 🟢 Shipped.

**Feature:** Zomato-style All / Veg / Non-Veg filter for the Food sub-app
(`src/features/food/screens/`), driven by the session-scoped `foodFilterStore` and a shared
`DietToggle` in the Food home + Search headers. Venues classified by `dietType`
(`veg`/`nonveg`/`both`); dishes by `isVeg?`. Match semantics in
`src/features/food/utils/dietFilter.ts` (`venueMatches` / `dishMatches`). The filter ANDs
with food-search chips (`foodSearchConfig.tsx` now uses the real `dietType` flag instead of
the old `/veg/i` cuisine heuristic). Unclassifiable dishes hide while a filter is active.

**Date:** 2026-09-10

---

## Account — nav rows & Coming-soon groups

**Status:** 🟡 Placeholder rows; Privacy/Legal sections are empty (Earn is now active).

**Feature:** The "You" page nav list (`features/profile/AccountView.tsx`, driven by
`@data/account/accountNav.ts` `accountNavGroups`) is grouped and titled: `profile`
(Profile settings), `payments` (Payments and credits), `privacy` (Privacy and security),
`earn` (Earn with us — now active with a `sell-with-us` row → `SellWithUs`), `legal` (Terms
and policies), `support` (Help & Support). The `privacy` and `legal` groups are
`comingSoon` and render a non-tappable "Coming soon" placeholder row.

**Future / honest gaps:**
- **Destination screens not built** for Payments, Recently Viewed, and Customer Support —
  these rows keep the TODO stub in `AccountView.handleRowPress` and don't navigate yet.
  Favourites now opens the search-results-style `Favourites` root route, and the
  "Coupons & Offers" stub row was removed from the `payments` group.
- **Privacy / Legal have no content** — no privacy/security settings, referral/
  partner/delivery-partner flow, or legal screens exist. Flip `comingSoon` off and add rows
  to each group once those screens are built; no component change is needed (data-driven).

**Interim contract:** Keep the `AccountNavGroup` shape (`title` + optional `comingSoon` +
`rows`) stable so server wiring via `GatewayClient.getAccountNav` (`navTable`) is a
data-layer change only.

**Date:** 2026-09-10

---

## FaazioRewards — coins & streak (local-only until backend)

**Status:** 🟡 Shipped locally; device-local balances (no server authority yet).

**Feature:** `features/rewards/` implements a FaazioCoins + order-streak loyalty loop:
- `rewardsStore` (persisted AsyncStorage `faazio/rewards/v1`, reset on logout) holds the coin
  balance, streak count, discount card, and an activity ledger (capped ~50 entries).
- Coins are earned on the **paid** order amount (`COIN_EARN_RATE` = ₹1000/coin) via
  `CartView.handlePlaceOrder` → `recordOrder(paidTotal, coinsRedeemed, orderId)`.
- Streak is calendar-date based; a 7-day streak grants a 10% discount card (5-day validity),
  reused as an opt-in coupon in the Bag coupon sheet. The payment step has an opt-in
  `CoinsRedeemRow` that redeems whole rupees of coins.
- UI: `FaazioRewardsScreen` (route `FaazioRewards`) and a FaazioCoins streak card on the
  Account page (title + balance + 7 flame icons filled per `streakCount`). All rules come
  from `@data/rewards/rewards.ts`.
- **Mock seed:** fresh installs start at `coinBalance = 245` / `streakCount = 5` (demo)
  until real orders override them; `reset()` on logout zeroes the balance and streak.

**Future / honest gaps:**
- **Balances are local-device-only.** `coinBalance`, `streakCount`, the discount card, and
  the ledger are stored in plain AsyncStorage and never logged with PII. There is no server
  authority yet — a user can edit local state, and balances won't sync across devices.
- **Server-side balances** must move to the Go Chi backend (`server/`): the backend should
  own earn/redemption/streak/card issuance and return authoritative balances via the
  `GatewayClient`. Until then, the `rewardsStore` blob is the single source of truth per device.
- **Order attribution is generated client-side** (`FZ-xxxxxx`) and not reconciled with any
  server order record — the ledger's `orderId` is the same client-generated id shown on the
  receipt, not a backend order reference.
- **No anti-abuse enforcement** — a local-only ledger can't detect forged orders or repeated
  same-day submissions server-side (same-day orders already count once for the streak by design).

**Interim contract:** Keep `@data/rewards/rewards.ts` constants and the `FaazioDiscountCard`
shape stable; server wiring is a store + data-layer swap (replace the local earn/redeem logic
with `GatewayClient` balance calls).

**Date:** 2026-09-10

---

## Sell with us — live partner onboarding

**Status:** 🟢 Live submit (gateway wired; `@data` label fixture retained).

**Feature:** `SellWithUsScreen` (route `SellWithUs`, from the Account `earn` group's
`Sell with us` row) is a real onboarding form. It collects business name, owner, category
(`MART`/`FOOD`/`PHARMA` chips), GSTIN, PAN, business address, contact phone and a 2-letter
state code. **All fields are mandatory** — submission is blocked until each is filled and the
state code is exactly two letters. Then submits a `PENDING_REVIEW` application via
`GatewayClient.submitSellerApplication` (`POST /sellers`, audited). On success it shows the
returned `sellerId`; offline/mock mode returns a local `PENDING_REVIEW` row so the flow still
completes. Field labels/placeholders still come from the stable
`@data/seller/sellerSetup.ts` fixture (`SELLER_SETUP_FIELDS`).

**Remaining / honest gaps:**
- **KYC + bank** are collected after approval (`POST /sellers/{id}/kyc`,
  `PUT /sellers/{id}/bank-account`, portal/seller-scoped) — not on this first screen.
- **No document picker yet** — KYC upload from mobile is a later step (Storage object keys).

**Date:** 2026-09-10 — updated 2026-10-13 (live submit).

---

## Production crash telemetry + release signing (build hardening)

**Status:** 🟢 Release signing done (CI); remote crash reporting still open.

**Shipped (2026-09-11):** `App.tsx` now installs a global `ErrorUtils` handler (so JS/render
errors are no longer swallowed in release, where `babel` strips `console.*`) and guards the splash
with a 10 s failsafe + 4 s hydration timeouts (prevents a stuck splash → ANR). The branded splash
shows the wide `logo.png` centered on Faazio blue for a minimum of 5 s (no spinner). Stale 188 MB
`faazio-debug.apk` / `faazio-release.apk` were removed from the repo root (already `*.apk`-ignored).

**Shipped (2026-09-12):** Release builds now run in **GitHub Actions** via `.github/workflows/release-apk.yml`
(triggered with `gh workflow run`). The workflow restores the release keystore from GitHub secrets
(`scripts/restore-keystore.sh`), generates release config, builds the committed `android/` project
with `./gradlew assembleRelease`, and publishes the
signed APK to a GitHub Release (`gh release upload --clobber` replaces any previous APK). This
replaces the previous "release signs with the debug keystore" gap. Removed the stale
`patches/@shopify+react-native-skia+2.2.12.patch` (skia is no longer a dependency), which was
breaking `npm ci`'s `postinstall` (`patch-package`) in fresh/CI environments.

**Investigated + documented (2026-09-12): local Gradle builds are killed by `systemd-oomd`.**
Every local `assembleDebug` attempt (detached, `--no-daemon`, any config) died ~2 min in with
exit 1 and no output, while the daemon logged `Success` + `EOFException`. Root cause confirmed
via `oomctl dump`: the whole `user@1000.service` slice (~9.6G: Chrome + VS Code + terminals +
Gradle) crosses systemd-oomd's 50%/20s memory-pressure threshold, which SIGKILLs the process
group (kernel `oom_kill` counter never moved). Mitigations applied locally (gitignored
`android/`): `gradle.properties` memory caps (`-Xmx2048m`, `workers.max=2`, `parallel=false`)
+ `local.properties` `sdk.dir` (both now committed/gitignored as appropriate). See
TROUBLESHOOTING.md "Gradle / native build failures" for the full diagnosis. **Working
policy: build via CI (`gh workflow run "Release APK"`); local builds only on a freed machine.**

**Future / honest gaps:**
- **No remote crash reporting.** The global handler only logs locally (dev). Production needs
  Sentry/Crashlytics (or a `GatewayClient` `/errors` endpoint) to surface real-device crashes.

**Shipped (2026-09-15): release APK install failure diagnosis + hardening.** A shared release APK
failed on a friend's device with **"App not installed as package appears to be invalid."**
Root cause: the friend had a **debug-signed** Faazio installed (from earlier `npm run android` dev
testing); the release APK is signed with the **release** keystore (`CN=Faazio`), a *different cert*
from the debug keystore (`CN=Android Debug`), so Android refuses the update. The fix is on the
installer side — **uninstall the old Faazio first, then install the release APK** (see
TROUBLESHOOTING.md → "Release signing"). Hardening shipped alongside:
- `android/app/build.gradle` now wires the `release` buildType to the release keystore directly and
  fails fast when `keystore.properties` is missing (removes the "release falls back to the debug
  keystore" foot-gun). The CI keystore restore script is the only signing step.
- Version bumped to `1.0.1` / `android.versionCode 2` so the rebuilt APK is a clean install.
- Docs: TROUBLESHOOTING.md "Release signing" + RELEASE.md document the debug-vs-release cert
  conflict and the `apksigner verify` cert check.
- Note: the APK is v2-signed only (correct for `minSdkVersion 24`); v1/JAR signing is intentionally
  omitted by AGP/apksigner for minSdk ≥ 24 and is not the cause of the install failure.

**Date:** 2026-09-15

---

## Category drill-in + vendor details (from the Home/Mart header rail)

**Status:** 🟢 Shipped (client-side, mock data).

**Feature:** A rail chip (Home hub `HeaderCategoryRail` or the Mart sub-app header) now opens a
dedicated **category drill-in page** (`features/catalog/CategoryDrillInScreen.tsx`, route
`CategoryDrillIn`) instead of the classic `MasterCategories` dual panel. The panel
(`components/CategoryDrillInPanel.tsx`) resolves the tab from `MASTER_CATEGORIES[app]`, shows the
tapped category's **subgroups as a plain-text rail** (`SubgroupTextRail`, first auto-selected,
active = accent + underline), and renders a section per sub-category listing **one-per-row vendor
cards** (`VendorRowCard`), grouped via the new repository seam `services/categoryVendors.ts`
(`getVendorsForApp` / `getVendorProducts`). An inline searchbar (page-local) filters the vendor
rows live. Tapping a vendor pushes `VendorDetailScreen` (route `VendorDetails`) — a back arrow
with an inline searchbar to its right (auto-focused, sub-category query pre-applied) and that
store's products rendered one-per-row via `SearchMartProductCard` / `SearchPharmaProductCard`.

**Data:** `data/pharma/products.ts` sets `storeId` from a category→outlet map
(`STORE_BY_CATEGORY` in `data/pharma/products.ts`) so the 6 outlets `store-p1…p6` each hold real
inventory (backing the prescription vendor picker and self-pickup), so both Mart and Pharma can
group by `storeId`.

**Deliberate deviation from the search predicate:** the Search screen matches a contiguous
substring of the full query; with the mock catalog that returns nothing for most multi-word
sub-categories. `getVendorsForApp`/`matchesQuery` instead do a **per-token** match (every query
word must appear in the same `searchableText`) so the drill-in actually groups the fixture data
into per-vendor rows. It shares the exact `productSearchableText` normalization.

**Future / honest gaps:**
- **The classic categories surfaces are now removed** (bottom-tab Categories, rail "View All",
  Mart "View All", Pharma category cards, and the `MasterCategories` route) — see the "Categories
  cleanup" entry above. The rail + drill-in are the only categories surfaces.
- **`app: 'PHARMA'` is currently unreachable** — the rail is always `FA_MART`. The route supports
  Pharma for when a pharma category entry point is added.
- **Per-vendor search is a live filter**, not a full `SearchScreen`; it reuses the row cards but
  not the sort/facet/suggestion machinery.

**Date:** 2026-09-13

## Product card images square + search-result vendor header

**Status:** 🟢 Shipped (client-side).

**Feature:** Product card images on the Mart / Pharma / Food pages (and the Home rails that
reuse the same wrapper cards) are now **1:1 square** instead of 3:4 portrait. Implemented via a
new `imageAspect` prop on `ProductCardBase` (default `3 / 4`, so the product-detail "More from
store" grid keeps portrait) with the Mart / Pharma / Food wrappers defaulting to `1`; the
standalone `MartDealCard` rail was squared too. Search-result rows keep their 3:4 image.

**Search result cards:** `SearchProductRowCard` now renders a slim **one-line vendor header**
(small bold store name + tiny Store icon, hairline divider) above the image/price row instead of
the store name inline in the body. `showStoreHeader` (default `true`, forwarded through
`SearchMartProductCard` / `SearchPharmaProductCard`) lets pages opt out — the single-store
`VendorDetails` page passes `false`. Search and Favourites keep the header.

**Date:** 2026-09-13

## Home "Today's Special" randomized rails

**Status:** 🟢 Shipped (client-side).

**Feature:** The Home `diningSpecials` section is titled **"Today's Special"** (renamed from "Today's
Dining Special"; parity in `data/home/sdui.ts`) and renders **two stacked, independent horizontal
rails** (`DiningSpecialsSection.tsx`) of **randomized cards** drawn from a combined **Food + Mart +
Pharma** pool (`TODAYS_SPECIALS` via `dishToProduct`, `recentlyViewedMart`, `hotBrandDeals`,
`recentlyViewedPharma`). Each rail scrolls horizontally on its own (no shared scroll state); the mix
is sampled once per mount so re-renders don't reshuffle. Cards use the shared `UniversalFeedCard`
(`variant="rail"`, `hs(150)` wide, **square 1:1** image with **rounded corners**) — matching the
"Daily Essentials" (Deals of the day) rail. Rating, price, badges and the add-to-cart control are
hidden (`showRating`/`showPrice`/`showBadge`/`showAddButton` off); taps open the shared
`CommonProductDetailView`. The earlier Home-local `TodaysSpecialCard` (2-up stacked columns) was
removed as obsolete.

**Date:** 2026-09-16

## Mart "Local Vendors Near You" — remove in-section search + category pill rail

**Status:** 🟢 Shipped (client-side).

**Feature:** The Mart feed's `LocalVendorRail` drops its **in-section search bar** and the
**category pill rail** (`VendorCategoryPills`) beneath it. The section keeps its
`MartSectionHeader` title and renders the full `martStores` list directly (with its empty state).
The Mart **header** search + header category rail are untouched. `VendorCategoryPills` was removed
(only used by this rail); `usePagedRail` remains in use by the header rail.

**Date:** 2026-09-16

## Sub-app crash hardening — visible, scoped, recoverable

**Status:** 🟢 Shipped (client-side).

**Feature:** A render error while Mart/Pharma mounts previously blanked the whole navigator with an
opaque "Something went wrong" card, and release builds strip `console.*` so the cause was invisible.
- `components/ErrorBoundary.tsx` now takes `scope` / `onReset`, always renders the thrown `message`
  (first stack frame in dev only), and offers **"Go to Home"** alongside "Try again" (reset
  navigation via `navigationRef`, `src/navigation/navigationRef.ts`).
- `SubAppScreen` wraps `SubAppWrapper` in a **scoped** `scope="SubApp"` boundary so a sub-app-only
  failure degrades in place and Home/Food keep working; it also guards an absent `route.params`.
- `SubAppWrapper` derives its config from a module-scope `SUB_APP_PRESETS` with a
  **never-undefined fallback** + an in-app "Unsupported sub-app" state (no more `config.tabs` on
  `undefined`), and guards `initialVendorStoreId` (`Array.isArray(martStores)`).
- Header consolidation finished: one `SubAppHeader` for all sub-apps (Mart pins `HeaderCategoryRail`
  via `belowSearchSlot`); `MartSubAppHeader.tsx` + `SubAppHeaderBackdrop.tsx` deleted.

**Date:** 2026-09-27

## Smaller "Today's Special" cards (Home + Food)

**Status:** 🟢 Shipped (client-side).

**Feature:** Food's **"Today's Special Near You"** card (`SpecialDishCard.tsx`) is rebuilt as a
compact `hs(116)`-wide card — **square** (`aspectRatio: 1`) image on top, dish name / restaurant /
price stacked below, no gradient overlay (the old 175×250 portrait card). On Home, the
`diningSpecials` rails shrink from `hs(150)` → `hs(116)` (`DiningSpecialsSection.tsx`), rails
tightened (`paddingBottom vs(8)`, `marginTop vs(4)`) and `CARDS_PER_RAIL` 8 → 10.

**Date:** 2026-09-27

## Durable backend seam — blood (0010) + bookings (0011)

**Status:** 🟡 Server + seed + `GatewayClient` shipped; screen reconciliation pending.

**Done:** the previously memory-only workflows now have a durable home served by the gateway:
- **blood** (`internal/blood`, migration `0010`): donor registry (`blood.donors` + the
  `blood.donor_directory` consented view), request board (`blood.requests`, `contact`/`address`
  redacted for anon), `blood.interests`, `blood.match_requests`. `bloodDonorStore` now mirrors
  `register()` → `PUT /donors/me`, `toggleInterested`/`acceptRequest` → `setBloodInterest`, and
  `requestDonor` → `createDonorMatch` (best-effort; AsyncStorage stays the optimistic cache).
- **bookings** (`internal/bookings`, migration `0011`/`0020`): `bookings.tables` (+ `venue_configs`,
  `payments`). `GatewayClient` exposes `getBookings/createBooking/cancelBooking/attachBookingPayment`.
  `bookings.food_orders` is reserved/unseeded (W29 follow-up removed the dead food-booking path).

**Remaining:** wire `bookingStore` (currently unused by any screen) to hydrate
from and write to the gateway; migrate the blood dashboard/request board off the `BLOOD_REQUESTS` /
`BLOOD_DONORS` `@data` seeds to `GET /blood-requests` / `GET /donors`.

**Date:** 2026-10-13

## DB-gap series closed — hardening (0014) + reco read path

**Status:** 🟢 Server + seed + `GatewayClient` shipped (phase 6, final).

**Done:**
- **`0014_hardening.sql`**: one generic `util.touch_updated_at()` trigger attached to every mutable
  table (stores/stock/carts/pickup_points/profile/vendor_reviews/prescriptions/bookings.tables/
  blood.donors/rewards.balances), a `checkout.purge_idempotency_keys()` pg_cron sweep (7-day window),
  hot-path indexes (`vendor_reviews(vendor_id, created_at desc)`, `prescriptions(user_id, status)`),
  and schema `USAGE` grants to `anon`/`authenticated` (Supabase-only). Idempotent/re-runnable.
- **Mongo**: `seed.js` now validates + creates the four MVP collections
  (`sdui_layouts`, `user_events`, `recommendations`, `product_stats`).
- **reco read path**: `GET /recommendations` (auth-scoped) reads the caller's `recommendations` doc by
  `userIdHash`, falls back to top `product_stats`, joins catalog, cached `faazio:v1:reco:{hash}:home`
  1 h. Client `getRecommendations()` falls back to highest-rated catalog entries.

**Remaining (Future Prod):** the batch job that writes `recommendations` / `product_stats` (and the
`segments` collection); wiring recommendations into a Home rail.

**Date:** 2026-10-13
