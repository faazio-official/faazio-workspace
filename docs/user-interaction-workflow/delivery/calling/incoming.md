# Incoming delivery call (customer → rider)

**App / route(s):** delivery · background handler → native ringing (CallKeep) → `ActiveCall`
**Status:** **Partial** — the rider receive/ring/answer path exists; no server or customer app sends
the `incoming_call` push yet.
**Trigger:** data-only FCM message `{ type: "incoming_call", callId, orderId, peerRole }`.

## Steps

1. `index.delivery.js` registers `registerDeliveryCallBackgroundHandler()` before the app mounts;
   `setBackgroundMessageHandler` runs on a foreground, background or swiped-away app.
2. Messages whose `type` is not `incoming_call` fall through to the existing order-offer path.
3. `handleIncomingCall()`:
   - rejects with `busy` when another call is already open,
   - sets `callStore` to `ringing` with `incoming: true` and the masked peer label,
   - immediately posts `POST /calls/{callId}/ringing-ack` (the <3 s delivery receipt),
   - sets up CallKeep and shows the native full-screen ring with "Delivery call · <order suffix>".
4. **Accept** (native answer or the in-app Accept button) → `acceptIncomingCall(callId)`:
   - requests microphone consent; a denial moves the ringing VOIP row to PSTN via
     `POST /calls/{callId}/fallback`,
   - `POST /calls/{callId}/join` accepts the row (`RINGING → ACTIVE`) and returns a fresh short-lived
     VOIP token,
   - joins 100ms (VOIP) or opens the masked dialer (PSTN), then `ActiveCall` shows the timer.
5. **Decline** (native decline or in-app Decline) → `POST /calls/{callId}/reject`
   (`RINGING → REJECTED`), native call ends; the caller can hear busy/failure.
6. While ringing, the server watches `ringing_ack_at`; a later `GET /calls/{callId}` reports
   `fallbackAvailable` so the caller can switch to PSTN.

## State

- `useCallStore` — `phase: 'ringing'`, `incoming: true`, masked peer label, order id; after join the
  normal active-call fields.
- CallKeep listeners (`answerCall`, `endCall`) are attached once on the Dashboard mount via
  `initializeDeliveryCalling()`.

## Data path

- FCM data message → `handleIncomingCall` (no fixture).
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack` → `delivery.calls`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join` → `delivery.calls` + 100ms token.
- `gateway.rejectDeliveryCall` → `POST /calls/{callId}/reject`.

## Success / error / empty

- **Success:** native ring → answer → active call; decline → caller hears failure.
- **Error:** CallKeep unavailable → the in-app `ActiveCall` surface shows Accept/Decline instead;
  push without `callId` is ignored; no session is fabricated.
- **Empty:** no push → no ring.

## Known gaps

- **No sender.** No endpoint enqueues the `incoming_call` data push (the customer-app "call rider"
  entry point is not built), so this path cannot be triggered in production yet.
- **No VoIP push (PushKit).** iOS is customer-only, so the delivery path is FCM/CallKeep (Android)
  only; a future iOS customer build needs PushKit + CallKit.
- **Answer when the app was swiped away** depends on the headless JS + CallKeep; device/OEM battery
  restrictions can suppress it (documented in PENDING_WORK).
- **No GSM-busy pre-check** before ringing.

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- `docs/architecture/mobile-app.md` (Masked calling)
- `docs/RUNBOOKS/FIREBASE_AUTH.md` (push transport)
