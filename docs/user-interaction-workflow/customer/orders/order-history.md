# Order history + detail

**App / route:** customer · `MyOrders` (`features/profile/MyOrdersScreen.tsx`) →
`OrderDetails` (`features/profile/OrderDetailsScreen.tsx`)
**Status:** Shipped
**Trigger:** Profile → My Orders, or tapping an order notification.

## Steps

1. `MyOrdersScreen` focuses and calls `useOrdersStore.refresh()` (also hydrated at login).
2. `gateway.getOrders()` fetches the owner-scoped order list.
3. The store keeps `serverOrders` and `getOrderById` prefers server history over in-session rows.
4. Tapping an order opens `OrderDetails`; the screen reads the order + invoice.
5. Invoice download calls `gateway.getOrderInvoice(orderId)`.
6. Tracking reads `gateway.getOrderTracking(orderId)` where shown.

## State

- `useOrdersStore` — `serverOrders`, `refresh()`, `recordServerOrder()`, `getOrderById()`.
- `useAuthStore` — owner scope.

## Data path

- `gateway.getOrders()` → `GET /orders` → `checkout.orders`, `checkout.order_items`.
- `gateway.getOrderTracking(orderId)` → `GET /orders/tracking/{id}`.
- `gateway.getOrderInvoice(orderId)` → `GET /orders/{id}/invoice` → `tax.tax_invoices` (presigned R2
  PDF when rendered).
- Cache: `checkout:orders:{userId}` 60 s.

## Success / error / empty

- **Success:** order list/detail/invoice render.
- **Error:** honest retry; invoice shows "not available yet" rather than a fake file.
- **Empty:** "No orders yet" state.

## Known gaps

- Invoice PDF renderer may not have produced `pdf_key` yet (`PENDING_WORK.md`); the screen shows an
  unavailable message.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (My Orders)
- `docs/architecture/db-schema.md` (checkout/tax tables)
