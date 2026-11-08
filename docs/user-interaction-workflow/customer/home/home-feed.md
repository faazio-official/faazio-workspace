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

## State

- `useLocationStore` — nearby origin for geo rails.
- `useCartStore` — add-to-cart from cards.
- Local section state for carousels and pagination.

## Data path

- `gateway.getHomeFeed()` → `GET /sdui/home` → Mongo `sdui_layouts` + Postgres `catalog.products`,
  `directory.stores`.
- Cache: `faazio:v1:gateway:sdui:{locale}:/home` (300 s), purged on SDUI publish.
- Supporting: `getProductsByIds` (`POST /products/batch`), `getActiveDiscounts`
  (`GET /promo/active-discounts`), `fetchCategoryRail` (`GET /categories/rail`).
- Offline shell: `@data/home/sections` registry + section fixtures, used only when the gateway is
  disabled. Online rails render server rows or an honest empty/error state.

## Success / error / empty

- **Success:** server section order and joined rows.
- **Loading:** honest "Loading your feed…" until the SDUI read answers.
- **Error/offline:** online error → retry; gateway disabled → static registry + fixtures.
- **Empty:** a section with no rows is omitted or shows an honest empty note.

## Known gaps

- None for live fixture substitution (removed); see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/data-layer-sdui.md`
- `docs/architecture/monolith-breakdown.md` (recommendations/SDUI row)
- `data/DATA_CONTROL.md` (`@data/home`)
