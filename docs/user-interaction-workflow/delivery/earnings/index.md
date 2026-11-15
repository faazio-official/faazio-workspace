# Delivery earnings — domain index

**Status:** Shipped (server-derived amounts; disbursement is intentionally manual by admin)
**Route:** `Payouts` (`features/delivery-partner/screens/PayoutScreen.tsx`)
**Trigger:** Rider taps the Earnings tab (or View earnings on Home).
**Visual layer:** `Payouts` is the Earnings tab of the persistent bottom-tab navigator (`Main`); it
shows a KPI strip (Pending leads with a larger figure, then Paid out), then the payout rows. First
load shows `DPSkeleton` (no fake `₹0`), a load failure shows `DPErrorState` + retry, and an empty
ledger shows a compact `DPEmptyState`. Headline totals use whole rupees; itemised ledger lines use
two decimals with tabular figures. Rows open the `EarningsDetail` route.

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
- **Error:** first-load failure → `DPErrorState` + retry; a refresh failure → inline error; no
  fabricated earnings and no `₹0` before the first load resolves.
- **Empty:** explicit "No payouts yet" state.

## Known gaps

- Payout amounts are calculated accurately server-side; disbursement is **intentionally manual** —
  a state/super admin records the transfer via `mark-paid` (no Razorpay Route), so bank credit
  timing depends on the payout run.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `Faazio_Fee_and_Payout_Report.pdf`
