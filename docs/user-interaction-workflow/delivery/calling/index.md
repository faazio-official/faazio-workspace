# Delivery calling — domain index

**App / route(s):** delivery · `ActiveCall` + `CallCustomerButton` on `Route` / `Dashboard`
(`features/delivery-partner/calling/`, `screens/ActiveCallScreen.tsx`)
**Status:** **Partial** — the rider half is implemented end-to-end; the customer-app entry point and
the PSTN provider bridging webhook are not.
**Authority:** `docs/architecture/mobile-app.md` ("Masked calling"), `monolith-breakdown.md` §1
(delivery row), `db-schema.md` §12.39.

## What exists

- Server-authoritative call session (`delivery.calls`, migration `0104`): the gateway chooses
  `VOIP` (100ms) vs `PSTN_BRIDGING` (masked virtual landline), enforces one open call per rider, and
  owns the ringing-ack / fallback window.
- `GatewayClient`: `initiateDeliveryCall`, `getDeliveryCall`, `ackDeliveryCallRinging`,
  `joinDeliveryCall`, `rejectDeliveryCall`, `endDeliveryCall`, `fallbackDeliveryCall`.
- `callStore` (`src/state/callStore.ts`) + `callController.ts` state machine, 3 s double-tap lock,
  microphone consent/fallback, status polling, network-reconnect state.
- `ActiveCallScreen` full-screen route with timer, mute, speaker, Bluetooth, "Switch to phone call",
  Accept/Decline for an in-app incoming ring, End.
- `CallCustomerButton` on accepted-order Dashboard cards and DROP stops on `Route`.
- Android native ringing: `react-native-callkeep` ConnectionService + delivery-flavor permissions and
  the `incoming_call` FCM background handler registered in `index.delivery.js`.
- 100ms voice adapter (`calling/voip.ts`): join/leave, earpiece/Bluetooth routing, mute, reconnect
  events.

## Flows

| Flow | Doc |
|---|---|
| Rider calls the customer | [outgoing.md](./outgoing.md) |
| Incoming call to the rider | [incoming.md](./incoming.md) |
| Failure/edge handling | [edge-cases.md](./edge-cases.md) |
| Screens, state and copy | [screens.md](./screens.md) |

## Data path

- `gateway.initiateDeliveryCall(orderId)` → `POST /delivery/{orderId}/call` →
  `delivery.calls` (mode chosen server-side) + 100ms room/token **or** the virtual number.
- `gateway.getDeliveryCall(callId)` → `GET /calls/{callId}` → `delivery.calls`.
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join` → freshly minted 100ms token.
- `gateway.rejectDeliveryCall` / `endDeliveryCall` / `fallbackDeliveryCall` → state transition.
- No fixture or fake latency is used anywhere in the flow.

## Configuration

Server (env-only, never committed): `HMS_APP_ACCESS_KEY`, `HMS_APP_SECRET`,
`HMS_TEMPLATE_ID` (per-call rooms; optional `HMS_MANAGEMENT_TOKEN` override) or `HMS_ROOM_ID` (dev),
`HMS_ROLE`, `HMS_RINGING_ACK_SECONDS`, `DELIVERY_CALL_VIRTUAL_NUMBER`.

Client: `CALLING_ENABLED` (default true) only — provider secrets never enter the app bundle.

## Known gaps

See [edge-cases.md](./edge-cases.md) and `../KNOWN_GAPS.md`. In short: no customer-app "call rider"
button, no server sender for the `incoming_call` push, no Exotel/Edesy Connect/webhook integration, no
GSM-busy pre-check, no proximity wake-lock. Until the customer side exists, a VOIP call cannot be
answered by the customer; the PSTN leg is the usable path.
