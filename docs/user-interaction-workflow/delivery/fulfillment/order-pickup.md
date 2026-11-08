# Order pickup

**App / route:** delivery · `Route` (`RouteScreen.tsx`)
**Status:** Shipped (seller-QR verified pickup)
**Trigger:** Rider arrives at the pickup stop.

## Steps

1. The route lists PICKUP stops first in sequence.
2. Rider taps **Arrived at store** → `gateway.updateDeliveryStop(stopId, 'AT_PICKUP')`
   (`PUT /delivery/stop/{stopId}/status`).
3. The seller opens the order in `/seller/orders` → **Pickup QR** (or the header scan icon), which
   calls `GET /seller/orders/{orderId}/pickup-qr`. The gateway mints a short-lived (2 h) HMAC-signed
   token for the active PICKUP stop; the portal renders it as a QR (no token is stored).
4. At the store, the rider taps **Scan seller QR & pick up** → `PickupScanModal` opens the camera
   (`useCodeScanner` from `react-native-vision-camera`, QR only) and sends the scanned token to
   `gateway.verifyDeliveryPickup(stopId, token)` (`POST /delivery/pickup/verify`).
5. The server verifies the token signature + expiry and that the stop belongs to the rider's
   `ACCEPTED` order, records `pickup_verified_at`, and advances `AT_PICKUP → PICKED_UP`.
6. `refresh()` re-reads active orders; if the pickup fails (cancelled order), the order is
   `CANCELLED` and capacity frees with an alert.

The plain status endpoint refuses `PICKED_UP` without a scan (`409 pickup_scan_required`), so the
handover cannot be completed by a status tap alone.

## State

- Local `stops`, `busy`, `error`, `scanStop` (open scanner).
- `useDeliveryPartnerStore` — rider context.

## Data path

- `gateway.updateDeliveryStop` → `PUT /delivery/stop/{stopId}/status` → `delivery.delivery_stops`.
- Seller `GET /seller/orders/{orderId}/pickup-qr` → `delivery.delivery_orders` +
  `delivery.delivery_stops` (active PICKUP stop; token is minted, not persisted).
- `gateway.verifyDeliveryPickup` → `POST /delivery/pickup/verify` → `delivery.delivery_stops`
  (`status`, `pickup_verified_at`, migration `0088`).
- Order state: `delivery.delivery_orders`.
- No synthetic pickup state.

## Success / error / empty

- **Success:** QR verified; pickup recorded (`PICKED_UP`); route advances to drop.
- **Error:** invalid/forged token → `401 invalid_pickup_qr`; expired → `409 pickup_qr_expired`;
  scan attempted before arrival → `409`; unconfigured signer → `503 pickup_qr_unavailable`; inline
  error and the stop does not advance locally.
- **Empty:** no pickup stop → not reachable.

## Known gaps

- Camera permission must be granted; the scanner shows an explicit prompt and degrades to a
  cancel-only screen if denied. No manual-token fallback by design.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- [`../../seller/orders/order-lifecycle.md`](../../seller/orders/order-lifecycle.md) (seller-side QR)
