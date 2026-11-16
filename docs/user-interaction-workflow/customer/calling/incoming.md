# Incoming customer call (delivery partner → customer)

**App / route(s):** customer · shared FCM handler → native ringing (CallKeep) → `ActiveCall`
**Status:** **Partial** — the customer receive/ring/answer path is implemented; the gateway has no
sender for the `incoming_call` push yet.
**Trigger:** data-only FCM message `{ type: "incoming_call", callId, orderId, peerRole }`.

## Steps

1. `index.js` registers `registerCustomerCallBackgroundHandler()` before the app mounts, using the
   shared `setBackgroundMessageHandler`. `customerPush.ts` routes foreground,
   notification-opened and cold-start call payloads to the same handler.
2. Messages whose `type` is not `incoming_call` continue to the existing inbox-refresh callback.
3. `handleIncomingCall()` (shared controller):
   - hydrates the Keychain session and drops the push when the device is signed out,
   - ignores a duplicate delivery of the same call id while ringing/active,
   - rejects with `busy` when another call is already open,
   - sets `callStore` to `ringing` with `incoming: true` and the masked peer label
     ("Delivery Partner"),
   - sets up CallKeep and shows the native full-screen ring with the peer role + order suffix; if
     CallKeep is unavailable the in-app surface is shown,
   - sends `POST /calls/{callId}/ringing-ack` only when a ring surface is actually visible (native
     ring displayed or the app is foreground).
4. **Accept** (native answer or in-app Accept) → `acceptIncomingCall(callId)`:
   - in-flight/double-answer guarded, brings the app forward on Android, asks for microphone
     consent (denial moves the ringing VOIP row to PSTN via `POST /calls/{callId}/fallback`),
   - `POST /calls/{callId}/join` accepts the row and returns a fresh token,
   - joins 100ms (VOIP) or opens the masked dialer (PSTN); `ActiveCall` shows the timer.
5. **Decline** (native decline or in-app Decline) → CallKeep `rejectCall` +
   `POST /calls/{callId}/reject`.
6. Startup recovery: `GET /delivery/calls/active` re-surfaces a still-ringing customer-initiated
   row and re-acks when a surface is shown; the gateway sweeper closes stale rows.

## State

- `useCallStore` — `phase: 'ringing'`, `incoming: true`, masked peer label, order id; after join
  the normal active fields.
- CallKeep `answerCall`/`endCall`/`didLoadWithEvents` listeners are attached once after login.

## Data path

- FCM data message → shared `handleIncomingCall` (no fixture).
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join`.
- `gateway.rejectDeliveryCall` → `POST /calls/{callId}/reject`.

## Success / error / empty

- **Success (after a sender exists):** native ring → answer → active call; decline → caller hears
  failure.
- **Error:** CallKeep unavailable → in-app Accept/Decline; a payload without `callId` is ignored;
  no session is fabricated.
- **Empty:** no push → no ring.

## Known gaps

- **No sender.** The gateway never enqueues the `incoming_call` push, so this path cannot be
  triggered in production yet.
- **iOS PushKit.** `UIBackgroundModes` includes `voip`/`audio`, but the CallKeep/100ms pods are not
  linked on iOS; a customer iOS incoming ring needs a native PushKit + CallKit bridge.
- **GSM-busy pre-check** and queued-call handling are absent.

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- [`../../delivery/calling/incoming.md`](../../delivery/calling/incoming.md)
- `docs/RUNBOOKS/FIREBASE_AUTH.md` (push transport)
