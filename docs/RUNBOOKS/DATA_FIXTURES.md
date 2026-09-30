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

A few screens (`FoodScreen` booking dishes, `ProductDetailView`) keep inline copies that already
exist under `@data/` (marked `@unused`). **Do not add new inline copies** — put data in `@data/*`
and consume it; de-dup of the existing copies is a tracked priority. (`PharmaScreen`'s former
inline `RECENT_ORDERS` was already de-duplicated into `data/pharma/recentOrders.ts` — do not
re-introduce it.)

## New-data checklist

When adding a fixture file (e.g. `data/food/menus.ts`, `data/pharma/recentOrders.ts`):

- Register its exports in `data/index.ts` so screens consume them via `@data/*` (see
  `data/index.ts`).
- Add the new exports to the relevant domain table in `data/DATA_CONTROL.md` (food →
  `restaurantMenus`/`allRestaurantMenuDishes`; pharma → `PHARMA_RECENT_ORDERS`/`PharmaRecentOrder`).
