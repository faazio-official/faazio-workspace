# Customer discovery — domain index

**Status:** Shipped (Mart/Food/Pharma read from the gateway; authored data is offline-shell only)
**Routes:** `SubApp` (Mart/Pharma), `FoodApp` (`FoodStack`), `CategoryDrillIn`, `VendorDetails`,
`ProductDetail`, `Search`, `DealsLanding`, `MedicalShopDetails`
**Trigger:** Home launcher, search, category rail, deal card, or deep link.

## Flows

| Flow | Doc |
|---|---|
| Store/category drill-in | [store-drillin.md](./store-drillin.md) |
| Product detail | [product-detail.md](./product-detail.md) |
| Product review | [product-review.md](./product-review.md) |
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
- Product reviews: `getProduct` (reviews leg) → `GET /product/{id}/reviews`; write
  `submitProductReview` → `PUT /products/{id}/review` → `reviews.reviews` (delivered purchase only,
  latest wins).
- Menus: `fetchVenues`, `fetchMenu` → `directory.dining_venues` / `directory.menus`.
- Mart, Food and Pharma use no `@data/*` substitution on a failed live read: empty/error is honest.
  Pharma's category grid shows a retryable error instead of authored rows; Food's restaurant grid,
  top-rated and specials rails are server-derived (no server snack/category feed exists yet, so
  those online rails are omitted rather than fixture-filled).

## Success / error / empty

- **Success:** server stores/products/menus render; prices match checkout.
- **Error:** empty surface + retry/report-issue affordance; no stale fixture rows anywhere online.
- **Empty:** honest "no stores/products" state for Mart, Food and Pharma.

## Known gaps

- Root `Search` accepts `subApp: 'FOOD'` but `SearchRouteScreen` only branches Mart/Pharma and falls
  back to the Home config. Food uses its own `FoodStack` search. See
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- Some `services/categoryVendors.ts` fixture helpers are unused by the live drill-in.

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (catalog/directory/search rows)
- `data/DATA_CONTROL.md`
