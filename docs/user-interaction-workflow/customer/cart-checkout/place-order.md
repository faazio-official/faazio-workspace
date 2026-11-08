# Place order + payment

**App / route:** customer · `Cart` (`CartView.tsx`), `PaymentCallback`
(`features/cart/payment/PaymentCallbackScreen.tsx`), `PaymentStatusScreen`
**Status:** Partial (self-pickup placement submits client-resolved `@mock` pickup points; card
payment/COD placement is shipped)
**Trigger:** Tapping **Place Order** on the PAYMENT step.

## Steps

1. `handlePlaceOrder` validates the delivery address (Delivery only) and builds a stable
   idempotency key.
2. `gateway.placeOrder(input)` → `POST /orders`. The gateway re-prices from `catalog.products`,
   validates the coupon and coin balance, decrements stock, and writes the order, items, invoice,
   payment, and idempotency key in **one transaction**.
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
  `checkout.payments`, `checkout.idempotency_keys`, `tax.tax_invoices`.
- `gateway.validateCoupon` → `POST /checkout/validate-coupon` → `promo.coupons`.
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
- Self-pickup orders submit pickup points built client-side by the `@mock`
  `data/cart/pickup-resolver.ts` (`CartView.tsx:29,431`) instead of a gateway pickup-point read —
  a no-mocks gap.
- Invoice PDF may return "not available yet" if the PDF renderer has not generated it.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (cart/checkout/payment)
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `docs/RUNBOOKS/DATABASE_MIGRATIONS.md`
