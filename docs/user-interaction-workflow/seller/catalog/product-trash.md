# Edit, delete and restore a listing (trash)

**App / route:** portal `/seller/products/[id]/edit`, `/seller/products/trash`
**Status:** Shipped
**Trigger:** Seller opens a listing and saves changes or deletes it; seller opens the Trash link on
`/seller/products`.

## Edit

1. The edit screen loads the hydrated row (`useProduct` over `GET /seller/pricing` /
   `GET /seller/inventory`).
2. Save calls `PUT /seller/products/{id}` with the descriptive fields — `name`, `description`,
   `category`, `isVeg`, `isPrescription` — plus `PUT /seller/pricing/{productId}` for price and
   `PUT /seller/products/{id}` (`imageKey`/`imageAssetId`) for the photo.
3. The gateway re-tokenizes `search_tokens` from the new name/category/description, writes
   `catalog.products` (+ `inventory.stock` for price/Rx) in one transaction, and purges the
   product/stock/store-products + nearby-tile caches.
4. Optimistic local update; a rejected write rolls the row back and toasts the failure.

## Delete (soft delete)

1. Delete opens a confirm sheet and calls `DELETE /seller/products/{id}?reason=…`.
2. The gateway sets `catalog.products.deleted_at = now()` and `delete_reason`, and purges the
   product's cache keys + geo tiles. The row leaves every shopper read (`deleted_at is null`) and
   the seller's active list immediately.
3. It remains restorable from the trash for **7 days**. After that
   `catalog.purge_deleted_products` (pg_cron hourly, or the gateway sweep run on each trash read)
   permanently removes the product and its `inventory.stock` row. Order history is preserved.

## Trash / restore

1. `/seller/products/trash` calls `GET /seller/products/trash` (caller-scoped: seller, district or
   super admin). Rows are newest-deletion first and carry `deletedAt`, `deleteReason` and `purgeAt`
   (`deletedAt + 7 days`).
2. Restore calls `POST /seller/products/{id}/restore`, which clears `deleted_at`/`delete_reason`,
   purges the caches, and the listing returns to its previous lifecycle status.
3. The page shows a days-left badge (`Nd left` / `Today`) and reloads the store on success.

## State

- Portal Zustand products slice for the active list; the trash list is fetched directly
  (`fetchProductTrash`) because it is intentionally absent from the hydrated active store.

## Data path

- `PUT /seller/products/{id}` → `catalog.products` (name/description/category/isVeg/isPrescription).
- `DELETE /seller/products/{id}` → `catalog.products.deleted_at` / `delete_reason` (`0089`).
- `POST /seller/products/{id}/restore` → clears the soft delete.
- `GET /seller/products/trash` → `catalog.products where deleted_at is not null`.
- Purge: `catalog.purge_deleted_products('7 days')` → deletes product + `inventory.stock`.

## Success / error / empty

- **Success:** save/delete/restore are server-confirmed; the trash row disappears on restore.
- **Error:** delete rollback re-inserts the row; restore failure re-reads the trash (the row may have
  passed the window and been purged).
- **Empty:** "No deleted listings — items you delete stay here for a week before they are removed".

## Linked docs

- [`index.md`](./index.md)
- `docs/architecture/db-schema.md` §5.1
- `docs/architecture/monolith-breakdown.md` (catalog row)
- `docs/architecture/caching-cloudflare-valkey.md`
