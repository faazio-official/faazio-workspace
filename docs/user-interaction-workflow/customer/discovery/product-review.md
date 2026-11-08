# Product review

**App / route:** customer · `ProductDetail` (`features/product/ProductDetailScreen.tsx`) →
`RateProduct` (`features/product/RateProductScreen.tsx`)
**Status:** Shipped
**Trigger:** "Write a review" / "Be the first to review" in the `Ratings & Reviews` section of a
product detail, shown only when a delivered order contains the product.

## Steps

1. `ProductDetailScreen` loads the canonical product + reviews (`getProduct` then
   `GET /product/{id}/reviews`) and renders `CommonProductDetailView`.
2. The client gate `canReviewProduct(productId)` (`services/productReviews.ts`) is true only when a
   `Delivered` order in `useOrdersStore` contains the product id.
3. When eligible, the PDP shows "Write a review"; tapping pushes the root `RateProduct` route with
   `{ productId, productName? }`.
4. The screen re-checks the gate (deep-link safe) and shows a "Verified buyers only" card when not
   eligible.
5. The buyer picks 1–5 stars and an optional comment (≤ 280 chars) and submits.
6. `PUT /products/{id}/review` upserts one live review per `(user, product)` (latest wins). On
   `synced` the toast reads "Review saved" and the screen pops after ~800 ms.

## State

- `useOrdersStore` — `orders` + `serverOrders` feed the delivered-purchase gate.
- Local screen state for rating/comment/error.

## Data path

- `gateway.getProduct(id)` → `GET /product/{id}` + `GET /product/{id}/reviews` →
  `catalog.products`, `reviews.reviews`.
- `gateway.submitProductReview(productId, rating, comment)` → `PUT /products/{id}/review` →
  `reviews.reviews` (unique partial index `(product_id, user_id) where user_id is not null`).
- Eligibility is derived, never stored: a `checkout.orders` row with `status = 'Delivered'` joined to
  `checkout.order_items.product_id` (`ProductPurchaseProof`).
- Cache purge on write: `faazio:v1:reviews:product:{id}`.
- Seeded/editorial `reviews.reviews` rows (`user_id` null) remain read-only display rows; they are
  never written by this flow.

## Success / error / empty

- **Success:** the review is durable and appears in the next `GET /product/{id}/reviews`.
- **Error:** inline message for `not-verified` (no delivered purchase), `signed-out`, or `offline`;
  nothing is fabricated locally.
- **Empty:** a product with no reviews shows "No reviews yet." plus the eligible "Be the first to
  review" CTA.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md` (Product detail, Vendor ratings & reviews)
- `docs/architecture/monolith-breakdown.md` (reviews row)
- `docs/architecture/db-schema.md` §7.6
- `data/DATA_CONTROL.md` (`@data/reviews`)
