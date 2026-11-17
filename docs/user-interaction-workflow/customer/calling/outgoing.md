# Outgoing customer call (customer → delivery partner)

**App / route(s):** customer · `OrderDetails` → `ActiveCall`
(`features/profile/OrderDetailsScreen.tsx`, `features/customer/components/CallDeliveryPartnerButton.tsx`)
**Status:** **Partial** — end to end on Android and implemented on iOS (PushKit/CallKit ring, not yet
verified on device); the PSTN provider bridge is unprovisioned.
**Trigger:** signed-in customer taps **Call delivery partner** on a delivery order whose status is
`Shipped` (the rider job is live; prescription orders excluded); **Use phone call** forces the
masked PSTN leg.

## Steps

1. `OrderDetails` renders a **Delivery partner** card with `CallDeliveryPartnerButton` when
   `order.fulfillment === 'DELIVERY'`, the status is `Shipped`, and the order is not a prescription
   flow. `Processing`/`Cancelled` orders have no assigned rider; a `Delivered` order is already
   terminal (`ROUTE_COMPLETE`), so both show no call card.
2. The button calls the shared controller's `startCustomerCall(orderId, 'Delivery Partner')`
   (`features/customer/calling/callController.ts`).
3. The controller refuses a second call while one is open and locks further taps for 3 s. The
   button mirrors the lock (`Starting call…`, disabled) so a rapid repeated tap is visibly rejected.
4. Android microphone consent is requested only when the VOIP leg may be used. A denial sends
   `forcePstn: true`; the explicit **Use phone call** action skips the prompt. Android 12+ also asks
   for `BLUETOOTH_CONNECT` (best-effort).
5. `callStore.begin()` → phase `connecting`; the root `ActiveCall` route opens immediately with the
   masked peer label and order suffix.
6. `gateway.initiateCustomerDeliveryCall(orderId, { forcePstn })` →
   `POST /orders/{orderId}/delivery-call`. The gateway resolves the checkout order id to the
   `delivery_orders` job via `customer_order_id`, requires `customer_id` ownership, writes
   `initiated_by='CUSTOMER'`, and enqueues a data-only `incoming_call` push to the rider.
7. The same branches as the delivery app apply: VOIP joins the 100ms room with the minted token,
   routes audio to Bluetooth/earpiece and loops a local ringback until the rider joins; PSTN opens the
   masked dialer, unless the server already placed the bridge (`bridged: true`), in which case the
   client only waits for the provider webhook. The rider's phone number is never rendered or dialled.
8. The controller polls `GET /delivery-calls/{callId}` every 2 s, mirrors a server `ACTIVE` status,
   and offers **Switch to phone call** when the server reports `fallbackAvailable`. A `409 conflict`
   makes it adopt the existing open call (`GET /orders/{orderId}/delivery-call`) instead of showing
   an error.
9. **End / dismiss:** `POST /delivery-calls/{callId}/end`, leave the 100ms room, end the native call,
   phase `ended`; `Done`/hardware back route through `dismissCall`.

## State

- `useCallStore` (shared) — phase, call projection, masked peer label, `connectedAt`,
  mute/speaker/`audioRoute`, `bluetoothAvailable`, `reconnecting`, `fallbackPrompt`, `notice`,
  error.
- Shared controller module state — active call id, poll timer, in-flight guards, 3 s lock,
  AppState subscription.

## Data path

- `gateway.initiateCustomerDeliveryCall` → `POST /orders/{orderId}/delivery-call` →
  `delivery.calls` (server chooses VOIP vs PSTN_BRIDGING) + `incoming_call` push to the rider.
- `gateway.getActiveCustomerDeliveryCall` → `GET /orders/{orderId}/delivery-call` (order-scoped
  resume; `204` when none).
- `gateway.getCustomerDeliveryCall` → `GET /delivery-calls/{callId}`.
- `gateway.endCustomerDeliveryCall` → `POST /delivery-calls/{callId}/end`.

## Success / error / empty

- **Success:** VOIP joins and the rider appears → `active`; PSTN dialer opens on the masked line.
- **Error:** `409 conflict` adopts the existing open call; `503 calling_unavailable`, not-found and
  offline are shown inline. No fake ringback or timer.
- **Empty:** pickup, cancelled, delivered, or prescription orders do not render the call card.

## Known gaps

- PSTN provider bridging is wired but dormant — no Exotel credentials or public
  `PSTN_WEBHOOK_URL` are provisioned, so the masked landline stays a dial-only handoff.
- The iOS ring exists (`VoipCallManager.swift` + `VoipCallBridge`, APNs `voip` push) but is unverified
  until a macOS `pod install` and a device build with the PushKit entitlement.
- A server-placed PSTN bridge is never re-dialled: the row carries `bridged: true`, the client waits
  for the provider webhook to mark it ACTIVE, and no `incoming_call` push is sent (the carrier call is
  the ring).
- PSTN timer starts at dialer open in handoff mode (a bridged call waits for the provider webhook);
  VOIP ringback is local and stops as soon as the peer joins.
- A mic denial mid-accept moves the row to PSTN; on iOS the prompt is native
  (`VoipCallBridge.requestMicrophone`), not `PermissionsAndroid`.

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- [`../../delivery/calling/outgoing.md`](../../delivery/calling/outgoing.md)
- `docs/architecture/mobile-app.md` (Masked calling)
