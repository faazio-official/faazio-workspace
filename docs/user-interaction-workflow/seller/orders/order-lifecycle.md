# Seller order lifecycle

**App / route:** portal `/seller/orders`, `/seller/orders/[id]`
**Status:** Shipped
**Trigger:** New-order push/inbox, or the seller order board.

## Steps

1. The board loads `getSellerOrders(status?)` (`GET /seller/orders`).
2. Seller opens an order (`GET /seller/orders/{orderId}`).
3. **Accept:** `PUT /seller/orders/{id}/accept` moves NEW → PACKED and triggers dispatch. The
   transition is gated: an order with `payment_status ≠ PAID` is rejected with
   `409 payment_pending`.
4. **Pickup QR:** a PACKED order shows **Pickup QR** (also the header scan icon). The portal calls
   `GET /seller/orders/{id}/pickup-qr`, which mints a short-lived (2 h) HMAC-signed token for the
   active delivery PICKUP stop and renders it as a QR; the rider scans it to complete the pickup
   (`POST /delivery/pickup/verify`, migration `0088`). The token is never stored.
5. **Reject:** `PUT /seller/orders/{id}/reject` moves NEW → REJECTED, refunds a captured payment,
   and notifies the customer.
6. Further transitions use `PUT /orders/{id}/status` (PACKED → SHIPPED → DELIVERED).
7. Returns/cancellations appear in `/seller/returns`; `advanceOrder` updates them.
8. New orders are fanned out to seller portal users through the notifications outbox.

## State

- Portal store + local board state.
- Server order status is authoritative.

## Data path

- `gateway.getSellerOrders` → `GET /seller/orders` → `checkout.orders`.
- `gateway.getSellerOrder` → `GET /seller/orders/{id}`.
- `gateway.acceptSellerOrder` → `PUT /seller/orders/{id}/accept` → `checkout.orders`,
  `delivery.delivery_orders` (auto-dispatch).
- `gateway.rejectSellerOrder` → `PUT /seller/orders/{id}/reject` → `checkout.orders`,
  `checkout.payments` (refund), `notifications.outbox`.
- `PUT /orders/{id}/status` → `checkout.orders`.
- `fetchSellerPickupQr` → `GET /seller/orders/{id}/pickup-qr` → `delivery.delivery_orders` +
  `delivery.delivery_stops` (mints a token; no write).

## Success / error / empty

- **Success:** server status advances; the customer sees the change.
- **Error:** 409 payment pending blocks packing; inline error otherwise.
- **Empty:** no orders → honest empty board.

## Known gaps

- None specific. The pickup QR requires an active delivery job (rider dispatched); an order with no
  rider gets `409 pickup_qr_unavailable` until allocation.

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (checkout/delivery rows)
- `docs/architecture/mobile-app.md` (delivery handover)
