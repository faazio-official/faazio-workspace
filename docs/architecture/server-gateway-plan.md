# Server & Gateway Plan Deep-Dive

> **Status:** MVP ACTIVE (built) / Future Prod (full) · **Scope:** `server/`.
> MVP authority: `docs/architecture/mvp-backend.md`; refactor mapping:
> `docs/architecture/monolith-breakdown.md`. The MVP is built — one Go Chi modular monolith
> (`server/gateway`) hosting all 6 contexts. Do **not** build the full microservices until explicitly
> requested. This doc condenses `server/README.md` and keeps the **Future Prod** target.

## Why this exists

The app will eventually be served by a backend instead of local `@data/*` mocks. This doc
captures the **target** microservices layout so scaffolding follows one plan and no concern
is silently re-invented. `server/` today holds the **built MVP monolith** (`server/gateway`) +
Supabase migrations/seed; the full microservices below remain the Future Prod target.

## Runtime surfaces

```
[ mobile app (client/mobile) ]
            │  HTTPS / JSON (SDUI)
            ▼
   [ gateway — Go Chi SDUI ]      ◀── serves the render tree (data/schema.ts)
            │
            ├── gRPC ────────────▶ [ search — Rust : Axum + Tantivy ]
            ├── gRPC ────────────▶ [ cart / stock — Go : chi + DynamoDB/Firestore ]
            ├── gRPC ────────────▶ [ checkout — Go : chi + CockroachDB ]
            ├── gRPC ────────────▶ [ reviews & ratings — Go : chi + PostgreSQL ]
            └── gRPC ────────────▶ [ recommendations — Python : FastAPI + MongoDB ]
```

- The **gateway** is the only public surface. It serves the structured SDUI tree currently
  mocked in `data/`, replacing `@mock` sources as modules are wired (`@mock` → `@server`).
- Internal service-to-service calls use **gRPC** (HTTP/2 + binary) for sub-2ms latency.
- Every `data/DATA_CONTROL.md` `@mock` entry becomes a handler contract.

## MVP modular monolith (active scope — built)

The MVP is a **single Go Chi modular monolith** (`server/gateway`) hosting all 6 bounded contexts as
packages — no gRPC, no separate services. `contracts/` holds Go interfaces (the future `.proto`
shape); contexts talk through them, never through sibling imports. It serves read + write endpoints
against **Supabase (Postgres) + MongoDB Atlas M0 + Aiven Valkey**, with Cloudflare in front; cache
keys/TTLs unchanged.

- **Endpoints:** reads `GET /health`, `/search?q=`, `/sdui/home`, `/sdui/mart` (Mart-only sections),
  `/sdui/food` (Food-only sections), `/sdui/pharma` (Pharma-only sections),
  `/home/campaigns` + `/home/campaigns/:id` (anon compiled editorial campaigns, store + products linked),
  `/product/:id`, `/product/:id/reviews`,
  `/vendors/:id/reviews` (+ `/summary`), `/stores`, `/stores/nearby?lat=&lng=&radius=&app=`,
  `/store/:id`, `/products/nearby?lat=&lng=&radius=&app=`, `/venues`, `/venues/:id/menu`,
  `/stock/:id`, `/orders`, `/profile`, `/profile/details`, `/profile/addresses` (GET/PUT/DELETE),
  `/membership`, `/order-status`, `/account-nav`, `/bookings`, `/venues/:id/booking-availability`,
  `/coupons?app=` (anon), `/promo/active-discounts?ids=` (anon), `/ads/live?slot=` (anon),
  `/admin/user-trail?userId=` (admin, ID-only), `/admin/sdui/home` (super-admin, raw ID-only layout);
  writes `POST/PUT/DELETE /cart…`, `POST /orders` (festival-discount + coupon settlement + ad
  attribution + optional live drop fix for auto-dispatch + dynamic delivery fee),
  `POST /checkout/validate-coupon`, `GET /checkout/delivery-fee?storeId=&lat=&lng=` (auth-scoped,
  server-authoritative road-distance delivery-fee quote), `POST /ads/events`, `PUT /vendors/:id/rating`, `POST /events`,
  `PUT /admin/sdui/home` (super-admin, publishes the Home layout: version bump + cache purge),
  `POST /bookings` (seat hold + Razorpay order), `DELETE /bookings/:id`,
  `POST /bookings/:id/payment`, seller `GET/PUT /seller/booking-config`, `GET /seller/bookings`,
  `PUT /bookings/:id/status` (accept/reject), `POST /bookings/:id/vacate`, `POST /webhooks/razorpay`.
