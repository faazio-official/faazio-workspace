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
7. Admin activation: the listing appears in the district/super admin product queue
   (`/admin/*/products/queue`). **Approve** calls `setProductStatus(id, "ACTIVE")`; **Reject** opens a
   dialog that collects a required reason and calls `setProductStatus(id, "REJECTED", reason)` →
   `PUT /seller/products/{id}/status`. The reason is persisted and shown to the seller.

## Admin moderation

- **Trigger:** a listing reaches `PENDING_REVIEW`.
- **Steps:** district admin opens `Listing queue` → Approve (one tap) or Reject (dialog + required
  reason, ≤ 500 chars).
- **State:** the portal optimistically updates the product row; a failed write rolls back the row
  and shows a toast.
- **Data path:** `PUT /seller/products/{id}/status` with `{ status, reason }` → `catalog.products`
  (`status`, `review_reason`; `review_reason` is set only for `REJECTED` and cleared on
  `ACTIVE`/`DELISTED`). Admin scope is seller/district-strict (`0057`, no state fallback).
- **Seller feedback:** a `REJECTED` product shows the admin's note on the seller product list and
  the edit screen, so the seller can fix it and resubmit. Approve/reject also enqueues a
  `PRODUCT_APPROVED` / `PRODUCT_REJECTED` notification for the owning seller portal via
  `contracts.Notifier.EnqueueSeller`, surfaced at `/seller/notifications` and deep-linked to the
  edit screen (see [`../web-portal/notifications.md`](../web-portal/notifications.md)).
- **Success / error:** status + reason persist and the cache keys are purged; a missing reject
  reason or one over 500 bytes is rejected with `400`. **Empty:** the queue shows the "Queue is
  clear" state.

## State

- Portal store + local form state; the reject dialog holds the reason locally until confirm.

## Data path

- `POST /seller/products` → `catalog.products`, `inventory.stock`.
- `PUT /seller/products/{id}/status` → `catalog.products.status`, `catalog.products.review_reason`;
  ACTIVE/REJECTED enqueues `notifications.outbox` (seller fan-out).
- `PUT /seller/inventory/{productId}` → `inventory.stock`.
- `POST /media/upload-url` + `POST /media/confirm` → `media.assets`.
- Cache purges: `faazio:v1:catalog:product:{id}`, `faazio:v1:stock:{id}`,
  `faazio:v1:catalog:store-products:{storeId}`, and the store's geo product tiles.

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
