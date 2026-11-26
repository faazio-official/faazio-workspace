# Super admin — Food master data (atomic taxonomy, store rules, sample dishes)

**App / route(s):** portal `/admin/super/food-master` (`app/admin/super/food-master/page.client.tsx`)
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Supply → Food master** in the Partner Portal.

Read-only reference data for the FOOD catalogue, seeded by migration
`0145_food_master_data_import.sql` from the approved `food_video_catalog_master_data` workbook. Live
seller dishes stay on **Menus**; navigation/GST stays on **Categories**.

## Steps

1. The page loads two reads in parallel:
   - `GET /admin/food-master` — `{ atomicTaxonomy, storeConfig, sampleMenu }`.
   - `GET /admin/categories?app=FOOD` — the FOOD carousel rows with their `atomicCategory` /
     `atomicSubcategory` mapping.
2. Four tabs, each a compact table with a shared search box:
   - **Atomic taxonomy** — `taxonomy.food_atomic_taxonomy` (147 cuisine sub-categories, grouped by
     category, with the 5% FOOD GST slab).
   - **Carousel map** — the 24 carousel categories resolved to `atomic_category › atomic_subcategory`
     (e.g. Dosa → South Indian › Tamil Tiffin).
   - **Store rules** — `taxonomy.store_config_options` (Schedule, Dietary Policy, Trust & Rating,
     Delivery & Offers) with collection stage and a truncated behaviour note.
   - **Sample dishes** — `taxonomy.food_sample_menu_items` (15 templates) with diet, price, bucket and
     cuisine origin. These are templates; migration `0146` also publishes them on the customer-visible
     `venue-food-lab` demo venue (15 ACTIVE `directory.menus` rows + facet tags), so the customer app
     can show real DB-backed dishes without a client fixture.
3. A failed read shows the standard error state; an empty search shows the standard empty state. No
   fixtures are substituted.

## Data / state

- Reads only (`src/lib/api` → `/api/gateway/...`). No local store; tab + query are component state.
- Write authority stays with the category/facet screens and the menu form; the workbook tables are
  origin reference data.

## Success / error / empty

- **Success:** the selected tab renders its rows, count in the section title.
- **Loading:** `DataShell` skeleton while either read is in flight.
- **Error:** `DataShell` error state with the gateway message (no fabricated rows).
- **Empty:** the "Nothing here" state when a search matches no row.

## Related

- [Categories + facets + mandatory GST](./super-admin-categories.md)
- [Menu creation (seller)](./menu-creation.md)
- `docs/architecture/db-schema.md` §12.30 / `server-gateway-plan.md` (categories context)