- **Seller onboarding + split payments (`internal/sellers` + `internal/settlement` + `internal/platform/razorpayroute`):**
  `POST /sellers` now carries the platform fee, payout bank details (full account number is forwarded
  to Razorpay and never stored), private R2 passbook/FSSAI keys and `otpVerified`. The OTP is the
  digital signature: the handler rejects `otpVerified` unless the bearer Firebase ID token's
  `phone_number` claim matches `contactPhone` (`auth.OTPSigned`, `401 otp_unverified`; dev-mode
  `X-Dev-*` identities are the only exception). Admin review:
  `PATCH /sellers/:id/platform-fee`, `POST /sellers/:id/verify-doc/:docType`,
  `POST /sellers/:id/verify-kyc` (creates the Route linked account + activates),
  `POST /sellers/:id/reject`, and seller `POST /sellers/:id/edit` (rejected rows only; field history).
  `GET /sellers/:id` returns the seller + masked bank account + KYC docs + verification log; admin KYC
  images render via the existing `GET /media/private/{id}` presigned-GET (creator or admin only).
  Settlement adds SUPER_ADMIN `POST /payouts/holds` (Route transfer with `on_hold` for the 14-day
  window + ledger row), `POST /payouts/:id/release` and `POST /payouts/:id/reverse` (refund/return
  clawback); a gateway worker releases due holds every 15 minutes when Route credentials are
  configured. The public `POST /webhooks/razorpay/route` reconciles `transfer.released` /
  `transfer.failed` / `transfer.reversed` by HMAC. `RAZORPAY_ROUTE_KEY_ID`/`_SECRET`/`_WEBHOOK_SECRET`
  fall back to the main Razorpay pair.
- **Portal identity writes (`internal/admins` + `internal/portal`):** `POST /district-admins` is the
  unified district-admin creator — `issueLogin` optionally mints the `DISTRICT_ADMIN` portal
  credential in the same tx (legacy `/state-admins` route alias retained). Duplicate **email** across
  `portal_users`, the roster and `sellers.sellers` is hard-blocked (`409 email_has_district_login`
  / `email_has_district_roster`); duplicate **phone** is a soft `201 warnings[]` notice (shared
  lines are allowed by policy). See `0036`, `0048` + `db-schema.md` §12.19/§12.24.
- **District scope (`internal/platform/geo`, migrations `0046`–`0049`):** the wire role is
  `DISTRICT_ADMIN`; the 42 TN/PY district codes are validated against `admins.district_master` and
  the Go master. Sellers carry an optional `district_code`; admin reads/writes use
  `auth.CanActForSellerDistrict` (district claim first, legacy parent `state_code` fallback).
- **Platform-fee change requests:** sellers file `POST /sellers/{id}/platform-fee-request` and read
  `GET /sellers/{id}/platform-fee-requests`; the review queue is
  `GET /seller/fee-change-requests` (district-scoped) with
  `PATCH /seller/fee-change-requests/{id}/approve|reject`. Only approval mutates
  `sellers.sellers.platform_fee_pct`; one `PENDING` row per seller (`0049`).
- **Tax + invoicing (`internal/tax` + `internal/platform/taxmath`, `0051` + `0053`):** every order is priced server-side from
  `tax.tax_rates` + `tax.platform_settings` (GST-inclusive split, TCS 1% / TDS 0.1% withheld).
  **Platform commission is removed** — sellers keep their full GST-inclusive gross (product GST is a
  pass-through; platform fee/GST are zero in `taxmath.Compute`). The **delivery fee is dynamic**:
  PICKUP waives it; DELIVERY distances `directory.stores` pins to the customer's live drop fix
  (Haversine, fractional km rounded to paisa) and applies the `tax.delivery_fee_settings` rate card
  (default 3 km / ₹35 / ₹7 per extra km) plus night/rain/festival surge (`internal/weather` +
  `internal/festival`, drop hex cell). `POST /orders` settles the same math (`CreateOrder`) and stores
  the distance/surge/basis on the order; `GET /checkout/delivery-fee` is the client-facing quote. A
  `free_delivery` coupon zeroes the customer's delivery line (platform-funded) while the rider payout
  still reuses the stored distance/surge. The immutable invoice is readable at
  `GET /orders/{orderId}/invoice` (owner-scoped; presigned R2 URL only when a PDF exists). Portal:
  `GET /tax/categories`, `GET|PUT /admin/tax/categories`, `DELETE /admin/tax/categories/{id}`,
  `GET|PUT /admin/tax/settings` (SUPER_ADMIN writes). Settlement ledger carries the same
  TDS/product-GST/platform-GST figures (commission now zero).
