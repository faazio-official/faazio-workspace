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

- The ledger is derived live from delivered `checkout.orders` (`settlementLedgerCTE`); the legacy
  `payments.settlement_ledger` table has had no writer since migration `0077` and is read-only.
- `payments.payouts` status enum is `SCHEDULED` / `PAID` / `ON_HOLD` (unique per seller+cycle). The
  admin board computes PENDING/PARTIAL/PAID for display; those are not stored values.
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
