# Outgoing delivery call (rider → customer)

**App / route(s):** delivery · `Dashboard` / `Route` (`CallCustomerButton`) → `ActiveCall`
(`screens/ActiveCallScreen.tsx`)
**Status:** **Partial** — rider side shipped; the customer peer app is not.
**Trigger:** rider taps **Call customer** on an accepted job (Dashboard active-order card) or on a
DROP stop on `Route`; **Use phone call** forces the masked PSTN leg.

## Steps

1. `CallCustomerButton` calls `startDeliveryCall(orderId, 'Customer')`.
2. `callController` refuses a second call while a call is open and locks further taps for 3 s.
3. Android microphone consent is requested. A denial or dismiss sends `forcePstn: true` to the
   gateway instead of failing the call.
4. `callStore.begin()` → phase `connecting`; `ActiveCall` opens immediately with the masked peer
   label and order suffix.
5. `gateway.initiateDeliveryCall(orderId, { forcePstn })` → `POST /delivery/{orderId}/call`.
6. The server verifies the rider is ACTIVE, the job is theirs, and the job is `ACCEPTED`, then:
   - **VOIP:** provisions/reuses a 100ms room, mints a short-lived token, inserts a `RINGING`
     `VOIP` row, returns `{ roomId, authToken }`.
   - **PSTN_BRIDGING:** inserts a `RINGING` row with the masked virtual number.
   - **Neither configured:** `503 calling_unavailable` (never a fabricated room/number).
7. **VOIP:** `voip.joinVoip()` joins the room, routes audio to a paired Bluetooth headset else the
   earpiece. The phase moves to `active` when a remote peer appears; `Reconnecting`/`Reconnected`
   drive the banner.
8. **PSTN:** `Linking.openURL('tel:<virtualNumber>')` opens the dialer on the masked landline. The
   customer's raw number is never shown or dialled.
9. `callController` polls `GET /calls/{callId}` every 2 s. A VOIP call still `RINGING` past
   `HMS_RINGING_ACK_SECONDS` (default 3) returns `fallbackAvailable`, and the screen offers
   **Switch to phone call**.
10. **End:** `POST /calls/{callId}/end`, leave the 100ms room, end the native call, phase `ended`.

## State

- `useCallStore` — phase, server call projection, masked peer label, `connectedAt`, mute/speaker/
  Bluetooth, `reconnecting`, `fallbackPrompt`, error.
- `callController` module state — `activeCallId`, poll timer, 3 s lock, fallback-shown flag.

## Data path

- `gateway.initiateDeliveryCall` → `POST /delivery/{orderId}/call` → `delivery.calls`
  + 100ms room/token or `DELIVERY_CALL_VIRTUAL_NUMBER`.
- `gateway.getDeliveryCall` → `GET /calls/{callId}` → `delivery.calls`.
- `gateway.endDeliveryCall` → `POST /calls/{callId}/end`.

## Success / error / empty

- **Success:** VOIP joins and the peer appears → `active`; PSTN dialer opens on the masked line.
- **Error:** 409 `order_not_accepted`, 409 open-call conflict, 503 `calling_unavailable`, offline —
  an honest inline message on `ActiveCall`; no fake ringback or timer.
- **Empty:** no accepted job → the call action is not rendered.

## Known gaps

- **Customer peer is not built.** A VOIP room has no callee until the customer app joins, so the
  fallback prompt appears after the ack window; today the PSTN leg is the usable path.
- **PSTN provider is external.** The gateway returns the configured virtual landline; Exotel/Edesy
  Connect + webhook reconciliation are not implemented (`provider_call_ref` stays empty).
- **No local ringback tone.** VOIP shows a "Ringing…" state rather than a synthesized ringback.
- **Timer for PSTN starts at allocation**, not at the provider's answer (no answer event yet).

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- `docs/architecture/mobile-app.md` (Masked calling)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` §12.39
