# Delivery fulfillment — domain index

**Status:** Shipped (seller-QR pickup + mandatory COD/UPI OTP handover)
**Route:** `Route` (`features/delivery-partner/screens/RouteScreen.tsx`)
**Trigger:** Rider has an accepted order and opens the route.
**Visual layer:** stop cards, status pills and modals are restyled; the stop model and forward-only
transitions are unchanged.

## Flows

| Flow | Doc |
|---|---|
| Pickup | [order-pickup.md](./order-pickup.md) |
| Customer handover / OTP / COD | [customer-handover.md](./customer-handover.md) |

## Stop model

`delivery.delivery_stops` carries ordered `PICKUP` / `DROP` stops with status, address, customer
name/phone, hashed handover OTP, expiry, failure reason, `pickup_verified_at`, and timestamps.
Transitions are forward-only; the server owns the route state. A PICKUP stop may only become
`PICKED_UP` after a valid seller-QR scan (`0088`).

## State

- Local `stops`, `otpByStop`, `failureFor`, `failureReason`, `busy`, `error`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `PUT /delivery/stop/{stopId}/status` → `delivery.delivery_stops`.
- `GET /seller/orders/{orderId}/pickup-qr` → mints the seller pickup token (not persisted).
- `POST /delivery/pickup/verify` → `delivery.delivery_stops` (`status`, `pickup_verified_at`).
- `POST /delivery/otp/verify` → OTP attempt lock (`delivery.delivery_stops`,
  `otp_attempts`).
- `POST /delivery/{orderId}/stop/{stopId}/payment-received` → COD gate.
- No fabricated stops/OTPs/tokens.

## Success / error / empty

- **Success:** pickup → dropoff → DELIVERED / ROUTE_COMPLETE.
- **Error:** wrong OTP, COD unpaid, failed drop → explicit state; no fake success.
- **Empty:** no active stops → dashboard.

## Known gaps

- OTP delivery uses the durable notifications outbox/FCM channel; it degrades to the inbox when
  push is unconfigured. See [`customer-handover.md`](./customer-handover.md).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/db-schema.md` (`delivery.*`)
