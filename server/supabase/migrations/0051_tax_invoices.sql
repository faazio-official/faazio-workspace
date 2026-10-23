-- Faazio MVP — GST tax engine, seller deductions (TCS/TDS), customer tax invoices.
-- Authority: docs/architecture/mvp-backend.md §2, docs/architecture/db-schema.md §7.6,
-- docs/architecture/monolith-breakdown.md §1 (checkout + settlement context rows).
--
-- Money policy (server-owned, never client-computed):
--   * Product prices are GST-inclusive. The server splits each line into taxable value + GST using
--     the category rate in tax.tax_rates (default 5%). GST is passed through to the seller.
--   * The platform commission ("platform fee %") is the seller's registered sellers.platform_fee_pct.
--     GST on that commission (18%) is the platform's own liability — it is NOT added to the customer
--     total and NOT deducted twice from the seller.
--   * TCS (1% u/s 52 CGST) and TDS (0.1% u/s 194-O) are withheld from the seller's gross, never
--     added to the customer's price.
--   * The customer pays product gross + the fixed delivery fee (tax.platform_settings), less any
--     platform-funded coupon and coins. Coupons never reduce the seller's gross.
--
-- Additive only (never rewrites 0001–0050). Idempotent: safe to re-run.

create schema if not exists tax;

-- ================================================================ category → GST rate
create table if not exists tax.tax_rates (
  tax_rate_id   text primary key,
  sector        app_brand not null,
  category      text not null,
  gst_rate_pct  smallint not null default 5 check (gst_rate_pct in (0, 5, 12, 18, 28)),
  is_active     boolean not null default true,
  updated_by    text not null default '',
  updated_at    timestamptz not null default now(),
  unique (sector, category)
);
create index if not exists tax_rates_sector_active_idx on tax.tax_rates (sector, is_active);

-- Seed one row per existing listing category so every product resolves a rate at checkout.
insert into tax.tax_rates (tax_rate_id, sector, category, gst_rate_pct)
select 'tr-' || lower(p.app::text) || '-' || md5(lower(p.category)),
       p.app, p.category, 5
  from (select distinct app, category from catalog.products where category <> '') p
on conflict (sector, category) do nothing;

-- ================================================================ platform rate settings
-- One row (id = 1) edited by SUPER_ADMIN. Delivery fee is charged to the customer; TCS/TDS and the
-- platform GST rate are withholding/remittance parameters.
create table if not exists tax.platform_settings (
  id                    smallint primary key default 1 check (id = 1),
  platform_gst_pct      smallint not null default 18 check (platform_gst_pct between 0 and 28),
  tcs_pct               numeric(5,2) not null default 1.00 check (tcs_pct >= 0 and tcs_pct <= 10),
  tds_pct               numeric(5,2) not null default 0.10 check (tds_pct >= 0 and tds_pct <= 10),
  delivery_fee_paisa    int8 not null default 5000 check (delivery_fee_paisa >= 0),
  updated_by            text not null default '',
  updated_at            timestamptz not null default now()
);
insert into tax.platform_settings (id) values (1) on conflict (id) do nothing;

-- ================================================================ tax invoices
-- One immutable legal invoice per customer order. `taxable_value_paisa + product_tax_paisa` equals
-- the GST-inclusive product gross. `total_paisa` is what the customer was charged.
create table if not exists tax.tax_invoices (
  invoice_id             text primary key,          -- 'inv-*'
  invoice_number         text not null unique,       -- human-facing 'INV-*'
  order_id               text not null unique references checkout.orders (order_id) on delete cascade,
  order_number           text not null default '',
  customer_id            text not null references checkout.users (user_id) on delete cascade,
  seller_id              text references sellers.sellers (seller_id) on delete set null,
  seller_name            text not null default '',
  seller_gstin           text not null default '',
  tax_rate_pct           smallint not null default 5 check (tax_rate_pct between 0 and 28),
  taxable_value_paisa    int8 not null default 0 check (taxable_value_paisa >= 0),
  product_tax_paisa      int8 not null default 0 check (product_tax_paisa >= 0),
  platform_fee_paisa     int8 not null default 0 check (platform_fee_paisa >= 0),
  platform_gst_paisa     int8 not null default 0 check (platform_gst_paisa >= 0),
  delivery_fee_paisa     int8 not null default 0 check (delivery_fee_paisa >= 0),
  tcs_paisa              int8 not null default 0 check (tcs_paisa >= 0),
  tds_paisa              int8 not null default 0 check (tds_paisa >= 0),
  coupon_discount_paisa  int8 not null default 0 check (coupon_discount_paisa >= 0),
  total_paisa            int8 not null default 0 check (total_paisa >= 0),
  seller_net_paisa       int8 not null default 0,
  pdf_key                text,                      -- private R2 object key, never a URL
  generated_at           timestamptz not null default now()
);
create index if not exists tax_invoices_customer_idx on tax.tax_invoices (customer_id, generated_at desc);
create index if not exists tax_invoices_seller_idx   on tax.tax_invoices (seller_id, generated_at desc);

-- ================================================================ order charge snapshot
-- Durable per-order figures so a later rate/config change can never rewrite what a customer paid or
-- what a seller was owed. `total_paisa` (existing) stays the product gross; `total_charged_paisa`
-- is the customer-facing amount (product + delivery − coupon); coins are a separate tender.
alter table checkout.orders add column if not exists invoice_id            text;
alter table checkout.orders add column if not exists taxable_value_paisa   int8 not null default 0;
alter table checkout.orders add column if not exists product_tax_paisa     int8 not null default 0;
alter table checkout.orders add column if not exists platform_fee_paisa    int8 not null default 0;
alter table checkout.orders add column if not exists platform_gst_paisa    int8 not null default 0;
alter table checkout.orders add column if not exists delivery_fee_paisa    int8 not null default 0;
alter table checkout.orders add column if not exists tcs_paisa             int8 not null default 0;
alter table checkout.orders add column if not exists tds_paisa             int8 not null default 0;
alter table checkout.orders add column if not exists total_charged_paisa   int8 not null default 0;
create index if not exists orders_invoice_idx on checkout.orders (invoice_id) where invoice_id is not null;

-- ================================================================ settlement deductions
alter table payments.settlement_ledger add column if not exists tds_paisa           int8 not null default 0;
alter table payments.settlement_ledger add column if not exists product_tax_paisa   int8 not null default 0;
alter table payments.settlement_ledger add column if not exists platform_gst_paisa  int8 not null default 0;

-- ================================================================ RLS + grants (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0051 RLS + grants (non-Supabase environment)';
    return;
  end if;

  grant usage on schema tax to authenticated;
  grant select on tax.tax_rates to anon, authenticated;
  grant select on tax.tax_invoices to authenticated;

  alter table tax.tax_invoices enable row level security;

  execute 'drop policy if exists own_invoice_read on tax.tax_invoices';
  execute $p$create policy own_invoice_read on tax.tax_invoices for select to authenticated
    using (customer_id = checkout.current_app_user_id())$p$;
end;
$$;
