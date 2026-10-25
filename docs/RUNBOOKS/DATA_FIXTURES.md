# Data Fixtures Runbook

> Authoring rules for `@data/*` fixtures (the shared source of truth).

## 🏛 Architecture overview

- `data/` is the **single source of truth** for product screens, consumed via `@data/*`.
- `data/DATA_CONTROL.md` is the **authoritative ownership matrix** — update it on any change.
- Two surfaces exist: the **legacy fixtures** (typed entity arrays) and the **normalized
  microservice tables** (which import from the legacy ones). See
  [architecture/data-layer-sdui.md](../architecture/data-layer-sdui.md).

## ✍️ Authoring rules

### CRITICAL RULES

- **Status banner is mandatory.** Every data file starts with a top-of-file comment tag:
  `@mock`, `@seed`, `@static`, `@unused`, or `@aspirational`.
- **Update `DATA_CONTROL.md`** whenever you add, remove, rename, or re-own a fixture.
- **Typed arrays only** — use the shared types from `data/types.ts`; do **not** invent ad-hoc
  shapes or duplicate an existing type.
- **No `as` casts** to force incompatible types — fix the type instead.
- **Cross-link within `data/` only** — a data file may import from other `data/*` files
  (e.g. `getProductById`) but never from `client/mobile/src`.
- **Home-only aggregation** — if a section aggregates multiple sub-apps, it belongs to
  `data/home/` and is consumed by `features/home` (the sanctioned cross-module consumer).
- **No hand-copied literals in the normalized tables** — import from the legacy sources so
  the two surfaces never drift.

### Example

```ts
/** @mock data/mart/products.ts — Mart catalog fixtures */
import type { MartProduct } from '../../types';

export const martProducts: MartProduct[] = [
  {
    id: 'p1',
    name: 'Example',
    price: 99,
    // …use real typed fields; no `as`
  },
];
```

After adding, register the export in `data/index.ts` (if screens consume it via `@data/*`).

## 🔧 Verification

```bash
cd client/mobile
npm run ts:check            # type safety of new fixtures
npm run check:boundaries    # no sub-app boundary violated
npm run check:drillin       # every MASTER_CATEGORIES searchQuery resolves ≥1 vendor
```

`check:drillin` mirrors the drill-in's `matchesQuery` predicate over the raw fixtures — run it
after any change to `data/categories/masterCategories.ts` or the mart/pharma product arrays.

## Known duplication to avoid re-introducing

A few screens (`FoodScreen` dish rails, `ProductDetailView`) keep inline copies that already
exist under `@data/` (marked `@unused`). **Do not add new inline copies** — put data in `@data/*`
and consume it; de-dup of the existing copies is a tracked priority. (`PharmaScreen`'s former
inline `RECENT_ORDERS` was already de-duplicated into `data/pharma/recentOrders.ts` — do not
re-introduce it.)

## New-data checklist

When adding a fixture file (e.g. `data/food/menus.ts`, `data/pharma/recentOrders.ts`):

- Register its exports in `data/index.ts` so screens consume them via `@data/*` (see
  `data/index.ts`).
- Add the new exports to the relevant domain table in `data/DATA_CONTROL.md` (food →
  `restaurantMenus`/`allRestaurantMenuDishes`; pharma → `PHARMA_RECENT_ORDERS`/`PharmaRecentOrder`;
  vendor identity/ratings → `directory/vendors.ts`, `food/diningVenues.ts`, `reviews/vendorReviews.ts`).

**Vendor identity & ratings fixtures:** vendor identity is resolved by
`data/directory/vendors.ts` `resolveVendorForProduct` (stores + `food/diningVenues`). Never
duplicate a vendor id/name elsewhere — add it to `directory/stores.ts` (Mart/Pharma) or
`food/diningVenues.ts` (Food venues) and re-export as needed. Vendor order snapshots stay on
`MyOrder.storeId` / `OrderRow.vendorStoreIds`. Public vendor reviews live in
`data/reviews/vendorReviews.ts` (full name only — never add id/phone/order id/avatar). The
production schema is `docs/architecture/db-schema.md` §7.7.

---

## 🖼 R2 image backfill (Phase 7)

`@data` product/store/menu images are hotlinked unsplash URLs. Phase 7 moves the bytes into
**Cloudflare R2** and records one `media.assets` identity row each (`docs/architecture/db-schema.md`
§12.16), so the app reads content-addressed CDN URLs instead of third-party hotlinks.

Tooling (`server/supabase/seed/`):

