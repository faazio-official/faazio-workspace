# Delivery partner app — interaction workflows

**Product:** Faazio Delivery Partner (separate partner product)
**Entry:** `client/mobile/index.delivery.js` → `src/DeliveryPartnerApp.tsx` →
`src/features/delivery-partner/DeliveryPartnerNavigator.tsx`
**Routes:** `PhoneEntry`, `OtpVerify`, `Register`, `SubmissionSuccess`, `Main` (persistent bottom-tab
shell), `AcceptReject` (modal, opened by push/deep link or a `Dashboard` offer card), `Route`,
`ActiveCall` (full-screen masked call), `EarningsDetail`, `EditProfile`, `Settings`, `Support`; the
five tabs inside `Main` are `Dashboard` · `Payouts` · `OrderHistory` · `Notifications` · `RiderProfile`.
**Navigation:** the authenticated rider area is a persistent `@react-navigation/bottom-tabs`
navigator (`DeliveryTabs.tsx`) hosted by the single `Main` stack screen; its custom `tabBar`
(`components/DeliveryTabBar.tsx`) renders `components/shared/dp/DPBottomNav` (Home · Earnings · Orders ·
Alerts · Profile) plus the reference's raised active-order CTA that links to `Route`.
**Auth:** Firebase phone OTP (shared with the customer app) + rider application status.
**Data:** `GatewayClient` delivery methods only; no fixtures as live data.

## Visual layer (Vite reference + rider-first upgrade)

The rider UI was first restyled to the mobile view of `client/web/Delivery app vite Reference.`
(full-bleed cards on `surface`/`card`, hairline `border`, status pills, a persistent bottom tab bar
with a raised active-order CTA), then upgraded to a rider-first system in W93:

- **Direction:** `docs/UI_DESIGN_SYSTEM.md` §1 (Delivery partner app) — cool-graphite neutrals, one
  accent (Faazio Blue `#1627E9`), green only for online/delivered/cash-in-hand.
- **Signature:** the `DPRouteRail` (pickup → drop → …N line with an icon per stop) on the
  offer card, active-route card and Route screen.
- **All authenticated pages:** a pinned `DPUtilityBar` shift bar (`DeliveryHeader`) — Faazio logo,
  alerts with unread badge, presence switch — so availability and alerts are reachable everywhere.
  Onboarding/auth pages (`PhoneEntry`, `OtpVerify`, `Register`, `SubmissionSuccess`) have no bar.
- **Home:** the pinned shift bar plus a **This shift** summary, an always-present **Offers**
  section with honest waiting copy, and **Your route** as `DPOrderCard`s.
- **Reference used as vocabulary, not a blueprint:** no Active/History split on the Home tab and no
  Gigs/Bazaar/Offers-matrix tabs — the Orders/Earnings/Alerts tabs own those and Gigs/Bazaar have no
  gateway. No invented data.
- **Tokens/primitives:** `client/mobile/src/theme/deliveryTokens.ts` (anchored on `parentRamp`;
  text roles via `DP_TYPE`, including `micro` and the OTP `code` role — **no `kicker`/eyebrow role**)
  and `client/mobile/src/components/shared/dp/` (`DPRouteRail`, `DPUtilityBar`, `DPOrderCard`,
  `DPTabStrip`, `DPFadeIn`, `DPKpiCard`, `DPStat`/`DPStatStrip`, `DPSectionHeader`, `DPBackLink`,
  `DPButton`, ...). Headers are title-only: `DPPageHeader`/`DPSectionCard` carry **no kicker/eyebrow
  label above a title**. Delivery screens carry **no raw hex and no local font sizes** — colours
  resolve through `DELIVERY`/`DP_TONE`, text through `DP_TYPE`; shared order helpers live in
  `features/delivery-partner/order.ts` and money formatting in `features/delivery-partner/format.ts`.

Routes, screens, store actions, `GatewayClient` calls, timers, modals and validation rules are
preserved; the bottom nav moved from a per-screen footer to a real tab navigator under `Main`.

## Flow inventory

