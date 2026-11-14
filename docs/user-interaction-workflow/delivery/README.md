# Delivery partner app — interaction workflows

**Product:** Faazio Delivery Partner (separate partner product)
**Entry:** `client/mobile/index.delivery.js` → `src/DeliveryPartnerApp.tsx` →
`src/features/delivery-partner/DeliveryPartnerNavigator.tsx`
**Routes:** `PhoneEntry`, `OtpVerify`, `Register`, `SubmissionSuccess`, `Dashboard`,
`AcceptReject` (modal, opened by push/deep link or a `Dashboard` offer card), `Route`, `Payouts`,
plus the additive bottom-nav tabs `OrderHistory` · `Notifications` · `RiderProfile` and the detail
routes `EarningsDetail` · `Settings` · `Support`.
**Navigation:** a 5-tab bottom bar (Feed · Pocket · Orders · Inbox · More) is rendered by the tab
screens via `components/DeliveryTabBar.tsx`; the stack itself is unchanged (no tab navigator).
**Auth:** Firebase phone OTP (shared with the customer app) + rider application status.
**Data:** `GatewayClient` delivery methods only; no fixtures as live data.

## Visual layer (Vite reference)

The rider UI was restyled to the mobile view of `client/web/Delivery app vite Reference.`:
full-bleed cards on `surface`/`card`, hairline `border`, tone-dot headers, KPI strip, status pills,
filter chips, and a fixed bottom tab bar. Tokens live once in
`client/mobile/src/theme/deliveryTokens.ts` (anchored on `parentRamp` — Faazio Blue `#1627E9`,
replacing the old orphan `#2c56f6`) and primitives in `client/mobile/src/components/shared/dp/`.
This is a visual-only change: every route, screen signature, store action, `GatewayClient` call,
timer, modal and validation rule is preserved.

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
| Earnings | Single-order breakdown | `EarningsDetail` | [earnings/earnings-detail.md](./earnings/earnings-detail.md) |
| More | Bottom nav + profile / settings / support / inbox / history | `OrderHistory`, `Notifications`, `RiderProfile`, `Settings`, `Support` | [more/index.md](./more/index.md) |

## Cross-cutting rules

- `Dashboard` refreshes `GET /delivery/me` + `GET /delivery/active`; a non-ACTIVE rider is sent to
  `SubmissionSuccess`.
- Heartbeats are foreground/background location writes (`POST /delivery/heartbeat`); a missed
  heartbeat is non-fatal (Valkey key expires and dispatch skips the rider).
- No mock offers or payouts; empty states are honest.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Delivery-specific gaps: Android background-location
best-effort limits (OEM battery optimisation; the app is Android/Play only) are documented in
`client/mobile/PENDING_WORK.md`. OTP handover is enabled (COD/UPI checkout orders)
and delivered through the notifications outbox.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
