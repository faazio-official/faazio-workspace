# Delivery calling — edge cases

**App / route(s):** delivery · `calling/callController.ts`, `calling/voip.ts`, `calling/callkeep.ts`
**Status:** **Partial**

| Case | Current behavior | Status |
|---|---|---|
| Double tap / two devices | `callController` 3 s lock + one server open call per rider (partial unique index `calls_one_open_per_rider`); the second initiate is `409` | Implemented |
| Microphone denied | Outgoing sends `forcePstn: true`; incoming calls `POST /calls/{id}/fallback` before joining | Implemented |
| Bluetooth helmet/intercom | `voip.routeBestAudio()` selects `BLUETOOTH` when present, else `EARPIECE`; the screen exposes a Bluetooth control | Implemented |
| Wi-Fi → cellular handoff | 100ms `RECONNECTING`/`RECONNECTED` drive a warning banner; no automatic PSTN switch | Partial — no 6 s timer, manual "Switch to phone call" |
| Call is not answered | Server returns `fallbackAvailable` after `HMS_RINGING_ACK_SECONDS`; the screen offers one-tap PSTN fallback | Implemented (caller can choose) |
| End while app is backgrounded | `endActiveCall` calls the gateway + leaves the room; CallKeep ends the native call | Implemented |
| App swiped away mid-call | `endCallsWhenReactNativeStops: true` ends the native call; no JS `applicationWillTerminate` hook | Partial — server row may stay `ACTIVE` until reconciliation |
| Rider already has another call | A second initiate is refused with `busy`/open-call conflict; no second room is created | Implemented |
| Rider on two orders | The server allows one open call; the in-app banner for a queued customer call ("Customer #2 tried calling") is not built | Gap |
| Already on a GSM call | No `TelephonyManager.CALL_STATE_OFFHOOK` / `CXCallObserver` pre-check | Gap |
| Proximity sensor while on earpiece | No wake-lock/proximity handling; the OS may keep the screen on | Gap |
| End by native UI | CallKeep `endCall` → reject while ringing, end when active | Implemented |
| Provider outage (100ms) | Initiate falls back to PSTN when `DELIVERY_CALL_VIRTUAL_NUMBER` is set, else `503 calling_unavailable` | Implemented |
| PSTN provider failure | The gateway returns the configured landline; there is no provider call-ref/webhook yet | Gap |
| Raw phone exposure | The app never receives the customer's phone; `Route` no longer dials `customerPhone` | Implemented (security fix in the same change) |

## Known gaps summary

The following must land before this domain can be marked **Complete**:

1. Customer-app "Call delivery partner" button + server endpoint that creates a
   `CUSTOMER`-initiated call and enqueues the `incoming_call` data push.
2. Exotel/Edesy Connect API + status webhook (populate `provider_call_ref`, answer/end events, and
   ringback/timer accuracy for the PSTN leg).
3. GSM-busy pre-check and proximity/wake-lock handling.
4. A queued-call banner for a rider already on a call.
5. A cold-start/native-terminate reconciliation that closes a stale `ACTIVE` row.

## Linked docs

- [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- `docs/architecture/mobile-app.md`
- `client/mobile/PENDING_WORK.md`
