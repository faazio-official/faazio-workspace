# Outgoing customer call (customer → delivery partner)

**App / route(s):** customer · `OrderDetails` → `ActiveCall`
(`features/profile/OrderDetailsScreen.tsx`, `features/customer/components/CallDeliveryPartnerButton.tsx`)
**Status:** **Partial** — the client is implemented; the gateway has no customer-initiated call
endpoint yet.
**Trigger:** signed-in customer taps **Call delivery partner** on a delivery order whose status is
`Shipped` or `Delivered` (a rider is assigned; prescription orders excluded); **Use phone call**
forces the masked PSTN leg.

## Steps

1. `OrderDetails` renders a **Delivery partner** card with `CallDeliveryPartnerButton` when
   `order.fulfillment === 'DELIVERY'`, the status is `Shipped` or `Delivered`, and the order is not a
   prescription flow. `Processing`/`Cancelled` orders have no assigned rider and show no call card.
2. The button calls the shared controller's `startCustomerCall(orderId, 'Delivery Partner')`
   (`features/customer/calling/callController.ts`).
3. The controller refuses a second call while one is open and locks further taps for 3 s. The
   button mirrors the lock (`Starting call…`, disabled) so a rapid repeated tap is visibly rejected.
4. Android microphone consent is requested only when the VOIP leg may be used. A denial sends
   `forcePstn: true`; the explicit **Use phone call** action skips the prompt. Android 12+ also asks
   for `BLUETOOTH_CONNECT` (best-effort).
5. `callStore.begin()` → phase `connecting`; the root `ActiveCall` route opens immediately with the
   masked peer label and order suffix.
6. `gateway.initiateDeliveryCall(orderId, { forcePstn })` → `POST /delivery/{orderId}/call`.
   **Server gap:** the endpoint currently resolves the caller as a rider and writes a
   rider-initiated row; a normal customer is not a rider, so this step surfaces `404 not_found` (or
   `409` when the phone/rider state is invalid) as an honest error on the call surface.
7. When the server path lands, the same branches as the delivery app apply: VOIP joins the 100ms
   room with the minted token, routes audio to Bluetooth/earpiece and loops a local ringback until
   the rider joins; PSTN opens the masked dialer. The phone number of the rider is never rendered or
   dialled.
8. The controller polls `GET /calls/{callId}` every 2 s, mirrors a server `ACTIVE` status, and
   offers **Switch to phone call** when the server reports `fallbackAvailable`.
9. **End / dismiss:** `POST /calls/{callId}/end`, leave the 100ms room, end the native call, phase
   `ended`; `Done`/hardware back route through `dismissCall`.

## State

- `useCallStore` (shared) — phase, call projection, masked peer label, `connectedAt`,
  mute/speaker/`audioRoute`, `bluetoothAvailable`, `reconnecting`, `fallbackPrompt`, `notice`,
  error.
- Shared controller module state — active call id, poll timer, in-flight guards, 3 s lock,
  AppState subscription.

## Data path

- `gateway.initiateDeliveryCall` → `POST /delivery/{orderId}/call` → `delivery.calls`
  (server chooses VOIP vs PSTN_BRIDGING).
- `gateway.getDeliveryCall` → `GET /calls/{callId}`.
- `gateway.endDeliveryCall` → `POST /calls/{callId}/end`.

## Success / error / empty

- **Success (after the server ships):** VOIP joins and the rider appears → `active`; PSTN dialer
  opens on the masked line.
- **Error:** the current rider-only endpoint rejects a customer with an honest "This order is not
  ready for a call yet." / not-found style message; offline and `calling_unavailable` are shown
  inline. No fake ringback or timer.
- **Empty:** pickup, cancelled, or prescription orders do not render the call card.

## Known gaps

- No customer-initiated gateway endpoint, order-ownership check, customer VOIP token minting, or
  `incoming_call` push sender (see `../../KNOWN_GAPS.md`).
- PSTN provider bridging is external (masked landline only).
- PSTN timer starts at dialer open; VOIP ringback is local and stops as soon as the peer joins.

## Linked docs

- [`index.md`](./index.md) · [`edge-cases.md`](./edge-cases.md) · [`screens.md`](./screens.md)
- [`../../delivery/calling/outgoing.md`](../../delivery/calling/outgoing.md)
- `docs/architecture/mobile-app.md` (Masked calling)
