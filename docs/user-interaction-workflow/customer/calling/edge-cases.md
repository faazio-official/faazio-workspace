# Customer calling — edge cases

**App / route(s):** customer · shared `features/call/` + `features/customer/calling/`
**Status:** **Partial**

| Case | Current behavior | Status |
|---|---|---|
| Double tap / two devices | 3 s lock; shared controller ignores late responses for a non-active call id; the gateway's one-open-call constraint is the final guard | Implemented (server customer path pending) |
| Double Accept (native + in-app) | In-flight guard + already-active early return; a duplicated join cannot tear down a connected call | Implemented |
| Microphone denied | Outgoing sends `forcePstn: true`; incoming moves the ringing VOIP row to PSTN before joining | Implemented |
| Bluetooth headset | 100ms routes to Bluetooth when present else earpiece; `ON_AUDIO_DEVICE_CHANGED` updates the UI; Android 12+ asks `BLUETOOTH_CONNECT` | Implemented (device QA pending) |
| Wi-Fi → cellular handoff | Reconnecting banner + one-tap **Switch to phone call**; no automatic switch/timeout | Partial |
| Call not answered | Server `fallbackAvailable` drives the PSTN prompt while ringing | Implemented |
| End/reject network failure | Lifecycle mutations retry once; local session clears; the gateway sweeper bounds any row that never lands | Implemented (best-effort) |
| App swiped away mid-call | `endCallsWhenReactNativeStops` ends native ringing; the sweeper closes stale rows; recovery ends an unrecoverable active row | Implemented (bounded delay) |
| Signed-out device receives a call push | Background handler hydrates the Keychain session and drops the push when unauthenticated; sign-out calls `shutdownCalling()` and disables the native phone account | Implemented |
| Already on a GSM call | No telephony pre-check; CallKeep's managed-call check prevents a second app call | Gap |
| Proximity sensor on earpiece | No wake-lock/proximity handling | Gap |
| Android 14+ full-screen intent | Permission declared; special-access grant is not requested/checked | Gap |
| iOS incoming call | `voip`/`audio` background modes declared, but PushKit/CallKit pods are not native-linked | Gap |
| PSTN controls | Mute/speaker/Bluetooth hidden on `PSTN_BRIDGING` (no-ops otherwise) | Implemented |
| Switch to PSTN fails | Live VOIP leg kept; recoverable `notice` instead of a terminal error | Implemented |
| Raw phone exposure | Only the masked virtual number is returned; the rider's raw number never reaches the customer client | Implemented |

## Known gaps summary

1. Gateway customer-initiated call endpoint (order ownership + `initiated_by='CUSTOMER'`) and a
   customer-join token path.
2. `incoming_call` push sender for the rider.
3. Exotel/Edesy Connect + status webhook for PSTN.
4. GSM-busy pre-check, proximity wake-lock, provider-answer timer.
5. iOS PushKit + CallKit native bridge.

## Linked docs

- [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- [`../../delivery/calling/edge-cases.md`](../../delivery/calling/edge-cases.md)
- `docs/architecture/mobile-app.md`
- `client/mobile/PENDING_WORK.md`
