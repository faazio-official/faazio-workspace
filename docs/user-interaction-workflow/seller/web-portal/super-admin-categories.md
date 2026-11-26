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
   **GST rate** (mandatory select from the slab master, filtered to the chosen app's sector; for
   **Main app header** the pick-list combines the active Mart **and** Pharma slabs, since that pool
   carries both), **Header labels**, Name, **Name (Tamil)**, Icon URL, Vendor
   search query, Sort order, Active, and **Sub-categories**. Save calls `POST /categories` with
   `headerLabels`, `gstRateCategoryId`, `gstRatePct` and `subCategories`. The Tamil name field
   validates with `tamilFieldError` (`src/lib/tamil.ts`) — Tamil letters, digits and light punctuation
   only, blank = untranslated — and a filled value is sent as `nameTa`; a non-Tamil
   character blocks Save with a toast before any request is made. The gateway re-validates
   (`internal/platform/locale.IsTamilText`) and returns `400` if bypassed. Category descriptions were
   removed in `0140` — the sheet has no English or Tamil description field.
   There is **no parent-id input**: the sheet omits `parentId`, so a new category is top-level
   (`parent_id = null`), and its children are the inline sub-category rows, which the gateway binds
   with `parent_id = <this category>`. On edit the sheet likewise omits `parentId`, and the repo keeps
   the stored parent — a name/GST edit never re-parents or detaches an existing category.
4. **GST pick (mandatory, Option B):** the parent picks one slab, and **every inline sub-category row
   picks its own slab in the same sheet**. A save is blocked while any row is unpicked. A **Main app
   header** pool shows the combined active Mart + Pharma slab list for the parent and for each
   sub-category row (no Food slabs; `MAIN_APP_HEADER`-sector slabs are not offered). FOOD is
   pinned: the select is a read-only 5% display and the server rejects any other slab for a FOOD row.
   The stored `gst_rate_pct` is copied from the slab, never sent from the client — so a later slab
   re-rate does not silently re-price an existing category.
