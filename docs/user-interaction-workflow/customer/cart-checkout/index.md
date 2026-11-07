# Cart & checkout — domain index

**Status:** Shipped
**Routes:** `Cart` (`features/cart/CartScreen.tsx`), Cart tab (`CartTabScreen.tsx`),
`PaymentCallback` (`features/cart/payment/PaymentCallbackScreen.tsx`)
**Shared view:** `CartView.tsx` (wizard `BAG → FULFILLMENT → PAYMENT → RECEIPT`)
**Trigger:** Tapping the Cart tab, a product "Add" action, or a cart deep link.

## Flows

| Flow | Doc |
|---|---|
| Add to cart / quantity changes | [add-to-cart.md](./add-to-cart.md) |
| Delivery-fee quote | [delivery-fee-quote.md](./delivery-fee-quote.md) |
| Place order + payment | [place-order.md](./place-order.md) |

## Wizard steps

| Step | What the user does | Primary data |
|---|---|---|
| `BAG` | Review lines, quantity, select items, choose coupon | `useCartStore`, `getCart`, `validateCoupon` |
| `FULFILLMENT` | Choose Delivery or Self-Pickup, address/pickup point | `getAddresses`, `getPickupPoints`, `fetchDeliveryFee` |
| `PAYMENT` | Choose COD/UPI, redeem coins, place order | `placeOrder`, `createRazorpayOrder`, `payForOrder` |
| `PAYMENT_STATUS` | UPI return/poll | `fetchPaymentStatus` |
| `RECEIPT` | Order confirmation + tracking | `getOrderTracking` / `ordersStore` |

## State

- `useCartStore` — server-authoritative cart with optimistic writes and rollback.
- `useOrdersStore` — adopts the server order after checkout.
- `useRewardsStore` — coins balance/ledger; reconcile after checkout.
- `useLocationStore` — live delivery fix.

## Data path

- Cart: `getCart` / `addToCart` / `updateCartItem` / `removeCartItem` → `inventory.carts`.
- Pricing: `validateCoupon` → `promo.coupons`; `getActiveDiscounts` → `promo`.
- Fees: `fetchDeliveryFee` → `tax.delivery_fee_settings` + store pins.
- Order: `placeOrder` → `checkout.orders`, `checkout.order_items`, `checkout.payments`,
  `checkout.idempotency_keys` (one transaction).
- Payment: `createRazorpayOrder` / `fetchPaymentStatus` / `payForOrder` → `checkout.payments`.

## Success / error / empty

- **Success:** durable order id adopted; receipt shows server status.
- **Error:** inline message; order is not fabricated. A 409 means "already being processed — check
  My Orders".
- **Empty:** empty cart renders an honest empty state.

## Known gaps

- `PaymentOptions` is registered in `AppNavigator` but never navigated; the real payment UI is
  inline in `CartView`.
- Invoice PDF may be unavailable (stub message).
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (cart/checkout section)
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `docs/architecture/caching-cloudflare-valkey.md`
