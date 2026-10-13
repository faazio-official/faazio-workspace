# Faazio Gateway — Go Chi modular monolith (MVP)

One binary hosting all six bounded contexts. Authority:
[`docs/architecture/mvp-backend.md`](../../docs/architecture/mvp-backend.md) +
[`docs/architecture/monolith-breakdown.md`](../../docs/architecture/monolith-breakdown.md).

## Layout

```
gateway/
├── cmd/server/main.go            # entrypoint: connect platform → router → serve
├── internal/
│   ├── contracts/                # cross-context interfaces + JSON DTOs (future .proto)
│   ├── platform/{config,db,cache,mongo,auth,httpx}   # no domain knowledge
│   ├── search/         # GET /search
│   ├── catalog/        # GET /product/{id}, POST /products/batch
│   ├── directory/      # GET /stores, GET /store/{id}
│   ├── cartstock/      # GET /stock/{id}, auth cart
│   ├── checkout/       # orders + accounts (auth)
│   ├── reviews/        # product + vendor reviews, vendor rating (auth)
│   ├── reco/           # POST /events (Mongo, ID-only)
│   ├── sdui/           # GET /sdui/home
│   └── server/         # composition root (only package importing all contexts)
└── tools/importlint/   # boundary enforcement (go run ./tools/importlint)
```

## Run locally

```bash
cd server/gateway
docker compose up --build          # postgres + valkey + mongo + gateway
curl localhost:8080/health
curl 'localhost:8080/search?q=coffee'
curl localhost:8080/stores
```

Without compose, point the env at managed services (see `.env.example`) and:

```bash
go run ./cmd/server
```

## Verify (run before every push)

```bash
go build ./...
go vet ./...
go test ./...
go run ./tools/importlint          # fails on sibling-context imports
```

Unit tests run standalone. Integration tests (FTS, order lock/decrement, rating gate, PII
redaction, keyset pagination) **skip** unless pointed at the compose stack:

```bash
TEST_DATABASE_URL='postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable' \
TEST_VALKEY_URL='redis://localhost:6379/0' \
go test ./...
```

CI runs the full suite with Postgres + Valkey service containers
(`.github/workflows/server-gateway.yml`).

## Endpoints

| Method + path | Auth | Context |
|---|---|---|
| `GET /health` | — | server |
| `GET /search?q=&app=&limit=` | — | search |
| `GET /product/{id}` · `POST /products/batch` | — | catalog |
| `GET /stores?app=` · `GET /store/{id}` | — | directory |
| `GET /stock/{productId}` | — | cartstock |
| `GET/POST/PUT/DELETE /cart…` | ✔ | cartstock |
| `GET/POST /orders`, `GET /profile`, `/profile/details`, `/membership`, `/order-status`, `/account-nav` | ✔ | checkout |
| `GET /product/{id}/reviews` · `GET /vendors/{id}/reviews` · `/summary` · `PUT /vendors/{id}/rating` | partly ✔ | reviews |
| `POST /events` | ✔ | reco |
| `GET /sdui/home?locale=` | — | sdui |

Auth: `Authorization: Bearer <supabase-jwt>` (HS256). Local dev: `AUTH_DISABLED=true`
and `X-Dev-User` / `DEV_USER_ID`.

## Boundaries

A context may import `internal/contracts`, `internal/platform/*`, and itself — never a
sibling context. Cross-context calls go through `contracts` interfaces injected at the
composition root (`internal/server`). `go run ./tools/importlint` enforces this in CI.

## Seed

The DB seed under `../supabase/seed/` is generated from the root `@data/*` fixtures so
IDs (and therefore cache keys) stay identical:

```bash
node ../supabase/seed/generate.mjs
```

Migrations + seed: `../supabase/migrations/*.sql`, `../supabase/seed/0001_seed.sql`,
`../supabase/seed/mongo/seed.js`.