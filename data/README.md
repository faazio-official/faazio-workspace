# Faazio Data (SDUI Source of Truth)

Single source of truth for all product, store, and UI metadata used by the React Native app
(`client/mobile/`). Consumed via Metro `watchFolders` + the `@data/*` TS path alias.

> **Start here → [DATA_CONTROL.md](./DATA_CONTROL.md)** for the authoritative per-sub-app ownership,
> consumer, and mock/live status map. Every file in this folder carries a status banner
> (`@mock` / `@seed` / `@static` / `@unused`).

## Structure

- `types.ts` — canonical entities (`Product`, `AppBrand`, `StoreProfile`, `CartItem`, `Review`, …)
- `schema.ts` — `SDUINode` discriminated union. **`@aspirational`**: no data file produces SDUI trees yet.
- `index.ts` — the single barrel all sub-apps feed into (no per-sub-app barrels).
- `<domain>/*` — per-sub-app data: `home/`, `food/`, `mart/`, `grocery/`, `pharma/`, `cart/`,
  `account/`, `explore/`, `categories/`, `productMeta/`.

## Rules

1. **Do not edit this folder to add UI logic.** It is data only (types + fixtures).
2. **Sub-app data is owned by its feature.** Keep it self-contained; only `home/` may aggregate
   across sub-apps (see `home/filterFeed.ts`).
3. **Every new fixture must carry a status banner** (`@mock`/`@seed`/`@static`) and update `DATA_CONTROL.md`.
4. Typed arrays against `types.ts` are required; `as` casts are forbidden on data exports.
