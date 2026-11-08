# Food search

**App / route:** customer · FoodStack `Search` (`features/food/screens/FoodSearchScreen.tsx`)
**Status:** Shipped
**Trigger:** FoodHome search entry (`FoodHomeScreen.tsx`) or a Food search deep link.

## Steps

1. `FoodHomeScreen` navigates `FoodStack` → `Search` (`navigation/FoodStack.tsx:24`).
2. `FoodSearchScreen` composes the shared `SearchScreen` shell with the Food config
   (`createFoodSearchConfig`): dishes-only, toggle-less, with restaurant filter chips.
3. Results come from `config.fetch` → `searchProducts` (`GET /search/products`), filtered by the
   Food veg/non-veg `useFoodFilterStore.dietFilter`.
4. Tapping a dish maps it with `dishToProduct` and navigates the root stack to
   `ProductDetail` (`{ product }`).
5. Back returns to `FoodHome`; the fixed bottom nav can move to Home/Cart/You.

## State

- `useFoodFilterStore` — `dietFilter` (veg / non-veg / all).
- `useSearchStore` — recent searches (shared shell).
- `useCartStore` — cart bar count / add-to-cart from a result.

## Data path

- `searchProducts` → `GET /search/products` → `catalog.products` / `directory.stores`.
- Offline: `SearchScreen` renders an explicitly labelled "Showing offline results" shell; it never
  presents fixture rows as live.

## Success / error / empty

- **Success:** live dish rows render with server prices.
- **Error/offline:** labelled offline results or the shell's retry state.
- **Empty:** honest "no results" state for the query.

## Known gaps

- The root `Search` (`SearchRouteScreen`) does not yet branch `subApp: 'FOOD'`; Food uses this
  dedicated stack search instead. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- [`store-drillin.md`](./store-drillin.md) (Food home / venue drill-in)
- `docs/architecture/mobile-app.md`
- `data/DATA_CONTROL.md`
