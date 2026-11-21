# Super admin — category taxonomy, header labels + main app header

**App / route(s):** portal `/admin/super/categories` (`app/admin/super/categories/page.client.tsx`)
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Supply → Categories** in the Partner Portal.

## Steps

1. The page loads two reads: `GET /admin/categories` for the **Category tree** table and
   `GET /admin/categories?header=MAIN_APP_HEADER` for the **Main app header** table. The tree keeps the
   `ALL / Mart / Food / Pharma` filter chips (filtering by the primary `app`). Each tree row shows
   Name, App, **Header labels**, Parent, Active, Sort and Updated.
2. **Main app header section** lists only the rows tagged `MAIN_APP_HEADER` — the categories Mart and
   Pharma share into the mobile main header. A shared row stays in its own app table too (one
   canonical `taxonomy.categories` row, several header labels).
3. **Create:** *New category* opens the sheet — App, **Header labels**, Name, **Name (Tamil)**,
   **Description (Tamil)**, Parent id, Icon URL, Vendor search query, Sort order, Active. Save calls
   `POST /categories` with `headerLabels` (and the `showOnHomeRail` alias). The two Tamil fields
   validate with `tamilFieldError` (`src/lib/tamil.ts`) — Tamil letters, digits and light punctuation
   only, blank = untranslated — and a filled value is sent as `nameTa`/`descriptionTa`; a non-Tamil
   character blocks Save with a toast before any request is made. The gateway re-validates
   (`internal/platform/locale.IsTamilText`) and returns `400` if bypassed.
4. **Header labels:** the pill group shows all four labels. The primary app label is always on and
   cannot be toggled off; the other app labels are inert. **Main app header** is the toggle that
   shares the row into the main header list — disabled for FOOD.
5. **Edit:** *Edit* prefills the sheet (including stored Tamil copy and the `MAIN_APP_HEADER` pill) and
   calls `PUT /categories/{id}`. A nil `isActive` / `showOnHomeRail` / `headerLabels` leaves the stored
   value unchanged; the primary app label always follows a changed App. Each row shows the Tamil name
   under the English one once translated.
6. **Deactivate:** the trash button (or the sheet's Active toggle) soft-deletes via
   `DELETE /categories/{id}` (`is_active = false`); references from sellers/products are preserved.
7. **Share into the main app header:** toggle **Main app header** on a Mart or Pharma category (any
   tree level). The header is **unbounded** — Mart and Pharma share one horizontally scrolled strip,
   so any number of active rows can be shared. A child row is a valid chip: the customer drill-in
   opens that node's subtree. FOOD is rejected.
8. The customer app reads the curated chips from `GET /categories/rail` on the Home/Mart header
   (see the Home category rail flow). Tap → `CategoryDrillIn` (that node's subtree + vendored
   products).
9. **Seller product creation** (`/seller/products/new`) picks the active taxonomy **leaf** for the
   chosen store's sector and submits `taxonomyCategoryId` alongside the GST category — see
   [../catalog/add-product.md](../catalog/add-product.md).

## State

- `tab` — which app filter is loaded (`ALL`/`MART`/`FOOD`/`PHARMA`).
- `rows` — the current `GET /admin/categories` projection (includes `showOnHomeRail` + `headerLabels`).
- `mainRows` — the shared main app header list (`GET /admin/categories?header=MAIN_APP_HEADER`).
- Sheet form state — App, header-label pills, name, Tamil name, Tamil description, parent, icon,
  search query, sort, Active.
- No client-side category cache; each save refetches both tables.

## Data path

- `listCategories()` → `GET /admin/categories` → `taxonomy.categories` (+ `headerLabels`).
- `listCategoriesByHeader("MAIN_APP_HEADER")` → `GET /admin/categories?header=MAIN_APP_HEADER` →
  `taxonomy.categories ⋈ taxonomy.category_headers` where `header = 'MAIN_APP_HEADER'`.
- `createCategory()` / `updateCategory()` → `POST /categories` / `PUT /categories/{id}` →
  `taxonomy.categories` + `taxonomy.category_headers` in one transaction (SUPER_ADMIN; audit-logged).
  `headerLabels` is the curated label set (`0115`); `show_on_home_rail` stays a mirror of the
  `MAIN_APP_HEADER` label. `name_ta`/`description_ta` are display-only translations (`0107`): the
  mobile app shows them when the shopper picked Tamil, and falls back to `name`/`description` when
  empty. Never searched.
- `deleteCategory()` → `DELETE /categories/{id}` → `taxonomy.categories.is_active = false`.
- Home rail read → `GET /categories/rail` → active rows tagged `MAIN_APP_HEADER` (unbounded, Mart +
  Pharma combined, any tree level; `show_on_home_rail` kept as a fallback for pre-`0115` rows).
- Product link → `catalog.products.taxonomy_category_id` → `taxonomy.categories(id)`; the gateway
  validates an active leaf of the store's app and enriches `catalog.products.search_tokens`.

## Success / error / empty

- **Success:** row persists; toast *Category created/updated*; the next app boot / rail fetch sees it
  (no taxonomy cache).
- **Header label errors:** `400` for an unknown label, a label from another app, or
  `MAIN_APP_HEADER` on a FOOD row. The portal blocks the FOOD case before sending and shows a toast;
  the `0115` guard trigger also refuses it at the DB level.
- **Deactivate:** row stays visible in the admin list (inactive) but disappears from the rail/tree;
  existing seller/product references are kept.
- **Empty:** each section shows its own empty state ("No categories yet" / "Nothing shared yet").

## Known gaps

- Category ids, slugs and parents are entered as free text in the portal (no tree picker widget).
- `GET /admin/categories` has no pagination; the tree is small today.

## Linked docs

- `docs/architecture/db-schema.md` §12.30
- `docs/architecture/monolith-breakdown.md` §1 (categories row)
- `docs/architecture/server-gateway-plan.md` (central category taxonomy)
- [`../catalog/add-product.md`](../catalog/add-product.md)
- [`../../customer/home/home-feed.md`](../../customer/home/home-feed.md)
