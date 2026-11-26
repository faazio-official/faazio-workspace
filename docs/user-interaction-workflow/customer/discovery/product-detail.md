# Product detail (PDP)

**App / route:** customer · `ProductDetail` (`src/features/product/ProductDetailScreen.tsx`,
`CommonProductDetailView.tsx`)
**Status:** Shipped
**Trigger:** Tapping a product card, search result, deal, or deep link.

## Steps

1. `ProductDetailScreen` receives a product from the caller and renders the shared
   `CommonProductDetailView` immediately.
2. With the gateway enabled it refreshes canonical price/stock via `getProduct(id)`
   (`GET /product/{id}` + `GET /product/{id}/reviews`), the ratings histogram via
   `GET /product/{id}/reviews/summary`, and the approved festival discount overlay. A failed read keeps
   the passed product, shows a retry banner, and re-runs the read.
3. It loads the store context (`getStore`) and **Recommended** rows. The recommendation source is
   sector-aware: a MART/PHARMA product reads its own store's listings (`getStoreProducts`), while a
   FOOD dish reads its restaurant's full menu (`fetchMenu` → `GET /venues/{venueId}/menu`) and maps
   sibling dishes onto the shared product card (`menuDishToProduct`, carrying the venue id). If the
   same-vendor source is empty or fails, the PDP falls back to personalized
   `getRecommendations()` filtered to the same app; it never invents a rail. A FOOD dish keeps its
   venue id from its menu/search/SDUI source (`SpecialDish.restaurantId` → `Product.storeId`), and
   the restaurant affordance resolves the public store via `getStore` +
   `storeProfileToFoodRestaurant` (hidden when the id is absent or the read fails). The PDP renders
   the brand above the title, the seller below, tappable variant chips (siblings from the detail
   read), MRP strike + % OFF (only when MRP > price), delivery ETA, an honest Offers card
   (`GET /coupons`, `store.offerTag`, the live festival discount), the veg mark (Mart/Food) or Rx
   banner (Pharma), description/highlights/ingredients, the legal-metrology **Product information**
   table from `attributes`, and a 5-star histogram with an interactive "Tap to rate" empty state.
   Sections are white `SurfaceCard`s over the `canvas` background; the sticky footer anchors the
   price on the left and a solid brand CTA on the right (stepper + Go to Cart after add).
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
  "Ratings & Reviews" section. `getProductReviewSummary(id)` → `GET /product/{id}/reviews/summary`
  feeds the histogram. `getCoupons(app)` + the store `offerTag` + `useActiveDiscounts` feed the Offers
  card — all hide cleanly when the server has nothing.
- `gateway.getStore(id)` → `GET /store/{id}` → `directory.stores`.
- `gateway.getStoreProducts(storeId)` → `GET /stores/{id}/products` (MART/PHARMA recommended).
- `gateway.fetchMenu(venueId)` → `GET /venues/{venueId}/menu` (FOOD recommended; ACTIVE dishes only).
- `gateway.getRecommendations()` → `GET /recommendations` (personalized fallback, Mongo
  `recommendations` joined to catalog; same-app, current item excluded).
- `gateway.trackEvent(productId, 'view')` → `POST /events` → Mongo `user_events` (ID-only).
- `gateway.getVendorReviews` / `getVendorReviewSummary` / `rateVendor` → `reviews.vendor_reviews` /
  `reviews.vendor_summary` (vendor profile screens only).
- Cache: `faazio:v1:catalog:product:{id}` 24 h, purged on product edit/status and order placement.

## Success / error / empty

- **Success:** product and server-authoritative price render; the store card, the **Recommended**
  rail and the "Ratings & Reviews" list render. The **View Vendor** / **View Restaurant** action is
  shown only when the caller supplies the handler (never a no-op button). The recommended rail is
  server-backed only and stays hidden when every source returns nothing (no bundled dish fixture is
  invented). FOOD recommended cards open the tapped dish's PDP (no direct add, since a dish may need
  add-ons).
- **Error:** a failed canonical read keeps the passed product rendering and shows an inline retry
  banner that re-runs `getProduct`. A missing route `product` shows "Product unavailable" with the
  Faazio welcome wordmark (`FaazioLogo` `variant="welcome"`) above the message.
- **Empty:** an empty review list shows "No reviews yet." (the section stays hidden when reviews
  were never loaded, e.g. offline). Out-of-stock products show "Out of stock" and disable the
  add-to-cart button; low stock (≤5) shows "Only N left in stock".

## Known gaps

- The personalized fallback (`getRecommendations`) depends on the Mongo recommendation job; when it is
  cold/empty the rail is simply hidden. Same-vendor rows are the reliable source.
- A dining-venue dish has no `directory.stores` row, so its **View Restaurant** affordance stays
  hidden; seller-owned FOOD stores (the live vendors) resolve normally.
- Vendor rating requires a completed purchase for the verified-purchase path.

## Linked docs

- `docs/architecture/mobile-app.md` (vendor ratings)
- `docs/architecture/monolith-breakdown.md` (catalog/reviews rows)
- `data/DATA_CONTROL.md`
