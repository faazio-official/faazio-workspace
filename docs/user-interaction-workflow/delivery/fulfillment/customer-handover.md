# Customer handover / OTP / COD

**App / route:** delivery · `Route` (`RouteScreen.tsx`)
**Status:** Partial (OTP handover is unreachable for checkout orders; COD+OTP UI ordering)
**Trigger:** Rider arrives at the DROP stop.

## Steps

1. If the order requires payment (`paymentRequired` and not `paymentReceived`), the rider must tap
   **Payment received** first: `gateway.markDeliveryPaymentReceived(orderId, stopId)`
   (`POST /delivery/{orderId}/stop/{stopId}/payment-received`). The rider can show the delivery UPI
   QR (`getDeliveryUpipQr`, `GET /app-config/delivery-upi-qr`).
2. Rider enters the customer's 4-digit OTP and calls `gateway.verifyDeliveryOtp(stopId, otp)`
   (`POST /delivery/otp/verify`).
3. The server checks the hashed OTP with an attempt lock; success completes the DROP.
4. `refresh()` updates the route; when no stops remain, `ROUTE_COMPLETE` frees capacity (or a
   `FAILED` drop shows a route-finished alert).

## State

- Local `otpByStop`, `busy`, `error`, `qrUrl`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `gateway.verifyDeliveryOtp` → `POST /delivery/otp/verify` → `delivery.delivery_stops`
  (`customer_otp_hash`, `otp_attempts`, expiry).
- `gateway.markDeliveryPaymentReceived` → `POST /delivery/{orderId}/stop/{stopId}/payment-received`
  → `delivery.delivery_orders.payment_received`.
- `gateway.getDeliveryUpipQr` → `GET /app-config/delivery-upi-qr`.
- No client-side OTP/payment fabrication.

## Success / error / empty

- **Success:** DROP `DELIVERED`; route completes.
- **Error:** wrong OTP, expired OTP, or COD unpaid → explicit error; the stop does not complete.
- **Empty:** no drop stop → not reachable.

## Known gaps

- Checkout's in-process auto-dispatch never sets `RequireOTP`, so `stop.requiresOtp` is false for
  normal orders and this OTP branch never renders. Only admin `POST /dispatch/assign` can require
  OTP.
- When a COD order does require OTP, `RouteScreen` renders the OTP branch before the "Payment
  received" branch, while `deliverWithOtp` refuses until payment is received — the flow cannot be
  completed in the UI.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` (`delivery.delivery_stops`)
