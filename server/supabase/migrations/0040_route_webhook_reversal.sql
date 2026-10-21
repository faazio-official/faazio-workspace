-- Faazio MVP — Razorpay Route reconciliation: webhook-driven payout states + refund/return reversal.
-- Authority: docs/architecture/db-schema.md §12.22, docs/architecture/server-gateway-plan.md,
-- docs/architecture/monolith-breakdown.md §1 (settlement row), docs/RUNBOOKS/RELEASE.md.
--
-- Additive only (never rewrites 0001–0039). Existing payouts keep their status: only new terminal
-- states are introduced. The Route webhook and the SUPER_ADMIN reverse action both write these.
--
-- SECURITY: the webhook is public but only a valid X-Razorpay-Signature (RAZORPAY_ROUTE_WEBHOOK_SECRET)
-- may mutate a payout. No raw payload, bank detail or secret is stored.

alter type payout_status add value if not exists 'FAILED';
alter type payout_status add value if not exists 'REVERSED';

-- reversed_at mirrors released_at so the ledger distinguishes a settled payout from a clawback.
alter table payments.payouts
  add column if not exists reversed_at timestamptz;

-- Webhook events key on the Razorpay transfer id, so make the lookup cheap and unique per transfer.
create unique index if not exists payouts_transfer_uniq
  on payments.payouts (razorpay_transfer_id)
  where razorpay_transfer_id is not null;
