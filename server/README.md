# Faazio Server (Go Chi)

> **Status: Production (live, built) / Scaling stage (documented).** Production runs a **Go Chi
> modular monolith** (`server/gateway`) hosting all 6 bounded contexts over Supabase (Postgres) +
> MongoDB Atlas M0 + Aiven Valkey, with Cloudflare in front — single authorities:
> `docs/architecture/mvp-backend.md` (production) and `docs/architecture/monolith-breakdown.md`
> (context → package → scaling-service mapping). The full microservices plan below is the
> **scaling stage** and stays documented so extraction follows one target layout and no concern is
> silently re-invented. Extract services only when a scale trigger hits — a packaging change, not a
> rewrite.

This directory hosts the Faazio backend. The production monolith is §0; the enterprise-grade
microservices target is the **scaling-stage** sections below — one target layout, each concern owning
exactly one home, boundaries enforced inside the monolith so extraction is a packaging change.

---

## 0. Production modular monolith (live, built)

The production backend is a **single Go Chi modular monolith** (`server/gateway`) hosting all 6
bounded contexts. No gRPC, no separate services yet; contexts talk through `internal/contracts`
interfaces.

```
server/
├── README.md                    # this file
├── gateway/                     # Go Chi modular monolith (only public surface)
│   ├── cmd/server/main.go       # entrypoint (GET /health first)
│   ├── internal/
│   │   ├── contracts/           # cross-context interfaces + DTOs (future .proto shape)
│   │   ├── platform/            # config, db, cache, mongo, auth, httpx
│   │   ├── search/ catalog/ directory/ cartstock/ checkout/ reviews/ reco/ sdui/
│   │   └── server/              # composition root
│   ├── tools/importlint/        # boundary gate
│   ├── docker-compose.yml       # local postgres + valkey + mongo + gateway
│   └── Dockerfile
├── supabase/
│   ├── migrations/              # 0001 schemas, 0002 FTS, 0003 TTL/RLS
│   └── seed/                    # generate.mjs + @data/* twins (IDs unchanged)
└── (deploy)                     # repo-root render.yaml (Render Blueprint) + gateway/Dockerfile
```

- **Endpoints:** reads `GET /health`, `/search?q=`, `/sdui/home`, `/product/:id`,
  `/product/:id/reviews`, `/vendors/:id/reviews` (+ `/summary`), `/stores`, `/store/:id`,
  `/stock/:id`, `/orders`, `/profile`, `/profile/details`, `/membership`, `/order-status`,
  `/account-nav`; writes `POST/PUT/DELETE /cart…`, `POST /orders`, `PUT /vendors/:id/rating`,
  `POST /events` — origins and the `@data/*` / `GatewayClient` mapping in
  `docs/architecture/mvp-backend.md` §3; context mapping in `monolith-breakdown.md` §1.
- **Run locally:** `cd server/gateway && docker compose up --build` → `curl localhost:8080/health`.
- **Deploy:** **Render** (Docker web service) via the repo-root `render.yaml` Blueprint — Root
  Directory `server/gateway`, health check `/health`, all env vars set in the dashboard. The service
  reads Render's injected `PORT` and falls back to `RENDER_EXTERNAL_URL` for `PUBLIC_BASE_URL`
  (public `/assets/{key}` media links), so neither needs to be set by hand. Blueprint: `standard`
  plan, `minInstances: 2` (no idle spin-down / rolling deploys), Cloudflare proxied + Full SSL with
  Render inbound rules locked to Cloudflare IP ranges (see `render.yaml` comments).
- **Migrations:** **Render never applies them.** The runtime image is distroless (binary only — no
  SQL, no `psql`), and the gateway only health-checks the schema and logs `hint=apply migration NN`
  when tables are missing. Every migration under `server/supabase/migrations/` is applied manually
  from a dev terminal using the creds in `server/gateway/.env`
  (`docs/RUNBOOKS/DATABASE_MIGRATIONS.md`) — always **apply migrations before rolling the deploy**.
- **Verify:** `go build/vet/test ./...` + `go run ./tools/importlint`.
- **Origins:** Supabase (Postgres) for catalog/directory/reviews/checkout/accounts/inventory;
  MongoDB Atlas for `sdui_layouts` + events; Aiven Valkey read-through; Cloudflare in front.
