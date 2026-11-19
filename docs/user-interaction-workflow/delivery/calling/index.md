# Delivery calling — domain index

**App / route(s):** customer + delivery · `ActiveCall` in both navigators
(`features/call/`, `features/delivery-partner/calling/`, `features/customer/calling/`)
**Status:** **Partial** — both directions are live server-side (rider-initiated and
customer-initiated), the `incoming_call` push is sent as a data-only high-priority message, and the
Exotel PSTN bridge is wired (config + fail-closed status webhook; the server also places the bridge
on fallback). Partial because the iOS PushKit/CallKit ring is implemented but not yet verified on a
device, no provider credentials are provisioned, and a few edge cases (GSM-busy, proximity
wake-lock, provider-answer timer) remain.
**Authority:** `docs/architecture/mobile-app.md` ("Masked calling"), `monolith-breakdown.md` §1
(delivery row), `db-schema.md` §12.39.

## What exists

- Server-authoritative call session (`delivery.calls`, migration `0104`): the gateway chooses
  `VOIP` (100ms) vs `PSTN_BRIDGING` (masked virtual landline), enforces one open call per rider,
  owns the ringing-ack / fallback window, checks the open-call index before provisioning a room,
  and sweeps stale `RINGING` (45 s) / `ACTIVE` (2 h) rows. Both directions are server-supported:
  rider `POST /delivery/{orderId}/call` and customer `POST /orders/{orderId}/delivery-call`, sharing
  one `startCall` path so mode choice, room provisioning and push enqueue cannot drift.
- Incoming-call push: a data-only, Android `priority=high` / `ttl=45s` FCM message
  (`type=incoming_call`). Data-only is required — FCM only runs the app's Android background handler
  for a data-only message, so a `notification` block would put the ring in the tray and a
  killed/swiped app would never ring. For the iOS customer the same push goes straight to APNs as
  `apns-push-type: voip` (only a PushKit token can make CallKit ring; FCM cannot carry it) when
  `APNS_*` is configured; otherwise the drain prefers the FCM token.
- `GatewayClient`: rider `initiateDeliveryCall`, `getDeliveryCall`, `getActiveDeliveryCall`,
  `ackDeliveryCallRinging`, `joinDeliveryCall`, `rejectDeliveryCall`, `endDeliveryCall`,
  `fallbackDeliveryCall`; customer `initiateCustomerDeliveryCall`,
  `getActiveCustomerDeliveryCall`, `getCustomerDeliveryCall`, `ackCustomerDeliveryCallRinging`,
  `joinCustomerDeliveryCall`, `rejectCustomerDeliveryCall`, `endCustomerDeliveryCall`,
  `fallbackCustomerDeliveryCall`. The shared controller reaches them through an injected `CallApi`
  surface, so each product only sees its own authorised endpoints.
- Shared call stack in `src/features/call/`:
  - `controller.ts` — one state machine factory used by both apps: 3 s double-tap lock with a
    matching disabled button state, session-epoch guards so a dismissed/ended session cannot be
    resurrected by a late response, double-accept and decline-vs-accept guards, UUID-scoped native
    events, status polling with cross-call guards, mic/mic-denial fallback (verified before join),
    retrying lifecycle teardown, once-per-session startup recovery, AppState resync, audio-route
    tracking, notice vs fatal error, and `CALLING_ENABLED` enforcement.
  - `voip.ts` — 100ms join/leave, earpiece/Bluetooth routing, `ON_AUDIO_DEVICE_CHANGED`, mute,
    reconnect events, 15 s join timeout.
  - `ringtone.ts` — looped ringback while an outgoing VOIP call rings, and the in-app ringtone when
    the full-screen-intent notification could not be shown.
  - `callkeep.ts` — native-ring facade: on Android it posts/dismisses the full-screen-intent
    notification (no `ConnectionService`, no phone account); on iOS it reports the PushKit/CallKit
    state (`displayed`/`answered`/`ended`) and forwards `answerCall`/`endCall`.
  - `fullScreenIntent.ts` — the Android bridge to the `FaazioIncomingCall` native module
    (`IncomingCallModule.kt`): post/dismiss the ring notification, hold the call-audio foreground
    service, and take/subscribe the Answer/Decline action.
  - `incoming.ts` — shared FCM data-only background handler.
  - `CallSurface.tsx` — shared full-screen call UI; each app injects its theme tokens.
- `callStore` (`src/state/callStore.ts`) — phase, server call projection, masked peer label,
  connected timestamp, mute/speaker/audio route/Bluetooth, incoming, reconnecting, fallback
  prompt, recoverable notice, error. `markActive()` never resets a running timer.
- Delivery binding: `features/delivery-partner/calling/callController.ts` + `CallCustomerButton`
  on Dashboard/Route + `ActiveCallScreen` (eventual `DELIVERY` tokens).
- Customer binding: `features/customer/calling/callController.ts` + `CallDeliveryPartnerButton`
  on `OrderDetails` + `ActiveCallScreen` (light/dark palette).
- Android native ringing: a high-importance **full-screen-intent notification** (the
  `FaazioIncomingCall` native module + `IncomingCallReceiver`/`CallAudioService`) in the **customer and
  delivery** flavor manifests — `USE_FULL_SCREEN_INTENT`, `FOREGROUND_SERVICE_MICROPHONE`,
  `RECORD_AUDIO`, `BLUETOOTH_CONNECT` (+ legacy Bluetooth). No telecom `ConnectionService` and no phone
  account, so no "Phone account required" dialog after login; `react-native-callkeep`'s phone-account
  permissions are stripped with `tools:node="remove"`. `index.js`/`index.delivery.js` register the
  shared `incoming_call` FCM handler before mount. iOS background modes (`voip`, `audio`) and
  local-network copy are declared, but the CallKeep/100ms pods remain excluded from iOS autolinking.
