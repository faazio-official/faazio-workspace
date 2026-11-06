-- 0080_delivery_payment_status.sql
-- Dance-level payment state for the rider app.
--
-- 0077 modelled a payment_status mirror on delivery.delivery_orders (the gateway's
-- delivery.CreateOrder already computes it and the rider JSON emits it), but only
-- checkout.orders ever received the column. The delivery read
-- (`select ... coalesce(payment_status,'') ... from delivery.delivery_orders`) therefore
-- failed with `column "payment_status" does not exist` on every delivery order read.
--
-- This column mirrors checkout.payments.status (whose vocabulary is free text:
-- PENDING / PAID / FAILED / REFUNDED), so it stays permissive text like the ledger —
-- NOT the git-checked order gate vocabulary (PENDING_PAYMENT/PAID/FAILED) that
-- checkout.orders.payment_status uses. Default 'PAID' matches the ledger default.
--
-- Idempotent — safe to re-run.

alter table delivery.delivery_orders
  add column if not exists payment_status text not null default 'PAID';

comment on column delivery.delivery_orders.payment_status is
  'Mirror of checkout.payments.status copied at dispatch time (0077). PENDING for a Razorpay
   order awaiting capture, PAID on confirmed/COD/coins, FAILED/REFUNDED per the ledger. The
   authoritative money state lives on checkout.payments; this is a rider-facing snapshot.';