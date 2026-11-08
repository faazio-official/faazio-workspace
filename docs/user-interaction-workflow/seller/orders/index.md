# Seller orders — domain index

**Status:** Shipped (seller pickup QR + order lifecycle)
**Routes:** portal `/seller/orders`, `/seller/orders/[id]`, `/seller/order-history`, `/seller/returns`,
`/seller/payments`
**Trigger:** New-order notification, seller console, or order board.

## Flows

| Flow | Doc |
|---|---|
| Order board + accept/reject/advance | [order-lifecycle.md](./order-lifecycle.md) |
| Payouts / ledger / invoices | [payouts-ledger.md](./payouts-ledger.md) |

## State

- Portal store + local board state.
- Server order status is authoritative (`checkout.orders.status`).

## Data path

- `GET /seller/orders`, `GET /seller/orders/{id}` → `checkout.orders`, `checkout.order_items`.
- `PUT /seller/orders/{id}/accept|reject`, `PUT /orders/{id}/status`.
- `GET /seller/orders/{id}/pickup-qr` → `delivery.delivery_stops` (mints the rider-scanned token).
- `GET /seller/payments`, `GET /seller/payments/{cycleId}`, `GET /seller/payout-invoices/{payoutId}`
  → `payments.*`.

## Success / error / empty

- **Success:** server status advances; the customer sees the change.
- **Error:** `409 payment_pending` blocks packing; inline error otherwise.
- **Empty:** no orders → honest empty board.

## Known gaps

- None specific. The pickup QR needs an active delivery job; unallocated orders show
  `409 pickup_qr_unavailable` until a rider is assigned.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (checkout/payouts rows)
