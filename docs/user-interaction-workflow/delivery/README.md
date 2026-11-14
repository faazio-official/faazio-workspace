# Delivery partner app — interaction workflows

**Product:** Faazio Delivery Partner (separate partner product)
**Entry:** `client/mobile/index.delivery.js` → `src/DeliveryPartnerApp.tsx` →
`src/features/delivery-partner/DeliveryPartnerNavigator.tsx`
**Routes:** `PhoneEntry`, `OtpVerify`, `Register`, `SubmissionSuccess`, `Main` (persistent bottom-tab
shell), `AcceptReject` (modal, opened by push/deep link or a `Dashboard` offer card), `Route`,
`EarningsDetail`, `Settings`, `Support`; the five tabs inside `Main` are `Dashboard` · `Payouts` ·
`OrderHistory` · `Notifications` · `RiderProfile`.
**Navigation:** the authenticated rider area is a persistent `@react-navigation/bottom-tabs`
navigator (`DeliveryTabs.tsx`) hosted by the single `Main` stack screen; its custom `tabBar`
(`components/DeliveryTabBar.tsx`) renders `components/shared/dp/DPBottomNav` (Feed · Pocket · Orders ·
Inbox · More) plus the reference's raised active-order CTA that links to `Route`.
**Auth:** Firebase phone OTP (shared with the customer app) + rider application status.
**Data:** `GatewayClient` delivery methods only; no fixtures as live data.

## Visual layer (Vite reference)

The rider UI was restyled to the mobile view of `client/web/Delivery app vite Reference.`:
full-bleed cards on `surface`/`card`, hairline `border`, tone-dot headers, KPI strip, status pills,
filter chips, and a persistent bottom tab bar with a raised active-order CTA. Tokens live once in
`client/mobile/src/theme/deliveryTokens.ts` (anchored on `parentRamp` — Faazio Blue `#1627E9`,
replacing the old orphan `#2c56f6`) and primitives in `client/mobile/src/components/shared/dp/`.
Routes, screens, store actions, `GatewayClient` calls, timers, modals and validation rules are
preserved; the bottom nav moved from a per-screen footer to a real tab navigator under `Main`.

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
| More | Bottom nav + profile / settings / support / inbox / history | `Main` (`Dashboard`, `Payouts`, `OrderHistory`, `Notifications`, `RiderProfile`), `Settings`, `Support` | [more/index.md](./more/index.md) |

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