5. **Inline sub-categories:** the sheet is wide (`sm:max-w-2xl lg:max-w-3xl`) and each sub-category is
   a stacked card, one field per row so nothing is cramped: **Name** (+ remove button), **Name
   (Tamil)**, and its own **GST pick** (read-only 5% for FOOD). The Tamil name is **mandatory** — save
   is blocked with a toast while any child has an empty or non-Tamil Tamil name. Saving writes the
   child rows in the same transaction, with
   `show_on_home_rail = false` and only the parent's own app label — a sub-category is reached through
   the parent's drill-in, never as its own rail chip. On update, a `subCategories` array replaces the
   parent's child set; omitting it leaves the children untouched. Editing a category hydrates each
   child row with its stored `nameTa`.

   **Facet tags (per sub-category).** A leaf row in the Category tree shows a **Tags** action that
   opens the facet manager (`AttributeManagerSheet`, `app/admin/super/categories/attribute-manager.tsx`).
   It loads `GET /categories/{id}/attribute-groups` and edits groups (Patty, Cheese Type, Bun, Dosa
   Style) with their options (Chicken, Cheddar, Brioche), each option carrying an optional
   **filter tab** (for the customer drawer's Chicken | Paneer | Vegetables rail), an icon URL and
   **auto-tag keywords**. Saving calls `PUT /admin/categories/{id}/attribute-groups` (replace-all;
   ids are preserved so sellers' existing dish tags survive a reorder, removed options cascade their
   dish links). These groups are deliberately **not** sub-categories — they never appear in the tree or
   the customer drill-in; they are the filter facets the seller dish form and the customer filter
   drawer read. Tags are optional on a dish.

   **Tamil facet names (`0141`).** Each group and option has an optional **Tamil name** field in the
   facet sheet (`nameTa`); the seeded FOOD master is translated for all 12 groups / 164 options.
   Blank falls back to the English name, and the English label remains the stable key the dish tags
   reference.

   **Seed migrations `0139` + `0140` + `0143`.** The FOOD tree ships pre-seeded so a seller sees
   listable rows on `/seller/menus` before any manual entry: the original five roots (Burger, Dosa,
   Fried Rice, Chicken, Thali) plus the 20-category app-flow expansion (Rolls … Chicken 65), each with
   one leaf (`cat-<slug>` / `sub-<slug>`), a mandatory 5% `gst-food-standard` row per category and a
   `FOOD` header label per row (never `MAIN_APP_HEADER`). `0139` seeds the Burger facet master
   (Patty with 5 tabs, Patty Type, Cheese Type, Dressing / Sauce, Toppings, Bun Type, Region /
   Cuisine Origin); `0143` adds the global Dietary Preference on every new leaf and the Ice Cream
   (Flavour tabs + Type), Shake (Flavour tabs + Type + Additive) and Rolls (Ingredient tabs + Base +
   Region) masters. Group/option ids are deterministic (`ag-<slug>`, `ao-<slug>-<label>`), so
   re-applying updates in place and never orphans a seller's dish tags. `0140` makes the curated tree
   the only FOOD tree (Tamil names, no category descriptions, seller items remapped, legacy shelves
   deleted). `0143` also adds the per-category `priceTierSet` (`standard` / `premium` / `snack`) used
   by the customer price filter. Option icons are left null until uploaded to R2 (the facet sheet and
   category form already edit the icon URL).
6. **Header labels:** the pill group shows all four labels. The primary app label is always on and
   cannot be toggled off; the other app labels are inert. **Main app header** is the toggle that
   shares the row into the main header list — disabled for FOOD. A `MAIN_APP_HEADER` row is its own
   primary label and cannot be tagged with a vendor app label.
7. **Edit:** *Edit* prefills the sheet (stored Tamil name, the GST pick, the `MAIN_APP_HEADER` pill and
   the existing sub-categories, each with its stored `nameTa`) and calls
   `PUT /categories/{id}`. A nil `isActive` / `showOnHomeRail` / `headerLabels` / `subCategories` /
   `parentId` leaves the stored value unchanged — the sheet never sends `parentId`, so an edit can
   never re-parent or detach the row; the primary app label always follows a changed App.
8. **Delete → trash (soft delete, 7-day undo):** the trash button opens a confirm dialog with an
   optional **Reason**. Deleting moves the category **and its whole subtree** to the trash
   (`DELETE /categories/{id}?moveTo=&reason=`) — `deleted_at = now()`, `is_active = false` for the
   node and every descendant (`0136`). The rows leave the app reads, the rail, seller pickers and the
   admin list **immediately**, and appear under the **Deleted** chip. Listings are never orphaned:
   when the subtree owns any live listing, the dialog shows how many and requires a **move target** —
   a live category at the same tree level (top-level→top-level, child→child) in the same app, never
   the node itself or anything inside its subtree. The selected target's active leaf receives every
   affected listing (`taxonomy_category_id` + `category` updated in the same transaction) and the
   toast reports `N listings moved to <name>`. A subtree with no listings trashes without a prompt.
   The gateway refuses a listing-owning delete that names no target (`409 move_required`), a
   bad/absent/cross-level/descendant target (`400 invalid_move_target`), and a row already in the trash
   (`404 not_found`).
9. **Active / Inactive toggle:** the **Active** column is an inline `Switch` that calls
   `PATCH /categories/{id}/toggle` — a plain hide (`is_active`), not a delete. It never touches the
   trash, descendants or listings, and the row stays in the admin list (inactive) while disappearing
   from the rail/tree. It is refused on a trashed row (restore it first).
10. **Deleted (trash) view:** the **Deleted** chip beside the app tabs swaps the tree table for the
   soft-deleted list — Name, App, Parent, Deleted (`deletedAt` + `purgeAt`), Reason, and a **Restore**
   button per row. Each row also has a checkbox, and the header checkbox selects all; with a selection
   the toolbar shows **Delete forever**, which permanently removes every selected trashed subtree
   (`DELETE /categories/{id}/permanent`, one call per row). A subtree still referenced by a listing,
   store or menu is kept and reported (`409 category_in_use`) — it cannot be purged until those
   references are gone. Restore (`POST /categories/{id}/restore`) brings the whole subtree back
   **deactivated**, so the operator re-enables it deliberately; a row past the 7-day window is purged
   and reported as `410 trash_expired`.
11. **Auto-flush:** the gateway `categories.Purger` sweeps hourly, removing trashed rows older than
   `CategoryTrashWindow` (7 days) that nothing references; the trash read also sweeps first, so an
   expired row never shows as restorable. A trashed parent is skipped until its trashed children go.
12. **Share into the main app header:** toggle **Main app header** on a Mart or Pharma category (any
   tree level). The header is **unbounded** — Mart and Pharma share one horizontally scrolled strip,
   so any number of active rows can be shared. A child row is a valid chip: the customer drill-in
   opens that node's subtree. FOOD is rejected.
13. The customer app reads the curated chips from `GET /categories/rail` on the Home/Mart header (see
    the Home category rail flow). Tap → `CategoryDrillIn` (that node's subtree + vendored products). A
    header-only `MAIN_APP_HEADER` chip walks its own tree while the body searches the Mart pool.
14. **Seller product creation** (`/seller/products/new`) picks the active taxonomy **leaf** for the
    chosen store's sector and submits `taxonomyCategoryId`; the charged GST now comes from that
    category's link row — see [../catalog/add-product.md](../catalog/add-product.md).

## State

- `tab` — which app filter is loaded (`ALL`/`MART`/`FOOD`/`PHARMA`/`MAIN_APP_HEADER`).
- `rows` — the current `GET /admin/categories` projection (includes `gstRatePct`,
  `gstRateCategoryId`, `gstRateCategoryName`, `showOnHomeRail`, `headerLabels`, and `productCount` —
  the live listings linked directly to the node, summed over the subtree to decide whether a delete
  needs a move target).
- `deleting` / `deleteTarget` / `deleteReason` — the row being deleted, the same-level category chosen
  to receive its listings, and the optional reason kept with the trashed row. `deleteImpact(row)` sums
  `productCount` over `subtreeOf(row)`; `moveTargets(row)` offers only live, same-app, same-level rows
  outside that subtree.
- `showTrash` / `trashed` / `trashLoading` / `trashError` — the Deleted view and its read
  (`GET /admin/categories/trash`), shown instead of the tree when the Deleted chip is on.
- `selected` — the set of trashed row ids ticked for the bulk "delete forever"; `confirmPurge` guards
  the confirmation dialog.
- `mainRows` — the shared main app header list (`GET /admin/categories?header=MAIN_APP_HEADER`).
- `tagging` — the leaf sub-category whose facet groups are open in `AttributeManagerSheet` (its own
  local draft groups/options; saved in one replace-all call).
- `rateCategories` — the slab pick-list (`useGSTRateCategories`, shared with the GST rates page).
- Sheet form state — App, GST pick, header-label pills, name, Tamil name, icon, search query, sort,
  Active, and the `subCategories` rows (name + Tamil name + GST pick each). No parent-id state: new
  categories are top-level.
- No client-side category cache; each save refetches both tables.

## Data path

- `listCategories()` → `GET /admin/categories` → `taxonomy.categories` (+ `headerLabels`,
  + `tax.category_gst_rates ⋈ tax.gst_rate_categories`).
- `listCategoriesByHeader("MAIN_APP_HEADER")` → `GET /admin/categories?header=MAIN_APP_HEADER` →
  `taxonomy.categories ⋈ taxonomy.category_headers` where `header = 'MAIN_APP_HEADER'`.
- `fetchSubcategoryAttributes(id)` → `GET /categories/{id}/attribute-groups` →
  `taxonomy.subcategory_attribute_groups ⋈ taxonomy.attribute_options`. `replaceSubcategoryAttributes(id, groups)`
  → `PUT /admin/categories/{id}/attribute-groups` → one transaction upserting groups + options by id
  (new rows mint `ag-`/`ao-` ids) and deleting the ones the payload dropped (SUPER_ADMIN).
- `createCategory()` / `updateCategory()` → `POST /categories` / `PUT /categories/{id}` →
  `taxonomy.categories` + `taxonomy.category_headers` + `tax.category_gst_rates` (+ child rows) in one
  transaction (SUPER_ADMIN; audit-logged). `gst_rate_pct` is copied from the picked slab; the handler
  rejects a missing pick, an inactive slab, an unknown slab and any non-5% slab on FOOD.
- `deleteCategory(id, moveTo?, reason?)` → `DELETE /categories/{id}?moveTo=&reason=` → one transaction:
  the subtree's listings are re-linked to the destination's active leaf
  (`catalog.products.taxonomy_category_id` + `category`), then the node and every descendant get
  `deleted_at = now()` + `is_active = false` + `delete_reason` (`0136`). Returns
  `{trashed, movedProducts, targetId, targetName}`. The destination leaf is the target itself when
  childless, else its first active descendant leaf by `(sort_order, id)`.
- `setCategoryActive(id, isActive)` → `PATCH /categories/{id}/toggle` → `taxonomy.categories.is_active`
  for one live row (a hide, no trash, no descendant change).
- `listDeletedCategories(app?)` → `GET /admin/categories/trash` → `taxonomy.categories` where
  `deleted_at is not null`; `restoreCategory(id)` → `POST /categories/{id}/restore` clears
  `deleted_at` for the node **and every descendant** (subtree returns deactivated);
  `purgeCategory(id)` → `DELETE /categories/{id}/permanent` hard-deletes one trashed, unreferenced
  subtree. The gateway purger (`categories.Purger`, hourly) removes rows older than 7 days.
- Home rail read → `GET /categories/rail` → active rows tagged `MAIN_APP_HEADER` (unbounded, Mart +
  Pharma combined, any tree level; header-only children excluded).
- Product link → `catalog.products.taxonomy_category_id` → `taxonomy.categories(id)`; the gateway
  validates an active leaf of the store's app and enriches `catalog.products.search_tokens`.
- Checkout rate → `tax.category_gst_rates` by `taxonomy_category_id` (FOOD pinned to 5%) — see
  `docs/architecture/db-schema.md` §12.43.

## Success / error / empty

- **Success:** row persists; toast *Category created/updated*; the next app boot / rail fetch sees it
  (no taxonomy cache). A delete moves the subtree to Deleted with a 7-day undo; a restore brings it
  back deactivated.
- **Trash errors:** `404 not_found` when deleting an already-trashed row or restoring a live one;
  `410 trash_expired` when the restore window has closed (the row is purged); `409 category_in_use`
  when a permanent delete is refused because a listing, store or menu still references the subtree.
- **GST errors:** `400` when the pick is missing, the slab is inactive/unknown, or a FOOD row is given
  a non-5% slab. The portal blocks an unpicked row before sending.
- **Sub-category errors:** `400` for a blank child name, a child with no Tamil name, non-Tamil (or
  over-length) Tamil copy, or a child with no GST pick. The portal blocks an empty/non-Tamil Tamil
  name and an unpicked GST row before sending.
- **Facet-tag errors:** `400 bad_request` for a blank group name or option label, a bad input type or
  an over-long tab; `409 conflict` when a group slug or option label is duplicated within the
  sub-category; `404 not_found` when the sub-category was deleted meanwhile.
- **Header label errors:** `400` for an unknown label, a label from another app, or
  `MAIN_APP_HEADER` on a FOOD row. The portal blocks the FOOD case before sending and shows a toast;
  the `0115` guard trigger also refuses it at the DB level.
- **Deactivate:** row stays visible in the admin list (inactive) but disappears from the rail/tree;
  existing seller/product references are kept.
- **Empty:** each section shows its own empty state ("No categories yet" / "Nothing shared yet" /
  "Nothing deleted").

## Known gaps

- Category ids and slugs are entered as free text in the portal; there is no parent picker — the sheet
  only creates top-level rows, and children come from the inline sub-category editor.
- Inline sub-category rows are created but cannot be reordered independently of the parent's sort.
- `GET /admin/categories` has no pagination; the tree is small today.

## Linked docs

- [`super-admin-gst-rates.md`](./super-admin-gst-rates.md) — the slab master this page picks from
- `docs/architecture/db-schema.md` §12.30 (taxonomy) + §12.4 (menu + attribute facets, `0138`) + §12.43 (GST master + per-category link)
- `docs/architecture/monolith-breakdown.md` §1 (categories + tax rows)
- `docs/architecture/server-gateway-plan.md` (central category taxonomy)
- [`../catalog/add-product.md`](../catalog/add-product.md)
- [`../../customer/home/home-feed.md`](../../customer/home/home-feed.md)
