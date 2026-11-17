# Customer calling — screens + state

**App / route(s):** customer · `OrderDetails`, `ActiveCall`
**Status:** **Partial**

## Screens / components

| Surface | File | Behavior |
|---|---|---|
| Order Details call card | `features/profile/OrderDetailsScreen.tsx` | Renders for `fulfillment === 'DELIVERY'` orders in `Shipped` (rider job live), non-prescription. A `Delivered` order is terminal (`ROUTE_COMPLETE`) and shows no card. Explains the masked line; no rider phone number is shown |
| `CallDeliveryPartnerButton` | `features/customer/components/CallDeliveryPartnerButton.tsx` | Primary **Call delivery partner** + secondary **Use phone call** with a phone-line icon (forces PSTN). Hidden when `CALLING_ENABLED=false`; while a call is open it opens `ActiveCall` instead of starting a second one. For 3 s after a tap it reads **Starting call…** and is disabled |
| `ActiveCall` | `features/customer/screens/ActiveCallScreen.tsx` → shared `features/call/CallSurface.tsx` | Root full-screen route (`fullScreenModal`, `gestureEnabled: false`, `beforeRemove` guard ends the call first). Masked peer label, `Delivery call · #<last6>`, connect-only timer, status line, mute/speaker/Bluetooth/phone-line controls, End; Accept/Decline when ringing; Done after end/error |

## Visual rules

- While an outgoing VOIP call is `ringing`, `features/call/ringtone.ts` plays a looped local ringback; the status line still says **Ringing…**.

- The shared surface takes `CallSurfaceColors`; the customer screen supplies the resolved light/dark
  palette (`useThemeMode`) and `RADIUS`/`TOUCH`, so no per-component theme conditionals or raw hex.
- The timer is `mm:ss` from `connectedAt` and stays `00:00` while ringing.
- Copy is status-true ("Connecting…", "Ringing…", "Reconnecting…", "Secure phone call",
  "Call ended"); the peer is always **Delivery Partner**, never a name/number.
- The call card is hidden for pickup, `Processing`, `Cancelled` and prescription orders.

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
and shuts down on sign-out. The binding sets `recoverActiveCall: false` because
`GET /delivery/calls/active` is rider-scoped; the customer resumes per order through
`GET /orders/{orderId}/delivery-call` inside `start`/`adoptOpenCall` instead.

Regression tests: `src/features/call/__tests__/controller.test.ts` and
`src/state/__tests__/callStore.test.ts` cover the shared lifecycle races and store contract.

## Known gaps

- The customer binding injects an `api` surface, so the shared controller only reaches the
  order-scoped `delivery-calls` family; the rider-scoped `/delivery/calls/*` routes stay unreachable
  from this product.
- No proximity/wake-lock; PSTN timer starts at dialer open.
- The in-app Accept/Decline surface is the fallback when CallKeep is unavailable.

## Linked docs

- [`index.md`](./index.md) · [`outgoing.md`](./outgoing.md) · [`incoming.md`](./incoming.md)
- [`../../delivery/calling/screens.md`](../../delivery/calling/screens.md)
- `docs/UI_DESIGN_SYSTEM.md`
- `docs/architecture/mobile-app.md`
