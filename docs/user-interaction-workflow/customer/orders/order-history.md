# Order history + detail

**App / route:** customer · `MyOrders` (`features/profile/MyOrdersScreen.tsx`) →
`OrderDetails` (`features/profile/OrderDetailsScreen.tsx`)
**Status:** Partial (invoice PDF and cancellation are gaps)
**Trigger:** Profile → My Orders, or tapping an order notification.

## Steps

1. `MyOrdersScreen` focuses and calls `useOrdersStore.refresh()` (also hydrated at login).
2. `gateway.getOrders()` fetches the owner-scoped order list.
3. The store keeps `serverOrders` and `getOrderById` prefers server history over in-session rows.
4. Tapping an order opens `OrderDetails`; the screen reads the order and loads the invoice for
   display.
5. The invoice is loaded with `gateway.getOrderInvoice(orderId)` on mount; there is no download
   action (see KNOWN_GAPS).
6. Cancelling an order opens a `mailto:` support hand-off; there is no in-app cancel endpoint.
7. Tracking is not read by this flow (`gateway.getOrderTracking` has no screen caller).

## State

- `useOrdersStore` — `serverOrders`, `refresh()`, `recordServerOrder()`, `getOrderById()`.
- `useAuthStore` — owner scope.

## Data path

- `gateway.getOrders()` → `GET /orders` → `checkout.orders`, `checkout.order_items`.
- `gateway.getOrderInvoice(orderId)` → `GET /orders/{id}/invoice` → `tax.tax_invoices` (presigned R2
  PDF when rendered).
- Cache: `faazio:v1:checkout:orders:{userId}` 60 s.

## Success / error / empty

- **Success:** order list/detail/invoice render.
- **Error:** honest retry; invoice shows "not available yet" rather than a fake file.
- **Empty:** "No orders yet" state.

## Known gaps

- Invoice PDF renderer may not have produced `pdf_key`; the screen shows an unavailable message and
  never offers a download.
- Cancellation is a `mailto:` support hand-off, not an in-app cancel state or endpoint.
- No screen reads `getOrderTracking`.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (My Orders)
- `docs/architecture/db-schema.md` (checkout/tax tables)
