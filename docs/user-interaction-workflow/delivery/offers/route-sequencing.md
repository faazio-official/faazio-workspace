# Route sequencing

**App / route:** delivery · `Route` (`features/delivery-partner/screens/RouteScreen.tsx`)
**Status:** Shipped
**Trigger:** Accepted offer, or opening the active route.
**Visual layer:** the route summary carries the signature `DPRouteRail` (the pickup → drop → …N line
with the current-stop dot, with per-stop `done` from the server status), above the map card and the
per-stop `DPSectionCard`s. First load shows a `DPSkeleton`; a load failure shows `DPErrorState` with
retry, and no active stops shows `DPEmptyState`. A drop stop's `customerPhone` is a tappable
`tel:` link. The pickup modal renders in its own `SafeAreaProvider` so its insets are not the app
root's. The server-owned sequencing and stop transitions are unchanged.

## Steps

1. `RouteScreen` loads `getActiveDeliveryOrders()` and `getDeliveryUpipQr()` on focus.
2. It merges accepted orders into one ordered stop list (`mergeRoute`), computes distance and
   payout totals, and draws the polyline.
3. The gateway owns sequencing: `ActiveStopsByRider` / `OptimizeGlobalRoute` /
   `ResequenceActiveStops` / `ResequenceAssignedRoute`; insertion uses `OptimizeStopSequence`.
4. The rider advances stops (pickup/drop) via `updateDeliveryStop`.
5. On the last stop, the route completes and capacity frees; a failed drop shows a route-finished
   alert.

## State

- Local `orders`, `stops`, `otpByStop`, `failureFor`, `qrUrl`, `busy`, `error`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `gateway.getActiveDeliveryOrders` → `GET /delivery/active` → `delivery.delivery_orders`,
  `delivery.delivery_stops`.
- `gateway.getDeliveryUpipQr` → `GET /app-config/delivery-upi-qr`.
- `gateway.updateDeliveryStop` → `PUT /delivery/stop/{stopId}/status`.
- (`gateway.getDeliveryRoute` is used by `AcceptReject`, not by `RouteScreen`.)
- Route cache: `delivery:route:{lat,lng}:{lat,lng}` 300 s (PII/OTP never cached).
- Google Routes matrix; fails closed when `GOOGLE_ROUTES_API_KEY` is unset.

## Success / error / empty

- **Success:** ordered stops, forward-only transitions, route completion.
- **Error:** first-load failure → `DPErrorState` + retry; an action failure → inline error; no
  reordered local fiction.
- **Empty:** no active stops → `DPEmptyState`.

## Known gaps

- Straight-line travel matrix is dev/test only; production fails closed without Routes API.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/caching-cloudflare-valkey.md`
