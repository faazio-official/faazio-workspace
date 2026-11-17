# Outgoing delivery call (rider → customer)

**App / route(s):** delivery · `Dashboard` / `Route` (`CallCustomerButton`) → `ActiveCall`
(`features/delivery-partner/screens/ActiveCallScreen.tsx` → shared `features/call/CallSurface.tsx`)
**Status:** **Partial** — rider side shipped; the customer peer app exists but the server has no
customer-initiated/push path.
**Trigger:** rider taps **Call customer** on an accepted job (Dashboard active-order card) or on a
DROP stop on `Route`; **Use phone call** forces the masked PSTN leg.

## Steps

1. `CallCustomerButton` calls `startDeliveryCall(orderId, 'Customer')`.
2. The shared controller refuses a second call while one is open and locks further taps for 3 s. The
   button mirrors that lock (`Starting call…`, disabled) so a rapid second tap is visibly rejected
   rather than silently ignored.
3. Android microphone consent is requested only when the VOIP leg may be used. A denial or dismiss
   sends `forcePstn: true`; the explicit **Use phone call** action skips the microphone prompt
   entirely. Android 12+ also asks for `BLUETOOTH_CONNECT` (best-effort, never blocks the call).
4. `callStore.begin()` → phase `connecting`; `ActiveCall` opens immediately with the masked peer
   label and order suffix.
5. `gateway.initiateDeliveryCall(orderId, { forcePstn })` → `POST /delivery/{orderId}/call`.
6. The server verifies the rider is ACTIVE, the job is theirs, and the job is `ACCEPTED`; it then
   refuses with `409` when an open call already exists **before** provisioning anything, then:
   - **VOIP:** provisions a 100ms room, mints a 2-hour token, inserts a `RINGING` `VOIP` row.
   - **PSTN_BRIDGING:** inserts a `RINGING` row with the masked virtual number.
   - **Neither configured:** `503 calling_unavailable` (never a fabricated room/number).
7. **VOIP:** `voip.joinVoip()` joins the room, routes audio to a paired Bluetooth headset else the
   earpiece, and reports the active route. While the phase is `ringing`, `ringtone.ts` loops a local
   ringback; it stops on peer join, media error, switch, end or dismiss. The phase moves to `active`
   when a remote peer appears; `Reconnecting`/`Reconnected` drive the banner (a successful reconnect
   clears it). `markActive()` preserves the first `connectedAt`, so the timer never resets.
8. **PSTN:** `Linking.openURL('tel:<virtualNumber>')` opens the dialer on the masked landline. No
   provider answer webhook exists, so the surface marks the leg active when the dialer opens; the
   timer starts there, not at provider answer. The customer's raw number is never shown or dialled.
   If the dialer cannot open, the row is ended (`start_failed`) and polling stops.
9. The controller polls `GET /calls/{callId}` every 2 s (single in-flight poll; responses for an
   old call are ignored). A VOIP call still `RINGING` past `HMS_RINGING_ACK_SECONDS` (default 3)
   returns `fallbackAvailable`, and while the local phase is still `ringing` the screen offers
   **Switch to phone call**. A server `ACTIVE` status flips the local phase to active.
10. **End / dismiss:** `POST /calls/{callId}/end` (retried once), leave the 100ms room, end the
    native call, stop the ringback, phase `ended`. `Done`, hardware back and a native hang-up all
    route through the same end/dismiss path, which bumps the session epoch: a `connect`, `join` or
    PSTN-switch response that lands later is discarded (a created row is rejected/ended) instead of
    joining a call with no UI. A failed start tears the row down too.
11. **Recovery:** once per authenticated session, `GET /delivery/calls/active` returns any open row.
    A still-ringing incoming call is re-surfaced and re-acked; a stale outgoing/active row is ended
    with reason `app_restarted`. The gateway separately sweeps `RINGING` > 45 s and `ACTIVE` > 2 h.

## State

- `useCallStore` — phase, server call projection, masked peer label, `connectedAt`, mute/speaker/
  `audioRoute`, `bluetoothAvailable`, `reconnecting`, `fallbackPrompt`, `notice`, error.
- Shared controller module state — `activeCallId`, poll timer, in-flight poll/accept guards,
  session epoch, once-per-session recovery flag, 3 s lock, fallback-shown flag, AppState
  subscription.

## Data path

- `gateway.initiateDeliveryCall` → `POST /delivery/{orderId}/call` → `delivery.calls`
  + 100ms room/token or `DELIVERY_CALL_VIRTUAL_NUMBER`.
- `gateway.getDeliveryCall` → `GET /calls/{callId}` → `delivery.calls`.
- `gateway.endDeliveryCall` → `POST /calls/{callId}/end`.

## Success / error / empty

- **Success:** VOIP joins and the peer appears → `active`; PSTN dialer opens on the masked line.
  (The customer peer cannot join until the server creates a CUSTOMER-initiated session and pushes
  it, so VOIP success is only observable with a second test peer.)
- **Error:** 409 `order_not_accepted`, 409 open-call conflict, 503 `calling_unavailable`, offline —
  an honest inline message on `ActiveCall`; the ringback is local only while the row is genuinely
  `ringing` and no fake timer runs before connect.
- **Empty:** no accepted job → the call action is not rendered.

## Known gaps

- **No customer-initiated server path.** The customer app now has the button/route/controller, but
  the gateway only accepts rider-initiated calls and never enqueues an `incoming_call` push, so the
  customer button is rejected with a conflict.
- **PSTN provider is external.** The gateway returns the configured virtual landline; Exotel/Edesy
  Connect + webhook reconciliation are not implemented (`provider_call_ref` stays empty) — so the
  call does not reach the customer.
- **PSTN timer starts at dialer open**, not at the provider's answer (no answer event yet).

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- `docs/architecture/mobile-app.md` (Masked calling)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` §12.39
