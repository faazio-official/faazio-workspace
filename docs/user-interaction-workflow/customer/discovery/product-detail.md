# Product detail (PDP)

**App / route:** customer · `ProductDetail` (`src/features/product/ProductDetailScreen.tsx`,
`CommonProductDetailView.tsx`)
**Status:** Partial (same-store dish rail not yet built)
**Trigger:** Tapping a product card, search result, deal, or deep link.

## Steps

1. `ProductDetailScreen` receives a product from the caller and renders the shared
   `CommonProductDetailView` immediately.
2. With the gateway enabled it refreshes canonical price/stock via `getProduct(id)`
   (`GET /product/{id}` + `GET /product/{id}/reviews`); both the product and its `reviews` are
   rendered. A failed read keeps the passed product, shows a retry banner, and re-runs the read.
3. It loads the store context (`getStore`) and related rows (`getStoreProducts`).
4. `trackEvent('view')` records the view (`POST /events`).
5. Add-to-cart calls `useCartStore.addToCart`, which writes the server cart. The action is gated on
   the canonical stock row: `available: false` (or `inStockQty: 0`) disables it, and the stepper
   cannot exceed `inStockQty`.
6. Favourite toggle calls `useFavoriteStore` → `PUT/DELETE /favourites/{productId}`.

## State

- `useCartStore` — add-to-cart.
- `useFavoriteStore` — favourite toggle.

> Vendor rating lives on the vendor/restaurant profile screens (`useVendorRating`,
> `VendorProfileView`, `RestaurantProfileScreen`, `MedicalShopDetailsScreen`), not on the PDP.

## Data path

- `gateway.getProduct(id)` → `GET /product/{id}` + `/product/{id}/reviews` → `catalog.products`,
  `inventory.stock`, `reviews.reviews`. The stock row gates the footer; the review rows feed the
  "Ratings & Reviews" section.
- `gateway.getStore(id)` → `GET /store/{id}` → `directory.stores`.
- `gateway.getStoreProducts(storeId)` → `GET /stores/{id}/products`.
- `gateway.trackEvent(productId, 'view')` → `POST /events` → Mongo `user_events` (ID-only).
- `gateway.getVendorReviews` / `getVendorReviewSummary` / `rateVendor` → `reviews.vendor_reviews` /
  `reviews.vendor_summary` (vendor profile screens only).
- Cache: `faazio:v1:catalog:product:{id}` 24 h, purged on product edit/status and order placement.

## Success / error / empty

- **Success:** product and server-authoritative price render; the store card and the
  "Ratings & Reviews" list render. The **View Vendor** / **View Restaurant** action is shown only
  when the caller supplies the handler (never a no-op button). The same-store dish rail is
  server-backed only and stays hidden when the server returns nothing (no bundled dish fixture is
  invented).
- **Error:** a failed canonical read keeps the passed product rendering and shows an inline retry
  banner that re-runs `getProduct`. A missing route `product` shows "Product unavailable".
- **Empty:** an empty review list shows "No reviews yet." (the section stays hidden when reviews
  were never loaded, e.g. offline). Out-of-stock products show "Out of stock" and disable the
  add-to-cart button; low stock (≤5) shows "Only N left in stock".

## Known gaps

- There is no same-store dish rail yet; the previous always-empty block was removed rather than
  presenting a dead section.
- Vendor rating requires a completed purchase for the verified-purchase path.

## Linked docs

- `docs/architecture/mobile-app.md` (vendor ratings)
- `docs/architecture/monolith-breakdown.md` (catalog/reviews rows)
- `data/DATA_CONTROL.md`
