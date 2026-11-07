# Customer home — domain index

**Status:** Shipped (server SDUI with labelled offline fallback)
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
- Editorial/offline fallbacks (`homeSections` registry and per-section fixtures) only when the
  server doc is absent.

## State

- `useLocationStore` — nearby origin.
- `useCartStore` / `useFavoriteStore` — add-to-cart and favourites actions.
- `useRemoteConfigStore` — config-driven copy/keys.
- `useConnectivityStore` — offline guard.

## Data path

- Primary: `gateway.getHomeFeed()` → `GET /sdui/home` → Mongo `sdui_layouts` + Postgres
  `catalog.products` / `directory.stores` joins, cached at the edge.
- Supporting reads: `fetchCategoryRail`, `getHeroAds`, `getLiveAds`, `getProductsByIds`,
  `getRecommendations`, `getActiveDiscounts`.
- `@data/home/*` is the offline/error shell and type source, not the online origin.

## Success / error / empty

- **Success:** server-ordered sections render with joined rows.
- **Error/offline:** static section registry + labelled first-paint fixtures; no fabricated live
  rows.
- **Empty:** a section with no server rows hides or shows an honest empty state.

## Known gaps

- Some sections still carry local first-paint fixtures while the SDUI doc has no join for them.
  This is allowed only as a labelled offline shell; see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- `src/services/homeFeed.ts` was a fixture-backed repository seam and is not used by the live
  screen; removal is tracked in `KNOWN_GAPS.md`.

## Linked docs

- `docs/architecture/data-layer-sdui.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (SDUI ownership)
