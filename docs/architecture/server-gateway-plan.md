# Server & Gateway Plan Deep-Dive

> **Status:** PLANNED — not yet implemented · **Scope:** `server/` (placeholder).
> This condenses `server/README.md`. Do **not** build server code until explicitly requested.

## Why this exists

The app will eventually be served by a backend instead of local `@data/*` mocks. This doc
captures the **target** microservices layout so scaffolding follows one plan and no concern
is silently re-invented. `server/` today holds only this plan.

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
            └── gRPC ────────────▶ [ recommendations — Python : FastAPI + MongoDB ]
```

- The **gateway** is the only public surface. It serves the structured SDUI tree currently
  mocked in `data/`, replacing `@mock` sources as modules are wired (`@mock` → `@server`).
- Internal service-to-service calls use **gRPC** (HTTP/2 + binary) for sub-2ms latency.
- Every `data/DATA_CONTROL.md` `@mock` entry becomes a handler contract.

## Service matrix

| Service | Language | DB | Cloud Run spec | Why |
|---|---|---|---|---|
| Search & Catalog | Rust | Tantivy/Meilisearch | 0.5 vCPU / 512 MB | sub-ms, no GC pauses |
| Cart & Stock | Go | DynamoDB/Firestore | 0.5 vCPU / 256 MB | high concurrency, flat perf |
| Checkout & Orders | Go | CockroachDB | 0.25 vCPU / 256 MB | financial consistency |
| Recommendations | Python | MongoDB | 1 vCPU / 1 GB | ML/analytics |

## Planned module tree

```
server/
├── gateway/                 # Go Chi SDUI entrypoint (only public surface)
│   └── internal/{sdui,handlers,clients}
├── services/                # one folder per microservice
│   ├── search/              # Rust — Axum + Tantivy, gRPC via Tonic
│   ├── cart/                # Go — chi, DynamoDB/Firestore
│   ├── checkout/            # Go — chi, CockroachDB
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

## Fail-safe contract

1. Each service is independently deployable and owns its schema; communicates only via gRPC
   through `contracts/`.
2. **Never commit secrets** — config via env/secret manager; `.env` templates only.
3. DB ports closed to the public; only necessary ports open; SSH keys not passwords.
4. Every `@mock` data file in `DATA_CONTROL.md` maps to a handler.

## Honest limitations

- **Nothing is built yet.** `server/` is a placeholder — plan only.
- Cost estimates assume free tiers scale-to-zero; real cost depends on traffic.
- Gateway remains unbuilt, so `GatewayClient` in the app stays unwired.
