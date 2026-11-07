# Add product

**App / route:** portal `/seller/products/new` (`app/seller/products/new/page.client.tsx`)
**Status:** Shipped
**Trigger:** Seller taps "Add product".

## Steps

1. Seller fills name, category, app, price, unit, description, image, and stock.
2. Image upload uses the media pipeline (`POST /media/upload-url` → R2 `PUT` → `POST /media/confirm`).
3. Save calls `createProduct(input)` (`POST /seller/products`).
4. The gateway writes `catalog.products` + `inventory.stock` in one transaction and defaults the
   product to `PENDING_REVIEW`.
5. `updateStock` (`PUT /seller/inventory/{productId}`) sets qty/ETA.
6. The product appears in `GET /seller/products` and the admin review queue
   (`/admin/*/products/queue`).
7. Admin activation: `PUT /seller/products/{id}/status` (or portal `setProductStatus`).

## State

- Portal store + local form state.

## Data path

- `POST /seller/products` → `catalog.products`, `inventory.stock`.
- `PUT /seller/inventory/{productId}` → `inventory.stock`.
- `POST /media/upload-url` + `POST /media/confirm` → `media.assets`.
- Cache purges: `catalog:product:{id}`, `stock:{id}`, `catalog:store-products:{storeId}`, and the
  store's geo product tiles.

## Success / error / empty

- **Success:** product created (PENDING_REVIEW) and visible to the seller.
- **Error:** inline error; no fake product row.
- **Empty:** no products → create-product empty state.

## Known gaps

- The new-product page hardcodes GST/TCS/TDS display constants (`page.client.tsx`); the server is
  the authority. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (catalog row)
- `docs/architecture/web-portal.md`
- `docs/architecture/caching-cloudflare-valkey.md`
