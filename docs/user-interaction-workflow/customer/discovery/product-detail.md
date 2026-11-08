# Product detail (PDP)

**App / route:** customer · `ProductDetail` (`src/features/product/ProductDetailScreen.tsx`,
`CommonProductDetailView.tsx`)
**Status:** Partial (reviews fetched but not rendered; no stock gating or retry UI)
**Trigger:** Tapping a product card, search result, deal, or deep link.

## Steps

1. `ProductDetailScreen` receives a product from the caller and renders the shared
   `CommonProductDetailView` immediately.
2. With the gateway enabled it refreshes canonical price via `getProduct(id)` (`GET /product/{id}` +
   `GET /product/{id}/reviews`); only `product` is used, the `reviews` array is discarded today.
3. It loads the store context (`getStore`) and related rows (`getStoreProducts`).
4. `trackEvent('view')` records the view (`POST /events`).
5. Add-to-cart calls `useCartStore.addToCart`, which writes the server cart.
6. Favourite toggle calls `useFavoriteStore` → `PUT/DELETE /favourites/{productId}`.

## State

- `useCartStore` — add-to-cart.
- `useFavoriteStore` — favourite toggle.

> Vendor rating lives on the vendor/restaurant profile screens (`useVendorRating`,
> `VendorProfileView`, `RestaurantProfileScreen`, `MedicalShopDetailsScreen`), not on the PDP.

## Data path

- `gateway.getProduct(id)` → `GET /product/{id}` + `/product/{id}/reviews` → `catalog.products`,
  `inventory.stock`, `reviews.reviews`.
- `gateway.getStore(id)` → `GET /store/{id}` → `directory.stores`.
- `gateway.getStoreProducts(storeId)` → `GET /stores/{id}/products`.
- `gateway.trackEvent(productId, 'view')` → `POST /events` → Mongo `user_events` (ID-only).
- `gateway.getVendorReviews` / `getVendorReviewSummary` / `rateVendor` → `reviews.vendor_reviews` /
  `reviews.vendor_summary` (vendor profile screens only).
- Cache: `faazio:v1:catalog:product:{id}` 24 h, purged on product edit/status and order placement.

## Success / error / empty

- **Success:** product and server-authoritative price render; the store card renders. The
  **View Vendor** / **View Restaurant** action is shown only when the caller supplies the handler
  (never a no-op button). The same-store dish rail is server-backed only and stays hidden when the
  server returns nothing (no bundled dish fixture is invented).
- **Error:** a failed canonical read is swallowed and the passed product keeps rendering; there is
  no retry UI. A missing route `product` shows "Product unavailable".
- **Empty:** reviews are not rendered today, so there is no empty review state; add-to-cart is always
  enabled (no out-of-stock gating).

## Known gaps

- `/product/{id}/reviews` is fetched but never rendered; there is no review list or empty state.
- No stock/availability check disables add-to-cart on the PDP.
- A failed canonical read has no retry affordance.
- There is no same-store dish rail yet; the previous always-empty block was removed rather than
  presenting a dead section.
- Vendor rating requires a completed purchase for the verified-purchase path.

## Linked docs

- `docs/architecture/mobile-app.md` (vendor ratings)
- `docs/architecture/monolith-breakdown.md` (catalog/reviews rows)
- `data/DATA_CONTROL.md`
