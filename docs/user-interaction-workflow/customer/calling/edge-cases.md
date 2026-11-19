# Customer calling — edge cases

**App / route(s):** customer · shared `features/call/` + `features/customer/calling/`
**Status:** **Partial**

| Case | Current behavior | Status |
|---|---|---|
| Double tap / two devices | The button disables for 3 s (`Starting call…`) and the controller enforces the same window; shared controller ignores late responses for a non-active call id; the gateway's one-open-call-per-rider index is the final guard, and a `409 conflict` makes the client adopt the existing open call instead of erroring | Implemented |
| End / Done / back while `connecting` | The session epoch cancels the in-flight initiate; a row created after the surface closed is rejected (`cancelled`) instead of joining a call with no UI | Implemented |
| Double Accept (native + in-app) | In-flight guard + already-active early return; a duplicated join cannot tear down a connected call | Implemented |
| Decline during Accept | `decline` bumps the session epoch; an accept still awaiting `/join` ends the row (`cancelled`) instead of joining media after the user declined | Implemented |
| Microphone denied | Outgoing sends `forcePstn: true`; incoming moves the ringing VOIP row to PSTN and proceeds only when the fallback response is `PSTN_BRIDGING` — it never joins VOIP without a mic | Implemented |
| Bluetooth headset | 100ms routes to Bluetooth when present else earpiece; `ON_AUDIO_DEVICE_CHANGED` updates the UI; Android 12+ asks `BLUETOOTH_CONNECT` | Implemented (device QA pending) |
| Wi-Fi → cellular handoff | Reconnecting banner + one-tap **Switch to phone call**; no automatic switch/timeout | Partial |
| Call not answered | Server `fallbackAvailable` drives the PSTN prompt while ringing | Implemented |
| End/reject network failure | Lifecycle mutations retry once; local session clears; the gateway sweeper bounds any row that never lands | Implemented (best-effort) |
| App swiped away mid-call | The native ring notification is cleared on teardown; the sweeper closes stale rows. The customer resumes with the order-scoped `GET /orders/{orderId}/delivery-call`, so a row that outlived the process is adopted rather than left to the sweeper | Implemented (startup recovery is opt-in per product) |
| Re-delivered push after decline/end | The controller remembers the declined call id and ignores a duplicate push for a call already `ended`/`error` | Implemented |
| Late PSTN switch after end | `switchToPstn` captures the session epoch + call id; a fallback response that lands after end/dismiss is discarded and never reopens the dialer | Implemented |
| PSTN dialer cannot open | The controller ends the row (`start_failed`) and stops polling instead of showing an error over an open session | Implemented |
| Outgoing ringback | Local looped ringback while an outgoing VOIP call rings; also used for an incoming call when the full-screen notification could not be shown | Implemented |
| Signed-out device receives a call push | Background handler hydrates the Keychain session and drops the push when unauthenticated; sign-out calls `shutdownCalling()` and tears the native ring/session down | Implemented |
| Already on a GSM call | No telephony pre-check; the shared controller's open-call guard prevents a second **app** call | Gap |
| Proximity sensor on earpiece | No wake-lock/proximity handling | Gap |
| Android 14+ full-screen intent | Permission declared; special-access grant is not requested/checked | Gap |
| iOS incoming call | Native PushKit + CallKit (`VoipCallManager.swift`, one `CXProvider`) reports the APNs `voip` push before JS boots; `VoipCallFailed` falls back to the in-app surface | Implemented (device-unverified) |
| PSTN controls | Mute/speaker/Bluetooth hidden on `PSTN_BRIDGING` (no-ops otherwise) | Implemented |
| Switch to PSTN fails | Live VOIP leg kept; recoverable `notice` instead of a terminal error | Implemented |
| Raw phone exposure | Only the masked virtual number is returned; the rider's raw number never reaches the customer client | Implemented |

## Known gaps summary

1. Exotel/Edesy Connect credentials + a public `PSTN_WEBHOOK_URL` to make the wired bridge live;
   until then the masked landline stays a dial-only handoff.
2. GSM-busy pre-check, proximity wake-lock, provider-answer timer.
3. Verify the iOS PushKit + CallKit bridge on a macOS build (the code exists; `pod install` and a
   device build with the PushKit entitlement are what is missing — FCM cannot deliver a VoIP push).

## Linked docs

- [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- [`../../delivery/calling/edge-cases.md`](../../delivery/calling/edge-cases.md)
- `docs/architecture/mobile-app.md`
- `client/mobile/PENDING_WORK.md`