- Prompt-free bootstrap: `DeliveryPartnerApp.tsx` calls `bootstrapCalling()` when the rider is
  authenticated; the native ring surface is initialized lazily on the first **Call** tap
  (`initializeDeliveryCalling()` in `CallCustomerButton`).

## Flows

| Flow | Doc |
|---|---|
| Rider calls the customer | [outgoing.md](./outgoing.md) |
| Incoming call to the rider | [incoming.md](./incoming.md) |
| Failure/edge handling | [edge-cases.md](./edge-cases.md) |
| Screens, state and copy | [screens.md](./screens.md) |
| Customer calls the rider | [`../../customer/calling/`](../../customer/calling/index.md) |

## Data path

Rider-initiated (rider token, `auth.Require` rider group):

- `gateway.initiateDeliveryCall(orderId)` → `POST /delivery/{orderId}/call` →
  `delivery.calls` (mode chosen server-side) + 100ms room/token **or** the virtual number, then an
  `incoming_call` push to the customer.
- `gateway.getDeliveryCall(callId)` → `GET /calls/{callId}` → `delivery.calls`.
- `gateway.getActiveDeliveryCall()` → `GET /delivery/calls/active` → open row or `204` (resume).
- `gateway.ackDeliveryCallRinging` → `POST /calls/{callId}/ringing-ack`.
- `gateway.joinDeliveryCall` → `POST /calls/{callId}/join` → freshly minted 100ms token.
- `gateway.rejectDeliveryCall` / `endDeliveryCall` / `fallbackDeliveryCall` → state transition.

Customer-initiated (shopper token; exists outside the rider group because the caller is not a rider):

- `gateway.initiateCustomerDeliveryCall(orderId)` → `POST /orders/{orderId}/delivery-call`. The
  gateway resolves the checkout order id to the `delivery_orders` job via `customer_order_id` and
  requires `customer_id` ownership, so a shopper cannot call on someone else's order. It writes
  `initiated_by='CUSTOMER'` and pushes `incoming_call` to the rider.
- `gateway.getActiveCustomerDeliveryCall(orderId)` → `GET /orders/{orderId}/delivery-call`
  (order-scoped, `204` when none) — a shopper has no rider identity for `GET /delivery/calls/active`.
- `gateway.getCustomerDeliveryCall` / `ackCustomerDeliveryCallRinging` / `joinCustomerDeliveryCall` /
  `rejectCustomerDeliveryCall` / `endCustomerDeliveryCall` / `fallbackCustomerDeliveryCall` →
  `GET|POST /delivery-calls/{callId}[/…]`. These authorise by call ownership, so neither peer can
  drive someone else's session.

Both directions share one `startCall` path, so mode choice, the one-open-call-per-rider index, room
provisioning and push enqueue cannot drift between the two. The push is enqueued through the
`notifier` outbox and then **nudged** (`contracts.PushNudger`) so the drain worker delivers it
immediately: the default tick is 30 s but a ring TTL is 45 s, so waiting for the tick could deliver
the ring after it had already expired.

PSTN reconciliation: `POST /delivery/calls/pstn-webhook` is mounted — and a bridge is only placed —
when `CanReconcilePSTN()` holds (provider credentials, `PSTN_WEBHOOK_URL` and `PSTN_WEBHOOK_TOKEN`);
the token check fails closed. It maps the provider's answered/terminal events onto the row, looking
the call up by `CustomField` and falling back to `CallByProviderRef`.

- No fixture or fake latency is used anywhere in the flow.

## Configuration

Server (env-only, never committed): `HMS_APP_ACCESS_KEY`, `HMS_APP_SECRET`,
`HMS_TEMPLATE_ID` (per-call rooms; optional `HMS_MANAGEMENT_TOKEN` override) or `HMS_ROOM_ID` (dev),
`HMS_ROLE`, `HMS_ENDPOINT` (optional 100ms API origin), `HMS_RINGING_ACK_SECONDS`,
`DELIVERY_CALL_VIRTUAL_NUMBER`.

PSTN bridge (optional — without it the masked landline stays a dial-only handoff):
`PSTN_PROVIDER=exotel`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`,
`EXOTEL_SUBDOMAIN`, `PSTN_WEBHOOK_URL`, `PSTN_WEBHOOK_TOKEN`, `PSTN_TIME_LIMIT_SECONDS` (default
900), `PSTN_TIMEOUT_SECONDS` (default 30). A bridge is only placed (and the route mounted) when the
credentials, `PSTN_WEBHOOK_URL` and `PSTN_WEBHOOK_TOKEN` are all set — otherwise the call stays the
dial-only handoff.

iOS ring (optional — without it an iPhone has no CallKit ring): `APNS_KEY_ID`, `APNS_TEAM_ID`,
`APNS_PRIVATE_KEY_PEM` (the `.p8` key, base64 or PEM), `APNS_TOPIC` (defaults to
`com.faazio.customer`, the only iOS product) and `APNS_ENVIRONMENT` (`production`/`sandbox`, must
match the provisioning profile). All are declared in `render.yaml` (secrets `sync:false`).

Client: `CALLING_ENABLED` (default true) only — provider secrets never enter the app bundle.

## Known gaps

See [edge-cases.md](./edge-cases.md) and `../KNOWN_GAPS.md`. In short: the iOS PushKit/CallKit ring is
implemented (`VoipCallManager.swift`, APNs `voip`, second `voip` push token) but unverified until a
macOS `pod install` + device build; no provider credentials are provisioned, so the PSTN bridge is
wired but dormant; no GSM-busy pre-check, proximity wake-lock, queued-call banner or provider-answer
timer.
