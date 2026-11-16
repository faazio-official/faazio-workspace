# Customer calling — screens + state

**App / route(s):** customer · `OrderDetails`, `ActiveCall`
**Status:** **Partial**

## Screens / components

| Surface | File | Behavior |
|---|---|---|
| Order Details call card | `features/profile/OrderDetailsScreen.tsx` | Renders for `fulfillment === 'DELIVERY'`, not `Cancelled`, non-prescription orders. Explains the masked line; no rider phone number is shown |
| `CallDeliveryPartnerButton` | `features/customer/components/CallDeliveryPartnerButton.tsx` | Primary **Call delivery partner** + secondary **Use phone call** (forces PSTN). Hidden when `CALLING_ENABLED=false`; while a call is open it opens `ActiveCall` instead of starting a second one |
| `ActiveCall` | `features/customer/screens/ActiveCallScreen.tsx` → shared `features/call/CallSurface.tsx` | Root full-screen route (`fullScreenModal`, `gestureEnabled: false`, `beforeRemove` guard ends the call first). Masked peer label, `Delivery call · #<last6>`, connect-only timer, status line, mute/speaker/Bluetooth/phone-line controls, End; Accept/Decline when ringing; Done after end/error |

## Visual rules

- The shared surface takes `CallSurfaceColors`; the customer screen supplies the resolved light/dark
  palette (`useThemeMode`) and `RADIUS`/`TOUCH`, so no per-component theme conditionals or raw hex.
- The timer is `mm:ss` from `connectedAt` and stays `00:00` while ringing.
- Copy is status-true ("Connecting…", "Ringing…", "Reconnecting…", "Secure phone call",
  "Call ended"); the peer is always **Delivery Partner**, never a name/number.
- The call card is hidden for pickup, cancelled and prescription orders.

## State machine (`src/state/callStore.ts`)

`idle → connecting → ringing → active → ending → ended` (plus `error`).

Fields: `call`, `orderId`, `peerLabel`, `connectedAt`, `muted`, `speaker`, `audioRoute`,
`bluetoothAvailable`, `incoming`, `reconnecting`, `fallbackPrompt`, `notice`, `error`.

Actions: `begin`, `beginIncoming`, `setCall`, `markRinging`, `markActive`, `setMuted`, `setSpeaker`,
`setAudioRoute`, `setBluetoothAvailable`, `setReconnecting`, `setFallbackPrompt`, `setNotice`,
`setError`, `markEnding`, `markEnded`, `reset`. `markActive()` preserves an existing `connectedAt`.

## Controller (`features/customer/calling/callController.ts`)

A thin binding of the shared factory with the root `navigationRef` and customer copy:
`initializeCustomerCalling`, `startCustomerCall`, `handleIncomingCall`, `acceptIncomingCall`,
`declineIncomingCall`, `endActiveCall`, `handleNativeEnd`, `toggleMute`, `toggleSpeaker`,
`routeToBluetooth`, `switchCallToPstn`, `dismissCall`, `shutdownCalling`,
`flushPendingActiveCall`, `clearCall`, `currentCallId`, `isCallOpen`.

`App.tsx` initializes after login, flushes a pending call navigation in `NavigationContainer.onReady`,
and shuts down on sign-out.

## Known gaps

- The call surface is reachable and honest, but the server rejects a customer-initiated call until
  the gateway endpoint + push sender land.
- No proximity/wake-lock; PSTN timer starts at dialer open.
- The in-app Accept/Decline surface is the fallback when CallKeep is unavailable.

## Linked docs

- [`index.md`](./index.md) · [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- [`../../delivery/calling/screens.md`](../../delivery/calling/screens.md)
- `docs/UI_DESIGN_SYSTEM.md`
- `docs/architecture/mobile-app.md`
