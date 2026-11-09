# Store / category drill-in

**App / route:** customer · `SubApp`, `FoodApp`, `CategoryDrillIn` (`features/catalog/CategoryDrillInScreen.tsx`),
`VendorDetails` (`features/catalog/VendorDetailScreen.tsx`)
**Status:** Shipped (server feeds; authored data is offline-shell only)
**Trigger:** Tapping a sub-app, category, store card, deal, or search result.

## Steps

1. Home launches `SubApp` (`FA_MART`/`PHARMA`) or `FoodApp` (`FoodStack`).
2. The surface loads its feed:
   - Mart: `getMartFeed` (`GET /sdui/mart`) + `getStores('MART')` + `getStoresNearby`.
   - Food: `getFoodFeed` (`GET /sdui/food`) + `fetchStores('FOOD')` + `fetchVenues('FOOD')` — the
     restaurant grid is the union of seller-owned FOOD stores and dining venues.
   - Pharma: `fetchPharmaSections` (`GET /sdui/pharma`) + `fetchStores('PHARMA')`.
3. Category tap → `CategoryDrillIn`; the hook `useCategoryVendors` groups server search results by
   `storeId` (`GET /search?q=&app=` + `GET /stores?app=`).
4. Store tap → `VendorDetails`; `getStore` + `getStoreProducts` load the store profile and catalog.
5. Product tap → `ProductDetail`.
6. Pull-to-refresh is available on the drill-in body (`AppRefreshControl`): one pull re-runs both
   `useCategoryTree` (taxonomy/chips) and `useCategoryVendors` (store-grouped body). Category chips
   are not server-cached, so they update instantly. Stale rows stay visible while the spinner runs.

## State

- `useLocationStore` — nearby distance.
- `useCartStore` — add-to-cart.
- `useFavoriteStore` — favourites.
- `useFoodFilterStore` — Food diet filter.

## Data path

- `gateway.fetchCategories(app?, parentId?)` → `GET /categories` → `taxonomy.categories`.
- `gateway.getStores(app?)` / `getStoresNearby(origin)` → `GET /stores`, `/stores/nearby` →
  `directory.stores`.
- `gateway.searchProducts(query, app?)` → `GET /search` → `catalog.products` FTS. Only `status =
  'ACTIVE'` (and non-deleted) rows surface, so a seller listing still in `PENDING_REVIEW` never
  reaches the drill-in before an admin approves it.
- `gateway.getStore(id)` → `GET /store/{id}` → `directory.stores`.
- `gateway.getStoreProducts(storeId)` → `GET /stores/{id}/products` → `catalog.products` +
  `inventory.stock`.
- Store page paid band: `gateway.getHeroAds('STORE_TOP', { app, storeId })` → `GET /ads/hero` →
  `ads.campaigns`. Every shop carries 2 seeded LIVE `STORE_TOP` campaigns (migration `0094`), so the
  band has fill out of the box; an empty read drops the band rather than showing a placeholder.
- `gateway.fetchStores('FOOD')` → `GET /stores?app=FOOD` → `directory.stores` (seller-owned FOOD
  delivery kitchens, `is_live`-filtered) — the Food grid's store half.
- `gateway.fetchVenues(app?)` / `fetchMenu(venueId)` → `GET /venues`, `/venues/{id}/menu` →
  `directory.dining_venues` / `directory.menus`. The Food grid unions both lists; a `store-f*`
  profile resolves its menu through the same `/venues/{id}/menu` (`directory.menus.venue_id`).
- Cache: catalog/store-products/geo keys per `monolith-breakdown.md`.
- No local fallback in `useCategoryVendors`: a failed or empty server read leaves the drill-in empty
  and offers "Report issue".

## Success / error / empty

- **Success:** server stores/products render; prices match checkout.
- **Refreshing:** `refreshing` from both drill-in hooks drives the branded spinner; a failed pull
  keeps the current rows and only sets `failed` (a category/query change still clears, so another
  category's vendors are never shown under the new chip).
- **Error:** empty surface + report-issue affordance; no stale fixture grouping.
- **Empty:** honest "no stores/products" state.

## Known gaps

- A pull re-reads the upstream 300 s cache for the server-backed lists (feed/taxonomy), so it can
  return identical content until the key lapses — see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- Root `Search` `FOOD` config mismatch (see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md)).
- `services/categoryVendors.ts` still exports unused fixture-backed `getVendorsForApp` /
  `getVendorsWithProducts` / `getVendorProducts`. The live drill-in (`useCategoryVendors`) uses the
  gateway directly and does not call these helpers or the `matchesQuery` / `isDiscounted` predicates
  (those are used by `VendorDetailScreen`, `MedicalShopDetailsScreen`, and `DealsLandingScreen`).

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (catalog/directory rows)
- `docs/architecture/caching-cloudflare-valkey.md`
