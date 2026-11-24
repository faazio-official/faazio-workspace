# Cart & checkout — domain index

**Status:** Shipped (self-pickup points are server-derived; fulfilment choice moved to PAYMENT step)
**Routes:** `Cart` (`features/cart/CartScreen.tsx`), Cart tab (`CartTabScreen.tsx`),
`PaymentCallback` (`features/cart/payment/PaymentCallbackScreen.tsx`)
**Shared view:** `CartView.tsx` (wizard `BAG → PAYMENT → RECEIPT`)
**Trigger:** Tapping the Cart tab, a product "Add" action, or a cart deep link.

## Flows

| Flow | Doc |
|---|---|
| Add to cart / quantity changes (+ dish add-ons) | [add-to-cart.md](./add-to-cart.md) |
| Delivery-fee quote | [delivery-fee-quote.md](./delivery-fee-quote.md) |
| Place order + payment | [place-order.md](./place-order.md) |

## Wizard steps

| Step | What the user does | Primary data |
|---|---|---|
| `BAG` | Review items, quantity, select items, choose coupon or streak card | `useCartStore`, `getCart`, `validateCoupon` |
| `PAYMENT` | Delivery/self-pickup choice, payment method, coupons, place order | `fulfillment` set in payment, coupon code, delivery quote, `placeOrder` |
| `PAYMENT_STATUS` | UPI return/poll | `fetchPaymentStatus` |
| `RECEIPT` | Order confirmation + track action | `useOrdersStore`; "Track My Order" navigates to `MyOrders` |

**Motion:** fulfilment/payment sheets use the shared `SlideUpSheet` — enter on the entrance curve,
leave ~20% faster, and drag the grab handle down to dismiss (translation clamps to its bounds).
The receipt success uses a single pulse, not a loop.

## State

- `useCartStore` — server-authoritative cart with optimistic writes and rollback.
- `useOrdersStore` — adopts the server order after checkout.
- `useRewardsStore` — coins balance/ledger; reconcile after checkout.
- `useLocationStore` — live delivery fix.

## Data path

- Cart: `getCart` / `addToCart` / `updateCartItem` / `removeCartItem` → `inventory.carts`.
- Pricing: `validateCoupon` → `promo.coupons`; `getActiveDiscounts` → `promo`; streak card →
  `rewards.balances.card` (read + cleared at `POST /orders` settlement).
- Fees: `fetchDeliveryFee` → `tax.delivery_fee_settings` + store pins.
- Order: `placeOrder` → `checkout.orders`, `checkout.order_items`, `checkout.payments`,
  `checkout.idempotency_keys` (one transaction).
- Payment: `createRazorpayOrder` / `fetchPaymentStatus` / `payForOrder` → `checkout.payments`.
- Self-pickup points: `gateway.getPickupPoints(storeIds)` (`GET /pickup-points`) returns live
  store/neutral-hub rows; the selected snapshot is submitted in `POST /orders`. The client resolver
  is retired (`@unused` offline shell).

## Success / error / empty

- **Success:** durable order id adopted; receipt shows server status.
- **Error:** inline message; order is not fabricated. A 409 means "already being processed — check
  My Orders".
- **Empty:** empty cart renders an honest empty state.

## Known gaps

- Invoice PDF may be unavailable while no renderer writes `pdf_key`; the download is offered only
  in My Orders → Order Details (never on the receipt/confirmation).
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (cart/checkout section)
- `docs/architecture/monolith-breakdown.md` (checkout row)
- `docs/architecture/caching-cloudflare-valkey.md`
