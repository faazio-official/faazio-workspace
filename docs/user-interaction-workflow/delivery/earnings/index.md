# Delivery earnings — domain index

**Status:** Shipped (manual settlement)
**Route:** `Payouts` (`features/delivery-partner/screens/PayoutScreen.tsx`)
**Trigger:** Rider taps Earnings on the dashboard.

## Flows

| Flow | Doc |
|---|---|
| Earnings ledger | [earnings-ledger.md](./earnings-ledger.md) |

## State

- Local `payouts`, `loading`, `error`.
- `useDeliveryPartnerStore` — rider context.

## Data path

- `GET /delivery/payouts?limit=` → `delivery.delivery_payouts`, `delivery.payout_settings`.
- `GET /delivery/payouts/{orderId}` for a single order payout.
- No synthetic payouts.

## Success / error / empty

- **Success:** pending/paid totals + payout rows.
- **Error:** inline error; no fabricated earnings.
- **Empty:** zero pending/paid honest state.

## Known gaps

- Payout split is manual (no Razorpay Route); bank credit timing depends on the payout run.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `Faazio_Fee_and_Payout_Report.pdf`
