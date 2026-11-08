# Customer handover / OTP / COD

**App / route:** delivery · `Route` (`RouteScreen.tsx`)
**Status:** Shipped (OTP mandatory for COD/UPI checkout orders; payment-before-OTP ordering)
**Trigger:** Rider arrives at the DROP stop.

## Steps

1. Checkout sets `RequireOTP` for COD and UPI orders at auto-dispatch. The delivery context
   generates a 4-digit OTP (hashed on the last DROP stop) and enqueues it to the customer's
   notification inbox/push (`notifyCustomerOTP`).
2. If the order requires payment (`paymentRequired` and not `paymentReceived`), the rider must tap
   **Payment received** first: `gateway.markDeliveryPaymentReceived(orderId, stopId)`
   (`POST /delivery/{orderId}/stop/{stopId}/payment-received`). The rider can show the delivery UPI
   QR (`getDeliveryUpipQr`, `GET /app-config/delivery-upi-qr`). The payment controls render before
   the OTP field.
3. Once paid (or prepaid), the rider enters the customer's 4-digit OTP and calls
   `gateway.verifyDeliveryOtp(stopId, otp)` (`POST /delivery/otp/verify`).
4. The server checks the hashed OTP with an attempt lock; success completes the DROP.
5. `refresh()` updates the route; when no stops remain, `ROUTE_COMPLETE` frees capacity (or a
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

- Depends on the customer notification/push channel being configured (`FCM`); the OTP is always
  durably enqueued, and degrades to the notifications inbox when push is unconfigured.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` (`delivery.delivery_stops`)
