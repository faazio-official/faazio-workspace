# Delivery earnings — domain index

**Status:** Shipped (server-derived amounts; disbursement is intentionally manual by admin)
**Route:** `Payouts` (`features/delivery-partner/screens/PayoutScreen.tsx`)
**Trigger:** Rider taps the Pocket tab (or Earnings on the dashboard).
**Visual layer:** `Payouts` is restyled (KPI strip, payout cards) and is the Pocket tab of the
persistent bottom-tab navigator (`Main`); rows open the `EarningsDetail` route.

## Flows

| Flow | Doc |
|---|---|
| Earnings ledger | [earnings-ledger.md](./earnings-ledger.md) |

## State

- Local `payouts`, `loading`, `error`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `GET /delivery/payouts?limit=` → `delivery.delivery_payouts`, `delivery.payout_settings`.
- `GET /delivery/payouts/{orderId}` exists for a single order payout but no screen calls it.
- No synthetic payouts.

## Success / error / empty

- **Success:** pending/paid totals + payout rows.
- **Error:** inline error; no fabricated earnings.
- **Empty:** zero pending/paid honest state.

## Known gaps

- Payout amounts are calculated accurately server-side; disbursement is **intentionally manual** —
  a state/super admin records the transfer via `mark-paid` (no Razorpay Route), so bank credit
  timing depends on the payout run.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `Faazio_Fee_and_Payout_Report.pdf`