- **Public media:** R2 public objects resolve via `R2_CDN_BASE` (custom domain, immutable) or, when
  unset, `PUBLIC_BASE_URL` + `GET /assets/{key}` (302 → 300 s presigned GET — no custom domain or
  `r2.dev` needed). Private Rx/KYC objects always use presigned GETs.
- **CORS:** `ALLOWED_ORIGINS` is an explicit comma-separated allow-list (default deny). A literal
  `*` reflects any Origin **only when `AUTH_DISABLED=true`** (local dev); in production it is
  ignored. The dev-only `X-Dev-*` request headers are only advertised in dev.
- **Auth:** real **Firebase phone OTP** for the mobile app; `FIREBASE_PROJECT_ID` enables
  `platform/auth.FirebaseVerifier` (RS256 against Google's x509 cert set, `iss`/`aud`/`exp`/`sub`).
  `checkout.Repo.ProvisionUserID` links the verified subject → `checkout.users.user_id` on first
  call (`0030`). The legacy Supabase HS256 verifier remains as a portal fallback. `AUTH_DISABLED=true`
  is local-dev only (logs a loud warning); release builds cannot embed a mock-login session.
- **Rate/body limits:** global `Throttle(100)` + 1 MiB body, plus `Throttle(10)` on
  `/ads/events`, `/vendors/{id}/rating`, `/media/*` and a 256 KiB cap on `/media/*`.
- **Health:** `GET /health` probes Postgres (required → 503), Valkey and Mongo (optional →
  `degraded`) with per-dependency latency, for Render's health-check/uptime alerts.
- **Notifications:** the durable outbox drains via the embedded **FCM HTTP v1 sender** when
  `FCM_SERVICE_ACCOUNT_JSON` + `FCM_PROJECT_ID` are set; `PENDING`→`SENT`, `FAILED` retried with
  capped exponential backoff up to 6 attempts; no sender configured = in-app inbox only and
  `POST /notifications/drain` returns `503 push_unconfigured` without marking rows `FAILED`).
- **Build order / status:** `docs/architecture/mvp-backend.md` §7.

---

## Scaling stage (full microservices)

The enterprise-grade target: five focused services, gRPC through `contracts/`, each owning its own
schema and deployable independently.

## 1. Runtime surfaces (who talks to what)

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

- The **gateway** is the only public surface the app talks to. It serves the structured
  SDUI tree currently mocked in `data/`, replacing `@mock` sources when each module is
  wired (`@mock` → `@server`).
- Internal service-to-service calls use **gRPC** (HTTP/2 + binary payloads) for
  sub-2ms inter-service latency — never heavy REST/JSON between services.
- Every `data/DATA_CONTROL.md` `@mock` entry becomes a contract for a handler; the
  ownership matrix (feature ↔ data file) stays the source of truth.

---

## 2. Future microservices plan

Four focused services, each choosing the best language/database for its job:

### 🔍 1. Search & Product Catalog Service
- **Language:** Rust
- **Engine/DB:** Tantivy or Meilisearch (product details synced from CockroachDB)
- **Why:** Search is the most heavily hit endpoint — customers constantly type, filter,
  and scroll. Rust delivers sub-millisecond responses with zero garbage-collection pauses.
  A Rust-native search library (Tantivy) processes complex text matching and
  auto-suggestions instantly without draining server memory.
- **Stack:** Axum (Tokio async runtime, tower middleware for load-balancing / rate-limiting /
  timeouts), Tantivy compiled directly into the binary, Tonic for gRPC.
- **Target spec (Render):** 0.5 vCPU / 512 MB RAM.

### 🛒 2. Shopping Cart & Local Inventory Service
- **Language:** Go
- **Database:** Amazon DynamoDB (or Google Firestore, Datastore mode)
- **Why:** Handles rapid, high-frequency actions — adding items to a cart, checking local
  dark-store stock. Go compiles to a single fast binary, handles massive concurrent
  connections, and has mature AWS SDKs. DynamoDB/Firestore provides flat, predictable
  sub-10ms performance for stock updates.
