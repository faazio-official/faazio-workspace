-- Faazio MVP — delivery-partner payout engine (distance + surge).
-- Authority: docs/architecture/db-schema.md §12.25, docs/architecture/monolith-breakdown.md §1
-- (delivery context row). Supersedes the 0042 note that Phase 5 payouts were out of scope.
--
-- The gateway (service_role) is the only writer. Payouts are server-derived from the persisted route
-- distance and a small, admin-editable rate card; `delivery.delivery_orders.payout_amount_paisa`
-- becomes a cached projection of the latest calculation (display only, the ledger below is truth).
--
-- Additive only (never rewrites 0001–0051). Idempotent: safe to re-run.

-- ================================================================ rate card
create table if not exists delivery.payout_settings (
  id                     smallint primary key default 1 check (id = 1),
  base_rate_paisa        int8 not null default 3000 check (base_rate_paisa >= 0),
  base_distance_km       numeric(5,2) not null default 3.00 check (base_distance_km > 0),
  per_extra_km_paisa     int8 not null default 700 check (per_extra_km_paisa >= 0),
  night_surge_paisa      int8 not null default 2000 check (night_surge_paisa >= 0),
  weather_surge_paisa    int8 not null default 2500 check (weather_surge_paisa >= 0),
  festival_surge_paisa   int8 not null default 1500 check (festival_surge_paisa >= 0),
  updated_by             text not null default '',
  updated_at             timestamptz not null default now()
);
insert into delivery.payout_settings (id) values (1) on conflict (id) do nothing;

-- ================================================================ payouts
do $$ begin
  create type delivery_payout_status as enum ('PENDING', 'PAID');
exception when duplicate_object then null; end $$;

create table if not exists delivery.delivery_payouts (
  payout_id              text primary key,             -- 'dp-*'
  rider_id               text not null references delivery.delivery_boys (rider_id) on delete cascade,
  order_id               text not null unique references delivery.delivery_orders (order_id) on delete cascade,
  distance_km            numeric(7,2) not null default 0 check (distance_km >= 0),
  base_rate_paisa        int8 not null default 0 check (base_rate_paisa >= 0),
  extra_km_charge_paisa  int8 not null default 0 check (extra_km_charge_paisa >= 0),
  surge_paisa            int8 not null default 0 check (surge_paisa >= 0),
  surge_reason           text not null default '',
  total_paisa            int8 not null default 0 check (total_paisa >= 0),
  status                 delivery_payout_status not null default 'PENDING',
  paid_at                timestamptz,
  paid_by                text not null default '',
  razorpay_transfer_id   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists delivery_payouts_rider_status_idx
  on delivery.delivery_payouts (rider_id, status, created_at desc);

-- Auditable breakdown of the last calculation (rate card version, km, surge reason).
alter table delivery.delivery_orders
  add column if not exists payout_basis jsonb
  check (payout_basis is null or octet_length(payout_basis::text) <= 2048);

-- ================================================================ RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0052 RLS (non-Supabase environment)';
    return;
  end if;

  grant select on delivery.delivery_payouts to authenticated;
  alter table delivery.delivery_payouts enable row level security;

  execute 'drop policy if exists delivery_payouts_read on delivery.delivery_payouts';
  execute $p$create policy delivery_payouts_read on delivery.delivery_payouts for select to authenticated
    using (rider_id = delivery.current_rider_id() or delivery.is_super())$p$;
end;
$$;
