# Customer discovery — domain index

**Status:** Partial (Mart server-backed; Pharma falls back to its authored shell on a failed read;
Food rails still merge `@mock` fixtures)
**Routes:** `SubApp` (Mart/Pharma), `FoodApp` (`FoodStack`), `CategoryDrillIn`, `VendorDetails`,
`ProductDetail`, `Search`, `DealsLanding`, `MedicalShopDetails`
**Trigger:** Home launcher, search, category rail, deal card, or deep link.

## Flows

| Flow | Doc |
|---|---|
| Store/category drill-in | [store-drillin.md](./store-drillin.md) |
| Product detail | [product-detail.md](./product-detail.md) |
| Food search | [food-search.md](./food-search.md) |

## Sub-app surfaces

| Sub-app | Entry | Primary screens |
|---|---|---|
| Mart | Home → `SubApp` `FA_MART` | `FaMartScreen`, `CategoryDrillIn`, `VendorDetails`, `ProductDetail`, `DealsLanding` |
| Food | Home → `FoodApp` (`FoodStack`) | `FoodHome`, `Search`, `RestaurantProfile`, `RestaurantOffers`, `RestaurantMenu` |
| Pharma | Home → `SubApp` `PHARMA` | `PharmaScreen`, `MedicalShopDetails`, `PrescriptionFlow`, `ProductDetail` |

## State

- `useCartStore` — add-to-cart.
- `useFavoriteStore` — favourites.
- `useFoodFilterStore` — Food veg/non-veg filter.
- `useSearchStore` — recent searches.
- `useLocationStore` — nearby origin.

## Data path

- Categories: `fetchCategories` / `fetchCategoryRail` → `GET /categories`, `/categories/rail` →
  `taxonomy.categories`.
- Stores: `getStores`, `getStoresNearby`, `getStore` → `directory.stores`.
- Products: `searchProducts`, `getStoreProducts`, `getProductsByIds`, `getProduct` →
  `catalog.products` / `inventory.stock`.
- Menus: `fetchVenues`, `fetchMenu` → `directory.dining_venues` / `directory.menus`.
- Mart uses no `@data/*` substitution on a failed live read; empty is empty. Pharma renders its
  authored category shell on a failed category read (`PharmaScreen.tsx:149-160,242`) — a no-mocks
  gap. Food still merges `@mock` fixture rows (`restaurantFeedService.ts` specials/topFoods,
  `SNACKS_BEVERAGES`) even while the gateway answers.

## Success / error / empty

- **Success:** server stores/products/menus render; prices match checkout.
- **Error:** empty surface + report-issue affordance; no stale fixture grouping in Mart; Pharma
  shows its authored offline shell, Food its fixture rails (both Known gaps).
- **Empty:** honest "no stores/products" state (Mart); Food falls back to fixture rails today
  (see Known gaps).

## Known gaps

- Root `Search` accepts `subApp: 'FOOD'` but `SearchRouteScreen` only branches Mart/Pharma and falls
  back to the Home config. Food uses its own `FoodStack` search. See
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- Food feed rails (`restaurantFeedService.ts`, `FoodHomeScreen.tsx`) render `@mock` fixtures
  (`topFoods`, `specials`, `SNACKS_BEVERAGES`) alongside live data — a no-mocks gap.
- Pharma's category grid renders the authored `PHARMA_PRODUCTS_DB` shell after a failed live read
  (`PharmaScreen.tsx:149-160,242`) — a no-mocks gap.
- Some `services/categoryVendors.ts` fixture helpers are unused by the live drill-in.

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (catalog/directory/search rows)
- `data/DATA_CONTROL.md`
