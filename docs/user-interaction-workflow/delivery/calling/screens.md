# Delivery calling — screens + state

**App / route(s):** delivery · `ActiveCall`, `CallCustomerButton`
**Status:** **Partial**

## Screens / components

| Surface | File | Behavior |
|---|---|---|
| `CallCustomerButton` | `features/delivery-partner/components/CallCustomerButton.tsx` | Primary **Call customer** + optional secondary **Use phone call** (forces PSTN). Hidden when `CALLING_ENABLED=false`; while a call is open it opens `ActiveCall` instead of starting a second one |
| `Route` DROP stop | `screens/RouteScreen.tsx` | Renders the call action for the stop's `deliveryOrderId`; the old raw `tel:customerPhone` row was removed |
| `Dashboard` active card | `screens/DashboardScreen.tsx` | Renders the call action under each accepted `DPOrderCard` |
| `ActiveCall` | `screens/ActiveCallScreen.tsx` → shared `features/call/CallSurface.tsx` | Full-screen, non-dismissible (`gestureEnabled: false`, `fullScreenModal`, plus a `beforeRemove` guard that ends the call before leaving). Masked peer label, `Delivery call · #<last6>`, timer (only after connect), status line, mute/speaker/Bluetooth/phone-line controls, End; Accept/Decline when ringing; Done after end/error |
| Customer `ActiveCall` | `features/customer/screens/ActiveCallScreen.tsx` | Same shared surface with the customer light/dark palette (see customer calling docs) |

## Visual rules

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

The shared factory exposes `initialize`, `start`, `handleIncomingCall`, `accept`, `decline`, `end`,
`handleNativeEnd`, `toggleMute`, `toggleSpeaker`, `routeToBluetooth`, `switchToPstn`, `dismiss`,
`shutdown`, `clear`, `currentCallId`, `isOpen`. The delivery binding re-exports the existing names
(`startDeliveryCall`, `acceptIncomingCall`, …).

It polls `GET /calls/{id}` every 2 s with a single in-flight request; ignores responses for a
non-active call id; the 3 s tap lock and the server's pre-provisioning open-call check prevent
duplicate rooms. Startup calls `GET /delivery/calls/active` to resume/close a row that outlived the
runtime. Sign-out calls `shutdownCalling()` so no row or native session survives the account switch.

## Known gaps

- No proximity/wake-lock UI (screen may stay on during an earpiece call).
- The PSTN timer starts at dialer open, not at provider answer.
- The in-app Accept/Decline surface is shown when CallKeep is unavailable; the native ring is the
  primary path.
- CallKeep "answered" from a killed app is replayed via `didLoadWithEvents`; a device that denies the
  phone account gets the in-app surface (or lets the server PSTN-fallback if headless).
- The customer app surface exists but the server cannot create a customer-initiated call yet.

## Linked docs

- [`index.md`](./index.md) · [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- [`../../customer/calling/screens.md`](../../customer/calling/screens.md)
- `docs/UI_DESIGN_SYSTEM.md`
- `docs/architecture/mobile-app.md`
