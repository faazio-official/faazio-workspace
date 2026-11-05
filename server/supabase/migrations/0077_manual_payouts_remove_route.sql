-- 0077_manual_payouts_remove_route.sql
-- Manual money rails: Razorpay Route (0039/0040) + settlement are removed; payouts become a recorded
-- "Mark Paid" ledger with balance carry-forward. The customer Razorpay UPI rail (0066) is untouched.
--
-- Applies after 0039/0040 (if those were ever applied, their Route columns are dropped here; if not,
-- the drops are no-ops). Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Sellers: no more Razorpay linked accounts.
-- ---------------------------------------------------------------------------
alter table sellers.sellers
  drop column if exists razorpay_linked_account_id,
  drop column if exists platform_fee_pct;

-- ---------------------------------------------------------------------------
-- 2. Seller payouts (payments.payouts): manual marking with balance carry-forward.
--    The Route hold/release/reverse columns are removed; paid_amount_paisa accumulates
--    partial "Mark as Paid" entries so an unpaid balance carries to the next cycle.
-- ---------------------------------------------------------------------------
drop index if exists payouts_hold_idx;
drop index if exists payouts_transfer_uniq;
alter table payments.payouts
  drop column if exists razorpay_transfer_id,
  drop column if exists release_after,
  drop column if exists released_at,
  drop column if exists reversed_at;
alter table payments.payouts
  add column if not exists paid_amount_paisa bigint not null default 0 check (paid_amount_paisa >= 0),
  add column if not exists paid_by text not null default '',
  add column if not exists paid_at timestamptz;
create unique index if not exists payouts_seller_cycle_idx on payments.payouts (seller_id, cycle);

-- ---------------------------------------------------------------------------
-- 3. Delivery payouts (delivery.delivery_payouts): manual paid amount per job.
-- ---------------------------------------------------------------------------
alter table delivery.delivery_payouts
  drop column if exists razorpay_transfer_id;
alter table delivery.delivery_payouts
  add column if not exists paid_amount_paisa bigint not null default 0 check (paid_amount_paisa >= 0);
alter type delivery_payout_status add value if not exists 'PARTIAL';

-- ---------------------------------------------------------------------------
-- 4. Delivery orders: payment collection before DROP delivery.
--    payment_method mirrors the checkout method at creation; payment_required is true for
--    cash/QR-on-delivery (COD) orders; payment_received gates the DELIVERED transition.
-- ---------------------------------------------------------------------------
alter table delivery.delivery_orders
  add column if not exists payment_method text not null default '',
  add column if not exists payment_required boolean not null default false,
  add column if not exists payment_received boolean not null default false,
  add column if not exists payment_received_at timestamptz;
create index if not exists delivery_payment_pending_idx
  on delivery.delivery_orders (payment_required, payment_received)
  where payment_required and not payment_received and status = 'ACCEPTED';

-- ---------------------------------------------------------------------------
-- 5. Checkout orders: order-level UPI gate. Default PAID (confirmed / COD / coins).
--    UPI orders are PENDING_PAYMENT at placement until the Razorpay webhook flips them.
-- ---------------------------------------------------------------------------
alter table checkout.orders
  add column if not exists payment_status text not null default 'PAID'
    check (payment_status in ('PENDING_PAYMENT', 'PAID', 'FAILED'));
create index if not exists orders_payment_status_idx
  on checkout.orders (payment_status) where payment_status <> 'PAID';

-- ---------------------------------------------------------------------------
-- 6. Media: allow a QR owner type for the superadmin-uploaded delivery UPI QR.
-- ---------------------------------------------------------------------------
alter table media.assets drop constraint if exists media_assets_owner_type_chk;
alter table media.assets add constraint media_assets_owner_type_chk check (
  owner_type in ('', 'PRODUCT', 'STORE', 'MENU', 'BRAND', 'BANNER', 'AVATAR', 'PRESCRIPTION', 'KYC', 'QR')
);