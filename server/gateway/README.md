# Faazio Gateway — Go Chi modular monolith (production)

One binary hosting every bounded context. Authority:
[`docs/architecture/mvp-backend.md`](../../docs/architecture/mvp-backend.md) +
[`docs/architecture/monolith-breakdown.md`](../../docs/architecture/monolith-breakdown.md).

## Layout

```
gateway/
├── cmd/server/main.go            # entrypoint: connect platform → router → serve
├── internal/
│   ├── contracts/                # cross-context interfaces + JSON DTOs (future .proto)
│   ├── platform/{config,db,cache,mongo,auth,httpx,r2}   # no domain knowledge
│   ├── search/         # GET /search
│   ├── catalog/        # GET /product/{id}, POST /products/batch
│   ├── directory/      # GET /stores, GET /store/{id}
│   ├── cartstock/      # GET /stock/{id}, auth cart
│   ├── checkout/       # orders + accounts (auth)
│   ├── reviews/        # product + vendor reviews, vendor rating (auth)
│   ├── reco/           # POST /events (Mongo, ID-only)
│   ├── sdui/           # GET /sdui/home
│   ├── media/          # R2 image registry: upload-url/confirm/resolve/private
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
| `POST /errors` | optional auth | errorsink |
| `GET /sdui/home?locale=` | — | sdui |
| `POST /media/upload-url` · `POST /media/confirm` · `GET /media/private/{id}` | ✔ | media |
| `GET /media/resolve?ids=` | — | media |
| `PUT /media/{id}/status` · `DELETE /media/{id}` · `POST /media/gc` | admin | media |

Auth: `Authorization: Bearer <firebase-id-token>` (RS256) from **real Firebase phone OTP**;
`FIREBASE_PROJECT_ID` enables verification against Google's published certificate set. The first
authenticated call upserts `checkout.users.auth_uid` (`ProvisionUserID`, `0030`). A legacy Supabase
HS256 token is also accepted for the partner portal when `SUPABASE_JWT_SECRET` is set. Local dev:
`AUTH_DISABLED=true` and `X-Dev-User` / `DEV_USER_ID`. Setup: `docs/RUNBOOKS/FIREBASE_AUTH.md`.

## Media workers

Two background workers run alongside the HTTP server (built in `cmd/server`), both disabled when
R2/Cloudflare credentials are unset:

- **GC sweeper** (`internal/media/sweeper.go`) — reclaims orphaned `DRAFT` assets past the 24 h draft
  TTL: deletes the R2 object then the registry row. Runs every 6 h; the admin `POST /media/gc` runs one
  synchronous pass (503 when unconfigured).
- **CDN purge worker** (`internal/media/purger.go`) — `LISTEN media_updated` (a `pg_notify` from
  `media.assets` on insert/update/delete) and purges the asset's CDN URL so an immutable-key cache can
  still be invalidated on moderation/removal. Purge is a Cloudflare `purge_cache` call, enabled by
  `CF_ZONE_ID` + `CF_API_TOKEN`.

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
`../supabase/seed/mongo/seed.js`. Apply them from the repo root with
`server/supabase/apply-migration.sh`, which runs the Go migrator `cmd/migrate` (pgx; no
`psql`/Docker) using `DATABASE_URL` from this directory's `.env`; see
`docs/RUNBOOKS/DATABASE_MIGRATIONS.md`.