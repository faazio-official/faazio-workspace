-- Faazio MVP — partner control plane (the durable home for the Partner Portal workflows).
-- Authority: docs/architecture/db-schema.md §12.9, monolith-breakdown.md §1, mvp-backend.md §2.
-- Why: the Portal shipped 45 routes against localStorage only. This migration is the origin of
-- truth they converge on — additive only (never rewrites 0001–0014), so the mobile app keeps running.
--
-- Inherits the lean dtype policy (§0.1 freeze) instead of re-deciding per table:
--   money `*_paisa` = INT8 · ratings = REAL 0–5 · counts = INT4 · qty/percent = SMALLINT · ids = TEXT
--   slugs · time = TIMESTAMPTZ · enums = native ENUM · JSONB guarded ≤ 8 KB · writes = service_role.
-- Idempotent throughout: safe to re-run on a database that already has partial state.

-- ================================================================ enum alignment (Option A)
-- One lifecycle both apps read: the portal speaks NEW/PACKED/RETURNED; mobile speaks Processing.
-- The gateway maps mobile Processing ↔ NEW/PACKED (internal/checkout). Additive only — existing
-- values keep their meaning. `IF NOT EXISTS` keeps this re-runnable.
alter type order_status add value if not exists 'NEW';
alter type order_status add value if not exists 'PACKED';
alter type order_status add value if not exists 'RETURNED';

-- ================================================================ sellers schema
create schema if not exists sellers;

do $$ begin
  create type seller_status as enum ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kyc_doc_type as enum ('GSTIN', 'PAN', 'BANK_PROOF', 'SHOP_LICENSE');
exception when duplicate_object then null; end $$;

create table if not exists sellers.sellers (
  seller_id     text primary key,               -- stable slug, e.g. 'sel-1'
  business_name text not null,
  owner_name    text not null,
  category      app_brand not null,
  gstin         text not null default '',
  pan           text not null default '',
  address       text not null default '',
  phone         text,                            -- PII — never cached, never anon-exposed
  state_code    char(2) not null,
  status        seller_status not null default 'PENDING_REVIEW',
  rating        real not null default 0 check (rating between 0 and 5),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sellers_state_status_idx on sellers.sellers (state_code, status);
create index if not exists sellers_category_idx     on sellers.sellers (category);

create table if not exists sellers.kyc_documents (
  kyc_id      text primary key,
  seller_id   text not null references sellers.sellers (seller_id) on delete cascade,
  doc_type    kyc_doc_type not null,
  file_key    text not null,                     -- Storage object key — never a URL/data-URL
  verified    boolean not null default false,
  uploaded_at timestamptz not null default now()
);
create index if not exists kyc_documents_seller_idx on sellers.kyc_documents (seller_id);

create table if not exists sellers.bank_accounts (
  bank_account_id       text primary key,
  seller_id             text not null references sellers.sellers (seller_id) on delete cascade,
  account_number_masked text not null,           -- masked tail only; never the full number
  ifsc                  text not null,
  beneficiary_name      text not null,
  created_at            timestamptz not null default now()
);
create index if not exists bank_accounts_seller_idx on sellers.bank_accounts (seller_id);
-- One current payout account per seller (MVP): makes the upsert idempotent.
create unique index if not exists bank_accounts_seller_uniq on sellers.bank_accounts (seller_id);

-- ================================================================ extend catalog + directory
-- Seller scoping + the moderation queue need a column to filter on; the live flag already exists
-- on directory.stores, so products borrow the same model through `status`.
-- 0005 narrowed catalog.products.rating to REAL but missed directory.stores.rating; align it here.
alter table directory.stores alter column rating type real using rating::real;
alter table directory.stores add column if not exists seller_id  text;
alter table directory.stores add column if not exists state_code char(2);
create index if not exists stores_seller_idx      on directory.stores (seller_id);
create index if not exists stores_state_live_idx  on directory.stores (state_code);

do $$ begin
  create type product_status as enum ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'DELISTED');
exception when duplicate_object then null; end $$;

alter table catalog.products add column if not exists seller_id text;
alter table catalog.products add column if not exists status product_status not null default 'DRAFT';
create index if not exists products_seller_status_idx on catalog.products (seller_id, status);
create index if not exists products_status_idx        on catalog.products (status);

-- ================================================================ promo schema (festival + coupons)
create schema if not exists promo;

