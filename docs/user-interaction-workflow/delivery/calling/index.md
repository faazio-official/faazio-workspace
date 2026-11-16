# Delivery calling — domain index

**App / route(s):** customer + delivery · `ActiveCall` in both navigators
(`features/call/`, `features/delivery-partner/calling/`, `features/customer/calling/`)
**Status:** **Partial** — both client halves are implemented; the gateway still has no
customer-initiated call endpoint, no `incoming_call` push sender, and no PSTN provider bridge.
**Authority:** `docs/architecture/mobile-app.md` ("Masked calling"), `monolith-breakdown.md` §1
(delivery row), `db-schema.md` §12.39.

## What exists

- Server-authoritative call session (`delivery.calls`, migration `0104`): the gateway chooses
  `VOIP` (100ms) vs `PSTN_BRIDGING` (masked virtual landline), enforces one open call per rider,
  owns the ringing-ack / fallback window, checks the open-call index before provisioning a room,
  and sweeps stale `RINGING` (45 s) / `ACTIVE` (2 h) rows.
- `GatewayClient`: `initiateDeliveryCall`, `getDeliveryCall`, `getActiveDeliveryCall`,
  `ackDeliveryCallRinging`, `joinDeliveryCall`, `rejectDeliveryCall`, `endDeliveryCall`,
  `fallbackDeliveryCall` (shared by both apps).
- Shared call stack in `src/features/call/`:
  - `controller.ts` — one state machine factory used by both apps: 3 s double-tap lock,
    double-accept guard, UUID-scoped native events, status polling with cross-call guards,
    mic/mic-denial fallback, retrying lifecycle teardown, startup recovery, AppState resync,
    audio-route tracking, notice vs fatal error.
  - `voip.ts` — 100ms join/leave, earpiece/Bluetooth routing, `ON_AUDIO_DEVICE_CHANGED`, mute,
    reconnect events, 15 s join timeout.
  - `callkeep.ts` — Android ConnectionService ring, `hasPhoneAccount`/managed-call checks,
    `rejectCall` for ringing, `displayIncomingCall` with iOS call options, cold-start
    `didLoadWithEvents`, `backToForeground`, `setAvailable`.
  - `incoming.ts` — shared FCM data-only background handler.
  - `CallSurface.tsx` — shared full-screen call UI; each app injects its theme tokens.
- `callStore` (`src/state/callStore.ts`) — phase, server call projection, masked peer label,
  connected timestamp, mute/speaker/audio route/Bluetooth, incoming, reconnecting, fallback
  prompt, recoverable notice, error. `markActive()` never resets a running timer.
- Delivery binding: `features/delivery-partner/calling/callController.ts` + `CallCustomerButton`
  on Dashboard/Route + `ActiveCallScreen` (eventual `DELIVERY` tokens).
- Customer binding: `features/customer/calling/callController.ts` + `CallDeliveryPartnerButton`
  on `OrderDetails` + `ActiveCallScreen` (light/dark palette).
- Android native ringing: `react-native-callkeep` ConnectionService + `VoiceConnectionService` in
  the **customer and delivery** flavor manifests; `index.js`/`index.delivery.js` register the
  shared `incoming_call` FCM handler before mount. iOS background modes (`voip`, `audio`) and
  local-network copy are declared, but the CallKeep/100ms pods remain excluded from iOS
  autolinking.

## Flows

| Flow | Doc |
|---|---|
| Rider calls the customer | [outgoing.md](./outgoing.md) |
| Incoming call to the rider | [incoming.md](./incoming.md) |
| Failure/edge handling | [edge-cases.md](./edge-cases.md) |
| Screens, state and copy | [screens.md](./screens.md) |
| Customer calls the rider | [`../../customer/calling/`](../../customer/calling/index.md) |

## Data path

- `gateway.initiateDeliveryCall(orderId)` → `POST /delivery/{orderId}/call` →
  `delivery.calls` (mode chosen server-side) + 100ms room/token **or** the virtual number.
- `gateway.getDeliveryCall(callId)` → `GET /calls/{callId}` → `delivery.calls`.
- `gateway.getActiveDeliveryCall()` → `GET /delivery/calls/active` → open row or `204` (resume).
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join` → freshly minted 100ms token.
- `gateway.rejectDeliveryCall` / `endDeliveryCall` / `fallbackDeliveryCall` → state transition.
- No fixture or fake latency is used anywhere in the flow.

## Configuration

Server (env-only, never committed): `HMS_APP_ACCESS_KEY`, `HMS_APP_SECRET`,
`HMS_TEMPLATE_ID` (per-call rooms; optional `HMS_MANAGEMENT_TOKEN` override) or `HMS_ROOM_ID` (dev),
`HMS_ROLE`, `HMS_ENDPOINT` (optional 100ms API origin), `HMS_RINGING_ACK_SECONDS`,
`DELIVERY_CALL_VIRTUAL_NUMBER`. All are declared in `render.yaml` (secrets `sync:false`).

Client: `CALLING_ENABLED` (default true) only — provider secrets never enter the app bundle.

## Known gaps

See [edge-cases.md](./edge-cases.md) and `../KNOWN_GAPS.md`. In short: the gateway has no
customer-initiated call endpoint and no sender for the `incoming_call` push, so the customer app's
button reaches the rider-only endpoint and is rejected; no Exotel/Edesy Connect/webhook integration
(PSTN dials only the masked landline); iOS PushKit/CallKit is not native-linked; no GSM-busy
pre-check, proximity wake-lock, queued-call banner or provider-answer timer. The flow is **not**
end-to-end usable until the server pieces land.