- **Rider payouts (`internal/delivery`, `0052` + `0054`):** `GET /delivery/payouts` (rider history)
  and `GET /delivery/payouts/{orderId}` (upsert a PENDING calculation). The payout reuses the
  customer-billed distance + surge stored on `checkout.orders` (`delivery_distance_km`,
  `delivery_surge_paisa`, `delivery_surge_reason`), so base minus ₹5 and every extra/surge rupee are
  a 1:1 pass-through; legacy orders fall back to the delivery route distance + clock-derived night.
  `?weather=1&festival=1` forces an admin test derivation. Admin `GET|PUT /delivery/payout-settings`
  and super-admin `POST /delivery/payouts/{orderId}/settle` mark PAID.
- **Weather + festival surge (`internal/weather` + `internal/festival`, `0054`):** `GET
  /checkout/delivery-fee` and `POST /orders` call `contracts.WeatherChecker` (Weather Union,
  30-min per-hex cache, 60,000 calls/Indian FY) and `contracts.FestivalLookup` (active
  `ops.festival_calendar` window). Super-admin `GET /admin/weather/usage`,
  `PUT /admin/weather/override`, `GET|POST /admin/festival/calendar`,
  `DELETE /admin/festival/calendar/{id}`. Provider key is optional: unset means no rain surge.
- **Packages:** `internal/{search,catalog,directory,cartstock,checkout,reviews,reco,sdui,bookings,delivery,weather,festival,geo,pricing}`
  + `internal/{contracts,platform/*,server}`. Ownership table: `monolith-breakdown.md` §1.
- **Boundaries:** `go run ./tools/importlint` fails on sibling-context imports.
- **Mapping** (`@data/*` twin + `GatewayClient` method) and RLS classes: `docs/architecture/mvp-backend.md` §1–§3.
- **Build order / status:** `docs/architecture/mvp-backend.md` §7.


### Delivery partner (`internal/delivery`, migrations `0042`, `0043`, `0045`, `0052`, `0055`)

The partner domain is a first-class context in the same gateway (future service: Go + Postgres).
Rider endpoints authenticate with the Firebase phone ID token and resolve the rider by E.164 phone:
`POST /delivery/register` (KYC application), `GET /delivery/me`, `PUT /delivery/availability`,
`POST /delivery/heartbeat`, `GET /delivery/active`, `GET /delivery/route/{id}`,
`POST /delivery/{id}/accept|reject`, `PUT /delivery/stop/{id}/status`, `POST /delivery/otp/verify`
and `POST /delivery/{orderId}/rate`. Admin endpoints are `DISTRICT_ADMIN`/`SUPER_ADMIN` gated and
district-scoped: `GET /delivery/register/pending`, `GET /delivery/register/{id}`,
`PUT /delivery/register/{id}/verify|reject`, `PUT /delivery/register/{id}/documents/{docType}/reupload`
(admin uploads a replacement document), `GET /delivery/online-riders`,
`GET /admin/delivery-boys`, `GET /admin/delivery-boys/{id}/location`, `POST /dispatch/assign`
(plus super-only `PUT /delivery/register/{id}/activate` and `PUT /delivery/boys/{id}/blacklist`).

**Manual district allocation + dual payout mode (`0055`).** The portal allocation board reads
`GET /admin/delivery/orders` (PACKED orders with no delivery job, plus `ASSIGNED`/`REJECTED` offers;
district admins are forced to their claim, super admins may filter any district). Opening an order
loads `GET /admin/delivery/orders/{orderId}` and nearest-first `GET
/admin/delivery/orders/{orderId}/riders` (road distance from the store; riders are deliberately not
district-restricted, and a rider already holding another unaccepted `ASSIGNED` offer is excluded so
offers cannot stack above capacity). Date filters are IST calendar days. `POST
/admin/delivery/orders/{orderId}/allocate` requires a rider **and** `payoutMode`
(`AUTOMATED`|`MANUAL`), creates the job for an un-dispatched PACKED order or re-offers an existing
job with a fresh 45 s window. Before payment, `PUT …/payout-mode` can switch mode and
`POST …/manual-fare` records the admin-travelled distance + optional fare override for MANUAL orders.
`GET /admin/delivery/payouts` is the settlement board (completed jobs with no payout row projected
as PENDING). `POST /delivery/payouts/{orderId}/settle` marks PAID for the caller's district or, for
super admins, anywhere; MANUAL orders return `409 manual_fare_required` until the fare is recorded.
This is a recorded settlement only — no Razorpay transfer.

