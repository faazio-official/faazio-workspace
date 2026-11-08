# Delivery fulfillment — domain index

**Status:** Partial (pickup shipped; OTP handover is unreachable for normal checkout orders because
checkout dispatch does not set `RequireOTP`)
**Route:** `Route` (`features/delivery-partner/screens/RouteScreen.tsx`)
**Trigger:** Rider has an accepted order and opens the route.

## Flows

| Flow | Doc |
|---|---|
| Pickup | [order-pickup.md](./order-pickup.md) |
| Customer handover / OTP / COD | [customer-handover.md](./customer-handover.md) |

## Stop model

`delivery.delivery_stops` carries ordered `PICKUP` / `DROP` stops with status, address, customer
name/phone, hashed handover OTP, expiry, failure reason, and timestamps. Transitions are
forward-only; the server owns the route state.

## State

- Local `stops`, `otpByStop`, `failureFor`, `failureReason`, `busy`, `error`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `PUT /delivery/stop/{stopId}/status` → `delivery.delivery_stops`.
- `POST /delivery/otp/verify` → OTP attempt lock (`delivery.delivery_stops`,
  `otp_attempts`).
- `POST /delivery/{orderId}/stop/{stopId}/payment-received` → COD gate.
- No fabricated stops/OTPs.

## Success / error / empty

- **Success:** pickup → dropoff → DELIVERED / ROUTE_COMPLETE.
- **Error:** wrong OTP, COD unpaid, failed drop → explicit state; no fake success.
- **Empty:** no active stops → dashboard.

## Known gaps

- The customer-handover OTP branch never renders for normal checkout orders; see
  [`customer-handover.md`](./customer-handover.md) and [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- COD + OTP ordering bug: see [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/db-schema.md` (`delivery.*`)
