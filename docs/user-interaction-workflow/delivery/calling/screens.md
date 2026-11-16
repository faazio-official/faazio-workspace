# Delivery calling — screens + state

**App / route(s):** delivery · `ActiveCall`, `CallCustomerButton`
**Status:** **Partial**

## Screens / components

| Surface | File | Behavior |
|---|---|---|
| `CallCustomerButton` | `features/delivery-partner/components/CallCustomerButton.tsx` | Primary **Call customer** + optional secondary **Use phone call** (forces PSTN). Hidden when `CALLING_ENABLED=false`; while a call is open it opens `ActiveCall` instead of starting a second one |
| `Route` DROP stop | `screens/RouteScreen.tsx` | Renders the call action for the stop's `deliveryOrderId`; the old raw `tel:customerPhone` row was removed |
| `Dashboard` active card | `screens/DashboardScreen.tsx` | Renders the call action under each accepted `DPOrderCard` |
| `ActiveCall` | `screens/ActiveCallScreen.tsx` | Full-screen, non-dismissible (`gestureEnabled: false`, `fullScreenModal`, plus a `beforeRemove` guard that ends the call before leaving). Masked peer label, `Order #<last6>`, timer, status line, mute/speaker/Bluetooth/phone-line controls, End; Accept/Decline when ringing in-app; Done after end/error |

## Visual rules

- Uses `DELIVERY` / `DP_TYPE` / `DPButton` only; no raw hex, no custom font sizes.
- The timer is `mm:ss` from `connectedAt` (active) or the server `createdAt` (ringing).
- Copy is status-true: "Connecting…", "Ringing…", "Reconnecting…", "Secure phone call",
  "Call ended" — never a fake "connected" state.
- The masked peer is always **Customer** / **Delivery Partner**; no phone number, name or address is
  rendered by the call surface.

## State machine (`src/state/callStore.ts`)

`idle → connecting → ringing → active → ending → ended` (plus `error`).

Fields: `call` (server projection), `orderId`, `peerLabel`, `connectedAt`, `muted`, `speaker`,
`bluetoothAvailable`, `incoming`, `reconnecting`, `fallbackPrompt`, `error`.

Actions: `begin`, `beginIncoming`, `setCall`, `markRinging`, `markActive`, `setMuted`, `setSpeaker`,
`setBluetoothAvailable`, `setReconnecting`, `setFallbackPrompt`, `setError`, `markEnding`,
`markEnded`, `reset`.

## Controller (`features/delivery-partner/calling/callController.ts`)

`startDeliveryCall`, `acceptIncomingCall`, `declineIncomingCall`, `endActiveCall`, `handleNativeEnd`,
`toggleMute`, `toggleSpeaker`, `routeToBluetooth`, `switchCallToPstn`, `initializeDeliveryCalling`,
`dismissCall`, `shutdownCalling`, `flushPendingActiveCall`, `clearCall`. Polls `GET /calls/{id}`
 every 2 s; the 3 s tap lock and the server's pre-provisioning open-call check prevent duplicate
rooms. Startup calls `GET /delivery/calls/active` to resume/close a row that outlived the runtime.
Sign-out calls `shutdownCalling()` so no row or native session survives the account switch.

## Known gaps

- No proximity/wake-lock UI (screen may stay on during an earpiece call).
- The PSTN timer starts at allocation, not at provider answer.
- The in-app Accept/Decline surface is only shown when CallKeep is unavailable (or an incoming row is
  opened manually); the native ring is the primary path.
- CallKeep "answered" from a killed app is replayed via `didLoadWithEvents`; a device that denies the
  phone account still gets the in-app surface, and setup is retried on the next call.
- The customer app has no equivalent surface yet.

## Linked docs

- [`index.md`](./index.md) · [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- `docs/UI_DESIGN_SYSTEM.md`
- `docs/architecture/mobile-app.md`