`POST /dispatch/assign` is mounted under the admin roles for manual/operator dispatch, but checkout
also invokes the same dispatch path in-process through `contracts.DeliveryDispatcher` on `PACKED`.
The HTTP route is not used service-to-service — the dual mount is intentional.

**Rules**
- Capacity is hard-capped at intake by vehicle: `BICYCLE=1`, `TWO_WHEELER=2`, `FOUR_WHEELER=5`.
  Motorised vehicles require DL/RC/insurance capture; all riders require Aadhaar/PAN/live selfie.
- KYC images are private R2 keys only; the portal renders them through
  `GET /media/private/{id}` presigned GETs. Documents are verified individually; profile approval
  requires every document verified and the bank account not rejected; `ACTIVE` is super-admin only.
  Re-upload is admin-side: when a document is `REJECTED`/`REUPLOAD_REQUESTED`, the admin collects a
  clear photo offline, uploads it to the private bucket, and calls the replacement endpoint with
  `{fileKey, assetId?, notes?}`. The row returns to `PENDING` with its rejection reason cleared (a
  `VERIFIED` document cannot be replaced); the rider app has no re-upload screen. The legacy
  `/reupload-request` endpoint returns `410`.
- `POST /delivery/heartbeat` writes the live coordinate to Valkey
  `delivery:rider:{id}:location` with a 300 s TTL (the dispatch authority) and stamps the optional
  Postgres mirror. A stopped heartbeat removes the rider from candidates; the explicit availability
  toggle owns `is_available`.
- Dispatch scores `ACTIVE`, available, under-capacity riders by **road duration actually added to
  their route** (Google Routes API `distanceMatrix/v2:computeRouteMatrix`, `TRAFFIC_AWARE`, cached
  per leg for 300 s under `delivery:route:{lat,lng}:{lat,lng}`). For a rider with open accepted
  stops it computes `legA = last drop → new store`, `legB = new store → new customer` and
  `detour = legA + legB − last drop → new customer`, scoring `legA + detour`; a rider with no open
  stops is scored by rider → store. Capacity headroom and rating break ties. Riders already holding
  an unaccepted `ASSIGNED` offer are skipped (`PendingOfferRiderIDs`): `current_load` only rises on
  accept, so without it one rider could accumulate offers while peers stay idle. With
  `GOOGLE_ROUTES_API_KEY` unset (local/dev) it degrades to a Haversine/urban-speed estimate.
