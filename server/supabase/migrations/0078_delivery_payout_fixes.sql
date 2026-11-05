-- 0078_delivery_payout_fixes.sql
-- Per-store payout attribution + separate payout invoice (B2B settlement document).
--
-- 1. Denormalize store_id onto checkout.order_items so the payout board can charge each
--    store's own platform_fee_pct on that store's own lines (replaces the loose
--    vendor_store_ids[1] single-store heuristic). Backfilled online: order_items rows that
--    pre-date this column lean on the product's home store (catalog.products.store_id).
--
-- 2. payments.payout_invoices records a separate Payout Invoice per manual "Mark as Paid"
--    event. It is distinct from the per-order tax invoice (tax.tax_invoices) and is the
--    B2B settlement document the seller downloads. Applied after 0077 (manual payouts).
--
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. order_items.store_id (per-store payout accuracy).
-- ---------------------------------------------------------------------------
alter table checkout.order_items
  add column if not exists store_id text references directory.stores(id);

-- Backfill online: lines created before this migration carry no store_id; attribute them to
-- the product's vendor store (the same store checkout prices them against in 0069/0072).
update checkout.order_items oi
   set store_id = p.store_id
  from catalog.products p
 where oi.product_id = p.id
   and oi.store_id is null
   and p.store_id is not null
   and p.store_id <> '';

create index if not exists order_items_store_idx
  on checkout.order_items (store_id);

-- ---------------------------------------------------------------------------
-- 2. payments.payout_invoices — the separate payout settlement document.
-- ---------------------------------------------------------------------------
create table if not exists payments.payout_invoices (
  payout_invoice_id text primary key,
  payout_id         text not null references payments.payouts (payout_id),
  seller_id         text not null,
  cycle             text not null,
  invoice_number    text not null,
  gross_paisa       bigint not null default 0 check (gross_paisa >= 0),
  commission_paisa  bigint not null default 0 check (commission_paisa >= 0),
  tcs_paisa         bigint not null default 0 check (tcs_paisa >= 0),
  tds_paisa         bigint not null default 0 check (tds_paisa >= 0),
  net_paisa         bigint not null default 0 check (net_paisa >= 0),
  paid_amount_paisa bigint not null default 0 check (paid_amount_paisa >= 0),
  pdf_key           text,           -- R2 object key for a rendered PDF (empty until one exists)
  generated_at      timestamptz not null default now()
);

create index if not exists payout_invoices_payout_idx on payments.payout_invoices (payout_id);
create index if not exists payout_invoices_seller_idx on payments.payout_invoices (seller_id);