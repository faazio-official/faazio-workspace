# Seller orders — domain index

**Status:** Shipped
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
- `GET /seller/payments`, `GET /seller/payments/{cycleId}`, `GET /seller/payout-invoices/{payoutId}`
  → `payments.*`.

## Known gaps

- The "Simulate scan" button only toasts (no rider-QR verification). See
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (checkout/payouts rows)
