# Delivery calling — screens + state

**App / route(s):** delivery · `ActiveCall`, `CallCustomerButton`
**Status:** **Partial**

## Screens / components

| Surface | File | Behavior |
|---|---|---|
| `CallCustomerButton` | `features/delivery-partner/components/CallCustomerButton.tsx` | Primary **Call customer** + optional secondary **Use phone call** with a phone-line icon (forces PSTN). Hidden when `CALLING_ENABLED=false`; while a call is open it opens `ActiveCall` instead of starting a second one. For 3 s after a tap the button reads **Starting call…** and is disabled |
| `Route` DROP stop | `screens/RouteScreen.tsx` | Renders the call action for an unfinished DROP stop's `deliveryOrderId`; completed/failed stops hide it. The old raw `tel:customerPhone` row was removed |
| `Dashboard` active card | `screens/DashboardScreen.tsx` | Renders the call action under each accepted `DPOrderCard` |
| `ActiveCall` | `screens/ActiveCallScreen.tsx` → shared `features/call/CallSurface.tsx` | Full-screen, non-dismissible (`gestureEnabled: false`, `fullScreenModal`, plus a `beforeRemove` guard that ends the call before leaving). Masked peer label, `Delivery call · #<last6>`, timer (only after connect), status line, mute/speaker/Bluetooth/phone-line controls, End; Accept/Decline when ringing; Done after end/error |
| Customer `ActiveCall` | `features/customer/screens/ActiveCallScreen.tsx` | Same shared surface with the customer light/dark palette (see customer calling docs) |

## Visual rules

- While an outgoing VOIP call is `ringing`, `features/call/ringtone.ts` plays a looped local ringback; the status line still says **Ringing…** (copy and audio agree, no fake connect).

- Uses the injected `CallSurfaceColors`; the delivery binding passes `DELIVERY` tokens only, so no
  raw hex or local font sizes enter the screen.
- The timer is `mm:ss` from `connectedAt` (active) and stays `00:00` while ringing.
- Copy is status-true: "Connecting…", "Ringing…", "Reconnecting…", "Secure phone call",
  "Call ended" — never a fake "connected" state.
- The masked peer is always **Customer** / **Delivery Partner**; no phone number, name or address is
  rendered by the call surface.

## State machine (`src/state/callStore.ts`)

`idle → connecting → ringing → active → ending → ended` (plus `error`).

Fields: `call` (server projection), `orderId`, `peerLabel`, `connectedAt`, `muted`, `speaker`,
`audioRoute`, `bluetoothAvailable`, `incoming`, `reconnecting`, `fallbackPrompt`, `notice`, `error`.

Actions: `begin`, `beginIncoming`, `setCall`, `markRinging`, `markActive`, `setMuted`, `setSpeaker`,
`setAudioRoute`, `setBluetoothAvailable`, `setReconnecting`, `setFallbackPrompt`, `setNotice`,
`setError`, `markEnding`, `markEnded`, `reset`. `markActive()` preserves an existing `connectedAt`.

## Controller (`features/call/controller.ts` + delivery binding)

The shared factory exposes `bootstrap`, `initialize`, `start`, `handleIncomingCall`, `accept`,
`decline`, `end`, `handleNativeEnd`, `toggleMute`, `toggleSpeaker`, `routeToBluetooth`, `switchToPstn`,
`dismiss`, `shutdown`, `clear`, `currentCallId`, `isOpen`. The delivery binding calls `bootstrap` on
the authenticated app start (prompt-free) and re-exports the existing names (`startDeliveryCall`,
`initializeDeliveryCalling`, `acceptIncomingCall`, …). The native ring surface is set up lazily from
`CallCustomerButton` on the first **Call** tap.

It polls `GET /calls/{id}` every 2 s with a single in-flight request; ignores responses for a
non-active call id; a session epoch cancels any async connect/join/switch whose surface was
closed; the 3 s tap lock and the server's pre-provisioning open-call check prevent duplicate rooms.
Once per authenticated session it calls `GET /delivery/calls/active` to resume/close a row that
outlived the runtime (a Dashboard remount does not re-run recovery). Sign-out calls
`shutdownCalling()` so no row or native session survives the account switch.

Regression tests: `src/features/call/__tests__/controller.test.ts` covers the cancelled-start,
decline-during-accept and late-PSTN-switch races; `src/state/__tests__/callStore.test.ts` covers the
phase/timer/audio-route contract.

## Known gaps

- No proximity/wake-lock UI (screen may stay on during an earpiece call).
- The PSTN timer starts at dialer open, not at provider answer.
- The in-app Accept/Decline surface is shown when the full-screen-intent notification is refused; the
  notification ring is the primary path.
- An Answer tapped on the ring notification from a killed app is adopted via
  `takePendingCallAction()` on the next bootstrap; a device whose notifications are blocked gets the
  in-app surface (or lets the server PSTN-fallback if headless).
- The customer app surface reaches its own order-scoped endpoints
  (`POST /orders/{orderId}/delivery-call`); a shopper token cannot drive a rider-scoped route, and a
  rider token cannot drive `/delivery-calls/{callId}`.

## Linked docs

- [`index.md`](./index.md) · [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- [`../../customer/calling/screens.md`](../../customer/calling/screens.md)
- `docs/UI_DESIGN_SYSTEM.md`
- `docs/architecture/mobile-app.md`