- **Stack:** go-chi/chi/v5 (radix-tree router → near-zero URL-matching cost),
  google.golang.org/grpc for internal calls, go-playground/validator/v10 for request
  validation.
- **Target spec (Render):** 0.5 vCPU / 256 MB RAM.

### 💳 3. Checkout & Order Processing Service
- **Language:** Go (preferred) or Rust
- **Database:** CockroachDB Serverless
- **Why:** Handles money, payments, and final orders — accuracy matters more than raw
  speed. Go is easy to read, audit, and maintain for complex business logic (discount
  coupons, tax calculations, payment-gateway webhooks). CockroachDB guarantees financial
  consistency across servers so an order is never lost.
- **Stack:** go-chi/chi/v5, go-playground/validator/v10.
- **Target spec (Render):** 0.25 vCPU / 256 MB RAM.

### 🧠 4. Personalization, Recommendation & Analytics Engine
- **Language:** Python
- **Database:** MongoDB (unstructured user-behavior data; MongoDB Atlas M0 tier)
- **Why:** The **only** place Python is used. It is too slow for fast checkouts or text
  search, but it is the king of Data Science / ML — analyzing what users browse and
  predicting what to show next.
- **Stack:** FastAPI (Starlette + Pydantic, native async, auto Swagger docs).
- **Target spec (Render):** 1 vCPU / 1 GB RAM.

### ⭐ 5. Reviews & Ratings Service
- **Language:** Go
- **Database:** PostgreSQL
- **Why:** Vendor ratings are a small, consistency-sensitive read/write surface (one
  live rating per `(user, vendor)`, latest wins) with an eligibility gate derived
  from order history. Keeping it separate from Search keeps read-heavy catalog traffic
  off the review DB, and mirroring the mobile contract keeps the gate identical on
  both sides.
- **Eligibility (phase 1):** a user may rate a vendor iff they have a **non-cancelled**
  order resolving to that vendor. The server later tightens to `DELIVERED`. It is
  **derived, never a stored flag**, and stays true for the `(user, vendor)` pair once it
  exists ("old customer keeps the ability").
- **Endpoints (gateway-facing, planned):**
  - `GET  /vendors/{vendorId}/reviews` — public reviews (full name only; never id/phone/order id/avatar)
  - `GET  /vendors/{vendorId}/reviews/summary` — average, count, 1–5 distribution
  - `GET  /vendors/{vendorId}/rating` — the signed-in user's own rating for this vendor
  - `PUT  /vendors/{vendorId}/rating` — upsert the user's rating (server re-checks eligibility)
- **Stack:** go-chi/chi/v5, go-playground/validator/v10.
- **Target spec (Render):** 0.25 vCPU / 256 MB RAM.

---

## 3. Target modular folder tree

The layout below is the **planned target** so future scaffolding stays consistent,
enterprise-grade, and easy to maintain. Not built yet.

```
server/
├── README.md                    # this file
├── gateway/                     # Go Chi SDUI entrypoint (only public surface)
│   ├── cmd/
│   │   └── server/main.go
│   ├── internal/
│   │   ├── sdui/                # SDUI tree builder → render tree (data/schema.ts)
│   │   ├── handlers/            # HTTP handlers + validation
│   │   └── clients/             # gRPC clients for downstream services
│   ├── go.mod
│   └── go.sum
├── services/                    # one folder per microservice
│   ├── search/                  # Rust — Axum + Tantivy, gRPC via Tonic
│   ├── cart/                    # Go — chi, gRPC, DynamoDB/Firestore
│   ├── checkout/                # Go — chi, CockroachDB
│   ├── reviews/                 # Go — chi, PostgreSQL (vendor ratings + eligibility)
│   └── recommendations/         # Python — FastAPI, MongoDB
├── contracts/                   # shared proto / OpenAPI contracts between services
└── (deploy)                     # repo-root render.yaml Blueprints + per-service Dockerfiles
```

**Conventions for the folder tree:**
- Each service is independently deployable (own `go.mod` / `Cargo.toml` / `pyproject.toml`),
  owns its own schema, and communicates only via gRPC through `contracts/`.
- **Never commit secrets** — config via environment variables / secret managers; `.env`
  templates only.