do $$ begin
  create type campaign_status as enum ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type campaign_scope as enum ('GLOBAL', 'STATE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type optin_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

create table if not exists promo.sector_caps (
  cap_id       text primary key,
  sector       app_brand not null,
  state_code   char(2),                          -- null = global cap
  max_discount smallint not null check (max_discount between 0 and 90),
  updated_at   timestamptz not null default now()
);
create unique index if not exists sector_caps_scope_idx
  on promo.sector_caps (sector, coalesce(state_code, ''));

create table if not exists promo.festival_campaigns (
  campaign_id text primary key,
  name        text not null,
  scope       campaign_scope not null default 'GLOBAL',
  state_code  char(2),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  banner_url  text not null default '',
  status      campaign_status not null default 'DRAFT',
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((scope = 'STATE') = (state_code is not null))
);
create index if not exists festival_campaigns_status_idx
  on promo.festival_campaigns (status, starts_at desc);

create table if not exists promo.festival_optins (
  optin_id    text primary key,
  campaign_id text not null references promo.festival_campaigns (campaign_id) on delete cascade,
  seller_id   text not null references sellers.sellers (seller_id) on delete cascade,
  product_id  text not null check (char_length(product_id) between 1 and 64),
  discount    smallint not null check (discount between 0 and 90),
  status      optin_status not null default 'PENDING',
  created_at  timestamptz not null default now(),
  unique (campaign_id, product_id)
);
create index if not exists festival_optins_campaign_idx on promo.festival_optins (campaign_id, status);
create index if not exists festival_optins_seller_idx   on promo.festival_optins (seller_id);

create table if not exists promo.coupons (
  coupon_id          text primary key,
  code               text not null unique,
  scope              campaign_scope not null default 'GLOBAL',
  state_code         char(2),
  sector             app_brand,                  -- null = all sectors
  value_percent      smallint not null check (value_percent between 0 and 90),
  max_discount_paisa int8 not null default 0 check (max_discount_paisa >= 0),
  valid_till         timestamptz not null,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  check ((scope = 'STATE') = (state_code is not null))
);
create index if not exists coupons_active_scope_idx on promo.coupons (active, scope);

-- ================================================================ ads schema
create schema if not exists ads;

do $$ begin
  create type ad_placement as enum ('HOME_TOP', 'SPONSORED_SHOWCASE', 'SECTOR_RAIL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ad_status as enum ('REQUESTED', 'APPROVED', 'REJECTED', 'LIVE');
exception when duplicate_object then null; end $$;

create table if not exists ads.sponsored_slots (
  slot_id           text primary key,
  seller_id         text not null references sellers.sellers (seller_id) on delete cascade,
  product_id        text not null check (char_length(product_id) between 1 and 64),
  placement         ad_placement not null,
  state_code        char(2),
  status            ad_status not null default 'REQUESTED',
  impressions       int4 not null default 0 check (impressions >= 0),
  clicks            int4 not null default 0 check (clicks >= 0),
  orders_attributed int8 not null default 0 check (orders_attributed >= 0),
  requested_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists sponsored_slots_placement_idx on ads.sponsored_slots (placement, status);
create index if not exists sponsored_slots_seller_idx    on ads.sponsored_slots (seller_id);

-- ================================================================ payments settlement + payouts
-- Real money is never client-computed (fixes the portal's derived commission/TCS). The gateway
-- (service_role) is the only writer; there are no RLS update/delete policies, so rows are
-- append-by-convention (mirrors rewards.ledger). A payout freezes one cycle's net.
create schema if not exists payments;

do $$ begin
  create type payout_status as enum ('SCHEDULED', 'PAID', 'ON_HOLD');
exception when duplicate_object then null; end $$;

create table if not exists payments.settlement_ledger (
  entry_id          text primary key,
  seller_id         text not null references sellers.sellers (seller_id) on delete cascade,
  cycle             text not null,               -- 'YYYY-MM'
  order_value_paisa int8 not null check (order_value_paisa >= 0),
  commission_paisa  int8 not null check (commission_paisa >= 0),
  tcs_paisa         int8 not null check (tcs_paisa >= 0),
  net_paisa         int8 not null,
  created_at        timestamptz not null default now()
);
create index if not exists settlement_ledger_seller_cycle_idx
  on payments.settlement_ledger (seller_id, cycle);

create table if not exists payments.payouts (
  payout_id     text primary key,
  seller_id     text not null references sellers.sellers (seller_id) on delete cascade,
  cycle         text not null,
  amount_paisa  int8 not null check (amount_paisa >= 0),
  status        payout_status not null default 'SCHEDULED',
  scheduled_for timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists payouts_seller_cycle_idx on payments.payouts (seller_id, cycle);

-- ================================================================ admins schema (state admins + audit)
create schema if not exists admins;

create table if not exists admins.state_admins (
  admin_id       text primary key,
  name           text not null,
  email          text not null,                  -- PII
  phone          text not null,                  -- PII
  state_code     char(2) not null,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index if not exists state_admins_state_idx on admins.state_admins (state_code, active);

create table if not exists admins.audit_logs (
  log_id     text primary key,
  actor_id   text not null,
  actor_role text not null check (actor_role in ('SELLER', 'STATE_ADMIN', 'SUPER_ADMIN')),
  action     text not null,
  entity     text not null,
  entity_id  text not null default '',
  before     jsonb check (before is null or octet_length(before::text) <= 8192),
  after      jsonb check (after  is null or octet_length(after::text)  <= 8192),
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on admins.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx  on admins.audit_logs (entity, entity_id);

-- ================================================================ support tickets + returns
create schema if not exists support;

do $$ begin
  create type ticket_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
exception when duplicate_object then null; end $$;

create table if not exists support.tickets (
  ticket_id  text primary key,
  user_id    text references checkout.users (user_id) on delete set null,
  seller_id  text references sellers.sellers (seller_id) on delete set null,
  subject    text not null default '',
  body       text not null default '' check (char_length(body) <= 2000),
  status     ticket_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_status_created_idx on support.tickets (status, created_at desc);

do $$ begin
  create type return_status as enum ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');
exception when duplicate_object then null; end $$;

create table if not exists checkout.returns (
  return_id  text primary key,
  order_id   text not null references checkout.orders (order_id) on delete cascade,
  user_id    text not null references checkout.users (user_id) on delete cascade,
  seller_id  text,
  reason     text not null default '' check (char_length(reason) <= 2000),
  status     return_status not null default 'REQUESTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists returns_order_idx        on checkout.returns (order_id);
create index if not exists returns_seller_status_idx on checkout.returns (seller_id, status);

-- ================================================================ updated_at triggers
-- Reuse the generic util.touch_updated_at() from 0014; only tables that actually carry updated_at.
do $$
declare
  target text;
begin
  foreach target in array array[
    'sellers.sellers', 'promo.sector_caps', 'promo.festival_campaigns', 'ads.sponsored_slots',
    'support.tickets', 'checkout.returns'
  ] loop
    execute format('drop trigger if exists touch_updated_at on %s', target);
    execute format(
      'create trigger touch_updated_at before update on %s
         for each row execute function util.touch_updated_at()', target);
  end loop;
end;
$$;

-- ================================================================ RLS + grants (Supabase only)
-- The gateway connects as service_role (bypasses RLS) and is the real authority. These policies are
-- defence-in-depth for direct Supabase anon/authenticated clients. App roles travel in custom JWT
-- claims (`app_role`, `seller_id`, `state_code`) set at login — `auth.jwt()` returns jsonb.
do $$
declare
  s text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0015 RLS + grants (non-Supabase environment)';
    return;
  end if;

  foreach s in array array['sellers', 'promo', 'ads', 'payments', 'admins', 'support'] loop
    execute format('grant usage on schema %I to anon, authenticated', s);
  end loop;

  -- Enable RLS (no-op if already on).
  foreach s in array array[
    'sellers.sellers', 'sellers.kyc_documents', 'sellers.bank_accounts',
    'promo.sector_caps', 'promo.festival_campaigns', 'promo.festival_optins', 'promo.coupons',
    'ads.sponsored_slots', 'payments.settlement_ledger', 'payments.payouts',
    'admins.state_admins', 'admins.audit_logs', 'support.tickets', 'checkout.returns'
  ] loop
    execute format('alter table %s enable row level security', s);
  end loop;

  -- Helper predicates (jsonb claim access, null-safe). Inner function bodies use a distinct
  -- dollar tag so the delimiter never collides with the outer DO block.
  execute $fn$
    create or replace function sellers.is_super() returns boolean
    language sql stable as $body$ select coalesce(auth.jwt() ->> 'app_role', '') = 'SUPER_ADMIN' $body$
  $fn$;
  execute $fn$
    create or replace function sellers.is_state_admin_for(p_state char(2)) returns boolean
    language sql stable as $body$
      select coalesce(auth.jwt() ->> 'app_role', '') = 'STATE_ADMIN'
         and coalesce(auth.jwt() ->> 'state_code', '') = p_state
    $body$
  $fn$;
  execute $fn$
    create or replace function sellers.current_seller_id() returns text
    language sql stable as $body$ select nullif(auth.jwt() ->> 'seller_id', '') $body$
  $fn$;

  -- sellers.* : owner or admin read; writes service_role only.
  execute 'drop policy if exists seller_read on sellers.sellers';
  execute $p$create policy seller_read on sellers.sellers for select to authenticated
    using (seller_id = sellers.current_seller_id()
           or sellers.is_super()
           or sellers.is_state_admin_for(state_code))$p$;
  execute 'drop policy if exists seller_read on sellers.kyc_documents';
  execute $p$create policy seller_read on sellers.kyc_documents for select to authenticated
    using (seller_id = sellers.current_seller_id() or sellers.is_super()
           or exists (select 1 from sellers.sellers s where s.seller_id = kyc_documents.seller_id
                       and sellers.is_state_admin_for(s.state_code)))$p$;
  execute 'drop policy if exists seller_read on sellers.bank_accounts';
  execute $p$create policy seller_read on sellers.bank_accounts for select to authenticated
    using (seller_id = sellers.current_seller_id() or sellers.is_super()
           or exists (select 1 from sellers.sellers s where s.seller_id = bank_accounts.seller_id
                       and sellers.is_state_admin_for(s.state_code)))$p$;

  -- promo.* : super or state admin read.
  execute 'drop policy if exists admin_read on promo.sector_caps';
  execute $p$create policy admin_read on promo.sector_caps for select to authenticated
    using (sellers.is_super()
           or (state_code is null and coalesce(auth.jwt() ->> 'app_role','') in ('STATE_ADMIN','SUPER_ADMIN'))
           or sellers.is_state_admin_for(state_code))$p$;
  execute 'drop policy if exists admin_read on promo.festival_campaigns';
  execute $p$create policy admin_read on promo.festival_campaigns for select to authenticated
    using (sellers.is_super() or scope = 'GLOBAL' or sellers.is_state_admin_for(state_code))$p$;
  execute 'drop policy if exists admin_read on promo.festival_optins';
  execute $p$create policy admin_read on promo.festival_optins for select to authenticated
    using (seller_id = sellers.current_seller_id() or sellers.is_super()
           or exists (select 1 from sellers.sellers s where s.seller_id = festival_optins.seller_id
                       and sellers.is_state_admin_for(s.state_code)))$p$;
  execute 'drop policy if exists admin_read on promo.coupons';
  execute $p$create policy admin_read on promo.coupons for select to authenticated
    using (sellers.is_super() or scope = 'GLOBAL' or sellers.is_state_admin_for(state_code))$p$;

  -- ads.* : owner or admin read.
  execute 'drop policy if exists seller_read on ads.sponsored_slots';
  execute $p$create policy seller_read on ads.sponsored_slots for select to authenticated
    using (seller_id = sellers.current_seller_id() or sellers.is_super()
           or sellers.is_state_admin_for(state_code))$p$;

  -- payments.* : owner or super read.
  execute 'drop policy if exists seller_read on payments.settlement_ledger';
  execute $p$create policy seller_read on payments.settlement_ledger for select to authenticated
    using (seller_id = sellers.current_seller_id() or sellers.is_super())$p$;
  execute 'drop policy if exists seller_read on payments.payouts';
  execute $p$create policy seller_read on payments.payouts for select to authenticated
    using (seller_id = sellers.current_seller_id() or sellers.is_super())$p$;

  -- admins.* : super manages state admins; admins read the audit trail.
  execute 'drop policy if exists super_read on admins.state_admins';
  execute $p$create policy super_read on admins.state_admins for select to authenticated
    using (sellers.is_super() or sellers.is_state_admin_for(state_code))$p$;
  execute 'drop policy if exists admin_read on admins.audit_logs';
  execute $p$create policy admin_read on admins.audit_logs for select to authenticated
    using (coalesce(auth.jwt() ->> 'app_role','') in ('STATE_ADMIN','SUPER_ADMIN'))$p$;

  -- support.tickets + checkout.returns : customer own, seller own, or admin.
  execute 'drop policy if exists own_or_admin on support.tickets';
  execute $p$create policy own_or_admin on support.tickets for select to authenticated
    using (user_id = checkout.current_app_user_id()
           or seller_id = sellers.current_seller_id()
           or coalesce(auth.jwt() ->> 'app_role','') in ('STATE_ADMIN','SUPER_ADMIN'))$p$;
  execute 'drop policy if exists own_or_admin on checkout.returns';
  execute $p$create policy own_or_admin on checkout.returns for select to authenticated
    using (user_id = checkout.current_app_user_id()
           or seller_id = sellers.current_seller_id()
           or coalesce(auth.jwt() ->> 'app_role','') in ('STATE_ADMIN','SUPER_ADMIN'))$p$;
end;
$$;