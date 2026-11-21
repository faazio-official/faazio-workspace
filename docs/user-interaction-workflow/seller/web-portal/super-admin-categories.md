# Super admin — category taxonomy, mandatory GST, inline sub-categories + main app header

**App / route(s):** portal `/admin/super/categories` (`app/admin/super/categories/page.client.tsx`)
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Supply → Categories** in the Partner Portal.

This page absorbed the former **Sectors** page (`/admin/super/sectors`, deleted): the category tree and
the GST rate master are now two pages with one owner each — categories here, GST slabs on
[`super-admin-gst-rates.md`](./super-admin-gst-rates.md). A category never carries a free-form rate; it
links to a slab from that master.

## Steps

1. The page loads three reads: `GET /admin/categories` for the **Category tree** table,
   `GET /admin/categories?header=MAIN_APP_HEADER` for the **Main app header** table, and
   `useGSTRateCategories()` (`GET /admin/tax/gst-rate-categories`) for the slab pick-list. The tree
   keeps the `ALL / Mart / Food / Pharma / Main app header` filter chips (filtering by the primary
   `app`). Each tree row shows Name, App, **GST** (slab name + %), **Header labels**, Parent, Active,
   Sort and Updated.
2. **Main app header section** lists the standalone `MAIN_APP_HEADER` categories (e.g. "Electronics")
   plus the Mart/Pharma categories shared into the mobile main header. A shared Mart/Pharma row stays
   in its own app table too (one canonical `taxonomy.categories` row, several header labels).
