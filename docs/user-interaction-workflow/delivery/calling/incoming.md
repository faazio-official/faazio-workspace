# Incoming delivery call (customer → rider)

**App / route(s):** delivery · shared FCM handler → full-screen-intent notification → `ActiveCall`
**Status:** **Partial** — send, receive, ring and answer are implemented on Android (the delivery
partner is Android-only); the remaining gaps are the device-unverified iOS customer ring and PSTN
provider provisioning.
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
   - posts the high-importance full-screen-intent ring notification (peer role + order suffix); if the
     OS refuses it (notifications blocked) the in-app surface is shown and loops the ringing tone
     instead,
   - fires `POST /calls/{callId}/ringing-ack` **only when a ring surface is actually visible**
     (notification posted, or the app is foreground). A device whose notifications are blocked
     intentionally does not ack, so the server can fall back to PSTN,
   - starts the 2 s status poll, so a caller cancel/end (only the server knows) stops the ring
     instead of ringing until the 45 s sweep.
4. **Accept** (native answer or the in-app Accept button) → `acceptIncomingCall(callId)`:
   - is idempotent: an in-flight accept and a native+in-app double answer cannot join twice and
     tear the connected call down; a decline while the join is in flight cancels it,
   - brings the app forward on Android, requests microphone consent; a denial moves the ringing
     VOIP row to PSTN via `POST /calls/{callId}/fallback` and only proceeds when the response is
     `PSTN_BRIDGING` (otherwise the row is torn down with an explicit message),
   - `POST /calls/{callId}/join` accepts the row (`RINGING → ACTIVE`) and returns a fresh 2-hour
     VOIP token,
   - joins 100ms (VOIP) or opens the masked dialer in handoff mode (PSTN); when the server already
     placed the bridge (`bridged: true`) nothing is dialled — the client shows "Connecting the secure
     phone line…" and waits for the provider webhook to mark the row ACTIVE. Then `ActiveCall` shows
     the timer.
5. **Decline** (native decline or in-app Decline) → the ring notification is dismissed
   (`declineIncomingCall`) + `POST /calls/{callId}/reject` (`RINGING → REJECTED`; a `busy` reason is
   recorded as `BUSY`).
6. While ringing, the server watches `ringing_ack_at`; a later `GET /calls/{callId}` reports
   `fallbackAvailable` so the caller can switch to PSTN.
7. A row that outlives the runtime is handled twice: on the next authenticated start the client
   (once per session) re-surfaces a still-ringing incoming call from `GET /delivery/calls/active`,
   re-acks when a surface is shown **and** starts the in-app ringing tone when only the in-app
   surface is visible; the gateway sweeper closes `RINGING` rows older than 45 s as `MISSED`.

## State

- `useCallStore` — `phase: 'ringing'`, `incoming: true`, masked peer label, order id; after join the
  normal active-call fields (`connectedAt`, `audioRoute`, …).
- The notification's Answer/Decline `PendingIntent`s land in `IncomingCallReceiver`; a live JS runtime
  gets a `FaazioIncomingCallAction` event, a killed app parks the action in `IncomingCallState` and
  `takePendingCallAction()` adopts it on the next bootstrap. There is no phone-account prompt at any
  point, so nothing to cancel/retry.

## Data path

- FCM data message → shared `handleIncomingCall` (no fixture).
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack` → `delivery.calls`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join` → `delivery.calls` + 100ms token.
- `gateway.rejectDeliveryCall` → `POST /calls/{callId}/reject`.

## Success / error / empty

- **Success:** full-screen ring → answer → active call; decline → caller hears failure.
- **Error:** the notification is refused → the in-app `ActiveCall` surface shows Accept/Decline
  instead; push without `callId` is ignored; no session is fabricated.
- **Empty:** no push → no ring.

## Known gaps

- **Provisioning.** The `incoming_call` push is sent by both initiate paths and the Android
  background handler rings on it, but a production ring still needs FCM credentials
  (`FCM_SERVICE_ACCOUNT_JSON` + `FCM_PROJECT_ID`) — without them the outbox has no sender.
- **iOS ring unverified.** The customer iOS app owns PushKit/CallKit natively
  (`VoipCallManager.swift`) and the gateway sends the `voip` push over APNs; the delivery partner app
  stays Android/FCM (`incoming_call` data push → full-screen-intent notification). A macOS
  `pod install` + device build is still required to prove the iOS path.
- **Answer when the app was swiped away** depends on headless JS + the notification's Answer
  `PendingIntent`; device/OEM battery restrictions can suppress the background handler.
- **No GSM-busy pre-check** before ringing, and no queued-call banner for a second caller.

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- `docs/architecture/mobile-app.md` (Masked calling)
- `docs/RUNBOOKS/FIREBASE_AUTH.md` (push transport)
