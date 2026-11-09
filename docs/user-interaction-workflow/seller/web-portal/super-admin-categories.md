# Super admin — category taxonomy + home rail

**App / route(s):** portal `/admin/super/categories` (`app/admin/super/categories/page.client.tsx`)
**Status:** Shipped
**Trigger:** SUPER_ADMIN opens **Supply → Categories** in the Partner Portal.

## Steps

1. The page loads `GET /admin/categories` (all rows, including deactivated) with the `ALL / Mart /
   Food / Pharma` filter chips. Each row shows Name, App, Parent, Active, **Rail**, Sort and Updated.
2. **Create:** *New category* opens the sheet — App, Name, Parent id, Icon URL, Vendor search query,
   Sort order, Active, **Home rail**. Save calls `POST /categories`.
3. **Edit:** *Edit* prefills the sheet and calls `PUT /categories/{id}`. A nil `isActive` /
   `showOnHomeRail` leaves the stored value unchanged.
4. **Deactivate:** the trash button (or the sheet's Active toggle) soft-deletes via
   `DELETE /categories/{id}` (`is_active = false`); references from sellers/products are preserved.
5. **Curate the home rail:** toggle **Home rail** on a top-level Mart or Pharma category. The rail is
   capped at **3 active categories globally**; the portal checks the full tree before saving so a
   per-app tab cannot hide an existing slot. Success marks the row with a `Rail` badge.
6. The customer app reads the curated chips from `GET /categories/rail` on the Home/Mart header
   (see the Home category rail flow). Tap → `CategoryDrillIn` (leaf tree + vendored products).
7. **Seller product creation** (`/seller/products/new`) picks the active taxonomy **leaf** for the
   chosen store's sector and submits `taxonomyCategoryId` alongside the GST category — see
   [../catalog/add-product.md](../catalog/add-product.md).

## State

- `tab` — which app filter is loaded (`ALL`/`MART`/`FOOD`/`PHARMA`).
- `rows` — the current `GET /admin/categories` projection (includes `showOnHomeRail`).
- Sheet form state — App, name, parent, icon, search query, sort, Active, Home rail.
- No client-side category cache; each save refetches the list.

## Data path

- `listCategories()` → `GET /admin/categories` → `taxonomy.categories`.
- `createCategory()` / `updateCategory()` → `POST /categories` / `PUT /categories/{id}` →
  `taxonomy.categories` (SUPER_ADMIN; audit-logged).
- `deleteCategory()` → `DELETE /categories/{id}` → `taxonomy.categories.is_active = false`.
- Home rail read → `GET /categories/rail` → `taxonomy.categories WHERE is_active AND
  show_on_home_rail AND parent_id IS NULL` (max 3).
- Product link → `catalog.products.taxonomy_category_id` → `taxonomy.categories(id)`; the gateway
  validates an active leaf of the store's app and enriches `catalog.products.search_tokens`.

## Success / error / empty

- **Success:** row persists; toast *Category created/updated*; the next app boot / rail fetch sees it
  (no taxonomy cache).
- **Rail errors:** `400` when the category is FOOD or has a parent; `409 rail_full` when three active
  rail rows already exist. The portal also validates before sending and shows a toast.
- **Deactivate:** row stays visible in the admin list (inactive) but disappears from the rail/tree;
  existing seller/product references are kept.
- **Empty:** the section shows "No categories yet" with a prompt to create a top-level category.

## Known gaps

- The rail cap is enforced with a count check around the write, not a database constraint; two
  simultaneous super-admin saves could race past the limit (rare, portal-only).
- Category ids, slugs and parents are entered as free text in the portal (no tree picker widget).
- `GET /admin/categories` has no pagination; the tree is small today.

## Linked docs

- `docs/architecture/db-schema.md` §12.30
- `docs/architecture/monolith-breakdown.md` §1 (categories row)
- `docs/architecture/server-gateway-plan.md` (central category taxonomy)
- [`../catalog/add-product.md`](../catalog/add-product.md)
- [`../../customer/home/home-feed.md`](../../customer/home/home-feed.md)