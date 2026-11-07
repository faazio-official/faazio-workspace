# Order pickup

**App / route:** delivery · `Route` (`RouteScreen.tsx`)
**Status:** Shipped
**Trigger:** Rider arrives at the pickup stop.

## Steps

1. The route lists PICKUP stops first in sequence.
2. Rider taps the pickup action → `gateway.updateDeliveryStop(stopId, status, reason?)`
   (`PUT /delivery/stop/{stopId}/status`).
3. The server validates the forward-only transition and returns the updated order.
4. `refresh()` re-reads active orders; if the pickup fails, the order is `CANCELLED` and capacity
   frees with an alert.

## State

- Local `stops`, `busy`, `error`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `gateway.updateDeliveryStop` → `PUT /delivery/stop/{stopId}/status` →
  `delivery.delivery_stops`.
- Order state: `delivery.delivery_orders`.
- No synthetic pickup state.

## Success / error / empty

- **Success:** pickup recorded; route advances to drop.
- **Error:** inline error; the stop does not advance locally.
- **Empty:** no pickup stop → not reachable.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