- Shared internal logic lives under `gateway/internal/` (or the owning service) —
  nothing is duplicated across service folders.

---

## 4. Cost & sizing summary

| Service | Language | Render spec | Database | Initial monthly cost |
|---|---|---|---|---|
| Search | Rust | 0.5 vCPU / 512 MB | Meilisearch / Tantivy (embedded) | ~$0 (scales down to 0) |
| Cart & Stock | Go | 0.5 vCPU / 256 MB | Firestore (Datastore mode) | ~$0 (50k daily free reads) |
| Checkout | Go | 0.25 vCPU / 256 MB | CockroachDB Serverless | ~$0 (large free tier) |
| Reviews & Ratings | Go | 0.25 vCPU / 256 MB | PostgreSQL | ~$0 (free shared tier) |
| AI & Insights | Python | 1 vCPU / 1 GB | MongoDB Atlas M0 | ~$0 (free shared cluster) |

---

## 5. Supporting infrastructure (future)

### 🌐 Load Balancer & API Gateway
- **Use:** Render's managed load balancing + automatic TLS on custom domains.
- **Why:** Render terminates TLS and distributes traffic to the container with no
  load balancer to configure.
- **Where:** single entry point for mobile + web, routing to the gateway.

### 🚀 CDN & WAF
- **Use:** Cloudflare (Free / Pro tier) in front of the Render services.
- **Why:** free-tier world-class DDoS protection (WAF) plus free product-image caching,
  which drastically lowers Render bandwidth bills.
- **Security tie-in (AGENTS.md):** Cloudflare sits in front; the backend firewall accepts
  traffic only from Cloudflare's official IP ranges.

### 🧠 Background Jobs & Queues
- **Use:** Render Background Workers + Cron Jobs (or an external queue such as Upstash Kafka).
- **Why:** when an order is placed, stock updates, emails, and AI recommendations run in
  the background — never blocking the user. Workers scale to zero when idle.
- **Where:** checkout service emits jobs → cart/stock, notifications, recommendations.

### ⚡ Distributed Caching
- **Use:** Aiven Valkey (serverless). *Decision note: replaces the earlier "Upstash Redis" plan —
  full config in `docs/architecture/caching-cloudflare-valkey.md`.*
- **Why:** keep hot data (top search results, homepage banners) in RAM for flash sales
  without choking the database; Aiven free tier → Startup ~$60/mo (research-verified).
- **Where:** gateway / search read-through cache.

### 📋 Observability (Logging, Metrics & Tracing)
- **Use:** OpenTelemetry + Grafana Cloud (free tier).
- **Why:** with multiple gRPC microservices, tracing an error across systems needs a
  unified standard; OpenTelemetry is built into Go and Rust easily, and Grafana Cloud's
  free tier stores logs, metrics, and traces without enterprise fees.
- **Where:** all services emit OTel traces/metrics → Grafana dashboards.

### Deployment
- The production gateway deploys to **Render** via the repo-root `render.yaml` Blueprint (Docker,
  no secrets committed — set them in the dashboard). Future per-service Dockerfiles live
  beside their service folders.

---

## 6. Alignment with the mobile app

- The gateway serves the **SDUI render tree** (`data/schema.ts`) that `client/mobile/`
  renders today — no change to how the app consumes structure.
- Each `@mock` data file in `data/DATA_CONTROL.md` is a future handler contract:
  - `data/mart/products.ts` (incl. former grocery) → **search** service
  - `data/cart/*` (addresses, coupons) → **cart / checkout** services
  - `data/directory/vendors.ts`, `data/reviews/vendorReviews.ts` → **reviews & ratings** service
  - `data/home/*` (rails, offers, filters) → **recommendations / gateway**
- Security posture (AGENTS.md): DB ports closed to the public, only necessary ports open,
  secrets via env/secret manager, SSH keys not passwords, traffic via Cloudflare IP ranges.
- **Schemas & cache:** the per-service DB schemas (tables, datatypes, sample rows) are specified in
  `docs/architecture/db-schema.md`; the cache layer (Cloudflare edge + Aiven Valkey) in
  `docs/architecture/caching-cloudflare-valkey.md`.
