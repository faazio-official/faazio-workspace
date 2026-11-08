# Delivery offers — domain index

**Status:** Complete
**Routes:** `AcceptReject` (modal, push/deep link or a Dashboard offer card), `Route`
(`RouteScreen.tsx`), `Dashboard`
**Trigger:** Push/deep link for a new offer, the **View full offer →** link on a `Dashboard` offer
card, or the dashboard's active list.

## Flows

| Flow | Doc |
|---|---|
| Offer accept/reject (45 s window) | [delivery-offer.md](./delivery-offer.md) |
| Route sequencing | [route-sequencing.md](./route-sequencing.md) |

## State

- `useDeliveryPartnerStore` — rider projection.
- Local offer/route state.

## Data path

- `GET /delivery/active`, `GET /delivery/route/{deliveryId}`,
  `POST /delivery/{orderId}/accept|reject` → `delivery.delivery_orders`,
  `delivery.delivery_stops`.
- Dispatch uses Google Routes (fails closed when unconfigured) and bounded reassignment.

## Success / error / empty

- **Success:** accepted offer enters the route; rejected offer is reassigned.
- **Error/expired:** offer unavailable message; returns to dashboard.
- **Empty:** no offers → dashboard empty state.

## Known gaps

- None for offer accept/reject: `AcceptReject` is opened by `services/deliveryLinks.ts`
  (push/deep link) and by the **View full offer →** link on a `Dashboard` offer card.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
