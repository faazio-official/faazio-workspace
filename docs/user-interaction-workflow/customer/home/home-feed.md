# Home feed (SDUI)

**App / route:** customer · `MainTabs` → `Home` (`src/features/home/HomeTabScreen.tsx`,
`HomeView.tsx`, `hooks/useHomeFeed.ts`)
**Status:** Shipped (server SDUI; rails are server-only while online)
**Trigger:** Authenticated app launch or Home tab focus.

## Steps

1. `HomeView` calls `useHomeFeed()`.
2. `gateway.getHomeFeed()` fetches `GET /sdui/home`.
3. The gateway compiles the Mongo layout (`sdui_layouts`) and joins each section's `productIds` and
   `storeIds` through `contracts.ProductReader` / `contracts.StoreReader`.
4. The app maps each section to a `HomeRow` and renders the matching section component.
5. Section components may fire their own supporting reads (ads, discounts, ratings) and add to cart.
6. Pull-to-refresh (`AppRefreshControl`) on the body re-fetches the feed and bumps the shared
   `refreshStore` `home` counter, which also re-fetches the sibling header category rail
   (`HeaderCategoryRail` → `usePagedRail`). Stale rows stay visible while the spinner runs.

## State

- `useLocationStore` — nearby origin for geo rails.
- `useCartStore` — add-to-cart from cards.
- `useRefreshStore` — cross-component pull signal (`home` counter) shared by the feed and the
  header rail, which are siblings in the collapsing header.
- `useHomeFeed` returns `{ feed, loading, error, refreshing, refresh, reload }`; `refresh` sets
  `refreshing` and bumps the store, `reload` retries from the empty/error state.
- Local section state for carousels and pagination.

## Data path

- `gateway.getHomeFeed()` → `GET /sdui/home` → Mongo `sdui_layouts` + Postgres `catalog.products`,
  `directory.stores`.
- Cache: `faazio:v1:gateway:sdui:{locale}:/home` (300 s), purged on SDUI publish.
- Supporting: `getProductsByIds` (`POST /products/batch`), `getActiveDiscounts`
  (`GET /promo/active-discounts`), `fetchCategoryRail` (`GET /categories/rail` — only active
  top-level rows curated with `show_on_home_rail`, max 3 globally; FOOD is not eligible).
- Offline shell: `@data/home/sections` registry + section fixtures, used only when the gateway is
  disabled. Online rails render server rows or an honest empty/error state.

## Success / error / empty

- **Success:** server section order and joined rows.
- **Loading:** honest "Loading your feed..." until the SDUI read answers.
- **Refreshing:** `refreshing` true drives the branded spinner; existing rows stay on screen. A
  failed pull keeps the rows, stops the spinner and flips `error` — it never blanks or fabricates.
- **Error/offline:** online error → retry; gateway disabled → static registry + fixtures.
- **Empty:** a section with no rows is omitted or shows an honest empty note.

## Known gaps

- A pull re-reads the same 300 s Valkey-cached SDUI doc, so it can return identical content until
  the key lapses — see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md). No fixture substitution.

## Linked docs

- `docs/architecture/data-layer-sdui.md`
- `docs/architecture/monolith-breakdown.md` (recommendations/SDUI row)
- `data/DATA_CONTROL.md` (`@data/home`)