3. **Create:** *New category* opens the sheet — App (Mart / Food / Pharma / **Main app header**),
   **GST rate** (mandatory select from the slab master, filtered to the chosen app's sector),
   **Header labels**, Name, **Name (Tamil)**, **Description (Tamil)**, Parent id, Icon URL, Vendor
   search query, Sort order, Active, and **Sub-categories**. Save calls `POST /categories` with
   `headerLabels`, `gstRateCategoryId`, `gstRatePct` and `subCategories`. The two Tamil fields
   validate with `tamilFieldError` (`src/lib/tamil.ts`) — Tamil letters, digits and light punctuation
   only, blank = untranslated — and a filled value is sent as `nameTa`/`descriptionTa`; a non-Tamil
   character blocks Save with a toast before any request is made. The gateway re-validates
   (`internal/platform/locale.IsTamilText`) and returns `400` if bypassed.
4. **GST pick (mandatory, Option B):** the parent picks one slab, and **every inline sub-category row
   picks its own slab in the same sheet**. A save is blocked while any row is unpicked. FOOD is
   pinned: the select is a read-only 5% display and the server rejects any other slab for a FOOD row.
   The stored `gst_rate_pct` is copied from the slab, never sent from the client — so a later slab
   re-rate does not silently re-price an existing category.
5. **Inline sub-categories:** each row in the Sub-categories editor is a name + its own GST pick +
   remove. Saving writes the child rows in the same transaction, with `show_on_home_rail = false` and
   only the parent's own app label — a sub-category is reached through the parent's drill-in, never as
   its own rail chip. On update, a `subCategories` array replaces the parent's child set; omitting it
   leaves the children untouched.
6. **Header labels:** the pill group shows all four labels. The primary app label is always on and
   cannot be toggled off; the other app labels are inert. **Main app header** is the toggle that
   shares the row into the main header list — disabled for FOOD. A `MAIN_APP_HEADER` row is its own
   primary label and cannot be tagged with a vendor app label.
7. **Edit:** *Edit* prefills the sheet (stored Tamil copy, the GST pick, the `MAIN_APP_HEADER` pill and
   the existing sub-categories) and calls `PUT /categories/{id}`. A nil `isActive` /
   `showOnHomeRail` / `headerLabels` / `subCategories` leaves the stored value unchanged; the primary
   app label always follows a changed App.
8. **Deactivate:** the trash button (or the sheet's Active toggle) soft-deletes via
   `DELETE /categories/{id}` (`is_active = false`); references from sellers/products are preserved.
9. **Share into the main app header:** toggle **Main app header** on a Mart or Pharma category (any
   tree level). The header is **unbounded** — Mart and Pharma share one horizontally scrolled strip,
   so any number of active rows can be shared. A child row is a valid chip: the customer drill-in
   opens that node's subtree. FOOD is rejected.
10. The customer app reads the curated chips from `GET /categories/rail` on the Home/Mart header (see
    the Home category rail flow). Tap → `CategoryDrillIn` (that node's subtree + vendored products). A
    header-only `MAIN_APP_HEADER` chip walks its own tree while the body searches the Mart pool.
11. **Seller product creation** (`/seller/products/new`) picks the active taxonomy **leaf** for the
    chosen store's sector and submits `taxonomyCategoryId`; the charged GST now comes from that
    category's link row — see [../catalog/add-product.md](../catalog/add-product.md).

## State

- `tab` — which app filter is loaded (`ALL`/`MART`/`FOOD`/`PHARMA`/`MAIN_APP_HEADER`).
- `rows` — the current `GET /admin/categories` projection (includes `gstRatePct`,
  `gstRateCategoryId`, `gstRateCategoryName`, `showOnHomeRail`, `headerLabels`).
- `mainRows` — the shared main app header list (`GET /admin/categories?header=MAIN_APP_HEADER`).
- `rateCategories` — the slab pick-list (`useGSTRateCategories`, shared with the GST rates page).
- Sheet form state — App, GST pick, header-label pills, name, Tamil name, Tamil description, parent,
  icon, search query, sort, Active, and the `subCategories` rows (name + GST pick each).
- No client-side category cache; each save refetches both tables.

## Data path

- `listCategories()` → `GET /admin/categories` → `taxonomy.categories` (+ `headerLabels`,
  + `tax.category_gst_rates ⋈ tax.gst_rate_categories`).
- `listCategoriesByHeader("MAIN_APP_HEADER")` → `GET /admin/categories?header=MAIN_APP_HEADER` →
  `taxonomy.categories ⋈ taxonomy.category_headers` where `header = 'MAIN_APP_HEADER'`.
- `createCategory()` / `updateCategory()` → `POST /categories` / `PUT /categories/{id}` →
  `taxonomy.categories` + `taxonomy.category_headers` + `tax.category_gst_rates` (+ child rows) in one
  transaction (SUPER_ADMIN; audit-logged). `gst_rate_pct` is copied from the picked slab; the handler
  rejects a missing pick, an inactive slab, an unknown slab and any non-5% slab on FOOD.
- `deleteCategory()` → `DELETE /categories/{id}` → `taxonomy.categories.is_active = false`.
- Home rail read → `GET /categories/rail` → active rows tagged `MAIN_APP_HEADER` (unbounded, Mart +
  Pharma combined, any tree level; header-only children excluded).
- Product link → `catalog.products.taxonomy_category_id` → `taxonomy.categories(id)`; the gateway
  validates an active leaf of the store's app and enriches `catalog.products.search_tokens`.
- Checkout rate → `tax.category_gst_rates` by `taxonomy_category_id` (FOOD pinned to 5%) — see
  `docs/architecture/db-schema.md` §12.43.

## Success / error / empty

- **Success:** row persists; toast *Category created/updated*; the next app boot / rail fetch sees it
  (no taxonomy cache).
- **GST errors:** `400` when the pick is missing, the slab is inactive/unknown, or a FOOD row is given
  a non-5% slab. The portal blocks an unpicked row before sending.
- **Sub-category errors:** `400` for a blank child name or a child with no GST pick.
- **Header label errors:** `400` for an unknown label, a label from another app, or
  `MAIN_APP_HEADER` on a FOOD row. The portal blocks the FOOD case before sending and shows a toast;
  the `0115` guard trigger also refuses it at the DB level.
- **Deactivate:** row stays visible in the admin list (inactive) but disappears from the rail/tree;
  existing seller/product references are kept.
- **Empty:** each section shows its own empty state ("No categories yet" / "Nothing shared yet").

## Known gaps

- Category ids, slugs and parents are entered as free text in the portal (no tree picker widget).
- Inline sub-category rows are created but cannot be reordered independently of the parent's sort.
- `GET /admin/categories` has no pagination; the tree is small today.

## Linked docs

- [`super-admin-gst-rates.md`](./super-admin-gst-rates.md) — the slab master this page picks from
- `docs/architecture/db-schema.md` §12.30 (taxonomy) + §12.43 (GST master + per-category link)
- `docs/architecture/monolith-breakdown.md` §1 (categories + tax rows)
- `docs/architecture/server-gateway-plan.md` (central category taxonomy)
- [`../catalog/add-product.md`](../catalog/add-product.md)
- [`../../customer/home/home-feed.md`](../../customer/home/home-feed.md)
