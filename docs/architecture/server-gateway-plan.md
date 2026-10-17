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

- **Endpoints:** reads `GET /health`, `/search?q=`, `/sdui/home`, `/product/:id`, `/product/:id/reviews`,
  `/vendors/:id/reviews` (+ `/summary`), `/stores`, `/store/:id`, `/venues`, `/venues/:id/menu`,
  `/stock/:id`, `/orders`, `/profile`, `/profile/details`, `/profile/addresses` (GET/PUT/DELETE),
  `/membership`, `/order-status`, `/account-nav`, `/bookings`, `/venues/:id/booking-availability`,
  `/coupons?app=` (anon), `/promo/active-discounts?ids=` (anon), `/ads/live?slot=` (anon),
  `/admin/user-trail?userId=` (admin, ID-only), `/admin/sdui/home` (super-admin, raw ID-only layout);
  writes `POST/PUT/DELETE /cart…`, `POST /orders` (festival-discount + coupon settlement + ad attribution),
  `POST /checkout/validate-coupon`, `POST /ads/events`, `PUT /vendors/:id/rating`, `POST /events`,
  `PUT /admin/sdui/home` (super-admin, publishes the Home layout: version bump + cache purge),
  `POST /bookings` (seat hold + Razorpay order), `DELETE /bookings/:id`,
  `POST /bookings/:id/payment`, seller `GET/PUT /seller/booking-config`, `GET /seller/bookings`,
  `PUT /bookings/:id/status` (accept/reject), `POST /bookings/:id/vacate`, `POST /webhooks/razorpay`.
- **Packages:** `internal/{search,catalog,directory,cartstock,checkout,reviews,reco,sdui,bookings}` +
  `internal/{contracts,platform/*,server}`. Ownership table: `monolith-breakdown.md` §1.
- **Boundaries:** `go run ./tools/importlint` fails on sibling-context imports.
- **Mapping** (`@data/*` twin + `GatewayClient` method) and RLS classes: `docs/architecture/mvp-backend.md` §1–§3.
- **Build order / status:** `docs/architecture/mvp-backend.md` §7.

The sections below are the **Future Prod** target.

## Service matrix

| Service | Language | DB | Cloud Run spec | Why |
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
└── deployments/             # Cloud Run / Docker manifests, env templates (no secrets)
```

## Supporting infrastructure (future)

- **LB + API gateway:** Google Cloud HTTP(S) Load Balancing + Cloud Run native routing.
- **CDN & WAF:** Cloudflare in front (DDoS protection + image caching); backend firewall
  accepts traffic only from Cloudflare's IP ranges (AGENTS.md security posture).
- **Events:** Google Cloud Pub/Sub (or serverless Kafka) for order → stock/email/recommend.
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
- **Differential / per-feature OTA — not covered (out of scope for now).** There is no
  `expo-updates` / EAS Update / CodePush wiring; `React.lazy` routes defer module *evaluation* on
  a single Metro bundle, not per-feature download. `expo-updates` (OTA JS channel) is the
  pragmatic RN option; Flipkart-style per-feature delivery is custom infrastructure. Tracked in
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
