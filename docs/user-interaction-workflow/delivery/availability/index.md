# Delivery availability — domain index

**Status:** Shipped
**Route:** `Dashboard` (`features/delivery-partner/screens/DashboardScreen.tsx`)
**Trigger:** Rider opens the dashboard after activation.

## Flows

| Flow | Doc |
|---|---|
| Go online/offline + heartbeat | [go-online.md](./go-online.md) |

## What the dashboard shows

- Rider identity + status pill (`getDeliveryPartnerMe`).
- Online/offline toggle (`setDeliveryAvailability`).
- Active orders / offers (`getActiveDeliveryOrders`).
- Accept/reject actions (`acceptDeliveryOrder` / `rejectDeliveryOrder`).
- Navigation to `Route` and `Payouts`.

## State

- `useDeliveryPartnerStore` — rider projection.
- `useAuthStore` — session.
- Local `online`, `orders`, `busy`, `error`.

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

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
