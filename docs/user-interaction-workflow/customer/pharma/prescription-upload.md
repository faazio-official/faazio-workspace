# Prescription upload + quote + pay

**App / routes:** customer · `PrescriptionFlow` (`features/pharma/prescription/PrescriptionFlowScreen.tsx`) → `OrderDetails` (`features/profile/OrderDetailsScreen.tsx`)
**Status:** Shipped
**Trigger:** Pharma home "Upload prescription" or a pharmacy's prescription entry.

## Steps

1. **CAPTURE:** the user captures prescription pages with the camera **or imports them from the
   gallery** (system photo picker — `react-native-image-picker`, no media permission; capped at 10).
2. **NOTE:** optional note; a preset vendor (refill) skips vendor selection.
3. **VENDORS:** choose a pharmacy and fulfillment mode (Delivery/Pickup).
4. On confirm, `gateway.getAddresses()` resolves a **server-owned** default address id (never a
   fixture id).
5. Each photo uploads sequentially: `gateway.uploadPrescriptionImage(uri)` →
   `POST /prescriptions/upload-url` then `PUT {uploadUrl}`; only object **keys** are kept.
6. If remote and any page failed to upload, the flow hard-stops with a retry message — no silent
   partial upload.
7. `gateway.createPrescription({ vendorId, fulfillment, pages, note, imagePaths, addressId })` →
   `POST /prescriptions`.
8. The server returns the authoritative Rx id; `ordersStore.recordOrder` records a prescription
   order keyed by that id.
9. **CONFIRMED:** the shopper sees the submitted state; the pharmacy quotes/reveals later.
10. **Pay (new):** on `OrderDetails`, a `QUOTED` Rx with a positive total shows **Pay ₹X**. The sheet
    (`PrescriptionPaymentSheet`) first accepts the quote with
    `gateway.checkoutPrescription(rx.id)` → `POST /prescriptions/{id}/checkout` (idempotent). The
    server materialises a real `checkout.orders` row keyed to the Rx id, then the existing rail runs:
    COD (`gateway.payForOrder(rx.id, 'COD')`) or UPI (`gateway.createRazorpayOrder(rx.id)` → intent →
    webhook → `gateway.fetchPaymentStatus(rx.id)` poll). The amount is server-derived from the quote.
11. A `FULFILLED`/`CANCELLED` Rx offers **Order again**, re-opening the flow pre-set to the same
    pharmacy (a fresh capture is required; images are never reused).

## State

- `useOrdersStore` — durable history now merges `GET /prescriptions` (`prescriptionToPlaced`) as well
  as `GET /orders`, so an Rx survives an app restart in My Orders. In-session placement still keyed by
  the server Rx id.
- `usePrescriptionDetail(rxId, enabled)` — polls `GET /prescriptions/{id}` every 10 s for quote +
  status; stops only at FULFILLED/CANCELLED (READY keeps polling).
- `usePrescriptionPayment(rxId, enabled)` — polls `GET /orders/{id}/payment-status` for the
  materialised order (404 = not accepted yet).
- Local `PrescriptionFlow`: `draft`, `step`, `uploadProgress`, `submitting`, `submitError`.
  `OrderDetails` adds `paymentSheetVisible` + `PrescriptionPaymentSheet`.

## Data path

- `gateway.getAddresses` → `GET /profile/addresses` → `checkout.addresses`.
- `gateway.uploadPrescriptionImage` → `POST /prescriptions/upload-url` + presigned `PUT` → R2 /
  Supabase Storage.
- `gateway.createPrescription` → `POST /prescriptions` → `pharma.prescriptions`.
- Quote/reveal lifecycle: `GET /seller/prescriptions`, `POST /seller/prescriptions/{id}/quotes`,
  `PUT /prescriptions/{id}/status` → `pharma.quote_items`, `pharma.status_history`.
- Accept/pay: `POST /prescriptions/{id}/checkout` (checkout context; `pharma.Repo.QuoteForCheckout`
  via `contracts.PrescriptionQuoteReader`) → `checkout.orders` (+ `order_items`) with
  `rx_id` set and `order_id = rx.id` (migration `0086`). Then `POST /orders/{id}/payments` (COD) or
  `POST /razorpay/customer/orders` → webhook → `GET /orders/{id}/payment-status` (UPI).
- `GET /orders` excludes materialised Rx orders (`rx_id is null`) so the Rx is listed once via
  `GET /prescriptions`.
- Cache: `faazio:v1:pharma:prescriptions:{userId}` 60 s; never edge-cached. `checkout.orders` cache
  is invalidated on accept/payment.

## Success / error / empty

- **Success:** CONFIRMED with server Rx id; quote appears on `OrderDetails`; Pay records the payment
  (`PAID`) and the status/`Paid` row reflects it.
- **Error:** failed page upload → retry message; 404/422 → "pharmacy can no longer receive
  prescriptions, pick another"; other failures keep the user on the step. Pay: `409` (not quoted /
  terminal) → "not ready to pay"; `503` (Razorpay unset) → "temporarily unavailable"; UPI cancel or
  timeout → retry with the same order (never a second charge).
- **Empty:** a prescription must have at least one page (server rejects an empty Rx).

## Known gaps

- Accepted Rx orders have **no GST tax invoice**: the order is materialised without an invoice row, so
  `GET /orders/{id}/invoice` returns 404 and `OrderDetails` shows "not available yet". Shown honestly,
  not fabricated.
- Paying does not move the pharmacy lifecycle status — the Rx stays `QUOTED` until the seller marks it
  `READY`; the customer sees `Paid` and waits for the pharmacy.

## Linked docs

- `docs/architecture/mobile-app.md` (prescription flow)
- `docs/architecture/monolith-breakdown.md` (pharma + checkout rows)
- `docs/architecture/db-schema.md` (pharma tables, `checkout.orders.rx_id`)
- `docs/architecture/server-gateway-plan.md` (`POST /prescriptions/{id}/checkout`)