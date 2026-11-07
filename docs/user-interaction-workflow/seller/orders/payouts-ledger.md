# Seller payouts / ledger / invoices

**App / route:** portal `/seller/payments`; admin `/admin/district/delivery/payouts`,
`/admin/super/payouts`
**Status:** Shipped (manual payout model)
**Trigger:** Seller opens Payments, or admin opens the payout board.

## Steps

1. Seller opens `/seller/payments`; `useLedger` / `usePayouts` load the ledger and payouts.
2. `GET /seller/payments` returns seller-scoped cycles; `GET /seller/payments/{cycleId}` returns one
   cycle.
3. `GET /settlements` / `GET /payouts` expose the ledger and payout rows.
4. Invoice download: `GET /seller/payout-invoices/{payoutId}` (seller-scoped JSON invoice).
5. Admin marks a payout paid with `POST /admin/seller/payouts/{sellerId}/mark-paid`; the amount is
   capped at the outstanding net balance and each mark-paid writes a `payout_invoices` row.
6. Payouts are **manual only** — no Razorpay Route transfer.

## State

- Portal store + local board state.

## Data path

- `payments.settlement_ledger` (gross − commission − TCS − TDS per seller/cycle, per store).
- `payments.payouts` (PENDING/PARTIAL/PAID, unique per seller+cycle).
- `payments.payout_invoices` (invoice number, amounts, `pdf_key`).
- Cache: `faazio:v1:settlement:{sellerId}:{cycle}` 600 s, invalidated on mark-paid.

## Success / error / empty

- **Success:** ledger/payout/invoice render; mark-paid updates the balance.
- **Error:** portal error; no fabricated payout.
- **Empty:** no payouts → honest empty state.

## Known gaps

- Invoice PDF rendering may lag (`payments.payout_invoices.pdf_key` empty); the seller gets the
  JSON invoice. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/monolith-breakdown.md` (payouts row)
- `docs/architecture/db-schema.md` (`payments.*`)
- `Faazio_Fee_and_Payout_Report.pdf`
