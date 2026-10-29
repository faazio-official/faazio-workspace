# Faazio Monolith Breakdown — Modular Monolith → Microservices

> **Status:** Production (live). This is the **single authority** for how the production
> `server/gateway` modular monolith maps to the scaling-stage per-service split. Every context
> below is a package in **one Go binary** (`server/gateway`) with hard internal boundaries;
> extraction to a real service is a packaging change, not a rewrite.
> Companion / referenced from: `docs/architecture/mvp-backend.md` (production authority),
> `docs/architecture/db-schema.md` (table authority), `docs/architecture/server-gateway-plan.md`
> (scaling-stage gateway), `docs/architecture/caching-cloudflare-valkey.md` (cache authority).

## 0. Why one production monolith (not Go + Rust yet)

Ship **one Go Chi modular monolith now**, extract Rust/Go services later. Evidence:

- **Modular monolith → microservices without rewrite** is the proven path: bounded contexts in one
  binary behind hard `internal/<context>/` boundaries, extracted per-context when a scale trigger
  hits (Shopify strangler-fig guide; AWS strangler-fig prescriptive guidance; "one binary, many
  boundaries" Go pattern).
- **Prime Video** collapsed distributed microservices back into a modular monolith for cost/perf —
  keeping module boundaries so extraction stays possible (not a return to a ball of mud).
- **Postgres FTS is good enough for production**: `tsvector` + `pg_trgm` + `unaccent` handles
  ~100k–1M rows / few-hundred rps. Tantivy only pays off at high-QPS flash-sale scale.
- **A second Rust toolchain now costs 2 CI builds, 2 cold-starts, inter-service auth/gRPC + OTel
  across stacks, for zero production gain** — violates `AGENTS.md` (lightweight / fast / secure; justify size).

The refactor risk ("build Go, refactor to Rust later") is neutralized by the **contract freeze in §4**:
slug IDs, INT8 paisa, `TIMESTAMPTZ`, `GatewayClient` signatures, and cache keys/TTLs stay stable, so
search extraction is a pure index-replica swap.

## 1. Context → package → schema → cache → future-service ownership

1:1 with `db-schema.md` §1–§8 and `data/DATA_CONTROL.md`. **This table is the ownership authority for
`server/gateway/internal/*`.**

| Context (scaling-stage service) | Production package | Schema(s) | Cache keys / TTL | `GatewayClient` method(s) | Scaling-stage service |
|---|---|---|---|---|---|
| search → Rust/Tantivy | `internal/search` | `catalog` (read: `products_search`) | `faazio:v1:search:q:{query}` 600 s | `searchProducts` | Rust Axum + Tantivy |
| catalog/directory → Go | `internal/catalog`, `internal/directory` | `catalog`, `directory` (+ `inventory.pickup_points`, `directory.dining_venues`, `directory.menus` incl. `seller_id`/`status`/`mrp_paisa`) | `faazio:v1:catalog:product:{id}` 24 h (purged on product edit/status **and** per line item on `order.placed` — it embeds stock) · `faazio:v1:catalog:store-products:{storeId}` 300 s (first ACTIVE page, purged on product edit/status) · `faazio:v1:geo:nearby:stores:{lat3}:{lng3}:{radiusKm}:{app}` 120 s fresh + 300 s SWR (`Cache.ReadStale` — stale served + single-flight bg refresh, never a blank list; the cache stores the **canonical max** limit and slices per request so one tile key serves every `limit` variant; store live toggle `PUT /seller/stores/{id}/live` purges the store's 3×3 tile prefixes + `directory:store:{id}` + `catalog:store-products:{id}`) · `faazio:v1:geo:nearby:products:{lat3}:{lng3}:{radiusKm}:{app}` 120 s fresh + 300 s SWR (same read pattern + canonical-max limit; a product edit/status change purges the store's 3×3 `geo:nearby:products` tile prefixes; reader staleness beyond the tile block bounded by the 120 s fresh TTL) · `faazio:v1:directory:store:{id}` 24 h · `faazio:v1:directory:pickup:{key}` 24 h · `faazio:v1:directory:menu:{venueId}` 24 h (`cache.TTLStore`, invalidated on menu edit) · `faazio:v1:directory:venues:{app}` 24 h · `faazio:v1:directory:venue:{id}` 24 h | `createProduct` (`POST /seller/products`, seller-scoped to an owned **live** store, default `PENDING_REVIEW`, writes `catalog.products` + `inventory.stock` in one transaction, purges `catalog:product`/`stock`/`store-products` + the store's 3×3 `geo:nearby:products` tiles), `getProduct`, `getProductsByIds`, `getStoreProducts` (`GET /stores/{id}/products`), `getStores` (+ no-fallback `fetchStores`), `getStoresNearby`/`fetchStoresNearby` (`GET /stores/nearby`, bounding-box + Haversine, public PII-free projection), `getProductsNearby`/`fetchProductsNearby` (`GET /products/nearby`, ACTIVE rows of live stores), `getStore`, `getVenues` (+ no-fallback `fetchVenues` — the Food grid uses it to tell an authoritative empty list from offline), `getVenue` (`GET /venues/{id}`), `getPickupPoints`, `getMenu` (menu dishes carry an authored `mrp_paisa` strike; the public menu read serves **ACTIVE** rows only and `POST`/`PUT /seller/menus` accepts an `mrp` (rupees, `>= price`) so the seller authors the strike — **no** festival overlay — `promo.festival_optins` is `catalog.products`-scoped); portal menu CRUD (`/seller/menus`) + media link (`PUT /seller/products/{id}` `imageKey`/`imageAssetId`, `PUT /seller/stores/{id}/cover`, menu `imageKey`); reads resolve `image_key` → CDN; district-precise admin scope for seller-owned product/store/menu reads+writes (`0057`: seller/district match, unowned rows super-only; W71 menu ownership = dish → store → venue menu, re-checked in `UpsertMenu`); product projections expose `storeId` so the PDP store link is server-derived | CockroachDB + Postgres |
| pharma (prescriptions) → Go | `internal/pharma` | `pharma` (+ `pharma.quote_items`, `pharma.status_history`) | `faazio:v1:pharma:prescriptions:{userId}` 60 s; never edge-cached | `createPrescription` (image paths must sit under the caller's own `<userId>/` upload prefix), `uploadPrescriptionImage`, `getPrescriptions`/`getPrescription` (owner-scoped `GET /prescriptions/{id}`); portal quote/reveal (`GET /seller/prescriptions`, `GET /seller/prescriptions/{id}`, `POST /seller/prescriptions/{id}/quotes`, `PUT /prescriptions/{id}/status`; district-scoped vendor list/detail/quote/status/image access via `0057`) | Go + Postgres + R2 (Supabase Storage fallback) |
| notifications → Go+worker | `internal/notifications` | `notifications` (+ `outbox`, `push_tokens`) | `faazio:v1:notifications:inbox:{userId}` 30 s; never edge-cached | — (enqueue via `contracts.Notifier`; seller new-order fan-out via `Notifier.EnqueueSeller` (active SELLER portal users owning the order's stores); `POST/DELETE /notifications/register`, `GET /notifications`; portal `GET /admin/notifications` + admin `POST /notifications/drain` (`contracts.Drainer` one-shot); outbox **drain worker** → `PENDING`→`SENT` / `FAILED` with **retry** (`attempts` + `next_attempt_at`: capped exponential backoff, terminal after 6, `0058`), provider-agnostic `Sender`s (embedded **FCM HTTP v1** when `FCM_SERVICE_ACCOUNT_JSON` + `FCM_PROJECT_ID` are set), 30 s polling SLA, enabled when the FCM sender is present; manual `POST /notifications/drain` runs a **bounded 10-row batch** that stops cleanly on the request timeout; an FCM **`UNREGISTERED`** response expires the row (terminal, no retry budget spent) and **prunes the `push_tokens` row atomically** (`Repo.ExpireToken`), so dead tokens never retry) | Go + queue worker |
| blood → Go+Postgres | `internal/blood` | `blood` (+ `blood.donor_directory` view, pg_cron expiry; `blood.match_requests.responded_at` — 0029; `blood.requests.created_by` — 0061) | `faazio:v1:blood:requests:{bloodGroup};{city}` 60 s (public/redacted); never edge-cached. No interest cache: `blood.requests` carries no interest data, so `PUT`/`DELETE …/interest` never invalidates a key | `getDonorProfile` (+ no-fallback `fetchDonorProfile`), `saveDonorProfile`, `getBloodDonors` (+ no-fallback `fetchBloodDonors`), `getBloodRequests` (+ no-fallback `fetchBloodRequests`), `createBloodRequest` (stamps `created_by` from the bearer token for right-to-erasure), `setBloodInterest` (`PUT`), `clearBloodInterest` (`DELETE /blood-requests/{id}/interest`, idempotent un-interest), `createDonorMatch`, `getDonorMatches`, `getIncomingDonorMatches` (`GET /donor-match-requests/incoming`, recipient-scoped), `setDonorMatchStatus` (`PUT /donor-match-requests/{id}/status`, recipient-only pending→accepted/declined, enqueues `MATCH_ACCEPTED`/`MATCH_DECLINED` via `contracts.Notifier`); `DELETE /blood-requests/{id}` moderation is state-scoped for district admins and global for super admins (W71); `DELETE /users/me` erases the author's requests via `created_by`; writes return `BloodWriteOutcome` (`synced`/`offline`/`signed-out`) — the store owns the `pendingOps` retry outbox (`register`/`interest`/`interest-remove`/`match`/`match-status`/`request`) | Go + Postgres |
| cart/stock → Go+Dynamo | `internal/cartstock` | `inventory` | `faazio:v1:stock:{productId}` 30–60 s; **never** carts | `getStock`, `getCart`, `addToCart`, `updateCartItem`, `removeCartItem` | DynamoDB / Firestore |
| favourites → Go+Postgres | `internal/favourites` | `favourites` | `faazio:v1:favourites:items:{userId}` 60 s; never edge-cached | `getFavourites`, `addFavourite`, `removeFavourite` | CockroachDB |
| checkout → Go+Cockroach | `internal/checkout` | `checkout` (+ `checkout.idempotency_keys`, `checkout.payments`, `checkout.users_admin` read view), `accounts` | `faazio:v1:checkout:orders:{userId}` 60 s · idem `NX EX 300` · `faazio:v1:auth:uid:{sha256}` 3600 s | `getOrders`, `placeOrder` (re-prices from `catalog.products`: settles approved festival discounts via `contracts.DiscountReader`, coupon via `contracts.CouponValidator`, coins **validated against the server-held balance via `contracts.RewardsReader` — a redemption above the balance is rejected `400 insufficient_coins` before stock/money settles**; **stock decrement + order row + invoice + payment + idempotency key commit in ONE transaction** (`Repo.WithTx` — the `cartstock` decrement runs on the same `pgx.Tx`, so a failed insert rolls inventory back instead of silently draining it), then best-effort `contracts.AdAttributor`; a failed rewards `Earn` is logged loudly (not swallowed) and surfaced honestly by `GET /rewards`; **dynamic delivery fee** — PICKUP → 0, DELIVERY → Haversine between `directory.stores` pins and the live drop fix × `tax.delivery_fee_settings` rate card (fractional km), plus night/rain/festival surge from `contracts.SurgeReader` + `contracts.WeatherChecker` + `contracts.FestivalLookup` (hex drop zone); the distance/surge/basis are persisted on `checkout.orders` so payout is a 1:1 pass-through; **platform commission removed** so `taxmath.Compute` yields zero platform fee/GST and `SellerNet = Gross − TCS − TDS`), `validateCoupon` (`POST /checkout/validate-coupon`), `deliveryFee` (`GET /checkout/delivery-fee` — auth-scoped quote for `storeId + lat + lng`), `payForOrder`, `getPayments`, `getProfile`, `getMembership`, `getOrderStatus`, `getAccountNav`, `getDetails`, `getAddresses`, `saveAddress` (`PUT /profile/addresses`), `deleteAddress` (`DELETE /profile/addresses/{id}`), `deleteAccount` (`DELETE /users/me` — anonymising soft delete: erases PII tables, blanks free-text ticket/review/return fields, clears retained order coordinates + DROP-stop coordinates/OTP, resets `delivery_orders.route_sequence`, deletes the author's `blood.requests` via `created_by` (0061), deletes the user's prescription blobs from the active backend (R2 or Supabase Storage), unlinks `auth_uid`, keeps order/payment/invoice rows for legal retention, purges every per-user cache slice + `auth:uid`, and audits under an allowed partner role because `admins.audit_logs` has no CUSTOMER role), `requestDataDeletion` (`POST /users/me/data-deletion` — partial erasure of `addresses`/`favourites`/`prescriptions`; order records excluded), order tracking (`GET /orders/tracking/{id}`, owner-scoped status poll), seller app board (`GET /seller/orders`, `GET /seller/orders/{id}`, `PUT /seller/orders/{id}/accept` NEW→PACKED + dispatch, `PUT /seller/orders/{id}/reject` NEW→REJECTED + captured payment REFUNDED + customer notification, `0042` statuses + `0056` REJECTED; `POST /orders` also enqueues the seller new-order push via `contracts.Notifier.EnqueueSeller`), tax invoice (`GET /orders/{id}/invoice`, owner-scoped immutable row + presigned R2 PDF when rendered), auth-subject link (`auth.UserProvisioner` → `ProvisionUserID` upserts `checkout.users.auth_uid` on first OTP call and forward-fills the matching `accounts.profile` row so a new user never renders the `@data` fixture; `GET /profile` falls back to `checkout.users` for pre-provision rows; `0030` adds `last_login_at`; `0060` adds `users.deleted_at` + the account-deletion / partial-erasure paths; a login after deletion provisions a fresh deterministic id with a random suffix so the anonymised `user_id` is never revived) | CockroachDB |
| rewards → Go+Postgres | `internal/rewards` | `rewards` (+ `rewards.rates`) | `faazio:v1:rewards:view:{userId}` 60 s; never edge-cached | `getRewards` (earn happens in-process via `contracts.RewardsWriter`; checkout also reads the balance via `contracts.RewardsReader` so a redemption can never exceed it); portal reads ledger + rates | CockroachDB |
| reviews → Go+Postgres | `internal/reviews` | `reviews` (+ `reviews.vendor_summary` counter/trigger) | `faazio:v1:reviews:vendor:{id}` 24 h · `faazio:v1:reviews:product:{id}` 24 h (`rateVendor` also purges `directory:store:{id}` — the store card embeds rating/reviews_count) | `getReviews` (product), `getVendorReviews`, `rateVendor` | standalone Postgres |
| sellers → Go+Postgres | `internal/sellers` | `sellers` (+ `sellers.sellers` with `platform_fee_pct`/`razorpay_linked_account_id`/`otp_*`/`rejection_*`/FSSAI columns/`latitude`+`longitude` shop pin (0041)/`district_code` (0047), `kyc_documents` incl. `asset_id`, `bank_accounts`, `kyc_verification_log`, `seller_request_history`, `seller_fee_change_requests` (0049); district-precise seller-data RLS (`0050`); `directory.stores`/`catalog.products` `seller_id`; migration `0039`) | **none** — seller records carry PII (caching doc §8) | `submitSellerApplication` (`POST /sellers`, any authenticated applicant), `uploadSellerDocument` (`/media/upload-url` + `/media/confirm`); admin portal `GET /sellers`, `GET /sellers/{id}` (detail), `PATCH /sellers/{id}/platform-fee`, `POST /sellers/{id}/platform-fee-request` (seller) + `GET /sellers/{id}/platform-fee-requests` (own history) + `PATCH /seller/fee-change-requests/{id}/approve|reject` (district/super admin), `POST /sellers/{id}/verify-doc/{docType}`, `POST /sellers/{id}/verify-kyc`, `POST /sellers/{id}/reject`; seller `POST /sellers/{id}/edit` (REJECTED only) | Go + Postgres + Razorpay Route |
| admins → Go | `internal/admins` | `admins` (+ `district_admins` (renamed from `state_admins` in `0048`), `district_master` (0046, 42 TN/PY seeds), `audit_logs`); reads `checkout.users_admin`. `district_admins.district_code` is the authoritative scope (`internal/platform/geo`); legacy `state_code` remains nullable for non-TN/PY admins | none ever cached, incl. audit rows — but audit is now a **rolling 7-day window**: `admins.purge_audit_logs()` (`0037`) deletes >7d rows nightly at **00:00 IST** via the gateway worker (`internal/admins/purger.go` `Purger.Run`; **not** pg_cron — optional `0014`-style cron documented in the migration). This is an **origin delete, never a cache TTL** | portal-only (`GET /customers`, customer monitoring; `GET/POST /district-admins` (legacy `/state-admins` alias), `PUT/DELETE /district-admins/{id}` — `POST` is **district-mandatory** (`0065`): a missing or unknown district returns 400 `unknown_district` and `state_code` is derived from the district, never a fallback input). **`POST /district-admins` is the unified district-admin creator (`0036`, renamed in `0048`, district-mandatory in `0065`):** optional `issueLogin` mints a `DISTRICT_ADMIN` row in `admins.portal_users` in the **same tx**. Email is the hard one-person-one-role key (`409 email_has_district_login` / `email_has_district_roster`; the frontier constraint is `district_admins_email_lower_uniq`). Phone is a **soft warning** (`201 warnings[]`) — shared/SME lines are allowed, so roster/seller phone reuse never blocks; `PUT/DELETE` also deactivate/delete the linked portal login by `lower(email)` so a dead roster can never leave a live login. `Provisioner` (`internal/admins/provision.go`) owns the tx — extraction must move `district_admins` **and** `portal_users` together. **Retention surface:** SUPER_ADMIN-only `POST /audit-logs/purge` (manual pass, `contracts.AuditPurger` → `Purger`), plus the nightly worker; extraction must carry the `0037` function, the purger worker and the manual route | CockroachDB |
| portal auth → Go | `internal/portal` | `admins` (+ `portal_users` credentials with `SUPER_ADMIN`/`DISTRICT_ADMIN`/`SELLER` scope, `portal_sessions` rotating refresh families with 30 d sliding idle / 180 d absolute cap / 30 s reuse grace (`0032` + `0033` + `0034` + `0038`)); audit rows via `contracts.AuditWriter` | `faazio:v1:auth:login:ip:{sha8}` 60 s · `faazio:v1:auth:login:email:{sha8}` 60 s · `faazio:v1:auth:deny:{jti}` ≤15 m; refresh sessions are Postgres rows (idle 30 d, absolute 180 d), never cached | portal-only: `POST /auth/portal/{login,refresh,logout}`, `GET /auth/portal/me`, `PUT /auth/portal/password` (any role), `GET|POST /admin/portal-users`, `PUT /admin/portal-users/{id}`, `PUT /admin/portal-users/{id}/password` (superadmin; `forceChange` defaults false for `SUPER_ADMIN`, true for scoped roles). `DISTRICT_ADMIN` rows are **also** minted atomically by `POST /district-admins` (`issueLogin:true`, `internal/admins` Provisioner) — `/admin/portal-users` remains the general SELLER/DISTRICT_ADMIN issuer; mints the `iss=faazio-portal`/`aud=portal` access JWT with role + seller/district scope verified by `internal/platform/auth`; `refresh` implements the GCP rotation: consume-former-token atomically, grace-accept a replay inside 30 s, revoke the family only on a hard replay / absolute-cap, revoke only the row on an idle lapse; startup `portal.CheckSchema` logs `portal_tables=ok|partial|missing` (0032–0034 hint) | Go + Postgres |
| app config → Go+Postgres | `internal/appconfig` | `admins` (+ `app_config` (`0059`): SUPER_ADMIN-edited client-visible key/value set — `is_public` gates direct anon/authenticated SELECT (RLS), the gateway is the only writer; `value_secret` rows are masked in the portal (`value=null`, "leave blank to keep") and never client-visible; `is_public + value_secret` rejected; 4 KiB value / 300-char description caps; every write audited with the secret omitted) | none — a tiny DB read that must land on the next app boot; a cache would only delay a portal edit | `getAppConfig` (`GET /app-config?variant=`, public, no auth — cold-boot read before login); portal `GET /admin/app-config` + `PUT|DELETE /admin/app-config/{key}` (SUPER_ADMIN) | Go + Postgres |
| promo → Go+Postgres | `internal/promo` | `promo` (+ `festival_campaigns`, `seller_optins`, `coupons` incl. `title`/`min_order_paisa`/`free_delivery`, `sector_caps`) | `faazio:v1:promo:campaign:{id}` 300 s · `faazio:v1:promo:coupons:public:{app}:{state}` 600 s · `faazio:v1:promo:active:{productId}` 300 s (LIVE+APPROVED, sector-capped; invalidated on opt-in/campaign change) | portal control + public `GET /coupons?app=&state=` (anon, active/unexpired projection) + `GET /promo/active-discounts?ids=` (anon shopper-price projection the app overlays on base prices); implements `contracts.CouponValidator` (`ValidateCoupon`, pure `DecideCoupon`) and `contracts.DiscountReader` (`ActiveDiscounts`) so checkout settles coupons + live festival discounts server-side. **(W53)** the Pharma home Popular Medicines rail now consumes `GET /promo/active-discounts` (same overlay as Mart) and Top Offers are filtered to live `GET /coupons?app=PHARMA` codes — no app surface advertises a coupon checkout cannot settle. Admin control-plane access is state-scoped: a `DISTRICT_ADMIN` can only read/toggle its own state's campaigns, coupons and opt-ins (opt-in lists join `sellers.sellers` and filter by the admin's district; approvals re-check the parent campaign **and** the seller's district), while `GLOBAL` rows and cross-state ids are super-admin-only (unauthorized ids 404; cached campaign/slot reads re-check scope on every hit). Seller opt-ins verify product ownership and reject cross-seller overwrites (`409`) at the repo layer (W71) | Go + Postgres |
| ads → Go+Postgres | `internal/ads` | `ads` (+ `sponsored_slots`, `campaigns` — self-serve hero creative, `0027`/`0028`) | `faazio:v1:ads:slot:{id}` 300 s · `faazio:v1:ads:live:{placement}` 600 s · `faazio:v1:ads:hero:{placement}:{app}:{category}:{store}` 300 s (both invalidated on status change; hero namespace purged by prefix on publish/takedown) · `faazio:v1:ads:seen:{userId}:{slotId}` 300 s (impression dedupe) · `faazio:v1:ads:report:{userId}:{placementId}` 24 h (report dedupe) · `faazio:v1:ads:publish:{sellerId}:{day}` 24 h (rate counter) | portal control + public `GET /ads/live?slot=` and `GET /ads/hero?placement=&app=&category=&storeId=` (anon, LIVE projections); authenticated `POST /ads/events` records impression/click (`RecordEvent` — one round-trip updates the rail slot or hero row). Sponsored-slot requests (`POST /ads/slots`) verify the product belongs to the seller and re-check the seller's district for an admin before inserting, and force the seller's registered state. Hero campaigns are **self-serve** (`0028`): `POST /ads/campaigns` machine-checks ownership (resolved against `catalog.products`/`directory.menus`/`directory.stores`/`directory.dining_venues`), placement↔app fit, R2-CDN-only poster, bounds, ≤90-day window, ≤3 LIVE per (seller, placement) + ≤10 publishes/seller/day, then inserts `LIVE`; `GET /ads/campaigns?sellerId=` (scoped); authenticated `POST /ads/campaigns/{id}/report` (user abuse report, deduped, no PII); admin `PUT /ads/campaigns/{id}/status` is **takedown/restore only** (`REJECTED`+reason / `LIVE`). `contracts.AdAttributor` `AttributeOrder` bumps `orders_attributed` best-effort at checkout (both surfaces); `GatewayClient.getLiveAds`/`getSponsoredProducts`/`getHeroAds`/`recordAdEvent`/`reportHeroAd` feed the shared sponsored rail (HOME_TOP/SPONSORED_SHOWCASE/SECTOR_RAIL) and the labelled hero surfaces (MART_HERO/CATEGORY_TOP/STORE_TOP/HOME_HERO/FOOD_HERO/PHARMA_HERO) | Go + Postgres |
| tax / invoicing → Go+Postgres | `internal/tax` (+ shared `internal/platform/taxmath`) | `tax` (+ `tax_rates`, `platform_settings`, `tax_invoices` (`0051`), `delivery_fee_settings` (`0053`)) | none — invoices are immutable origin rows, never cached | `GET /orders/{id}/invoice` (owner-scoped, via `internal/checkout`), portal `GET /tax/categories`, `GET|PUT /admin/tax/categories`, `DELETE /admin/tax/categories/{id}`, `GET|PUT /admin/tax/settings`; canonical GST/TCS/TDS math (`taxmath.Compute`) shared by checkout + settlement — platform commission/GST are zero, the delivery fee is a per-order override, and the dynamic rate card (`tax.delivery_fee_settings`) is read by checkout (`DeliveryFeeSettings`, `internal/pricing.ComputeDeliveryPrice`, `haversineKm`) | Go + Postgres |
| settlement → Go+Cockroach | `internal/settlement` | `payments` (+ `settlement_ledger` incl. `tds_paisa`/`product_tax_paisa`/`platform_gst_paisa`, `payouts` with `razorpay_transfer_id`/`release_after`/`released_at`/`reversed_at`; migrations `0039` + `0040` + `0051`) | `faazio:v1:settlement:{sellerId}:{cycle}` 600 s (invalidated on hold/release/reverse/webhook) | portal-only: `POST /payouts` (legacy schedule), `POST /payouts/holds` (Route `on_hold` transfer + ledger), `POST /payouts/{id}/release`, `POST /payouts/{id}/reverse`; public `POST /webhooks/razorpay/route` (HMAC; reconciles `transfer.released/failed/reversed`); `Releaser` worker releases due holds every 15 min when Route is configured | CockroachDB + Razorpay Route |
| delivery partner → Go+Postgres | `internal/delivery` | `delivery` (+ `delivery_boys` with `user_id`/`auth_uid`, `delivery_documents`, `delivery_bank_accounts`, `delivery_orders` incl. `payout_basis` (audit JSONB written at payout calc) + `payout_amount_paisa`, `delivery_stops` with hashed handover OTP + `otp_attempts`, `rider_heartbeats`, `delivery_ratings`, `payout_settings` + `delivery_payouts` (0052), `0055` adding `district_code`, `payout_mode` (AUTOMATED/MANUAL), `manual_distance_km`, `manual_fare_paisa`, `calculated_fare_paisa` and `fare_override_reason` on jobs + payouts; migrations `0042`/`0043`/`0045` with `dispatch_attempts` + `excluded_rider_ids` for the bounded reject fallback and the OTP attempt lock) | `delivery:rider:{riderId}:location` 300 s (authoritative live coordinate) · `delivery:route:{lat,lng}:{lat,lng}` 300 s (Routes API matrix leg) — PII/OTP never cached | `registerDeliveryPartner` (`POST /delivery/register`), `getDeliveryPartnerMe` (`GET /delivery/me`), `setDeliveryAvailability` (`PUT /delivery/availability`), `sendDeliveryHeartbeat` (`POST /delivery/heartbeat`), `getActiveDeliveryOrders` (`GET /delivery/active`), `getDeliveryRoute`, `acceptDeliveryOrder`, `rejectDeliveryOrder`, `updateDeliveryStop`, `verifyDeliveryOtp`; admin `listDeliveryApplications`, `getDeliveryApplication`, `verifyDeliveryApplication`, `rejectDeliveryApplication`, `uploadDeliveryDocumentReplacement`, `activateDeliveryPartner`, `listDeliveryBoys`, `getDeliveryBoyLocation` (+ `PUT /delivery/boys/{id}/suspend|blacklist`); owner rating `POST /delivery/{orderId}/rate`; rider payouts `getDeliveryPayout` (`GET /delivery/payouts/{orderId}`, reuses the stored checkout distance + surge (legacy fallback: route distance/clock), upsert + `payout_basis` write; `?weather=1&festival=1` forces an admin test derivation), `getDeliveryPayouts` (`GET /delivery/payouts`), admin `GET|PUT /delivery/payout-settings`, `POST /delivery/payouts/{orderId}/settle` (district-scoped or super admin; recorded Mark Paid, no Razorpay transfer), manual allocation `GET /admin/delivery/orders`, `GET /admin/delivery/orders/{orderId}`, `GET /admin/delivery/orders/{orderId}/riders`, `POST /admin/delivery/orders/{orderId}/allocate`, `PUT /admin/delivery/orders/{orderId}/payout-mode`, `POST /admin/delivery/orders/{orderId}/manual-fare`, `GET /admin/delivery/payouts` | Go + Postgres (Valkey live coordinates; shared notifications outbox for order pings) |
| shared pricing libs (rule engine) | `internal/geo`, `internal/pricing` | — (pure functions, no I/O) | — | — | stays in-proc; extracted only if a standalone quote service is ever needed |
| weather surge → Go | `internal/weather` | `ops.weather_api_usage` (one row/day; live counter in Valkey) | `faazio:v1:weather:zone:{cell}` 1800 s · `faazio:v1:weather:override:{cell}` 1800 s · `faazio:v1:weather:calls:{FY}` until Apr 1 IST | server-internal via `contracts.WeatherChecker` (checkout); admin `GET /admin/weather/usage`, `PUT /admin/weather/override` (super admin) | Go + Weather Union provider (60k calls/FY hard cap) |
| festival calendar → Go | `internal/festival` | `ops.festival_calendar` | none (tiny DB read, no cache) | server-internal via `contracts.FestivalLookup` (checkout); admin `GET|POST|DELETE /admin/festival/calendar` (super admin) | Go |
| error/telemetry sink → Go | `internal/errorsink` | `ops.error_events` (0062 — best-effort insert; the structured `error_event` slog line is the always-on path) | none (pay-load-capped + `sensitiveThrottle`-limited POST /errors) | `reportError` (all three apps; non-PII message+stack, fire-and-forget, optional auth) | Go (shared log sink) |
| support → Go+Postgres | `internal/support` | `support` (+ `tickets` incl. server-derived `state_code`), `checkout.returns` | none (auth-scoped, never edge-cached) | portal-only (state/super ticket queue). Scope is server-enforced: `state_code` is derived on create (seller state, else the customer's latest order vendor state), district admins only list/mutate tickets + returns in their state (`auth.CanActForState`), and `POST /returns` verifies the order belongs to the caller (seller derived from the order's vendor snapshot). | Go + Postgres |
| media → Go+R2 | `internal/media` (+ `internal/platform/r2` signer, `internal/platform/cloudflare` purger) | `media` (+ `media.assets`; nullable `image_key`/`image_asset_id` links on `catalog.products`, `directory.stores`, `directory.menus`) | `faazio:v1:media:asset:{id}` 24 h (purged on confirm/status/delete); PRIVATE assets never cached | `POST /media/upload-url` (auth; 300 s presigned PUT), `POST /media/confirm` (DRAFT→ACTIVE + owner link), `GET /media/resolve?ids=` (anon batch → public URLs), public `GET /assets/*` (stable no-CDN path → 302 presigned GET on the public bucket; unused when `R2_CDN_BASE` is set), `GET /media/private/{id}` (creator/admin; 300 s presigned GET), admin `PUT /media/{id}/status` + `DELETE /media/{id}` + `POST /media/gc` (manual GC pass); owning contexts link a confirmed asset via `imageKey`/`imageAssetId` (`internal/catalog`, `internal/directory` use `contracts.MediaReader`); background GC sweeper (orphaned DRAFT > 24 h → delete R2 object + row, every 6 h) and CDN purge worker (`LISTEN media_updated` → Cloudflare `purge_cache`); `GatewayClient.getMediaUploadUrl`/`confirmMedia`/`uploadSellerDocument` (private KYC uploads) + `getPrivateMediaUrl` (creator/admin presigned GET — mobile admin KYC review) | Go + R2 |
| recommendations → Python+Mongo | `internal/reco`, `internal/sdui` | MongoDB `sdui_layouts`, `user_events`, `recommendations`, `product_stats`; `sdui` composes `catalog` + `directory` (`HomeSection` joins each section's `productIds` **and** `storeIds` via `contracts.ProductReader`/`contracts.StoreReader` — `directory.Repo.ByIDs`, PII-free projection; the anon campaign projection joins each `SduiSection.campaigns[]` def to its store + products) | `faazio:v1:reco:{userIdHash}:{context}` 1 h · `faazio:v1:gateway:sdui:{locale}:/home` 300 s, `...:/mart` 300 s, `...:/food` 300 s and `...:/pharma` 300 s (same compile + store join; all purged on publish) · `faazio:v1:home:campaigns:{locale}` 600 s (+ `:{id}`, purged by prefix on publish) | `getHomeFeed` (`GET /sdui/home`), `getMartFeed` (`GET /sdui/mart`, only `martHero`/`martDeals`/`martEssentials`), `getFoodFeed` (`GET /sdui/food`, only `foodHero`/`foodSpecials`/`mostRatedDining`), `getPharmaFeed` (`GET /sdui/pharma`, only `pharmaHero`/`pharmaPopular`/`pharmaEssentials`; no-fallback `fetchPharmaSections` for read provenance) and `getHomeCampaigns`/`getHomeCampaign` (`GET /home/campaigns(/{id})`, anon compiled editorial campaigns joined to store + products), `trackEvent` (app) + `getRecommendations`; portal monitoring `GET /admin/user-trail?userId=&limit=` (admin-only, ID-only `user_events` read); super-admin Home-layout editor `GET`/`PUT /admin/sdui/home` (raw ID-only sections, `contracts.LayoutWriter` → `reco.Repo.SaveHome` `$inc version` + purges all compiled-feed caches + the campaign namespace; audited `SDUI_PUBLISH`) | Python FastAPI |
| shared | `internal/platform/{db,cache,auth,config,otel,r2,cloudflare,razorpayroute,testenv}`, `internal/contracts` | — | — | — | gRPC via `contracts/` |


**Delivery partner (0042/0043, production built).** A separate partner experience ships from the same bare
RN workspace with its own Metro entry (`index.delivery.js` → `src/DeliveryPartnerApp.tsx`), Android
flavor and iOS configuration; neither product bundles the other's screens. The gateway owns KYC
review, vehicle-capped capacity, availability, Valkey live coordinates, detour-aware candidate
scoring (Google Routes API, `GOOGLE_ROUTES_API_KEY`; straight-line fallback when unset),
globally optimized multi-stop re-sequencing (`ActiveStopsByRider`/`OptimizeGlobalRoute`/
`ResequenceActiveStops`/`ResequenceAssignedRoute`; insertion `OptimizeStopSequence` is the
oversize-solver fallback), pending-offer exclusion
(`PendingOfferRiderIDs`), forward-only stop transitions, bounded reject→reassign fallback
(including the 45 s expiry worker; re-offers re-sequence into a loaded rider's route), 5-attempt
customer-OTP handover and ratings. The admin rider
projection (`RiderCurrentStopStatuses`) powers Available / At Pickup / At Delivery / Busy tabs and
the route endpoint returns an encoded polyline. The checkout `PACKED`
transition calls the internal `contracts.DeliveryDispatcher` (single-store orders) with the stored
drop fix; assignment is idempotent per customer order and best-effort. Order pings enqueue
through the existing `contracts.Notifier` outbox, and the partner app registers its FCM token
through the existing `notifications` context, so no second push stack is introduced. Android runs an
ongoing location foreground service that wakes the heartbeat headless task while online; iOS uses a
background-enabled CoreLocation watch behind explicit consent. Phase 5 (payout split) is explicitly
not built; `payout_amount_paisa` is display-only. Force-quit iOS behaviour remains an ops limit
tracked in `client/mobile/PENDING_WORK.md`.

Auth verifier ownership: `internal/platform/auth` owns token verification only — Firebase RS256
(`FirebaseVerifier`, Google public certs, no firebase-admin dependency), then gateway-native portal
HS256 (`PortalVerifier`, `iss=faazio-portal`/`aud=portal`, jti denylist), then the legacy Supabase HS256
fallback. A portal subject is already the `admins.portal_users.user_id` (the resolver is skipped);
every other subject goes through the checkout `UserProvisioner` → `checkout.users`.

Mongo `user_events` stores **ID-only** `{ userIdHash, productId, event, at }` with a 90-day TTL; the
raw user id is never stored (hash only). **Nothing rating-related is ever logged.**

All `GatewayClient` methods in the table are now implemented (reads + writes; `getVendorReviews`,
`rateVendor`, `getCart`/`addToCart`/`updateCartItem`/`removeCartItem`, `placeOrder`, `trackEvent`
included). Cache behaviour is built per the TTL matrix: `GET /stock/:id` is read-through and every
order decrement invalidates `stock:{id}`.

**App-gap deltas (W25, `0019`)** add the `getVenues`/`getNotifications` client methods to the
catalog/directory row: `GET /venues?app=` reads the PII-free `directory.dining_venues` projection
(cached `directory:venues:{app}` 24 h), and `directory.menus` gains `description`/`emoji`/
`delivery_time` so the Food restaurant screens can leave the fixture. The blood board is unchanged —
it stays redacted (no PII widening).

`directory.dining_venues` is restaurant identity only: it serves food discovery/menu lookup and has
no booking/reservation fields. There is no `/book-table`, `/reserve`, or `/dining` endpoint, and
`checkout.orders.fulfillment_mode` is `DELIVERY | PICKUP` only — so this change needs **no ownership,
table, cache-key, or endpoint update** in §1.

**Portal-only management endpoints** (role-scoped, audited via `admins`; no `GatewayClient` method):
`POST /seller/products` (catalog create: owned-store scope, `PENDING_REVIEW`, catalog+stock txn) + `GET /seller/products` + `PUT /seller/products/{id}/status` (catalog), `GET /seller/stores` +
`PUT /seller/stores/{id}/live` (directory), `GET /seller/orders` + `PUT /orders/{id}/status` (checkout, maps mobile `Processing ↔ NEW/PACKED`),
`GET/seller/orders/{id}` + accept/reject (seller app), `GET /seller/prescriptions` +
`PUT /prescriptions/{id}/status` (pharma), `DELETE /blood-requests/{id}` (blood moderation), plus the
sellers/promo/ads/settlement/
support/admin contexts above. Every write is scoped to the caller's `seller_id` unless the role is
`DISTRICT_ADMIN`/`SUPER_ADMIN`. The sellers-context writes exposed to the mobile client are
`POST /sellers` (partner onboarding, `GatewayClient.submitSellerApplication`) — any authenticated
applicant may create a `PENDING_REVIEW` seller — and, for `DISTRICT_ADMIN`/`SUPER_ADMIN` callers in the
Account "Seller applications" queue (`SellerRequestsScreen`/`SellerRequestDetailScreen`), the
role-scoped review methods `GET /sellers`, `GET /sellers/{id}`, `PATCH /sellers/{id}/platform-fee`,
`POST /sellers/{id}/verify-doc/{docType}`, `POST /sellers/{id}/verify-kyc`, `POST /sellers/{id}/reject`
(KYC bytes still render via `getPrivateMediaUrl` presigned GETs, never as URLs); every one of these
re-checks role + state scope server-side. KYC/bank writes outside that admin path stay portal-only. The Home
SDUI editor is super-admin-only: `GET`/`PUT /admin/sdui/home` (`internal/sdui`) reads/writes the
raw `sdui_layouts` doc and publishes a version bump the app picks up on its next poll. The doc is
ID-only except for optional editorial `banners[]` (`martHero`, `foodHero`, `pharmaHero`) and
`campaigns[]` (the `hotBrandDeals` vendor campaigns) on a section; the editor
adds no new
endpoint/table/cache key of its own. The public `GET /sdui/mart` read (`internal/sdui`, cache
`faazio:v1:gateway:sdui:{locale}:/mart`) serves the Mart-only section subset, `GET /sdui/food`
(cache `faazio:v1:gateway:sdui:{locale}:/food`) the Food-only subset (`foodHero` fields the house
hero, `foodSpecials` the "Today's Special" dish order, `mostRatedDining` the restaurant store rail) and
`GET /sdui/pharma` (cache `faazio:v1:gateway:sdui:{locale}:/pharma`) the Pharma-only subset
(`pharmaHero` house banners, `pharmaPopular`/`pharmaEssentials` OTC product rails; Rx-gated products
excluded). The anon `GET /home/campaigns(/{id})` (`internal/sdui`, cache
`faazio:v1:home:campaigns:{locale}` 600 s) compiles the `hotBrandDeals.campaigns[]` defs into a
display-only campaign projection joined to store + products (distinct from the seller-scoped
`GET /ads/campaigns` hero control plane);
`contracts` + `internal/reco` own the layout shape.

**Partner completion (v3, `0017`)** adds four portal-only control surfaces: customer monitoring
(`GET /customers` in `internal/admins`, reads the redacted `checkout.users_admin` view — state/super
only, never cached), food-menu editing (`GET /seller/menus` + `POST /seller/menus` /
`PUT /seller/menus/{venueId}/{dishId}` in `internal/directory`, seller-scoped, invalidates
`directory:menu:{venueId}`), rewards administration
(`GET /rewards/ledger` + `GET`/`PUT /rewards/rates` in `internal/rewards`; the server stays the sole
`rewards.ledger`/`balances` writer), and a state-scoped support queue (`GET /support/tickets?state=`
in `internal/support`). All are role-gated (`DISTRICT_ADMIN`/`SUPER_ADMIN`, or the owning seller) and
audited via `admins.audit_logs`.

**Pharma quote → READY reveal → notify (W24, `0018`)** adds the partner quote workflow. The seller
projection (`GET /seller/prescriptions`) is **name-only until READY/FULFILLED** (contact columns are
blanked by the query's `CASE`); `POST /seller/prescriptions/{id}/quotes` replaces the priced lines
(`pharma.quote_items`), recomputes `quoted_total_paisa` and advances to `QUOTED`; `PUT
/prescriptions/{id}/status READY` requires ≥1 line, stamps `revealed_at`/`revealed_by`, appends
`pharma.status_history` + an `RX_READY` audit row, and enqueues `notifications.outbox`. The new
`internal/notifications` context is the single writer of the outbox/push-token registry and exposes
`contracts.Notifier`; checkout order-status changes also enqueue through it. `GET
/prescriptions/{id}` returns one **owner-scoped** prescription (quote/total/status/history) so the
app polls a single row instead of the whole list; a non-owner id is a 404. `GET
/prescriptions/{id}/images` mints short-lived signed download URLs for the private bucket (owner,
assigned vendor or admin only). Repo wiring per `db-schema.md` §12.12.

**Public promo/ads reads, user trail + outbox worker (W29, `0021`).** The app's promotional surfaces
had no anon-readable contract: `promo.coupons` gained `title`/`min_order_paisa`/`free_delivery`
(`0021`) and a public `GET /coupons?app=&state=` projection (`internal/promo`), and `ads` gained a
public `GET /ads/live?slot=` LIVE projection. The app consumes coupons through
`GatewayClient.getCoupons` (cart coupon sheet; `@data/cart/coupons` fallback) and LIVE ads through
`GatewayClient.getLiveAds`/`getSponsoredProducts` (Home `SponsoredRailSection`, `HOME_TOP`; paid
placements have **no** fixture fallback — empty collapses the rail). Seed: `sel-3` (ACTIVE MART
seller) + three LIVE `HOME_TOP` slots (`ad-demo-home-*`) in `0001_seed.sql`. Monitoring:
`internal/reco` exposes admin-only `GET /admin/user-trail?userId=&limit=` reading the same ID-only
`user_events` (hash match; no raw user id), surfaced as an activity-trail panel on the portal
customers page. Delivery: `internal/notifications` gained a provider-agnostic outbox **drain worker**
(`Sender`s; the embedded **FCM HTTP v1 sender** — `FCM_SERVICE_ACCOUNT_JSON` +
`FCM_PROJECT_ID`) that moves
`PENDING`→`SENT`/`FAILED`. A transient send failure retries with capped backoff, while an FCM
`UNREGISTERED` response expires the row immediately and prunes the dead `push_tokens` row
(`Repo.ExpireToken`, one tx) so a dead device never burns retries; the manual `POST
/notifications/drain` runs a bounded 10-row batch and stops cleanly if the request window ends. The customer
app now registers its FCM token (`services/customerPush.ts` → `POST /notifications/register`) and
renders the durable `GET /notifications` inbox in `NotificationsScreen`; `DELETE
/notifications/register` runs on sign-out. Push delivery is optional — the inbox still works when
no sender is configured, and then the manual `POST /notifications/drain` returns `503
push_unconfigured` without touching `PENDING` rows (an empty sender is a nil interface, not a
typed nil, so `Worker.Enabled()` is truthful). Background and admin drains are serialized
in-process so the same batch is never double-delivered. Prod auth is unchanged in code (dev
`X-Dev-*` headers are only honoured when `AUTH_DISABLED=true`, which now logs a loud warning).

**Shopper price authority + discount integrity (W31, `0022`).** Festival opt-ins were control-plane
only: an approved `discount_percent` never reached the app, and two surfaces fabricated discounts
on-device. `internal/promo` now exposes an anon `GET /promo/active-discounts?ids=` projection
(`ActiveDiscounts`, best-wins per product, capped by the effective `sector_caps` row in SQL) cached
per product (`faazio:v1:promo:active:{productId}` 300 s, invalidated on opt-in/campaign status
change). Base catalog prices stay pure — the app overlays the projection (`GatewayClient.
getActiveDiscounts` → `services/pricing.ts` `applyActiveDiscount[s]`/`useActiveDiscounts`) in the
Mart vendor rail and `DealsLanding` (`discounts` mode); no discount means base price. `directory.
menus` gained `mrp_paisa` (`0022`) so the Food "Recommended & Offers" rail shows an authored MRP
(`mrp > price`) instead of the removed `price × 1.2` synthesis; the Home `Daily Essentials` rail now
resolves its `md-*` ids through the catalog (`getProductsByIds`) with the authored fixture only as
the offline fallback (the `md-*` rows were already seeded via `generate.mjs`).

**Coupon settlement + closed-loop ads (W32).** The coupon sheet was display-only and paid placements
had no event trail. `internal/promo` now implements `contracts.CouponValidator`
(`ValidateCoupon`/pure `DecideCoupon`: not-found/inactive/expired/wrong-sector/wrong-state/min-order),
exposed to the cart via authenticated `POST /checkout/validate-coupon` (`{code, app, state, subtotal}`
in whole rupees → `{valid, reason, discount, …}`). `checkout.CreateOrder` re-validates the coupon
**before** the stock decrement and settles `paid = subtotal − couponDiscount − coins`, so a stale
display can never discount an order the server didn't sanction (`ErrInvalidCoupon` → 400
`invalid_coupon`). Ads became closed-loop: authenticated `POST /ads/events` records impression/click
(`internal/ads.RecordEvent`, impressions de-duped per user via `faazio:v1:ads:seen:{userId}:{slotId}`
300 s), and `contracts.AdAttributor.AttributeOrder` bumps `orders_attributed` best-effort after the
order commits using the shopper's last-clicked slot (`services/adsAttribution.ts`). The paid shelf
moved to a boundary-safe shared `components/shared/SponsoredRail` (ad-server fill + events +
disclosure) so Home (`HOME_TOP`), the Mart showcase (`SPONSORED_SHOWCASE`) and the vendor-deals rail
(`SECTOR_RAIL`) share one pipeline; the seed adds demo `SPONSORED_SHOWCASE`/`SECTOR_RAIL` slots. The
partner portal's promo/ads writes now await the gateway and roll back with a toast on failure
(`writeAwaited`, Phase 5) instead of fire-and-forget. No schema change (settlement reuses
`promo.coupons` + the existing `ads.sponsored_slots` counters).

**Server quench + Rx privacy (W34, `0023`).** Closes the last app-quench/monitoring thin reads with
additive handlers in existing contexts (no new service): `internal/directory` `GET /venues/{id}`
(single restaurant venue, PII-redacted for anon, cached `faazio:v1:directory:venue:{id}` 24 h),
`internal/pharma` `GET /seller/prescriptions/{id}` (one Rx in the same name-only-until-READY seller
projection; cross-seller id is a 404), `internal/checkout` `GET /orders/tracking/{id}` (owner-scoped
lightweight status projection — no line items/PII; status mapped to the mobile vocabulary), and
`internal/notifications` `POST /notifications/drain` (admin-only one-shot outbox drain via
`contracts.Drainer`; 503 when no push provider). Pharma quote integrity tightens: `price <= mrp`
(when mrp authored) is rejected at the handler and by `0023` CHECK constraints (`NOT VALID`), and a
repeated `READY` is idempotent (no duplicate `status_history` row, no duplicate `RX_READY` notify).
`0023` also adds `prescriptions_vendor_status_idx (vendor_id, status, created_at desc)` for the seller
queue/deep-link. Additive only.

## 2. Boundary rules (enforced)

1. A context lives **only** under `internal/<context>/{handler,service,repo}.go` (handler = HTTP,
   service = logic, repo = SQL). No other package may import `internal/<context>/repo`.
2. **Cross-context calls go through a Go interface declared in `internal/contracts`** (e.g.
   `contracts.CatalogReader`, `contracts.StockWriter`) — the exact shape a future `.proto` will take.
   Contexts receive dependencies as interfaces, never as concrete sibling repos.
3. No context imports another context's package directly, except `internal/contracts`,
   `internal/platform/*`, and the pure shared libs `internal/geo` + `internal/pricing` (no I/O or
   schema ownership). `internal/sdui` composes via `contracts` interfaces only.
4. `internal/platform/*` (db/cache/auth/config/otel) has no domain knowledge — no context imports.
5. Enforcement: `go vet ./...` + a CI **import-lint** step (`go run ./tools/importlint` or `go list`
   based check, see `server/gateway/README.md`) that fails if a forbidden cross-context import exists.

## 3. Per-service extraction playbook

Extract the **first** context (search) as the reference. The others repeat the same steps.

1. **Contract freeze check** — confirm the context's rows in §4 are unchanged for the release.
2. **Dual-run** — stand the new service up behind the same `contracts` interface; the monolith gets a
   `SEARCH_SERVICE_URL` env override. Both paths serve traffic (shadow or %-split).
3. **Strangler cutover** — flip the flag to the new service for one app/module at a time; Cloudflare
   keeps caching public GETs, so keys/TTLs are unchanged and the app is unaware.
4. **Rollback** — unset the env flag (interface falls back to the in-process context). No app release.
5. **Delete the in-process context** only after the promotion trigger stays green.

| Promotion trigger (§6 `mvp-backend.md`) | Extract |
|---|---|
| FTS latency/ranking or search QPS is a bottleneck | search → Rust/Tantivy |
| relational write scale / multi-region consistency outgrows one Postgres | checkout → CockroachDB |
| stock/cart contention reaches 1000s of concurrent decrements | cart/stock → DynamoDB/Firestore |
| vendor-reviews traffic / cluster ownership must split | reviews → standalone Postgres |

> **admins/portal-auth extraction coupling (`0036`):** the `admins` and `portal auth` rows share one
> schema (`admins.district_admins` + `admins.portal_users`) and one write path — a district-admin creation
> mints both in a single tx in `internal/admins` (Provisioner). They must extract **together** (single
> service or one migration event); extracting `district_admins` alone would strand the portal login rows it
> now provisions. Before cutting over, backfill any legacy orphan pairs (roster with no login, or login
> with no roster) so the unified creator's assumptions hold.

> **checkout account deletion (`0060`/`0061`):** a cutover must carry `checkout.users.deleted_at`, the
> anonymising `DELETE /users/me` path (PII table erasure + free-text blanking + retained-order
> coordinate/DROP-stop OTP clearing + `blood.requests.created_by` erasure + `route_sequence`
> reset + `auth_uid` unlink), the partial-erasure
> `POST /users/me/data-deletion` path, prescription-blob deletion through the active storage
> backend (R2 or Supabase Storage), the fresh-id re-provisioning path, and the cache purge for
> `checkout:orders`, `favourites`, `rewards`, `notifications`, `pharma:prescriptions`, and
> `auth:uid`. Financial rows (`checkout.orders`/`payments`, `tax.tax_invoices`) stay behind by
> design.

## 4. Contract freeze (change any row here → update this doc in the same PR)

| Contract | Frozen value | Reason it must not drift |
|---|---|---|
| Public IDs | stable string slugs (`md-1`, `store-m3`, `user-1`, `ORD-001`) | CDN URLs, Valkey keys, `GatewayClient` args |
| Money | DB: **INT8 paisa** (₹1 = 100). JSON: whole **integer rupees** (`price`/`mrp`, no paisa, no float). Repo layer is the only conversion boundary (paisa → rupees on read, ×100 on write) | no float drift; `@data/*`/`GatewayClient` already use integer rupees, so the client shape is unchanged; Tantivy/Cockroach parity. **Money is never narrowed** — `INT4` paisa caps at ₹21M |
| Non-money column types | migration `0005`: `rating` REAL, counts/qty `INT4`/`SMALLINT`, `slug_uid` and `products_name_trgm_idx` dropped | byte diet only — JSON DTOs/`GatewayClient` are type-agnostic, so the wire shape is unchanged |
| Time | `TIMESTAMPTZ`; JSON ISO-8601 | fixed width; no epoch/ISO mixing |
| Enums | `app_brand`, `order_status`, `fulfillment_mode` (Postgres ENUM) | validated, 1–4 B |
| Partner enums (`0015`) | `seller_status`, `product_status`, `kyc_doc_type`, `campaign_status`, `campaign_scope`, `optin_status`, `ad_placement`, `ad_status`, `payout_status`, `ticket_status`, `return_status`; `order_status` gains `NEW`/`PACKED`/`RETURNED` (Option A, mobile `Processing` ⇄ `NEW`/`PACKED`) | one lifecycle both apps read; validated at the DB |
| Partner roles | JWT claims `app_role` (`SELLER`/`DISTRICT_ADMIN`/`SUPER_ADMIN`) + `seller_id`/`district_code`/`state_code`; `auth.RequireRole`. Portal tokens additionally pin `iss=faazio-portal`, `aud=portal`, `exp`, `jti`, `must_change` (confines scoped roles to `/auth/portal/*` until rotated; `SUPER_ADMIN` is exempt) | role checks in Go (`service_role` bypasses RLS); never trust a request-body actor; a portal token can never verify with the legacy Supabase secret |
| District codes | Production: **42 districts — Tamil Nadu (38) + Puducherry (4)**. Gateway authority `internal/platform/geo/geo.go` (also `Normalise`/`IsValid`/`StateForDistrict`); DB master `admins.district_master` (`0046`); frontend mirror `data/districts.ts` + `client/web/platform/src/data/districts.ts`; `admins.district_admins` carries one seeded active `TTC` roster row (`0065` — 42-district contract unchanged). Legacy 2-letter ISO state scope remains for non-TN/PY admins | a district typo must not create an orphan roster row; district→state derivation keeps seller/campaign state scope coherent |
| `GatewayClient` | method names + signatures in `client/mobile/src/services/api/GatewayClient.ts` | screens swap `@mock` → `@server` without call-site edits |
| Cache | `faazio:v1:{service}:{entity}:{id}` + TTL matrix (`caching-cloudflare-valkey.md` §4–§5). Includes `faazio:v1:auth:uid:{sha256}` (3600 s), portal `faazio:v1:auth:login:{ip,email}:{sha8}` (60 s) + `faazio:v1:auth:deny:{jti}` (≤15 m), `faazio:v1:pharma:prescriptions:{userId}` (60 s), `faazio:v1:notifications:inbox:{userId}` (30 s) | Cloudflare purge + Valkey invalidation map |
| Cache `v{N}` | bump to invalidate a key class | no scan needed |
| Idempotency | `SET faazio:v1:checkout:idem:{orderRef} 1 NX EX 300` | prevents double-place |

## 5. Where production differs from the scaling stage (kept documented)

- **Transport:** production contexts are in-process Go interfaces; the scaling stage is gRPC through
  `contracts/`. The interface names/shapes mirror the intended proto messages.
- **DB split:** production = one Supabase project (schemas `catalog`/`directory`/`reviews`/`checkout`/
  `accounts`/`inventory`) + MongoDB Atlas M0 + Aiven Valkey. The scaling stage = CockroachDB, Tantivy,
  DynamoDB, standalone Postgres — same datatypes, so the swap is invisible.
- **Auth:** real **Firebase phone OTP** (the Login UI exchanges the SMS code via `firebaseAuth.ts`;
  the gateway verifies the RS256 Firebase ID token with Google's x509 certificate set) + partner JWT
  claim roles (Firebase custom claims, gateway-native portal HS256 for superadmin/seller/state-admin, or legacy
  Supabase HS256); the gateway resolves `user_id` from the verified subject, upserting the `auth_uid`
  link on first call (`ProvisionUserID`) — portal tokens skip that resolver because their subject is
  already a `portal_users` id.
  Never trust a client-supplied user id. Local dev
  can still resolve the app as `user-1` (`AUTH_DISABLED=true`); the app sends `X-Dev-User` only in dev builds
  (`DEV_USER`). The two app writes behind `auth.Require` (`POST /ads/events`,
  `PUT /vendors/{id}/rating`) are reachable with the real Firebase ID token — W49 keeps the client
  honest about the outcome (confirmed-only boolean / rating `synced`/`offline`/`signed-out`/
  `not-verified`) without opening an anon endpoint.
- **Observability:** OTel hooks live in `internal/platform/otel`; exporters are env-gated (no-op when
  unset) so local dev adds no cost.

## 6. Honest limitations

- The scaling-stage services (Rust/Tantivy, CockroachDB, DynamoDB, Python) are **documented only, not
  built** — the monolith is the only running backend. `contracts/` is Go interfaces, not `.proto` yet.
- The extraction playbook is **documented, not rehearsed** — no shadow deployment exists.
- Boundary enforcement is by `go vet` + import-lint; it is not a compiler-enforced module system.
