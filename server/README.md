# Faazio Server (Go Chi)

> **Status: PLANNED — not yet implemented.** The `server/` folder is a placeholder.
> Per `AGENTS.md`, do **not** build server code until explicitly requested. This document
> captures the **future plan** so scaffolding follows one target layout and no concern
> is silently re-invented.

This directory will host the Faazio backend. It is designed as a **highly modular,
enterprise-grade microservices codebase** for scalability and long-term maintenance —
no monolith, no framework-heavy baggage, each concern owning exactly one home.

---

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
- **Target spec (Google Cloud Run):** 0.5 vCPU / 512 MB RAM.

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
- **Target spec (Google Cloud Run):** 0.5 vCPU / 256 MB RAM.

### 💳 3. Checkout & Order Processing Service
- **Language:** Go (preferred) or Rust
- **Database:** CockroachDB Serverless
- **Why:** Handles money, payments, and final orders — accuracy matters more than raw
  speed. Go is easy to read, audit, and maintain for complex business logic (discount
  coupons, tax calculations, payment-gateway webhooks). CockroachDB guarantees financial
  consistency across servers so an order is never lost.
- **Stack:** go-chi/chi/v5, go-playground/validator/v10.
- **Target spec (Google Cloud Run):** 0.25 vCPU / 256 MB RAM.

### 🧠 4. Personalization, Recommendation & Analytics Engine
- **Language:** Python
- **Database:** MongoDB (unstructured user-behavior data; MongoDB Atlas M0 tier)
- **Why:** The **only** place Python is used. It is too slow for fast checkouts or text
  search, but it is the king of Data Science / ML — analyzing what users browse and
  predicting what to show next.
- **Stack:** FastAPI (Starlette + Pydantic, native async, auto Swagger docs).
- **Target spec (Google Cloud Run):** 1 vCPU / 1 GB RAM.

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
│   └── recommendations/         # Python — FastAPI, MongoDB
├── contracts/                   # shared proto / OpenAPI contracts between services
└── deployments/                 # Cloud Run / Docker manifests, env templates (no secrets)
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

| Service | Language | Cloud Run spec | Database | Initial monthly cost |
|---|---|---|---|---|
| Search | Rust | 0.5 vCPU / 512 MB | Meilisearch / Tantivy (embedded) | ~$0 (scales down to 0) |
| Cart & Stock | Go | 0.5 vCPU / 256 MB | Firestore (Datastore mode) | ~$0 (50k daily free reads) |
| Checkout | Go | 0.25 vCPU / 256 MB | CockroachDB Serverless | ~$0 (large free tier) |
| AI & Insights | Python | 1 vCPU / 1 GB | MongoDB Atlas M0 | ~$0 (free shared cluster) |

---

## 5. Supporting infrastructure (future)

### 🌐 Load Balancer & API Gateway
- **Use:** Google Cloud HTTP(S) Load Balancing + Cloud Run native routing.
- **Why:** Cloud Run's built-in managed load balancer auto-manages SSL certificates and
  distributes incoming traffic to containers globally — no server to configure.
- **Where:** single entry point for mobile + web, routing to the gateway.

### 🚀 CDN & WAF
- **Use:** Cloudflare (Free / Pro tier) in front of the GCP infrastructure.
- **Why:** free-tier world-class DDoS protection (WAF) plus free product-image caching,
  which drastically lowers GCP bandwidth bills.
- **Security tie-in (AGENTS.md):** Cloudflare sits in front; the backend firewall accepts
  traffic only from Cloudflare's official IP ranges.

### 🧠 Event Streaming & Message Queues
- **Use:** Google Cloud Pub/Sub (or Upstash Kafka, serverless).
- **Why:** when an order is placed, stock updates, emails, and AI recommendations run in
  the background — never blocking the user. Serverless = pay per message, $0 at idle.
- **Where:** checkout service emits events → cart/stock, notifications, recommendations.

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
- All infrastructure config (Cloud Run manifests, env templates, no secrets) lives under
  `deployments/` in the folder tree above.

---

## 6. Alignment with the mobile app

- The gateway serves the **SDUI render tree** (`data/schema.ts`) that `client/mobile/`
  renders today — no change to how the app consumes structure.
- Each `@mock` data file in `data/DATA_CONTROL.md` is a future handler contract:
  - `data/mart/products.ts`, `data/grocery/products.ts` → **search** service
  - `data/cart/*` (addresses, coupons) → **cart / checkout** services
  - `data/home/*` (rails, offers, filters) → **recommendations / gateway**
- Security posture (AGENTS.md): DB ports closed to the public, only necessary ports open,
  secrets via env/secret manager, SSH keys not passwords, traffic via Cloudflare IP ranges.
- **Schemas & cache:** the per-service DB schemas (tables, datatypes, sample rows) are specified in
  `docs/architecture/db-schema.md`; the cache layer (Cloudflare edge + Aiven Valkey) in
  `docs/architecture/caching-cloudflare-valkey.md`.
