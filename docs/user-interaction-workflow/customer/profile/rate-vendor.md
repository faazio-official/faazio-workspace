# Rate vendor

**App / route:** customer · `RateVendor` (`features/profile/RateVendorScreen.tsx`)
**Status:** Shipped
**Trigger:** "Rate your purchase" on `OrderDetails`, the My Orders card CTA, or the vendor/restaurant
profile (`VendorProfileView`, `MedicalShopDetailsScreen`, `RestaurantProfileScreen`).

## Steps

1. A vendor surface renders the shared `VendorRateButton` when `canRateVendor(vendorId)` is true.
2. Tapping it pushes the root `RateVendor` route with `{ vendorId, vendorName? }`.
3. The screen re-checks `canRateVendor(vendorId)` (single owner: `services/vendorRatings.ts`) so a
   deep link cannot bypass eligibility.
4. The buyer picks 1–5 stars and an optional comment (≤ 280 chars).
5. Submit writes the device-local `vendorRatingStore` row first (offline-first display) and mirrors
   it to `PUT /vendors/{id}/rating`; the server re-checks the purchase gate.
6. On `synced` the toast reads "Rating saved"/"Rating updated" and the screen pops after ~800 ms.
   `offline` keeps the device-local rating, `not-verified`/`signed-out` show an inline explanation.

## State

- `useVendorRatingStore` — one live rating per `(user, vendor)`, latest wins, persisted at
  `faazio/vendor-ratings/v1`, reset on logout.
- `useOrdersStore` — in-session + server orders used by the derived gate.
- `useAuthStore` — owner scope.

## Data path

- `gateway.rateVendor(vendorId, rating, comment)` → `PUT /vendors/{id}/rating` →
  `reviews.vendor_reviews` (unique `(vendor_id, user_id)`; upsert latest wins).
- `gateway.getVendorReviews` / `getVendorReviewSummary` → `GET /vendors/{id}/reviews`,
  `/vendors/{id}/reviews/summary` → `reviews.vendor_reviews` / `reviews.vendor_summary`.
- Eligibility is derived, never stored: `checkout.orders` where the owner has a non-cancelled order
  addressing the vendor (`vendor_store_ids` snapshot; `PurchaseProof`).
- Cache purge on write: `faazio:v1:reviews:vendor:{id}` and `faazio:v1:directory:store:{id}`.
- `@data` vendor rows are display/fallback only; no rating is fabricated.

## Success / error / empty

- **Success:** rating is durable and appears in the public vendor review list/summary.
- **Error:** inline message for `not-verified` (no qualifying purchase), `signed-out`, or an invalid
  rating; `offline` keeps the device-local rating and says so.
- **Empty:** vendors with no public reviews show an honest empty list.

## Known gaps

- None specific. Order-level and product-level feedback are separate flows:
  [order feedback](../orders/order-feedback.md) and
  [product review](../discovery/product-review.md).

## Linked docs

- `docs/architecture/mobile-app.md` (Vendor ratings & reviews)
- `docs/architecture/monolith-breakdown.md` (reviews row)
- `docs/architecture/db-schema.md` §7.7
- `data/DATA_CONTROL.md` (`@data/reviews`, `@data/directory`)
