# Customer home — domain index

**Status:** Shipped (server SDUI; rails are server-only while online)
**Route:** `MainTabs` → `Home` (`src/features/home/HomeTabScreen.tsx` → `HomeView.tsx`)
**Trigger:** App launch when authenticated, or tapping the Home tab.

## Flows

| Flow | Doc |
|---|---|
| SDUI home feed + section rails | [home-feed.md](./home-feed.md) |
| Sponsored rail / hero ads | [sponsored-rail.md](./sponsored-rail.md) |

## What the screen composes

- Collapsing header + search entry (`Search` route) + cart entry.
- Sub-app launcher cards: Mart (`SubApp`), Food (`FoodApp`), Pharma (`SubApp`).
- Ordered SDUI sections from `GET /sdui/home` (`useHomeFeed`).
- Filter-feed chips and paginated pools.
- An explicit offline shell (`homeSections` registry + authored fixtures) only when the gateway is
  disabled. While online, a section with no server rows is omitted; loading/error states are honest.

## State

- `useLocationStore` — nearby origin.
- `useCartStore` — add-to-cart from cards.
- Local section state for carousels and pagination.

## Data path

- Primary: `gateway.getHomeFeed()` → `GET /sdui/home` → Mongo `sdui_layouts` + Postgres
  `catalog.products` / `directory.stores` joins, cached at the edge.
- Supporting reads: `fetchCategoryRail`, `getHeroAds`, `getLiveAds`, `getProductsByIds`,
  `getActiveDiscounts`.
- `@data/home/*` is the offline/error shell and type source only. While the gateway answers, rails
  render server rows or an honest empty/error state — never fixture rows.

## Success / error / empty

- **Success:** server-ordered sections render with joined rows.
- **Loading:** an honest "Loading your feed…" state until `GET /sdui/home` answers.
- **Error/offline:** online error → retry state; gateway disabled → static registry + fixtures.
- **Empty:** a section with no server rows is omitted (or shows its own honest empty note); the
  feed itself shows an honest empty state when the server returns no sections.

## Known gaps

- None for the online fixture substitution (removed). See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md)
  for unrelated home gaps.

## Linked docs

- `docs/architecture/data-layer-sdui.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (SDUI ownership)
