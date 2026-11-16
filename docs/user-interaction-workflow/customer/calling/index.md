# Customer calling — domain index

**App / route(s):** customer · `OrderDetails` → `ActiveCall`
(`features/customer/calling/`, shared `features/call/`, `features/profile/OrderDetailsScreen.tsx`)
**Status:** **Partial** — the customer client (button, route, controller, push wake-up, Android
ringing) is implemented; the gateway still has no customer-initiated call endpoint and no
`incoming_call` push sender, so the flow is not end-to-end usable.
**Authority:** `docs/architecture/mobile-app.md` ("Masked calling"), `monolith-breakdown.md` §1
(delivery row), `db-schema.md` §12.39.

## What exists

- `CallDeliveryPartnerButton` on `OrderDetails` for delivery orders with an assigned partner
  (not cancelled, not a prescription flow). Primary **Call delivery partner** + secondary
  **Use phone call** (forces `forcePstn`). Hidden when `CALLING_ENABLED=false`.
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
  `NavigationContainer.onReady`, and calls `shutdownCalling()` on sign-out.
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

- `gateway.initiateDeliveryCall(orderId)` → `POST /delivery/{orderId}/call` →
  `delivery.calls` (the endpoint is currently rider-scoped; a customer token is rejected).
- `gateway.getDeliveryCall(callId)` → `GET /calls/{callId}`.
- `gateway.getActiveDeliveryCall()` → `GET /delivery/calls/active` (customer token currently
  rejected).
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join`.
- `gateway.rejectDeliveryCall` / `endDeliveryCall` / `fallbackDeliveryCall` → state transition.
- No fixture or fake latency is used anywhere in the flow.

## Configuration

Client: `CALLING_ENABLED` (default true) only. Provider secrets are server-side, never in the
bundle.

## Known gaps

- **Server customer path.** `initiateCall` resolves the caller as a rider (`currentRider`) and
  writes `initiated_by='RIDER'`; there is no customer-owned order check, no CUSTOMER-initiated row,
  no customer token minting and no `incoming_call` push sender. The customer button therefore
  returns `409`/`403` until the gateway lands the mirror endpoint.
- **PSTN bridge.** Same external Exotel/Edesy gap as the delivery flow — the masked landline does
  not connect to the rider.
- **iOS PushKit/CallKit** is declared in Info.plist but not native-linked.
- **GSM-busy, proximity wake-lock, provider-answer timer** are not implemented (shared gaps).

See [`../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
