-- Faazio — Razorpay customer payments (UPI): link a checkout.payments row to the Razorpay order
-- + payment ids so the server webhook can reconcile PAID/FAILED.
-- Authority: docs/architecture/db-schema.md §12 (checkout.payments), docs/architecture/mvp-backend.md §3.
-- Why: the UPI intent `tr` param carries the Razorpay order id; the customer webhook
-- (POST /webhooks/razorpay/payments, X-Razorpay-Signature HMAC) flips the ledger row and the client
-- polls GET /orders/{id}/payment-status. Columns are nullable: only UPI rows populate them.

alter table checkout.payments add column if not exists razorpay_order_id   text;
alter table checkout.payments add column if not exists razorpay_payment_id text;

-- One checkout order → at most one live Razorpay order; the webhook resolves the row by this id.
create unique index if not exists payments_razorpay_order_idx
  on checkout.payments (razorpay_order_id) where razorpay_order_id is not null;

-- Payment-status polling selects the latest row for an order.
create index if not exists payments_order_created_idx
  on checkout.payments (order_id, created_at desc);
