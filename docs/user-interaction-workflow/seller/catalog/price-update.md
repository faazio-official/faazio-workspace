# Price / inventory / menu update

**App / route:** portal `/seller/pricing`, `/seller/inventory`, `/seller/menus`
**Status:** Shipped
**Trigger:** Seller edits a price, stock quantity/ETA, or a Food menu dish.

## Steps

### Price
1. `/seller/pricing` lists products with `GET /seller/pricing`.
2. Save calls `PUT /seller/pricing/{productId}` with the new price (price-only; `mrp_paisa` was
   dropped in migration `0079`).
3. The gateway purges product/stock/store-products/geo cache keys.

### Inventory
1. `/seller/inventory` lists rows with `GET /seller/inventory` (joins `inventory.stock`).
2. Save calls `PUT /seller/inventory/{productId}` with qty/ETA.

### Menus (Food)
1. `/seller/menus` lists dishes with `GET /seller/menus`.
2. Create/update: `POST /seller/menus` or `PUT /seller/menus/{venueId}/{dishId}`; the seller authors
   an optional `mrp` (rupees, `>= price`).
3. Status/delete: `PUT /seller/menus/{venueId}/{dishId}/status`, `DELETE
   /seller/menus/{venueId}/{dishId}`.
4. The public menu read serves **ACTIVE** rows only.

## State

- Portal store + local form state.

## Data path

- `PUT /seller/pricing/{productId}` → `catalog.products`.
- `PUT /seller/inventory/{productId}` → `inventory.stock`.
- `POST/PUT/DELETE /seller/menus/*` → `directory.menus`.
- Cache: `directory:menu:{venueId}` 24 h (invalidated on menu edit).

## Success / error / empty

- **Success:** server-confirmed price/stock/menu.
- **Error:** inline error; the form does not claim an unconfirmed save.
- **Empty:** no rows → honest empty state.

## Known gaps

- `/seller/inventory` uses local restock defaults (`RESTOCK_QTY=10`, `RESTOCK_ETA=30`) as form
  prefills, not data. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (catalog/directory rows)
- `docs/architecture/caching-cloudflare-valkey.md`
