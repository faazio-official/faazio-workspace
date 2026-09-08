# Data Layer & SDUI Deep-Dive

> **Status:** LIVE (data) / PLANNED (server-driven SDUI) · **Scope:** root `data/` +
> `GatewayClient`.

## Why this exists

All product screens need typed, consistent data. Instead of scattering literals in each
screen, Faazio keeps a single **source of truth** in root `data/`, consumed via the
`@data/*` import alias. `data/DATA_CONTROL.md` is the **authoritative** ownership matrix —
this doc is a companion, not a duplicate.

## Status taxonomy

Every domain file carries a top-of-file banner tag:

| Tag | Meaning |
|---|---|
| `@mock` | Static fixture for local dev; replaced by the future Go Chi backend |
| `@seed` | Bootstrap seed hydrated into client stores on first launch (cart / favourites / location) |
| `@static` | Immutable in-code config (e.g. Home section registry order) |
| `@unused` | Exported but not imported by mobile today — prune or wire up |
| `@aspirational` | Type-only contract not yet produced by any data file (e.g. `SDUINode`) |

## Data layout

```
data/
├── index.ts            # re-exports everything @data/* pulls from
├── types.ts            # shared entity types
├── schema.ts           # @aspirational SDUI contract types
├── DATA_CONTROL.md     # authoritative ownership matrix + known gaps
├── mart/ grocery/ food/ pharma/   # per-sub-app products + stores (+ deals/specials)
├── explore/ categories/ productMeta/ reviews/
├── cart/ account/ accounts/ checkout/ inventory/
└── home/               # sections, rails, feeds, seeds, sdui
```

## Ownership highlights (per `DATA_CONTROL.md`)

| Domain | Owner | Status |
|---|---|---|
| `mart`, `grocery` | `features/ecommerce` | `@mock` |
| `food` | `features/food` | `@mock` |
| `pharma` | `features/pharma` | `@mock` (+ `@unused` by mobile) |
| `explore`, `categories` | `features/catalog` | `@mock` |
| `cart` | `features/cart` | `@mock` |
| `account` | `features/profile` | `@mock` |
| `home` | `features/home` | mixed `@mock` / `@seed` / `@static` |

### Normalized microservice tables (new surface)

A parallel, microservice-shaped view of the same source data that **imports** from the
legacy fixtures (never hand-copied), so the two surfaces can't drift:

| Table | Simulates | Consolidates |
|---|---|---|
| `catalog/products.ts` | Rust + Tantivy search index | all product records, deduped by `id`; `getProductById` |
| `directory/stores.ts` | Go + PostgreSQL | mart + food stores |
| `reviews/reviews.ts` | Go + PostgreSQL | `productMeta/reviews` |
| `inventory/stock.ts` | Go + DynamoDB | net-new stock rows |
| `checkout/orders.ts` | Go + CockroachDB | account/cart/addresses/coupons |
| `accounts/profile.ts` | Go + PostgreSQL | account profile/orders/nav/details |
| `home/sdui.ts` | Python + MongoDB | home section structure — **IDs only** |

## Data flow today vs future

```
 TODAY (legacy)
 screen ──► @data/<domain>/* (typed arrays)          [@mock fixtures]

 FUTURE (server-driven)
 screen ──► GatewayClient (src/services/api/GatewayClient.ts)
                │ joins the normalized tables above
                ▼
              Go Chi gateway ──► SDUI render tree (data/schema.ts)
                │ gRPC
                ▼
        search / cart / checkout / recommendations
```

`GatewayClient` is the intended single data surface but is **not yet wired** — the legacy
`@data/*` path stays live until each consumer is migrated. Every `@mock` entry becomes a
future handler contract.

## Fail-safe contract

1. **Always** add/keep the status banner (`@mock`/`@seed`/...) at the top of a data file.
2. Update `data/DATA_CONTROL.md` when adding, removing, or re-owning a fixture.
3. Emit **typed entity arrays** — do **not** emit `SDUINode` trees (that contract is
   `@aspirational` only).
4. Data files may cross-link within `data/` (e.g. `getProductById`) but must not import
   `client/mobile` internals.
5. Prefer typed exports over `as` casts.

## Honest limitations

- All live data is **mock** — nothing is fetched from a backend yet.
- `schema.ts` `SDUINode` is `@aspirational` — not a live contract.
- Several screens keep inline copies of `@data` fixtures (marked `@unused`) — de-dup is a
  tracked priority (see `DATA_CONTROL.md` "Known Gaps").

## Authoring new fixtures

Follow [RUNBOOKS/DATA_FIXTURES.md](../RUNBOOKS/DATA_FIXTURES.md).
