# Home feed (SDUI)

**App / route:** customer · `MainTabs` → `Home` (`src/features/home/HomeTabScreen.tsx`,
`HomeView.tsx`, `hooks/useHomeFeed.ts`)
**Status:** Partial (server SDUI; fixture rail fallbacks — see Known gaps)
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
- Offline shell: `@data/home/sections` registry + section fixtures. Today some rails also use
  fixture rows when a server section has no joined products (`HomeView.tsx` `rail(fallback)`;
  `FilterFeedSection.tsx` `filterFeedPools`), even while the gateway answers.

## Success / error / empty

- **Success:** server section order and joined rows.
- **Error/offline:** static registry + first-paint fixtures; the UI does not claim live data.
- **Empty:** a section with no rows falls back to `@data/home` fixture rows today (see Known gaps),
  or hides when no fixture exists.

## Known gaps

- Live `@data/home` rail/filter fixture substitution while the gateway answers (no-mocks violation).
  See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/data-layer-sdui.md`
- `docs/architecture/monolith-breakdown.md` (recommendations/SDUI row)
- `data/DATA_CONTROL.md` (`@data/home`)
