# Incoming delivery call (customer → rider)

**App / route(s):** delivery · shared FCM handler → native ringing (CallKeep) → `ActiveCall`
**Status:** **Partial** — the rider receive/ring/answer path is implemented; no gateway endpoint or
push sender creates the `incoming_call` push yet.
**Trigger:** data-only FCM message `{ type: "incoming_call", callId, orderId, peerRole }`.

## Steps

1. `index.delivery.js` registers `registerDeliveryCallBackgroundHandler()` before the app mounts;
   the shared `setBackgroundMessageHandler` runs on a foreground, background or swiped-away app.
2. Messages whose `type` is not `incoming_call` fall through to the existing order-offer path.
3. `handleIncomingCall()` (shared controller):
   - hydrates the Keychain session and **drops the push when the device is signed out** (a
     previous account's call must never ring),
   - ignores a duplicate delivery of the same call id while it is already ringing/active,
   - rejects with `busy` when another call is already open,
   - sets `callStore` to `ringing` with `incoming: true` and the masked peer label,
   - sets up CallKeep and shows the native full-screen ring with the peer role + order suffix; if
     CallKeep is unavailable (or does not confirm the display within 1.5 s) the in-app surface is
     shown and loops the ringing tone instead,
   - fires `POST /calls/{callId}/ringing-ack` **only when a ring surface is actually visible**
     (native call displayed, or the app is foreground). A headless device without a phone account
     intentionally does not ack, so the server can fall back to PSTN.
4. **Accept** (native answer or the in-app Accept button) → `acceptIncomingCall(callId)`:
   - is idempotent: an in-flight accept and a native+in-app double answer cannot join twice and
     tear the connected call down; a decline while the join is in flight cancels it,
   - brings the app forward on Android, requests microphone consent; a denial moves the ringing
     VOIP row to PSTN via `POST /calls/{callId}/fallback` and only proceeds when the response is
     `PSTN_BRIDGING` (otherwise the row is torn down with an explicit message),
   - `POST /calls/{callId}/join` accepts the row (`RINGING → ACTIVE`) and returns a fresh 2-hour
     VOIP token,
   - joins 100ms (VOIP) or opens the masked dialer (PSTN), then `ActiveCall` shows the timer.
5. **Decline** (native decline or in-app Decline) → CallKeep `rejectCall` for the ringing UI +
   `POST /calls/{callId}/reject` (`RINGING → REJECTED`; a `busy` reason is recorded as `BUSY`).
6. While ringing, the server watches `ringing_ack_at`; a later `GET /calls/{callId}` reports
   `fallbackAvailable` so the caller can switch to PSTN.
7. A row that outlives the runtime is handled twice: on the next authenticated start the client
   (once per session) re-surfaces a still-ringing incoming call from `GET /delivery/calls/active`,
   re-acks when a surface is shown **and** starts the in-app ringing tone when only the in-app
   surface is visible; the gateway sweeper closes `RINGING` rows older than 45 s as `MISSED`.

## State

- `useCallStore` — `phase: 'ringing'`, `incoming: true`, masked peer label, order id; after join the
  normal active-call fields (`connectedAt`, `audioRoute`, …).
- CallKeep listeners (`answerCall`, `endCall`, and buffered `didLoadWithEvents` for cold-start taps)
  are attached once as soon as the authenticated app starts, and again idempotently from the
  background handler/Dashboard. A cancelled phone-account prompt is treated as "not configured" and
  retried on the next call (never cached as success).

## Data path

- FCM data message → shared `handleIncomingCall` (no fixture).
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack` → `delivery.calls`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join` → `delivery.calls` + 100ms token.
- `gateway.rejectDeliveryCall` → `POST /calls/{callId}/reject`.

## Success / error / empty

- **Success:** native ring → answer → active call; decline → caller hears failure.
- **Error:** CallKeep unavailable → the in-app `ActiveCall` surface shows Accept/Decline instead;
  push without `callId` is ignored; no session is fabricated.
- **Empty:** no push → no ring.

## Known gaps

- **No sender.** No endpoint enqueues the `incoming_call` data push (the customer-app entry point
  is now built, but its call is rejected by the rider-only endpoint), so this path cannot be
  triggered in production yet.
- **No VoIP push (PushKit).** iOS is customer-only; the delivery path is FCM/CallKeep (Android)
  only. iOS `voip`/`audio` background modes are declared but the PushKit/CallKit native pods are
  not linked.
- **Answer when the app was swiped away** depends on headless JS + CallKeep; device/OEM battery
  restrictions can suppress it.
- **No GSM-busy pre-check** before ringing, and no queued-call banner for a second caller.

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- `docs/architecture/mobile-app.md` (Masked calling)
- `docs/RUNBOOKS/FIREBASE_AUTH.md` (push transport)