| Domain | Flow | Route(s) | Doc |
|---|---|---|---|
| Onboarding | Phone + OTP entry | `PhoneEntry`, `OtpVerify` | [onboarding/index.md](./onboarding/index.md) |
| Onboarding | Rider registration | `Register` | [rider-registration.md](./onboarding/rider-registration.md) |
| Onboarding | Vehicle + documents | `Register` | [vehicle-documents.md](./onboarding/vehicle-documents.md) |
| Onboarding | Application status | `SubmissionSuccess` | [submission-success.md](./onboarding/submission-success.md) |
| Availability | Online/offline + heartbeat | `Dashboard` | [availability/index.md](./availability/index.md) · [go-online.md](./availability/go-online.md) |
| Offers | Offer accept/reject | `AcceptReject`, `Dashboard` | [offers/index.md](./offers/index.md) · [delivery-offer.md](./offers/delivery-offer.md) |
| Offers | Route sequencing | `Route` | [route-sequencing.md](./offers/route-sequencing.md) |
| Fulfillment | Pickup | `Route` | [fulfillment/index.md](./fulfillment/index.md) · [order-pickup.md](./fulfillment/order-pickup.md) |
| Fulfillment | Customer handover / OTP / COD | `Route` | [customer-handover.md](./fulfillment/customer-handover.md) |
| Calling | Outgoing masked call (rider → customer) | `Route`, `Dashboard` → `ActiveCall` | [calling/index.md](./calling/index.md) · [calling/outgoing.md](./calling/outgoing.md) |
| Calling | Incoming masked call (customer → rider) — **Partial**: server push + Android ring implemented; iOS CallKit and PSTN provisioning pending | `ActiveCall` (push + CallKeep) | [calling/incoming.md](./calling/incoming.md) · [calling/edge-cases.md](./calling/edge-cases.md) · [calling/screens.md](./calling/screens.md) |
| Earnings | Payout ledger | `Payouts` | [earnings/index.md](./earnings/index.md) · [earnings-ledger.md](./earnings/earnings-ledger.md) |
| Earnings | Single-order breakdown | `EarningsDetail` | [earnings/earnings-detail.md](./earnings/earnings-detail.md) |
| Profile | Bottom nav + profile / settings / support / alerts / history | `Main` (`Dashboard`, `Payouts`, `OrderHistory`, `Notifications`, `RiderProfile`), `EditProfile`, `Settings`, `Support` | [more/index.md](./more/index.md) |

## Cross-cutting rules

- `Dashboard` resolves `GET /delivery/me` first; a non-ACTIVE rider is sent to `SubmissionSuccess`
  before `GET /delivery/active` is called (that endpoint rejects a non-ACTIVE rider with `409`).
- Heartbeats are foreground/background location writes (`POST /delivery/heartbeat`); a missed
  heartbeat is non-fatal (Valkey key expires and dispatch skips the rider).
- Calls are masked and server-authoritative: the gateway chooses VOIP vs PSTN_BRIDGING, enforces one
  open call per rider, and the app never receives or dials the customer's raw phone number. The call
  state machine, VOIP adapter, CallKeep ring and full-screen surface are shared with the customer app
  under `src/features/call/`; the delivery binding only supplies navigation and copy.
- No mock offers or payouts; empty states are honest.

## Known gaps

See [`../KNOWN_GAPS.md`](../KNOWN_GAPS.md). Delivery-specific gaps: Android background-location
best-effort limits (OEM battery optimisation; the app is Android/Play only) are documented in
`client/mobile/PENDING_WORK.md`. OTP handover is enabled (COD/UPI checkout orders)
and delivered through the notifications outbox. Delivery calling is **Partial**: both directions are
live server-side (rider `POST /delivery/{orderId}/call`, customer
`POST /orders/{orderId}/delivery-call`), the `incoming_call` push is data-only and high priority, and
the Exotel PSTN bridge plus fail-closed status webhook are wired; the iOS PushKit/CallKit ring is
implemented but device-unverified, and no provider credentials are provisioned
([calling/index.md](./calling/index.md)).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
