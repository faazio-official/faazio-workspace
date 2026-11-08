-- Faazio MVP — pay for a quoted prescription by materialising a checkout order.
--
-- Why: prescriptions live only in pharma.prescriptions and the customer payment rail is keyed on
-- checkout.orders.order_id. A quoted Rx therefore had no way to be paid. Rather than duplicate the
-- Razorpay/COD ledger, the customer accepts a quote by materialising a real checkout.orders row
-- whose order_id is the Rx id (RX-*), then the existing payment/invoice/status rail applies.
--
-- rx_id marks an order as a prescription checkout so the generic My Orders history (which reads
-- pharma.prescriptions directly) does not list it twice. Additive and idempotent: safe to apply
-- after the gateway build ships. Apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md;
-- never auto-run on Render.

alter table checkout.orders add column if not exists rx_id text;

-- One materialised order per prescription. The partial unique index makes the checkout endpoint
-- idempotent under concurrent taps: the second insert loses and reads the existing order.
create unique index if not exists checkout_orders_rx_id_key
    on checkout.orders (rx_id)
    where rx_id is not null;