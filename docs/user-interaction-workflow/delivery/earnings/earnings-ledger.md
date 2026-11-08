# Earnings ledger (rider payouts)

**App / route:** delivery · `Payouts` (`PayoutScreen.tsx`)
**Status:** Shipped
**Trigger:** Dashboard → Earnings.

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

- Manual settlement means bank credit timing is an ops concern, not a real-time app state.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/architecture/db-schema.md` (`delivery.delivery_payouts`)
- `Faazio_Fee_and_Payout_Report.pdf`
