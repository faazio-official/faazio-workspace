# Customer home — domain index

**Status:** Partial (server SDUI; some rails still substitute `@mock` fixtures — see Known gaps)
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
- Editorial/offline fallbacks (`homeSections` registry and per-section fixtures) when the server
  doc is absent **or a server section comes back with no rows**.

## State

- `useLocationStore` — nearby origin.
- `useCartStore` — add-to-cart from cards.
- Local section state for carousels and pagination.

## Data path

- Primary: `gateway.getHomeFeed()` → `GET /sdui/home` → Mongo `sdui_layouts` + Postgres
  `catalog.products` / `directory.stores` joins, cached at the edge.
- Supporting reads: `fetchCategoryRail`, `getHeroAds`, `getLiveAds`, `getProductsByIds`,
  `getActiveDiscounts`.
- `@data/home/*` is the offline/error shell and type source. Today some rails also use fixture rows
  when a server section has no joined products (`HomeView.tsx` `rail(fallback)`;
  `FilterFeedSection.tsx` `filterFeedPools`). That is a no-mocks gap, not an online origin.

## Success / error / empty

- **Success:** server-ordered sections render with joined rows.
- **Error/offline:** static section registry + first-paint fixtures; no fabricated live rows.
- **Empty:** a section with no server rows falls back to fixture rows today (see Known gaps), or
  hides when no fixture exists.

## Known gaps

- Some rails (`recentlyViewed*`, `nearbyOffers`, `mens`/`womens`/`childrens`/`hairSkinCare`,
  `filterFeed`, `dealsOfDay` via `MART_DEALS`, `todaysSpecials`, `hotBrandDeals` via
  `adCampaigns`) substitute `@data/home` `@mock`/`@static-editorial` fixtures when the server
  section has no rows, even while the gateway answers. This violates the no-mocks rule and must be
  removed or relabelled; see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/data-layer-sdui.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (SDUI ownership)
