# Delivery calling — edge cases

**App / route(s):** customer + delivery · `features/call/controller.ts`, `voip.ts`, `callkeep.ts`
**Status:** **Partial**

| Case | Current behavior | Status |
|---|---|---|
| Double tap / two devices | The button disables itself for 3 s (`Starting call…`) and the controller enforces the same window; one server open call per rider (partial unique index `calls_one_open_per_rider`); the second initiate is `409 conflict`. Late poll/end responses are ignored unless they match the active call id | Implemented |
| End / Done / back while `connecting` | A session epoch is bumped by every dismiss/end/decline. When the initiate response arrives after the user left, the controller rejects the created row (`cancelled`) instead of joining a call with no UI | Implemented |
| Double Accept (native + in-app) | `accept` has an in-flight guard and returns early when the same call is already `active`; a second join cannot tear down a connected call | Implemented |
| Decline during Accept | `decline` bumps the session epoch, so an accept that is still awaiting `/join` ends the row (`cancelled`) instead of joining media after the user declined | Implemented |
| Microphone denied | Outgoing sends `forcePstn: true`. Incoming calls `POST /calls/{id}/fallback` and only proceed when the response is `PSTN_BRIDGING`; if the fallback fails the row is torn down with an explicit "microphone needed" message — it never joins a VOIP room without a mic | Implemented |
| Bluetooth helmet/intercom | `voip.routeBestAudio()` selects `BLUETOOTH` when present, else `EARPIECE`; `ON_AUDIO_DEVICE_CHANGED` updates the store, and the screen exposes a Bluetooth control. Android 12+ asks for `BLUETOOTH_CONNECT`; legacy permissions are declared for ≤ Android 11 | Implemented (device QA pending) |
| Wi-Fi → cellular handoff | 100ms `RECONNECTING`/`RECONNECTED` drive a warning banner; a successful reconnect clears it (and any stale instability notice). A media error on a ringing/active call offers **Switch to phone call** | Partial — no automatic switch/timeout |
| Outgoing ringback | A bundled ringing tone loops while an outgoing VOIP call is `ringing` and stops on peer join, media error, switch, end or dismiss. It is started/in-app for an incoming call only when CallKeep could not display the native ring | Implemented |
| Call is not answered | Server returns `fallbackAvailable` after `HMS_RINGING_ACK_SECONDS`; while the local phase is still `ringing` the screen offers one-tap PSTN fallback | Implemented (caller can choose) |
| End while app is backgrounded | Controller end calls the gateway + leaves the room; CallKeep ends the native call | Implemented |
| End/reject network failure | lifecycle mutations are retried once; the local session still clears and the gateway sweeper bounds any row that never landed | Implemented (best-effort) |
| App swiped away mid-call | `endCallsWhenReactNativeStops: true` ends the native call; the gateway sweeper closes a stale `ACTIVE` row after 2 h and `RINGING` after 45 s; the next start ends a recovered stale row (`app_restarted`). Recovery runs once per authenticated session, so a Dashboard remount cannot end another device's live call | Implemented (bounded delay) |
| Rider already has another call | A second initiate is refused with `409 conflict` **before** any room is provisioned; a reject whose reason is `busy` is recorded as status `BUSY` | Implemented |
| Re-delivered push after decline/end | The controller remembers the declined call id and ignores a duplicate push for a call already in `ended`/`error`, so a retried FCM delivery cannot re-ring a finished call | Implemented |
| Signed-out device receives a call push | The background handler hydrates the Keychain session and drops the push when unauthenticated; sign-out calls `shutdownCalling()` and disables the native phone account | Implemented |
| Rider on two orders | One open call is allowed; the in-app banner for a queued customer call is not built | Gap |
| Already on a GSM call | No `TelephonyManager.CALL_STATE_OFFHOOK` / `CXCallObserver` pre-check. CallKeep's managed-call check prevents a second **app** call | Gap |
| Proximity sensor while on earpiece | No wake-lock/proximity handling; the OS may keep the screen on | Gap |
| Android 14+ full-screen intent | Permission declared; the special-access grant is not requested/checked, so a denial degrades to a heads-up notification | Gap |
| End by native UI | CallKeep `endCall` → `rejectCall` while ringing, `endCall` when active; events are UUID-scoped | Implemented |
| Provider outage (100ms) | Initiate falls back to PSTN when `DELIVERY_CALL_VIRTUAL_NUMBER` is set, else `503 calling_unavailable` | Implemented |
| PSTN provider failure | The gateway returns the configured landline; there is no provider call-ref/webhook yet | Gap |
| PSTN outgoing state | The local surface marks the leg active when the dialer opens (the server row stays `RINGING`); timer starts at dialer open | Partial |
| PSTN dialer cannot open | `openPstnLeg` reports failure, the controller ends the row (`start_failed`) and stops polling instead of leaving an error surface over an open session | Implemented |
| PSTN controls | Mute/speaker/Bluetooth are hidden for `PSTN_BRIDGING` (they would be no-ops) | Implemented |
| Late PSTN switch after end | `switchToPstn` captures the session epoch and active call id; a fallback response that lands after the user ended/dismissed is discarded and never reopens the dialer | Implemented |
| Switch to PSTN fails | The live VOIP leg is kept; the failure is shown as a recoverable `notice`, not a terminal error | Implemented |
| Raw phone exposure | `Stop.CustomerPhone` is `json:"-"` and the rider order/route queries no longer select `customer_phone`; the client type dropped the field | Implemented |

## Known gaps summary

The following must land before this domain can be marked **Complete**:

1. Gateway customer-initiated call endpoint + `incoming_call` push sender.
2. Exotel/Edesy Connect API + status webhook (populate `provider_call_ref`, answer/end events, and
   ringback/timer accuracy for the PSTN leg).
3. GSM-busy pre-check and proximity/wake-lock handling.
4. A queued-call banner for a rider already on a call.
5. Android 14+ full-screen-intent special-access prompt.
6. An iOS customer build needs PushKit + CallKit pods/entitlements if incoming calls ship there
   (the delivery partner is Android-only).

**Fixed in this pass:** the caller-can-cancel-a-connecting-call ghost race, decline-vs-accept media
join, late PSTN-switch resurrection, PSTN-dialer failure leaving an open row, recovery re-acking
in-app rings and running once per session, reconnect notices clearing on success, re-delivered pushes
after decline/end, mic-denied accept silently joining a VOIP room, `CALLING_ENABLED` enforcement in
the controller/background handler (not just the button), an audible outgoing ringback/in-app
ringtone, a visible 3 s button lock, Android `phoneCall|microphone` foreground-service types, and
CallKeep display-timeout no longer sending a false delivery receipt.

## Linked docs

- [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- `docs/architecture/mobile-app.md`
- `client/mobile/PENDING_WORK.md`
