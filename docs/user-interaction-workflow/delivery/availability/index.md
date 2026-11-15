# Delivery availability — domain index

**Status:** Shipped
**Route:** `Dashboard` (`features/delivery-partner/screens/DashboardScreen.tsx`)
**Trigger:** Rider opens the dashboard after activation.
**Visual layer:** rider-first Feed. A `DPUtilityBar` shift bar (presence switch, emergency-contact
call, inbox with an unread badge, profile) is pinned above the scroll; the body is an identity
header, a **This shift** summary (deliveries completed / load / rating), an always-present
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
- Online/offline presence switch in the shift bar (`setDeliveryAvailability`); the
  emergency-contact call (`tel:`) sits beside it when the rider has one on file.
- Inbox unread badge, best-effort from the shared notifications outbox (a failure never blocks the
  shift).
- This-shift summary from the rider record (deliveries completed, load, rating).
- Active orders / offers, always rendered with an honest waiting state
  (`getActiveDeliveryOrders`).
- Accept/reject actions (`acceptDeliveryOrder` / `rejectDeliveryOrder`).
- Navigation to `Route`, `Payouts` and `OrderHistory`.

## State

- `useDeliveryPartnerStore` — rider projection.
- `useAuthStore` — session.
- Local `online`, `unread`, `orders`, `booting`, `busy`, `error`.

## Data path

- `GET /delivery/me`, `GET /delivery/active`, `PUT /delivery/availability`,
  `POST /delivery/heartbeat` → `delivery.delivery_boys`, `delivery.delivery_orders`,
  `delivery.rider_heartbeats`.
- Live coordinate cache: `delivery:rider:{riderId}:location` 300 s.

## Success / error / empty

- **Success:** rider online/offline; active offers render.
- **Error:** inline error; no fake offers.
- **Empty:** no active orders → honest empty state.

## Known gaps

- No per-shift earnings or online-hours source exists yet, so **This shift** shows only fields the
  rider record actually carries (deliveries completed, load, rating). It does not invent a cash
  figure or an hours count.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