- `lib/databuild.mjs` — shared `@data` compile (used by both scripts; one compilation path).
- `lib/r2.mjs` — dependency-free Node SigV4 presigner (mirrors the Go signer; verified against the AWS
  documentation vector).
- `lib/mediaplan.mjs` — collects image refs, derives keys/ids, and emits the `media.assets` + owner-link
  SQL. `lib/constants.mjs` holds the key prefix + MIME allowlist.
- `backfill_r2.mjs` — the one-shot downloader/uploader + manifest/SQL writer.
- `generate.mjs` — reads `media_manifest.json` (when present) to emit `media.assets` + `image_key`.

### 1. Prereqs (Cloudflare ops)
Create the R2 buckets `faazio-public` / `faazio-private`, allow `PUT` CORS from the gateway/portal
origins, and provision an API token. Set `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` /
`R2_SECRET_ACCESS_KEY` (optionally `R2_PUBLIC_BUCKET`). Public serving is optional, pick one:
- **Custom domain (recommended for prod):** attach `img.faazio.in` to the public bucket (Cache Rule
  `max-age=31536000, immutable`) and set `R2_CDN_BASE=https://img.faazio.in`.
- **No CDN (MVP):** leave `R2_CDN_BASE` empty and set `PUBLIC_BASE_URL` to the gateway's public origin;
  public objects are then served by the gateway's `/assets/{key}` route, which 302-redirects to a
  300 s presigned GET. Do **not** use the rate-limited `r2.dev` URL.
- With neither set, `image_key` decorations are skipped and the legacy `image_url` column (seed
  fixtures) is used.

### 2. Backfill + regenerate
```bash
# download 288 distinct images, hash, PUT to faazio-public; write manifest + link SQL
R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
  node server/supabase/seed/backfill_r2.mjs

# apply the owner links to an already-seeded DB, then regenerate the committed seed
# (psql "$DATABASE_URL" -f server/supabase/seed/backfill_media.sql)
node server/supabase/seed/generate.mjs
```

Flags: `--dry-run` (fetch + hash + manifest, **no** R2 PUT), `--manifest-only` (re-emit SQL from the
existing manifest, no network), `--limit N`, `--concurrency N` (default 8).

`media_manifest.json` is **committed** (the deterministic bridge: keys/hashes → R2 objects);
`backfill_media.sql` is a generated artifact and is git-ignored. Re-running is safe — assets dedupe on
`r2_key` and the URL→key mapping is stable for the same bytes. Until the manifest exists, `generate.mjs`
emits null `image_key`s and the unsplash URL stays the offline/legacy fallback.

---

## 🗄 Apply schema + data to Supabase (prod)

The gateway's Postgres origin is the **Supabase** project `mivisyjvvizyyidjdjmh` (region
**ap-south-1 / Mumbai**). Its direct host is IPv6-only; use the **Supavisor pooler** (IPv4,
session mode `:5432`, which supports prepared statements) as `DATABASE_URL`:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

Apply schema, then seed (`server/gateway/.env` holds the pooler URL — never commit secrets):

```bash
for f in server/supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/supabase/seed/0001_seed.sql
```

Migrations are Supabase-aware: they enable RLS and schedule `pg_cron` sweeps only when the `auth`
schema / `pg_cron` extension is present, and skip both on a bare local Postgres.

> **Render never applies migrations.** The loop above is the **fresh-DB** path; for an existing
> production DB apply only the **pending** files from a dev terminal. Full workflow (creds from
> `server/gateway/.env`, pending-only commands, alternative SQL-editor path):
> `docs/RUNBOOKS/DATABASE_MIGRATIONS.md`.

- **Mirroring a local dev DB → prod:** dump **data-only** from local (`pg_dump --data-only
  --no-owner --no-privileges`), `TRUNCATE` the prod app base tables, then restore. Use a **PG17**
  client (`postgres:17-alpine`) against the PG17 server. Exclude `reviews.vendor_summary` from the
  restore — it is trigger-maintained from `reviews.vendor_reviews` and would otherwise collide.
- **Extension schema:** on Supabase `unaccent` lives in the `extensions` schema, so
  `catalog.immutable_unaccent` (migration `0002`) pins `search_path = extensions, public, pg_temp`;
  the generated `search_vec` column then resolves its `unaccent(...)` call on Supabase and on a bare
  local Postgres alike. Without this the FTS generated column fails on every product write.
- **MongoDB:** `mongodump` the local `faazio` DB and `mongorestore` it into the Atlas cluster
  (`sdui_layouts` + events); the restore recreates the `user_events.expiresAt` TTL index.
