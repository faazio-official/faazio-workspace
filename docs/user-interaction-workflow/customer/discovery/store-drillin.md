# Store / category drill-in

**App / route:** customer · `SubApp`, `FoodApp`, `CategoryDrillIn` (`features/catalog/CategoryDrillInScreen.tsx`),
`VendorDetails` (`features/catalog/VendorDetailScreen.tsx`)
**Status:** Shipped (server feeds; authored data is offline-shell only)
**Trigger:** Tapping a sub-app, category, store card, deal, or search result.

## Steps

1. Home launches `SubApp` (`FA_MART`/`PHARMA`) or `FoodApp` (`FoodStack`).
2. The surface loads its feed:
   - Mart: `getMartFeed` (`GET /sdui/mart`) + `getStores('MART')` + `getStoresNearby`.
   - Food: `getFoodFeed` (`GET /sdui/food`) + `fetchVenues('FOOD')`.
   - Pharma: `fetchPharmaSections` (`GET /sdui/pharma`) + `fetchStores('PHARMA')`.
3. Category tap → `CategoryDrillIn`; the hook `useCategoryVendors` groups server search results by
   `storeId` (`GET /search?q=&app=` + `GET /stores?app=`).
4. Store tap → `VendorDetails`; `getStore` + `getStoreProducts` load the store profile and catalog.
5. Product tap → `ProductDetail`.

## State

- `useLocationStore` — nearby distance.
- `useCartStore` — add-to-cart.
- `useFavoriteStore` — favourites.
- `useFoodFilterStore` — Food diet filter.

## Data path

- `gateway.fetchCategories(app?, parentId?)` → `GET /categories` → `taxonomy.categories`.
- `gateway.getStores(app?)` / `getStoresNearby(origin)` → `GET /stores`, `/stores/nearby` →
  `directory.stores`.
- `gateway.searchProducts(query, app?)` → `GET /search` → `catalog.products` FTS.
- `gateway.getStore(id)` → `GET /store/{id}` → `directory.stores`.
- `gateway.getStoreProducts(storeId)` → `GET /stores/{id}/products` → `catalog.products` +
  `inventory.stock`.
- `gateway.fetchVenues(app?)` / `fetchMenu(venueId)` → `GET /venues`, `/venues/{id}/menu` →
  `directory.dining_venues` / `directory.menus`.
- Cache: catalog/store-products/geo keys per `monolith-breakdown.md`.
- No local fallback in `useCategoryVendors`: a failed or empty server read leaves the drill-in empty
  and offers "Report issue".

## Success / error / empty

- **Success:** server stores/products render; prices match checkout.
- **Error:** empty surface + report-issue affordance; no stale fixture grouping.
- **Empty:** honest "no stores/products" state.

## Known gaps

- Root `Search` `FOOD` config mismatch (see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md)).
- `services/categoryVendors.ts` still exports unused fixture-backed `getVendorsForApp` /
  `getVendorsWithProducts` / `getVendorProducts`. The live drill-in (`useCategoryVendors`) uses the
  gateway directly and does not call these helpers or the `matchesQuery` / `isDiscounted` predicates
  (those are used by `VendorDetailScreen`, `MedicalShopDetailsScreen`, and `DealsLandingScreen`).

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (catalog/directory rows)
- `docs/architecture/caching-cloudflare-valkey.md`
