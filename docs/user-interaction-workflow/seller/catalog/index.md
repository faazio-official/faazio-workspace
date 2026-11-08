# Seller catalog — domain index

**Status:** Partial (product name/description edit + delete are local-only)
**Routes:** portal `/seller/products`, `/seller/products/new`, `/seller/products/[id]/edit`,
`/seller/inventory`, `/seller/menus`, `/seller/pricing`
**Trigger:** Seller console → Products / Inventory / Menus / Pricing.

## Flows

| Flow | Doc |
|---|---|
| Add product | [add-product.md](./add-product.md) |
| Price / inventory / menu update | [price-update.md](./price-update.md) |

## Surfaces

- **Products:** list/create/edit/delete, image upload, status.
- **Inventory:** stock qty + ETA per product (`GET /seller/inventory`,
  `PUT /seller/inventory/{productId}`).
- **Pricing:** price-only updates (`GET /seller/pricing`, `PUT /seller/pricing/{productId}`).
- **Menus:** Food dishes per venue (`GET/POST /seller/menus`, `PUT/DELETE
  /seller/menus/{venueId}/{dishId}`).

## State

- Portal store + local form state; no mobile store (WebView shell).

## Data path

- `catalog.products`, `inventory.stock`, `directory.menus`, `media.assets`.
- Seller writes are scoped to an owned **live** store; ownership derives through
  `directory.stores.seller_id`.

## Success / error / empty

- **Success:** server-confirmed product/stock/menu rows render.
- **Error:** inline error; the form does not claim an unconfirmed save. Local-only edits/deletes
  (name/description) appear to succeed but do not persist — see Known gaps.
- **Empty:** no rows → honest empty state.

## Known gaps

- New-product page hardcodes GST/TCS/TDS constants for display; the server is the money authority.
- Product **name/description edits and delete are local-only** in the portal today (they update the
  Zustand store/audit row and do not call the gateway; there is no `DELETE /seller/products/{id}`).
  Price/image updates do persist. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (catalog/directory rows)
- `docs/architecture/web-portal.md`
- `docs/architecture/db-schema.md`
