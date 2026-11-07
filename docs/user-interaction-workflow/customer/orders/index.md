# Customer orders — domain index

**Status:** Shipped
**Routes:** `MyOrders` (`features/profile/MyOrdersScreen.tsx`), `OrderDetails`
(`features/profile/OrderDetailsScreen.tsx`), `Notifications`
**Trigger:** Profile → My Orders, receipt, or order notification.

## Flows

| Flow | Doc |
|---|---|
| Order history + detail | [order-history.md](./order-history.md) |

## State

- `useOrdersStore` (`src/state/ordersStore.ts`) — in-session placed orders + server-hydrated
  `serverOrders`; `getOrderById` prefers server history.
- `useAuthStore` — owner scope.

## Data path

- `gateway.getOrders()` → `GET /orders` → `checkout.orders` + `checkout.order_items`.
- `gateway.getOrderTracking(orderId)` → `GET /orders/tracking/{id}`.
- `gateway.getOrderInvoice(orderId)` → `GET /orders/{id}/invoice` → `tax.tax_invoices`.
- `gateway.getPayments()` → `GET /payments` → `checkout.payments`.

## Success / error / empty

- **Success:** server order list/detail renders.
- **Error:** honest retry/empty; no fixture order rows.
- **Empty:** "No orders yet" state.

## Known gaps

- Invoice PDF may be unavailable (stub message); see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md`
- `docs/architecture/monolith-breakdown.md` (checkout row)
