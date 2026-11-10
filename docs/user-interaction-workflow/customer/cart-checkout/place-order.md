# Place order + payment

**App / route:** customer · `Cart` (`CartView.tsx`), `PaymentCallback`
(`features/cart/payment/PaymentCallbackScreen.tsx`), `PaymentStatusScreen`
**Status:** Shipped (server-derived pickup points; COD/UPI placement)
**Trigger:** Tapping **Place Order** on the PAYMENT step.

## Steps

1. `handlePlaceOrder` validates the delivery address (Delivery only) and builds a stable
   idempotency key.
2. `gateway.placeOrder(input)` → `POST /orders`. The gateway re-prices from `catalog.products` (with
   a `directory.menus` fallback for Food dish ids). Each line may carry `addonIds`; the server
   re-validates that every one is ACTIVE + linked to the ordered dish, re-prices it from
   `directory.addons`, adds the add-on total to the line/invoice gross, and snapshots the selection
   into `checkout.order_item_addons`. It also
   validates the coupon / streak discount card and coin balance, decrements stock, and writes the
   order, items, add-on snapshots, invoice, payment, and idempotency key in **one transaction**. The streak card is
   sent as `useDiscountCard: true` (mutually exclusive with `couponCode`); the server reads its
   percent from `rewards.balances`, applies the same whole-rupee discount the client showed, and
   clears the card after the order commits. An absent/expired card fails with
   `invalid_discount_card` rather than charging an undiscounted total.
3. `useOrdersStore.recordServerOrder(placed)` adopts the durable server id; `useRewardsStore.reconcile()`
   refreshes the ledger (coins are earned server-side, never client-written).
4. Purchased lines are removed from the server cart (`DELETE /cart/items/{id}`); a failed removal
   triggers `cartStore.hydrate()` so the device never hides a line the server still holds.
5. `trackEvent(id, 'order')` records ID-only analytics.
6. **COD:** `payForOrder(orderId, 'COD', coinsRedeemed)` (`POST /orders/{id}/payments`) → RECEIPT.
7. **UPI:** `createRazorpayOrder(orderId)` (`POST /razorpay/customer/orders`) returns a Razorpay
   order; the app launches the UPI intent and shows `PAYMENT_STATUS`.
8. `PAYMENT_STATUS` polls `fetchPaymentStatus` (`GET /orders/{id}/payment-status`). The Razorpay
   webhook (`POST /webhooks/razorpay/payments`, HMAC) is the authority for PAID/FAILED.
9. `PaymentCallback` reconciles a return deep link by polling the same status endpoint.
10. Failure offers retry with the same order (never a second order) or switch to COD.

## State

- `useCartStore` — lines removed after placement.
- `useOrdersStore` — server order adopted.
- `useRewardsStore` — balance/ledger reconciled.
- Local `paymentAttempt`, `paymentProcessing`, `paymentError`.

## Data path

- `gateway.placeOrder` → `POST /orders` → `checkout.orders`, `checkout.order_items`,
  `checkout.order_item_addons`, `checkout.payments`, `checkout.idempotency_keys`, `tax.tax_invoices`.
- `gateway.validateCoupon` → `POST /checkout/validate-coupon` → `promo.coupons`.
- Streak discount card: `rewards.balances.card` (read at settlement, cleared after commit).
- `gateway.createRazorpayOrder` → `POST /razorpay/customer/orders` → `checkout.payments`.
- `gateway.fetchPaymentStatus` → `GET /orders/{id}/payment-status`.
- `gateway.payForOrder` → `POST /orders/{id}/payments`.
- Webhook: `POST /webhooks/razorpay/payments` (public, signature-verified).

## Success / error / empty

- **Success:** RECEIPT with server order id/status.
- **Error:** inline message; 409 → "already being processed, check My Orders". Offline → retry
  message. No local PAID state is fabricated.
- **Payment pending:** status screen polls; timeout → failure screen with retry/COD.
- **Empty:** cart cannot place with zero selected items.

## Known gaps

- `PaymentOptions` route is registered but never navigated; payment UI is inline in `CartView`.
- Self-pickup points are fetched from `GET /pickup-points` and the selected snapshot is submitted
  in `POST /orders`; placement is blocked when the server returns none.
- The confirmation receipt has no invoice UI. Invoice download lives in My Orders → Order Details
  and may return "not available yet" until the PDF renderer writes `pdf_key`.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (cart/checkout/payment)
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `docs/RUNBOOKS/DATABASE_MIGRATIONS.md`
