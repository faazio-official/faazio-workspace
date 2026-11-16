# Earnings ledger (rider payouts)

**App / route:** delivery · `Payouts` (`PayoutScreen.tsx`)
**Status:** Shipped (server-derived amounts; manual admin disbursement by design)
**Trigger:** Dashboard → Earnings.
**Visual layer:** restyled payout cards + KPI strip. The KPI totals come from the server's lifetime
summary, not the rows on the page. Each row shows only the order ref, status pill, total payout and a
single **View breakdown** button; tapping the button opens the in-page `PayoutBreakdownModal` with the
full distance / rate-card / settlement breakdown. Tapping the rest of the row still opens
`EarningsDetail` (`earnings-detail.md`) as the full-page breakdown.

## Steps

1. `PayoutScreen` loads `gateway.getDeliveryPayouts(50)` (`GET /delivery/payouts?limit=`), the
   lifetime totals `gateway.getDeliveryPayoutsSummary()` (`GET /delivery/payouts/summary`), and the
   live card `gateway.getDeliveryPayoutSettings()` (`GET /delivery/rate-card`) in parallel.
2. A completed route is materialised as a PENDING payout row in the completing transaction
   (`UpdateStop` → `ROUTE_COMPLETE`, no failed drop). `GET /delivery/payouts` also lazily backfills
   historical completed jobs that have no row yet, so the ledger does not omit finished work.
3. The KPI strip shows the server lifetime totals (`pendingPaisa` / `paidPaisa`); if the summary call
   fails it falls back to computing `max(0, totalPaisa − paidNow)` over the fetched rows, where
   `paidNow` is `totalPaisa` when status is PAID, otherwise `paidAmountPaisa ?? 0`.
4. The note is built from the live rate card (base rate, base distance, per-km rate); if the card
   fetch fails it falls back to a generic line with no hardcoded numbers.
5. **View breakdown** on a row opens `PayoutBreakdownModal` with that row's `RiderPayout`: distance,
   base (live first-N km), extra km, surge (+reason), total payout, paid so far, balance and paid-on
   date. The modal closes via the X or **Done**; it reuses the list data (no route or extra fetch).
6. Tapping the row outside the button navigates to `EarningsDetail` for the full-page breakdown.
7. Admin settlement: `POST /delivery/payouts/{orderId}/settle` or
   `POST /admin/delivery/payouts/{orderId}/mark-paid` (partial payments accumulate).

## State

- Local `payouts`, `summary`, `rateCard`, `loading`, `error`, and `selectedPayout` (the row shown in
  the breakdown modal; `null` when the modal is closed).

## Data path

- `gateway.getDeliveryPayouts` → `GET /delivery/payouts` → `delivery.delivery_payouts` (with a
  bounded lazy backfill of completed orders that have no payout row).
- `gateway.getDeliveryPayoutsSummary` → `GET /delivery/payouts/summary` → lifetime pending/paid SUMs
  over `delivery.delivery_payouts` (PAID rows count as settled even for legacy rows with no recorded
  `paid_amount_paisa`).
- `gateway.getDeliveryPayoutSettings` → `GET /delivery/rate-card` → `delivery.payout_settings`
  (read-only; admin edits still go through `PUT /delivery/payout-settings`).
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