- Assignment then runs a **full VRP** (`OptimizeGlobalRoute`) over every open stop of all the
  rider's accepted jobs plus the new pickup/drop. A Held-Karp bitmask DP (`O(2ⁿ·n²)`; ten open stops
  at the five-order four-wheeler cap, with a >15-stop guard that falls back to the insertion
  heuristic) minimizes
  total road time. Unstarted stops may be interleaved and reordered across orders; the prefix up to
  and including the last started stop (`AT_PICKUP`, `PICKED_UP`, `AT_CUSTOMER`) is pinned, and each
  order's pickup must precede its drop. The chosen sequence is written to `delivery_stops.sequence`
  (renumbered globally across the rider's accepted jobs) and each order's `route_sequence` JSON.
  Every assignment creates a 45 s accept lock and a durable order-ping in the shared notifications
  outbox (FCM/webhook drained by `internal/notifications`). `GET /delivery/route/{id}` returns the
  ordered stops plus a Google-encoded `polyline`; the partner app merges `GET /delivery/active` into
  one route ordered by the global sequence.
- When a seller marks a delivery order `PACKED`, checkout calls the internal
  `contracts.DeliveryDispatcher` (never HTTP) with the stored drop coordinates and the single
  store's pickup. The call is idempotent per customer order and runs in the background, so a slow
  Routes lookup or a rider shortage never blocks the status transition; no eligible rider leaves
  the order for manual admin assignment.
- `POST /delivery/{id}/reject` appends the declining rider to
  `delivery_orders.excluded_rider_ids`, then re-scores the remaining candidates and re-offers the
  same job (`dispatch_attempts` increments). The chain stops after
  `DELIVERY_MAX_DISPATCH_ATTEMPTS` (default 5) or when no eligible rider remains; a job is never
  re-offered to a rider who already declined it. Re-offers run the same global VRP and
  `ResequenceAssignedRoute` when the next rider already carries stops, so the fallback path cannot
  append the job out of order. The gateway expiry worker releases an `ASSIGNED` offer whose 45 s
  window elapsed and runs the same fallback chain, excluding the unresponsive rider.
- Stop transitions are enforced server-side and forward-only: pickup `PENDING → AT_PICKUP →
  PICKED_UP`, drop `PENDING → AT_CUSTOMER → DELIVERED`, with `FAILED` allowed before a terminal
  state. A drop cannot advance until its pickup is `PICKED_UP`; a failed pickup cancels the job and
  releases capacity. `FAILED` requires a non-empty failure reason. Completing a route never overrides
  the rider's explicit availability toggle; a route containing a failed drop releases capacity but
  does not increment `completed_orders`.
- Admin transitions are state-guarded: profile approval only applies to `PENDING_REVIEW`; rejecting
  is limited to pre-activation states (`ACTIVE` riders are suspended/blacklisted instead);
  suspend/blacklist requires a reason. Riders must be online to accept an offer.
- A high-risk/prepaid order may set `require_otp`; the 4-digit code is generated server-side, stored
  as SHA-256(code + stop id), and never returned in the rider projection. Only
  `/delivery/otp/verify` can mark that stop delivered. Attempts are bounded at 5 (`429 otp_locked`,
  migration `0045`); the hash/expiry are cleared on delivery so a code cannot be replayed.
- Every mutation writes an `admins.audit_logs` row through `contracts.AuditWriter`.
- `GET /admin/delivery-boys` projects `currentCategory` (`AVAILABLE`, `AT_PICKUP`, `AT_DELIVERY`,
  `BUSY`, `OFFLINE`) from the rider's next open stop and load/capacity. `GET
  /admin/delivery-boys/{id}/location` is a one-time Valkey read with the Postgres mirror fallback.
- **Payout splitting is not implemented.** `payout_amount_paisa` remains a display projection; the
  manual/automated payout ledger records the rider settlement, but no Razorpay transfer or
  platform/seller split is created.

**Known MVP limits:** multi-vendor orders (more than one store) are not auto-dispatched; iOS
terminates a swiped-away app (background location survives backgrounding, not force-quit) and OEM
battery whitelisting remains an ops step. These are tracked in `client/mobile/PENDING_WORK.md`.

The sections below are the **Future Prod** target.

## Service matrix

| Service | Language | DB | Deploy spec | Why |
|---|---|---|---|---|
| Search & Catalog | Rust | Tantivy/Meilisearch | 0.5 vCPU / 512 MB | sub-ms, no GC pauses |
| Cart & Stock | Go | DynamoDB/Firestore | 0.5 vCPU / 256 MB | high concurrency, flat perf |
| Checkout & Orders | Go | CockroachDB | 0.25 vCPU / 256 MB | financial consistency |
| Reviews & Ratings | Go | PostgreSQL | 0.25 vCPU / 256 MB | vendor-rating gate + reviews |
| Recommendations | Python | MongoDB | 1 vCPU / 1 GB | ML/analytics |

## Vendor reviews & ratings (planned)

Vendor rating is the first **write** surface the mobile app mocks end-to-end; the
gate must be identical on client and server so it can ship ahead of the backend.

- **Vendor identity** — resolved once via `resolveVendorForProduct`
  (`data/directory/vendors.ts`) and snapshotted onto the order at placement
  (`PlacedOrder.storeIds`, `OrderRow.vendorStoreIds`), so an old order keeps
  resolving to the same vendor.
- **Eligibility (derived, never a stored flag):** `hasPurchasedFromVendor(userId, vendorId)`
  is true iff a non-cancelled order resolves to that vendor. Phase 1 keeps any
  non-cancelled order; the server later tightens to `DELIVERED`. Once true it stays
  true for the `(user, vendor)` pair ("old customer keeps the ability").
- **One live rating per `(user, vendor)`**, latest wins; `orderIds[]` is kept as
  verified-purchase provenance (never shown). Public display is **full name only** —
  no user id, phone, order id, or avatar; nothing rating-related is logged.
- **Endpoints (gateway-facing, planned):** `GET /vendors/{id}/reviews`,
  `GET /vendors/{id}/reviews/summary`, `GET /vendors/{id}/rating`,
  `PUT /vendors/{id}/rating` (server re-checks eligibility).
- **Mobile owner:** `src/services/vendorRatings.ts` (single owner, reused by all five
  entry points) + `src/state/vendorRatingStore.ts` (persisted `faazio/vendor-ratings/v1`).
- **Cache:** `faazio:v1:reviews:vendor:{id}` (TTL 24 h); the user's own rating is
  auth-scoped and never edge-cached. See `docs/architecture/db-schema.md` §7.7.

## Planned module tree

```
server/
├── gateway/                 # Go Chi SDUI entrypoint (only public surface)
│   └── internal/{sdui,handlers,clients}
├── services/                # one folder per microservice
│   ├── search/              # Rust — Axum + Tantivy, gRPC via Tonic
│   ├── cart/                # Go — chi, DynamoDB/Firestore
│   ├── checkout/            # Go — chi, CockroachDB
│   ├── reviews/             # Go — chi, PostgreSQL (vendor ratings + eligibility)
│   └── recommendations/     # Python — FastAPI, MongoDB
├── contracts/               # shared proto / OpenAPI contracts
└── (deploy)                 # repo-root render.yaml Blueprints + per-service Dockerfiles
```

## Supporting infrastructure (future)

- **LB + API gateway:** Render managed load balancing + automatic TLS on custom domains.
- **CDN & WAF:** Cloudflare in front (DDoS protection + image caching); backend firewall
  accepts traffic only from Cloudflare's IP ranges (AGENTS.md security posture).
- **Events:** Render Background Workers + Cron Jobs (or an external queue such as Upstash Kafka)
  for order → stock/email/recommend.
- **Cache:** Aiven Valkey (read-through for search/banners). *Decision note: replaces the earlier
  "Upstash Redis" plan — see `docs/architecture/caching-cloudflare-valkey.md`. DB schemas: see
  `docs/architecture/db-schema.md`.*
- **Observability:** OpenTelemetry + Grafana Cloud.

## Delivery strategy (Flipkart-style alignment)

Flipkart itself is one of the largest React Native shops (RN client + in-house SDUI/plugin
system), so this plan's RN choice is consistent with that model. The plan matches the
lightweight-superapp playbook on two of three axes:

- **Server-driven widget layouts — aligned, data-driven first.** The gateway serves the render
  tree contract in `data/schema.ts` (`SDUINode`); the client composes typed entity arrays from a
  fixed component bank (`src/components/shared/`, 14 primitives) through repository seams
  (`src/services/homeFeed.ts`, `categoryVendors.ts`). That is the "backend sends a payload, app
  pulls pre-existing components" model. **Nuance:** the widget-tree half of `SDUINode` is tagged
  `@aspirational` — layout composition (section order/registry) is still client-side (`@static`),
  so today this is **server-driven data, not full server-driven layout**. The chosen trajectory is
  data-driven → widget-tree, moving composition server-side once the gateway exists; the interim
  keeps payloads small and typed.
- **Aggressive code shrinking — handled client-side.** R8 minify + resource shrinking, 2-ABI
  trimming and Hermes keep the shipped JS/native payload small; see `docs/RUNBOOKS/RELEASE.md`
  and `docs/architecture/mobile-app.md` ("Size & delivery strategy").
- **Differential / per-feature OTA — not covered (out of scope for now).** There is no OTA
  provider (CodePush/self-hosted) wiring; `React.lazy` routes defer module *evaluation* on a
  single Metro bundle, not per-feature download. A JS-bundle OTA channel is the pragmatic option;
  Flipkart-style per-feature delivery is custom infrastructure. Tracked in
  `client/mobile/PENDING_WORK.md`.

## Fail-safe contract

1. Each service is independently deployable and owns its schema; communicates only via gRPC
   through `contracts/`.
2. **Never commit secrets** — config via env/secret manager; `.env` templates only.
3. DB ports closed to the public; only necessary ports open; SSH keys not passwords.
4. Every `@mock` data file in `DATA_CONTROL.md` maps to a handler.

## Honest limitations

- **The MVP monolith is built; the Future Prod microservices are not.** `server/services/*` and
  `contracts/` as `.proto` remain plan-only — see `docs/architecture/monolith-breakdown.md` for the
  extraction playbook.
- Cost estimates assume free tiers scale-to-zero; real cost depends on traffic.
- `GatewayClient` is wired (remote + `@data/*` fallback); screens migrate onto it incrementally.
