-- Faazio MVP — dynamic delivery fee rate card.
-- Authority: docs/architecture/mvp-backend.md §2, docs/architecture/db-schema.md §7.6.
--
-- Delivery fee is now dynamic (distance-based) instead of a flat ₹50:
--   fee = base_fee_paisa + ((distanceKm − base_distance_km) × per_extra_km_paisa)
-- with a default card of 3 km / ₹35 / ₹7 per extra km (1:1 with the rider's ₹7/km).
-- (Databases created before 0054 are re-seeded to ₹7 by 0054.) The road distance is
-- server-authoritative (GET /checkout/delivery-fee reads directory.stores pins +
-- Haversine to the customer fix); self-pickup waives the fee entirely.
-- The gateway (service_role) is the only writer; SUPER_ADMIN edits the singleton row.
--
-- Additive only (never rewrites 0001–0052). Idempotent: safe to re-run.

create schema if not exists tax;

create table if not exists tax.delivery_fee_settings (
  id                 smallint primary key default 1 check (id = 1),
  base_distance_km   numeric(6,2) not null default 3.00 check (base_distance_km >= 0),
  base_fee_paisa     int8         not null default 3500 check (base_fee_paisa >= 0),
  per_extra_km_paisa int8         not null default 700 check (per_extra_km_paisa >= 0),
  updated_by         text         not null default '',
  updated_at         timestamptz  not null default now()
);
insert into tax.delivery_fee_settings (id) values (1) on conflict (id) do nothing;

-- ================================================================ RLS + grants (Supabase only)
-- No client grants: the gateway (service_role, bypasses RLS) is the only reader/writer. The fee is
-- computed server-side, so anon/authenticated never touch this table directly.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0053 RLS (non-Supabase environment)';
    return;
  end if;

  alter table tax.delivery_fee_settings enable row level security;
end;
$$;