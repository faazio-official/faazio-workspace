# Earnings detail (single order)

**App / route:** delivery · `EarningsDetail` (`screens/EarningsDetailScreen.tsx`)
**Status:** Shipped
**Trigger:** Tapping a job row on `Payouts` or an order on `OrderHistory`.

## Steps

1. The route receives `{ orderId }` (`navigate('EarningsDetail', { orderId })`).
2. It calls `gateway.getDeliveryPayout(orderId)` (`GET /delivery/payouts/{orderId}`).
3. It shows the payout breakdown: distance, base (first 3 km), extra km, surge (with reason), total,
   paid-so-far, balance and paid date. The headline total is whole rupees; itemised lines carry
   paise, all with tabular figures.

## State

- Local `payout`, `loading`, `error`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `gateway.getDeliveryPayout(orderId)` → `GET /delivery/payouts/{orderId}` →
  `delivery.delivery_payouts` (reuses stored checkout distance + surge; writes `payout_basis`).
- No synthetic payout.

## Success / error / empty

- **Success:** breakdown renders from the server-derived payout.
- **Error:** `DPErrorState` with retry; no fabricated amount.
- **Empty:** not reachable without an `orderId`.
- The back affordance is a context-neutral **Back** (chevron icon + label) because the screen is
  pushed from both `Payouts` and `OrderHistory`.

## Known gaps

- Disbursement is intentionally manual (admin settle / mark-paid); bank credit timing is an ops
  concern. See [`../earnings/index.md`](./index.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` (`delivery.delivery_payouts`)
