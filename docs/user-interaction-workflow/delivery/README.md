# Delivery partner app — interaction workflows

**Product:** Faazio Delivery Partner (separate partner product)
**Entry:** `client/mobile/index.delivery.js` → `src/DeliveryPartnerApp.tsx` →
`src/features/delivery-partner/DeliveryPartnerNavigator.tsx`
**Routes:** `PhoneEntry`, `OtpVerify`, `Register`, `SubmissionSuccess`, `Dashboard`,
`AcceptReject` (modal, opened by push/deep link), `Route`, `Payouts`
**Auth:** Firebase phone OTP (shared with the customer app) + rider application status.
**Data:** `GatewayClient` delivery methods only; no fixtures as live data.

## Flow inventory

| Domain | Flow | Route(s) | Doc |
|---|---|---|---|
| Onboarding | Phone + OTP entry | `PhoneEntry`, `OtpVerify` | [onboarding/index.md](./onboarding/index.md) |
| Onboarding | Rider registration | `Register` | [rider-registration.md](./onboarding/rider-registration.md) |
| Onboarding | Vehicle + documents | `Register` | [vehicle-documents.md](./onboarding/vehicle-documents.md) |
| Availability | Online/offline + heartbeat | `Dashboard` | [availability/index.md](./availability/index.md) · [go-online.md](./availability/go-online.md) |
| Offers | Offer accept/reject | `AcceptReject`, `Dashboard` | [offers/index.md](./offers/index.md) · [delivery-offer.md](./offers/delivery-offer.md) |
| Offers | Route sequencing | `Route` | [route-sequencing.md](./offers/route-sequencing.md) |
| Fulfillment | Pickup | `Route` | [fulfillment/index.md](./fulfillment/index.md) · [order-pickup.md](./fulfillment/order-pickup.md) |
| Fulfillment | Customer handover / OTP / COD | `Route` | [customer-handover.md](./fulfillment/customer-handover.md) |
| Earnings | Payout ledger | `Payouts` | [earnings/index.md](./earnings/index.md) · [earnings-ledger.md](./earnings/earnings-ledger.md) |

## Cross-cutting rules

- `Dashboard` refreshes `GET /delivery/me` + `GET /delivery/active`; a non-ACTIVE rider is sent to
  `SubmissionSuccess`.
- Heartbeats are foreground/background location writes (`POST /delivery/heartbeat`); a missed
  heartbeat is non-fatal (Valkey key expires and dispatch skips the rider).
- No mock offers or payouts; empty states are honest.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Delivery-specific gaps: `AcceptReject` is not navigated
from any screen (push/deep link only); iOS force-quit background limits are documented in
`client/mobile/PENDING_WORK.md`. OTP handover is enabled (COD/UPI checkout orders) and delivered
through the notifications outbox.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
