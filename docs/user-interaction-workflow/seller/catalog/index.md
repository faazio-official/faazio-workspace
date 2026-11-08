# Seller catalog — domain index

**Status:** Shipped
**Routes:** portal `/seller/products`, `/seller/products/new`, `/seller/products/[id]/edit`,
`/seller/products/trash`, `/seller/inventory`, `/seller/menus`, `/seller/pricing`
**Trigger:** Seller console → Products / Inventory / Menus / Pricing.

## Flows

| Flow | Doc |
|---|---|
| Add product | [add-product.md](./add-product.md) |
| Price / inventory / menu update | [price-update.md](./price-update.md) |
| Edit / delete / restore (trash) | [product-trash.md](./product-trash.md) |

## Surfaces

- **Products:** list/create/edit, image upload, status, soft delete → trash with restore.
- **Inventory:** stock qty + ETA per product (`GET /seller/inventory`,
  `PUT /seller/inventory/{productId}`).
- **Pricing:** price-only updates (`GET /seller/pricing`, `PUT /seller/pricing/{productId}`).
- **Menus:** Food dishes per venue (`GET/POST /seller/menus`, `PUT/DELETE
  /seller/menus/{venueId}/{dishId}`).

## State

- Portal store + local form state; no mobile store (WebView shell).

## Data path

- `catalog.products` (incl. `deleted_at`/`delete_reason`, `0089`), `inventory.stock`,
  `directory.menus`, `media.assets`.
- Seller writes are scoped to an owned **live** store; ownership derives through
  `directory.stores.seller_id`.
- Deleted listings stay in the trash for 7 days, then `catalog.purge_deleted_products` (or the
  gateway sweep on a trash read) permanently removes the product + its stock row.

## Success / error / empty

- **Success:** server-confirmed product/stock/menu rows render; edits/deletes are gateway writes.
- **Error:** a rejected write rolls the optimistic change back and toasts the failure; the form does
  not claim an unconfirmed save.
- **Empty:** no rows → honest empty state; empty trash → "no deleted listings".

## Known gaps

- New-product page hardcodes GST/TCS/TDS constants for display; the server is the money authority.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (catalog/directory rows)
- `docs/architecture/web-portal.md`
- `docs/architecture/db-schema.md`
