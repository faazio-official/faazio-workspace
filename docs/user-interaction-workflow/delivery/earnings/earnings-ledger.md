# Earnings ledger (rider payouts)

**App / route:** delivery · `Payouts` (`PayoutScreen.tsx`)
**Status:** Shipped (server-derived amounts; manual admin disbursement by design)
**Trigger:** Dashboard → Earnings.
**Visual layer:** restyled payout cards + KPI strip; tapping a row opens `EarningsDetail`
(`earnings-detail.md`). The pending/paid computation is unchanged.

## Steps

1. `PayoutScreen` loads `gateway.getDeliveryPayouts(50)` (`GET /delivery/payouts?limit=`).
2. It computes pending = `totalPaisa − paidAmountPaisa` per row, and paid = `paidAmountPaisa` (or
   `totalPaisa` when status is PAID).
3. The note explains the rate card: ₹30 base for the first 3 km + ₹7/km, plus night/weather/festival
   surge; Faazio settles the total manually.
4. Admin settlement: `POST /delivery/payouts/{orderId}/settle` or
   `POST /admin/delivery/payouts/{orderId}/mark-paid` (partial payments accumulate).

## State

- Local `payouts`, `loading`, `error`.

## Data path

- `gateway.getDeliveryPayouts` → `GET /delivery/payouts` → `delivery.delivery_payouts`,
  `delivery.payout_settings`.
- `gateway.getDeliveryPayout(orderId)` → `GET /delivery/payouts/{orderId}` exists for a single
  order (reuses stored checkout distance + surge, writes `payout_basis`) but no screen calls it.
- No Razorpay Route transfer; `payout_amount_paisa` is display-only until marked paid.

## Success / error / empty

- **Success:** pending/paid totals and rows render.
- **Error:** inline error; no fabricated payout.
- **Empty:** zero earnings honest state.

## Known gaps

- Amounts are accurate and server-derived. Disbursement is **intentionally manual** (admin
  `settle`/`mark-paid`); there is no Razorpay Route transfer and `payout_amount_paisa` is
  display-only until marked paid. Bank credit timing is an ops concern.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` (`delivery.delivery_payouts`)
- `Faazio_Fee_and_Payout_Report.pdf`
