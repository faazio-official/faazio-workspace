# Earnings ledger (rider payouts)

**App / route:** delivery · `Payouts` (`PayoutScreen.tsx`)
**Status:** Shipped (server-derived amounts; manual admin disbursement by design)
**Trigger:** Dashboard → Earnings.
**Visual layer:** restyled payout cards + KPI strip. Each row shows only the order ref, status pill,
total payout and a single **View breakdown** button; tapping the button opens the in-page
`PayoutBreakdownModal` with the full distance / rate-card / settlement breakdown. Tapping the rest of
the row still opens `EarningsDetail` (`earnings-detail.md`) as the full-page breakdown. The
pending/paid computation is unchanged.

## Steps

1. `PayoutScreen` loads `gateway.getDeliveryPayouts(50)` (`GET /delivery/payouts?limit=`).
2. It computes pending = `max(0, totalPaisa − paidNow)` per row, and paid = `paidNow`, where
   `paidNow` is `totalPaisa` when status is PAID, otherwise `paidAmountPaisa ?? 0`.
3. The note explains the rate card: ₹30 base for the first 3 km + ₹7/km, plus night/weather/festival
   surge; Faazio settles the total manually.
4. **View breakdown** on a row opens `PayoutBreakdownModal` with that row's `RiderPayout`: distance,
   base (first 3 km), extra km, surge (+reason), total payout, paid so far, balance and paid-on date.
   The modal closes via the X or **Done**; no new route or fetch is added (it reuses the list data).
5. Tapping the row outside the button navigates to `EarningsDetail` for the full-page breakdown.
6. Admin settlement: `POST /delivery/payouts/{orderId}/settle` or
   `POST /admin/delivery/payouts/{orderId}/mark-paid` (partial payments accumulate).

## State

- Local `payouts`, `loading`, `error`, and `selectedPayout` (the row shown in the breakdown modal;
  `null` when the modal is closed).

## Data path

- `gateway.getDeliveryPayouts` → `GET /delivery/payouts` → `delivery.delivery_payouts`,
  `delivery.payout_settings`.
- `gateway.getDeliveryPayout(orderId)` → `GET /delivery/payouts/{orderId}` is called by
  `EarningsDetailScreen` for the full-page breakdown (reuses stored checkout distance + surge,
  writes `payout_basis`). The in-page `PayoutBreakdownModal` does **not** call it — it renders the
  list row directly.
- No Razorpay Route transfer; `payout_amount_paisa` is display-only until marked paid.

## Success / error / empty

- **Success:** pending/paid totals and clean rows render; **View breakdown** opens the in-page modal
  with the full itemised breakdown, and the row still opens `EarningsDetail`.
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
