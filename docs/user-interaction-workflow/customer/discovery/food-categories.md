# Food category rail + drill-in

**App / route(s):** customer · FoodStack `FoodHome` rail (`features/food/components/FoodCategoryRail.tsx`) → `FoodCategoryDrillIn` (`features/food/screens/FoodCategoryDrillInScreen.tsx`)
**Status:** Shipped
**Trigger:** Shopper taps a category chip under the Food home ad banner.

## Steps

1. `FoodHomeScreen` renders `FoodCategoryRail` in the grid list header, directly below the
   `FOOD_HERO` ad banner.
2. The rail reads the superadmin taxonomy (`fetchCategories('FOOD')`) and keeps only top-level
   roots (`parentId === null`). A failed read renders no rail — never fixture chips.
3. Each chip shows the category's server `iconUrl` when present. A category with no uploaded
   image (or a broken image URL) shows a rounded food glyph (`UtensilsCrossed`, `foodTheme`
   tint) and the localized name, so every category stays visible and tappable.
4. Tapping a chip opens `FoodCategoryDrillIn` with `{ categoryId, title }`.
5. The drill-in reads the full FOOD tree, resolves the tapped node and walks its descendants to
   its leaves. A childless category is its own single leaf.
6. When a node has more than one leaf, a pill rail lists them (first selected); tapping a pill
   re-scopes the results without leaving the page.
7. For the active leaf the page runs the same server dish search the Food search uses:
   `searchQuery` (English) when present, otherwise the category name, via
   `gateway.searchProducts(query, 'FOOD')`.
8. Results render as `SearchDishCard` rows (server price/image, add/stepper). The shared
   All / Veg / Non-Veg `foodFilterStore` filter is applied client-side to the result rows.
9. Tapping a dish opens the root `ProductDetail`. Back returns to `FoodHome`.

## State

- `useLanguageStore` — localized category/leaf labels (`nameTa` falls back to English).
- `useFoodFilterStore` — the shared Food diet filter applied to the result rows.
- `useCartStore` — the dish card's add/quantity stepper (via `SearchDishCard`).

## Data path

- `fetchCategories('FOOD')` → `GET /categories?app=FOOD` → `taxonomy.categories` (active rows,
  `taxonomy.category_headers` labels). The rail filters to roots client-side.
- `searchProducts(query, 'FOOD')` → `GET /search?q=&app=FOOD` → `catalog.products` (ACTIVE rows
  only), mapped by `features/food/utils/productViewToDish.ts`.
- Offline / failed reads render honest error or empty states with a retry — no `@data/*`
  substitution.

## Success / error / empty

- **Success:** chips → leaf results (dish rows with server prices); the diet toggle filters rows.
- **Error:** the taxonomy or search read failed → labeled retry state.
- **Empty:** a live category with no matching catalog dishes shows "No dishes in this category
  yet"; an active diet filter that hides every match shows the shared `DietEmptyNote`.

## Known gaps

- None beyond the Food search scope: the drill-in uses the same `catalog.products` FTS as Food
  search, so it does not read dishes that exist only in `directory.menus`.

## Linked docs

- [`food-search.md`](./food-search.md)
- [`../../seller/web-portal/super-admin-categories.md`](../../seller/web-portal/super-admin-categories.md)
- `docs/architecture/mobile-app.md` (Food home)
- `docs/FAAZIO_USER_FLOW_GUIDE.md` (§2.6–2.7)
