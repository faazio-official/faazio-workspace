# Incoming customer call (delivery partner → customer)

**App / route(s):** customer · Android: shared FCM handler → native ringing (CallKeep) · iOS: PushKit VoIP push → CallKit → `ActiveCall`
**Status:** **Partial** — send, receive, ring and answer are implemented on Android and iOS; the remaining gap is PSTN provider provisioning.
**Trigger:** `{ type: "incoming_call", callId, callUuid, orderId, peerRole, callerLabel, mode }` — Android receives it as a data-only FCM message, iOS as a PushKit VoIP push (`apns-push-type: voip`).

## Steps

### Transport selection (server)

1. `delivery.Handler.notifyCallee` enqueues the `incoming_call` outbox row and nudges the drain
   worker. The row carries `callUuid` (a stable UUID derived from `callId`, because CallKit rejects
   `call-<hex>`) and `callerLabel` (the masked role of the *caller*). A call the server bridged over
   PSTN skips this push: the provider rings both phones and the row projects `bridged: true`.
2. `notifications.Repo.Pending` picks exactly one token per row: the PushKit `voip` token when the
   callee has one **and** the gateway has APNs credentials (`SupportsVoIP()`); otherwise the `push`
   token (Android, or an iOS device whose APNs key is missing — a PushKit token is not an FCM
   registration token). Every non-call kind only ever uses `push`.
3. `notifications.MultiSender` routes `voip` → APNs (`APNSender`, ES256 provider JWT, `apns-push-type:
   voip`) and everything else → FCM. A `410`/`BadDeviceToken` prunes that token; if a token that can
   still carry this row's kind survives, it returns to `PENDING` for the next drain, otherwise the row
   is terminal (never a PENDING row no drain can select).

### Android ring (FCM → CallKeep)

4. `index.js` registers `registerCustomerCallBackgroundHandler()` before the app mounts, using the
   shared `setBackgroundMessageHandler`. `customerPush.ts` routes foreground,
   notification-opened and cold-start call payloads to the same handler.
5. Messages whose `type` is not `incoming_call` continue to the existing inbox-refresh callback.
6. `handleIncomingCall()` (shared controller):
   - hydrates the Keychain session and drops the push when the device is signed out,
   - ignores a duplicate delivery of the same call id while ringing/active,
   - rejects with `busy` when another call is already open,
   - sets `callStore` to `ringing` with `incoming: true` and the masked peer label
     (`callerLabel`, else the role mapping),
   - sets up CallKeep and shows the native full-screen ring with the peer role + order suffix; if
     CallKeep is unavailable (or does not confirm the display within 1.5 s) the in-app surface is
     shown and loops the ringing tone,
   - sends `POST /delivery-calls/{callId}/ringing-ack` only when a ring surface is actually visible
     (native ring displayed or the app is foreground),
   - starts the 2 s status poll, so a caller cancel/end (only the server knows) stops the ring and
     resets the surface instead of ringing until the 45 s sweep.

### iOS ring (PushKit → CallKit)

7. `VoipCallManager.start()` runs in `AppDelegate.didFinishLaunchingWithOptions`, so PushKit and the
   single `CXProvider` exist before the first VoIP push — including a push that launches the app in
   the background with no JS runtime. iOS terminates an app that takes a VoIP push without reporting
   a call.
8. `pushRegistry(_:didUpdate:)` persists the PushKit token and emits `VoipTokenUpdated`;
   `customerPush.ts` registers the persisted value through `POST /notifications/register` with
   `tokenKind: "voip"` (a second row beside the FCM token) and subscribes to later deliveries/rotations.
9. `pushRegistry(_:didReceiveIncomingPushWith:)` parses `callId` + `callUuid`, reports the call to
   CallKit with the masked `callerLabel`, and persists the payload plus a `displayed` flag. A
   refused report (`Unentitled`, duplicate UUID, Do Not Disturb) keeps `displayed = false` so JS
   shows the in-app surface instead of ringing nowhere.
