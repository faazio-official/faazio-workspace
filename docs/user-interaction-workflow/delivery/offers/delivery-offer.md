# Delivery offer (accept / reject)

**App / route:** delivery · `AcceptReject` (`features/delivery-partner/screens/AcceptRejectScreen.tsx`)
**Status:** Complete
**Trigger:** Push notification or deep link with `orderId` + optional `expiresAt`
(`services/deliveryLinks.ts`), or the **View full offer →** link on a `Dashboard` offer card
(`DashboardScreen.tsx`, `navigate('AcceptReject', { orderId, expiresAt })`).

## Steps

1. `AcceptReject` loads `getDeliveryRoute(orderId)` and `getActiveDeliveryOrders()`.
2. If the order is already `ACCEPTED`, it replaces to `Route`; if not `ASSIGNED`, it shows
   "offer no longer available".
3. The deadline is server `expiresAt`, else the link timestamp, else a local 45 s window.
4. Countdown runs; at zero it calls `rejectDeliveryOrder(orderId)` and returns to `Dashboard`.
5. **Accept:** `acceptDeliveryOrder(orderId)` (`POST /delivery/{orderId}/accept`) → `Route`.
6. **Reject:** `rejectDeliveryOrder(orderId)` (`POST /delivery/{orderId}/reject`) → Dashboard; the
   server reassigns.

## State

- Local `order`, `deadline`, `seconds`, `busy`, `error`, `settled`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `gateway.getDeliveryRoute(orderId)` → `GET /delivery/route/{deliveryId}` →
  `delivery.delivery_orders`, `delivery.delivery_stops`.
- `gateway.acceptDeliveryOrder` → `POST /delivery/{orderId}/accept`.
- `gateway.rejectDeliveryOrder` → `POST /delivery/{orderId}/reject` → bounded reassignment.
- No mock offers.

## Success / error / empty

- **Success:** accepted → Route; rejected/expired → Dashboard.
- **Error:** "offer no longer available" / inline error; no fake acceptance.
- **Empty:** no offer payload → not reachable.

## Known gaps

- None. The screen is reachable from `Dashboard` offer cards (in addition to push/deep link), so a
  rider who misses or denies the push can still open the full offer in-app.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/RUNBOOKS/FIREBASE_AUTH.md` (push)
