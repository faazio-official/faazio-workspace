# Delivery availability — domain index

**Status:** Shipped
**Route:** `Dashboard` (`features/delivery-partner/screens/DashboardScreen.tsx`)
**Trigger:** Rider opens the dashboard after activation.
**Visual layer:** rider-first Feed. A `DPUtilityBar` shift bar (presence switch, inbox with an unread
badge, profile) is pinned above the scroll; the body is an identity
header, a **This shift** summary (deliveries completed / load / rating, plus server-backed shift
earnings and online today), an always-present
**Offers** section (offer cards with the `DPRouteRail` and a `DPTimer` driven by the server's
`expiresAt` — no countdown is fabricated when the window is absent), and **Your route**
(`DPOrderCard` with the rail), with a first-load `DPSkeleton`, `DPErrorState`+retry and duty-aware
`DPEmptyState` copy. `Dashboard` is the Feed tab
of the persistent bottom-tab navigator (`Main`). Logic, timers, gateway calls and routes are
unchanged. Tokens/type: `docs/UI_DESIGN_SYSTEM.md` §1 (delivery partner direction).

## Flows

| Flow | Doc |
|---|---|
| Go online/offline + heartbeat | [go-online.md](./go-online.md) |

## What the dashboard shows

- Rider identity + status pill (`getDeliveryPartnerMe`).
- Online/offline presence switch in the shift bar (`setDeliveryAvailability`).
- Inbox unread badge, best-effort from the shared notifications outbox (a failure never blocks the
  shift).
- This-shift summary: rider-record fields (deliveries completed, load, rating) plus the
  server-backed **Shift earnings** (₹) and **Online today** (worked time) from
  `getDeliveryShiftSummary` (`GET /delivery/shift-summary`). On a shift-summary failure the two cards
  show an honest `—` with a pull-to-refresh note — never a fabricated ₹ or hours figure.
- Active orders / offers, always rendered with an honest waiting state
  (`getActiveDeliveryOrders`).
- Accept/reject actions (`acceptDeliveryOrder` / `rejectDeliveryOrder`).
- Navigation to `Route`, `Payouts` and `OrderHistory`.

## State

- `useDeliveryPartnerStore` — rider projection.
- `useAuthStore` — session.
- Local `online`, `unread`, `orders`, `booting`, `busy`, `error`.

## Data path

- `GET /delivery/me`, `GET /delivery/active`, `GET /delivery/shift-summary`,
  `PUT /delivery/availability`, `POST /delivery/heartbeat` → `delivery.delivery_boys`,
  `delivery.delivery_orders`, `delivery.rider_heartbeats`, `delivery.rider_shift_days`.
- Live coordinate cache: `delivery:rider:{riderId}:location` 300 s.
- Shift worked-time cache: `delivery:rider:{riderId}:shift:since` (26 h) and
  `delivery:rider:{riderId}:shift:online:{YYYYMMDD}` (48 h). Today's online seconds are read from
  Valkey (never a Postgres write per heartbeat); earnings are durable in
  `delivery.delivery_boys.shift_earnings_paisa` (credited on DROP → DELIVERED) and a completed IST
  day rolls up into `delivery.rider_shift_days`.

## Success / error / empty

- **Success:** rider online/offline; active offers render.
- **Error:** inline error; no fake offers.
- **Empty:** no active orders → honest empty state.

## Known gaps

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md). Shift earnings/online time are now server-backed
  (`GET /delivery/shift-summary`); the two cards degrade to `—` if the gateway is unavailable. A
  dedicated rider order-history endpoint is still absent (history reads the payout ledger).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