10. `VoipCallBridge` emits `VoipCallDisplayed` (or `VoipCallFailed` when CallKit refused the report);
    either drives the shared controller's `onIncoming` handler through the same `handleIncomingCall`
    path as Android, so the state machine and the ringing ack are identical. `showIncoming` on iOS
    confirms the CallKit ring through the persisted state instead of calling a display API — a failed
    report therefore opens the in-app surface. A duplicate report for the same UUID is never sent.
11. A push that arrives while JS is not running is adopted on the next `initialize()`:
    `takePendingNativeCall()` replays the payload, and an answer/end the user gave on the system
    screen is honoured (`accept` / `reject`) instead of being lost.

### Shared answer / decline / end

12. **Accept** (native answer or in-app Accept) → `acceptIncomingCall(callId)`:
    - in-flight/double-answer guarded and cancelled if the user declines while `/join` is in flight,
    - on iOS an in-app Accept fulfils the CallKit answer action (`answerCall`); an answer from the
      system screen sets the UUID first so later end/answer calls reach CallKit,
    - brings the app forward on Android, asks for microphone consent (denial moves the ringing VOIP
      row to PSTN via `POST /delivery-calls/{callId}/fallback` and only proceeds when the response is
      `PSTN_BRIDGING`),
    - `POST /delivery-calls/{callId}/join` accepts the row and returns a fresh token,
    - joins 100ms (VOIP) or opens the masked dialer (PSTN); `ActiveCall` shows the timer.
13. **Decline** (native decline or in-app Decline) → `rejectNativeCall` (CallKeep `rejectCall` on
    Android, CallKit `CXEndCallAction` on iOS) + `POST /delivery-calls/{callId}/reject`.
14. **Startup recovery** is per-order for the customer: `GET /delivery/calls/active` is rider-scoped,
    so the customer binding resolves its own row with `GET /orders/{orderId}/delivery-call` when a
    start races an existing session. A row that outlived the runtime without an orderId in hand is
    bounded by the gateway sweeper, and a re-delivered push can still ring it.

## State

- `useCallStore` — `phase: 'ringing'`, `incoming: true`, masked peer label, order id; after join
  the normal active fields.
- Android: CallKeep `answerCall`/`endCall`/`didLoadWithEvents` listeners, attached once after login.
- iOS: `activeCallUuid` holds the CallKit UUID (the native key), `VoipCallBridge`
  `VoipCallAnswered`/`VoipCallEnded`/`VoipCallDisplayed` listeners, and the persisted pending-call
  state that survives a cold start.

## Data path

- Android: FCM data message → shared `handleIncomingCall` (no fixture). The push is data-only, so
  FCM runs the background handler even for a killed/swiped app.
- iOS: APNs VoIP push → `VoipCallManager` → CallKit + persisted payload → `VoipCallBridge` event →
  `handleIncomingCall`.
- `gateway.ackCustomerDeliveryCallRinging` → `POST /delivery-calls/{callId}/ringing-ack`.
- `gateway.joinCustomerDeliveryCall` → `POST /delivery-calls/{callId}/join`.
- `gateway.rejectCustomerDeliveryCall` → `POST /delivery-calls/{callId}/reject`.

## Success / error / empty

- **Success:** native ring → answer → active call; decline → caller hears failure.
- **Error:** CallKit/CallKeep unavailable → in-app Accept/Decline; a payload without `callId` or with
  an unparseable `callUuid` is ignored (never a fabricated ring); no session is fabricated.
- **Empty:** no push → no ring.

## Known gaps

- **PSTN bridge credentials** are not provisioned, so the masked landline stays a dial-only handoff.
- **GSM-busy pre-check** and queued-call handling are absent.
- **iOS ring verification** needs a real device + production APNs key (`APNS_KEY_ID`,
  `APNS_TEAM_ID`, `APNS_PRIVATE_KEY_PEM`); Codemagic builds the binary but cannot exercise a ring.

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- [`../../delivery/calling/incoming.md`](../../delivery/calling/incoming.md)
- `docs/RUNBOOKS/FIREBASE_AUTH.md` (push transport, APNs credentials)
