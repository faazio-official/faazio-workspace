# Customer calling — domain index

**App / route(s):** customer · `OrderDetails` → `ActiveCall`
(`features/customer/calling/`, shared `features/call/`, `features/profile/OrderDetailsScreen.tsx`)
**Status:** **Partial** — the customer client (button, route, controller, push wake-up, Android
ringing, iOS PushKit/CallKit ring) and the customer-initiated server path are implemented end to end.
Partial because the iOS ring is unverified until a macOS `pod install` + device build and PSTN
provider credentials are not provisioned.
**Authority:** `docs/architecture/mobile-app.md` ("Masked calling"), `monolith-breakdown.md` §1
(delivery row), `db-schema.md` §12.39.

## What exists

- `CallDeliveryPartnerButton` on `OrderDetails` for delivery orders that are out for delivery
  (`Shipped`, not a prescription flow). A `Delivered` order has no call card — the rider job is
  already `ROUTE_COMPLETE` and the gateway only bridges a live `ASSIGNED`/`ACCEPTED` job. Primary
  **Call delivery partner** + secondary **Use phone call** with a phone-line icon (forces
  `forcePstn`). Hidden when `CALLING_ENABLED=false`; for 3 s after a tap it reads **Starting call…**
  and is disabled.
- Shared call stack (`src/features/call/`): controller factory, 100ms VOIP adapter, CallKeep
  ringing, FCM background handler, and `CallSurface` full-screen UI. The customer binding lives in
  `features/customer/calling/callController.ts`.
- `ActiveCall` root route (`AppNavigator.tsx`, `fullScreenModal`, `gestureEnabled: false`) with a
  light/dark themed `ActiveCallScreen`; hardware back ends the call first.
- `callStore` (shared) — phase, call projection, masked peer label, `connectedAt`, mute/speaker/
  `audioRoute`/Bluetooth, incoming, reconnecting, fallback prompt, notice, error.
- `index.js` registers the shared FCM `incoming_call` background handler before the app mounts;
  `customerPush.ts` routes foreground/cold-start call payloads to the same handler.
- `App.tsx` initializes the controller after login, flushes a cold-start call navigation on
  `NavigationContainer.onReady`, and calls `shutdownCalling()` on sign-out. The customer binding sets
  `recoverActiveCall: false`: `GET /delivery/calls/active` is rider-scoped, so recovery happens
  per order through `GET /orders/{orderId}/delivery-call` inside `start`/`adoptOpenCall`; a row with
  no order id in hand is bounded by the gateway sweeper.
- Android customer flavor manifest (`android/app/src/customer/AndroidManifest.xml`) declares
  microphone/Bluetooth/full-screen-intent/phone-call foreground-service permissions and the CallKeep
  `VoiceConnectionService`. iOS declares `voip` + `audio` background modes and local-network copy,
  but the CallKeep/100ms pods remain excluded from iOS autolinking.

## Flows

| Flow | Doc |
|---|---|
| Customer calls the rider | [outgoing.md](./outgoing.md) |
| Incoming call to the customer | [incoming.md](./incoming.md) |
| Failure/edge handling | [edge-cases.md](./edge-cases.md) |
| Screens, state and copy | [screens.md](./screens.md) |

## Data path

- `gateway.initiateCustomerDeliveryCall(orderId)` → `POST /orders/{orderId}/delivery-call`. The
  button passes the **checkout** order id; the gateway resolves it to the `delivery_orders` job via
  `customer_order_id` and requires `customer_id` ownership, so a shopper cannot call on another
  person's order. The row is written with `initiated_by='CUSTOMER'`, and an `incoming_call` push is
  sent to the rider.
- `gateway.getActiveCustomerDeliveryCall(orderId)` → `GET /orders/{orderId}/delivery-call` → open row
  or `204`. This is order-scoped on purpose: `GET /delivery/calls/active` is rider-scoped and would
  never return a customer's row.
- `gateway.getCustomerDeliveryCall(callId)` → `GET /delivery-calls/{callId}`.
- `gateway.ackCustomerDeliveryCallRinging` → `POST /delivery-calls/{callId}/ringing-ack`.
- `gateway.joinCustomerDeliveryCall` → `POST /delivery-calls/{callId}/join`.
- `gateway.rejectCustomerDeliveryCall` / `endCustomerDeliveryCall` /
  `fallbackCustomerDeliveryCall` → state transition.

These endpoints live outside the rider group and authorise by call ownership, so a customer token
cannot drive a rider session and vice versa. The shared controller reaches them through an injected
`CallApi` surface (`features/customer/calling/callController.ts`), and a `409 conflict` response
makes it adopt the existing open call instead of surfacing an error.

- No fixture or fake latency is used anywhere in the flow.

## Configuration

Client: `CALLING_ENABLED` (default true) only. Provider secrets are server-side, never in the
bundle.

## Known gaps

- **iOS PushKit/CallKit is implemented but unverified.** `ios/Faazio/VoipCallManager.swift` owns the
  single `CXProvider` and reports the APNs `apns-push-type: voip` push from PushKit before React
  Native boots (`VoipCallBridge` hands answers/ends/token updates to JS); `0105` stores the PushKit
  token beside the FCM token and the gateway sends the VoIP push over APNs directly (`APNS_*`). FCM
  cannot deliver a VoIP push. What is not proven: a macOS `pod install` (the 100ms pod must link,
  `Podfile.lock` predates it) and a device build with the PushKit entitlement.
- **PSTN bridge.** Wired (`PSTN_PROVIDER=exotel` + `EXOTEL_*` + the status webhook) but dormant
  until provider credentials are provisioned; without them the masked landline stays a dial-only
  handoff.
- **GSM-busy, proximity wake-lock, provider-answer timer** are not implemented (shared gaps).

See [`../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
