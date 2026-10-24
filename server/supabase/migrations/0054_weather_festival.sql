-- Faazio MVP — server-authoritative delivery pricing: weather budget, festival calendar and the
-- persisted customer-price basis that rider payout reuses 1:1.
-- Authority: docs/architecture/db-schema.md §7.6/§12.25, docs/architecture/monolith-breakdown.md §1.
--
-- Additive only (never rewrites 0001–0053). Idempotent: safe to re-run.

-- ================================================================ ops schema
create schema if not exists ops;

-- Weather Union call history: exactly one row per day (≤365/year). The live budget counter is in
-- Valkey (faazio:v1:weather:calls:{FY}); this table is the durable daily trail for the dashboard.
create table if not exists ops.weather_api_usage (
  d          date primary key,
  calls      int8 not null default 0 check (calls >= 0),
  fy         text not null,
  updated_at timestamptz not null default now()
);

-- Super-admin festival surge windows. The active row's surge_paisa is the customer/rider surcharge.
create table if not exists ops.festival_calendar (
  id           text primary key,
  name         text not null,
  start_date   date not null,
  end_date     date not null check (end_date >= start_date),
  surge_paisa  int8 not null default 0 check (surge_paisa >= 0),
  active       bool not null default true,
  created_by   text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists festival_calendar_active_window_idx
  on ops.festival_calendar (active, start_date, end_date);

-- ================================================================ checkout order pricing basis
-- The customer-paid delivery price is computed once at placement and stored, so payout can never
-- diverge from the bill. delivery_fee_paisa already exists from the earlier fee work.
alter table checkout.orders
  add column if not exists delivery_zone_id text,
  add column if not exists delivery_distance_km numeric(7,2) check (delivery_distance_km >= 0),
  add column if not exists delivery_surge_paisa int8 not null default 0 check (delivery_surge_paisa >= 0),
  add column if not exists delivery_surge_reason text not null default '',
  add column if not exists delivery_billing_basis jsonb
    check (delivery_billing_basis is null or octet_length(delivery_billing_basis::text) <= 4096);

-- ================================================================ rate card alignment
-- The locked pricing text is ₹7/km to customer AND rider (1:1 pass-through). 0053 shipped ₹9/km;
-- align the singleton row for databases created before this migration. Fresh installs get the new
-- default from 0053.
update tax.delivery_fee_settings set per_extra_km_paisa = 700 where id = 1;

-- ================================================================ RLS + grants (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0054 RLS (non-Supabase environment)';
    return;
  end if;

  -- No client grants: these are ops tables read/written by the gateway (service_role) only.
  alter table ops.weather_api_usage enable row level security;
  alter table ops.festival_calendar enable row level security;
end;
$$;
