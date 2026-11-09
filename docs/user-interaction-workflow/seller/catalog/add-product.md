# Add product

**App / route:** portal `/seller/products/new` (`app/seller/products/new/page.client.tsx`)
**Status:** Shipped
**Trigger:** Seller taps "Add product".

## Steps

1. Seller picks the store, then a **Category** — the active taxonomy **leaf** for that store's app
   (`GET /categories?app=`, `taxonomy.categories`) — and a **GST category** from the platform rate
   master (`GET /tax/categories`, `tax.tax_rates`). Picking a leaf pre-selects the matching GST
   bucket when the names align; the seller can change it. GST stays a separate bucket because
   checkout resolves the rate from `catalog.products.category`.
2. Seller fills name, price, unit, description, image, and stock.
3. Image upload uses the media pipeline (`POST /media/upload-url` → R2 `PUT` → `POST /media/confirm`).
4. Save calls `createProduct(input)` (`POST /seller/products`) with `taxonomyCategoryId`.
5. The gateway verifies the taxonomy id is an **active leaf of the store's app brand**, folds its
   `search_query` + name into `catalog.products.search_tokens` (so the listing is discoverable in the
   category drill-in), then writes `catalog.products` + `inventory.stock` in one transaction and
   defaults the product to `PENDING_REVIEW`.
6. `updateStock` (`PUT /seller/inventory/{productId}`) sets qty/ETA.
7. The product appears in `GET /seller/products` and the admin review queue
   (`/admin/*/products/queue`).
8. Admin activation: the listing appears in the district/super admin product queue
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

- `POST /seller/products` → `catalog.products` (`category` = GST label, `taxonomy_category_id` =
  validated active leaf, `search_tokens` enriched with the leaf's `search_query`), `inventory.stock`.
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

## Testing

Four layers cover this workflow (all skip cleanly when their backing service is unset, so the
plain unit suite stays green without Docker):

1. **Go handler integration** — `server/gateway/internal/catalog/handler_test.go` drives
   `POST /seller/products` through a real `httptest` router over Postgres + Valkey:
   `TestCreateProductHandlerHappyPath` (201 + `PENDING_REVIEW`, product/stock rows, rupees→paisa),
   `...Validation` (400s), `...AuthZ` (cross-seller/cross-district 404, super-admin 201),
   `...ImageR2Resolution` (`r2:<key>` → `image_key`, unknown asset 400), and `...CachePurge`
   (store-products key purged; requires Valkey).
2. **Go media happy path** — `server/gateway/internal/media/handler_test.go` adds
   `TestUploadURLHappyPath` (minted `img_` asset + presigned PUT, DRAFT row), `TestConfirmHappyPath`
   (DRAFT → ACTIVE + owner link), and `TestConfirmRejectsUnknownAsset` (404).
3. **Portal unit tests** — `client/web/platform/src/lib/api/__tests__/createProduct.test.ts`
   (vitest) covers live-mode id/status adoption, whole-rupee conversion, `data:` rejection,
   `r2:`→`imageKey`, https passthrough, offline seed mode, and pricing parsing.
4. **Gateway simulation** — `server/gateway/scripts/test-seller-product-create.sh` runs the whole
   HTTP flow (upload-url → confirm → create → list → inventory → admin approve → negatives) against
   a running gateway and prints a PASS/FAIL summary.

```bash
# Go (from server/gateway/; export TEST_DATABASE_URL + TEST_VALKEY_URL to run, else they skip)
go test ./internal/catalog/... ./internal/media/...

# Portal
cd client/web/platform && npm test

# Simulation (gateway must be running; see the script header for SELLER_ID lookup)
SUPABASE_JWT_SECRET=... SELLER_ID=sel-tiruchi-01 \
  server/gateway/scripts/test-seller-product-create.sh http://localhost:8080
```

## Known gaps

- The new-product page hardcodes GST/TCS/TDS display constants (`page.client.tsx`); the server is
  the authority. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (catalog row)
- `docs/architecture/web-portal.md`
- `docs/architecture/caching-cloudflare-valkey.md`
