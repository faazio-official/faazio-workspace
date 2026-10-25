-- Faazio MVP — cross-cutting hardening (the closing migration of the DB-gap series 0007–0014).
-- Authority: docs/architecture/db-schema.md §12.8, monolith-breakdown.md §1.
-- Why: the per-workflow migrations each hand-rolled their own integrity rules. This migration
-- consolidates three cross-cutting concerns so future tables inherit them for free:
--   1. `updated_at` is kept honest for every mutable table (one generic trigger, not per-table code).
--   2. `checkout.idempotency_keys` cannot grow unbounded (a completed replay window + pg_cron prune).
--   3. hot read paths get the indexes the repos actually order by.
-- Idempotent throughout: safe to re-run on a database that already has partial state.

-- ---------------------------------------------------------------- generic updated_at touch
-- catalog.touch_updated_at() also fires pg_notify('catalog_updated', new.id); this generic twin
-- touches the timestamp only, so it is safe on tables without an `id` column.
create schema if not exists util;

create or replace function util.touch_updated_at()
returns trigger language plpgsql
set search_path = pg_catalog as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'directory.stores', 'inventory.stock', 'inventory.carts', 'inventory.pickup_points',
    'accounts.profile', 'reviews.vendor_reviews', 'pharma.prescriptions',
    'blood.donors', 'rewards.balances'
  ] loop
    execute format('drop trigger if exists touch_updated_at on %s', target);
    execute format(
      'create trigger touch_updated_at before update on %s
         for each row execute function util.touch_updated_at()', target);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- idempotency-key expiry sweep
-- The Valkey NX lock lives 300 s, but the durable row is the replay record: keep it 7 days (a
-- generous client-retry window) and let pg_cron prune older rows so the table stays bounded.
create or replace function checkout.purge_idempotency_keys(max_age interval default interval '7 days')
returns integer language plpgsql security definer
set search_path = pg_catalog as $$
declare deleted integer;
begin
  delete from checkout.idempotency_keys where created_at < now() - max_age;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('faazio-purge-idempotency-keys')
      where exists (select 1 from cron.job where jobname = 'faazio-purge-idempotency-keys');
    perform cron.schedule('faazio-purge-idempotency-keys', '15 4 * * *',
      $cron$ select checkout.purge_idempotency_keys(); $cron$);
  end if;
end;
$$;

-- ---------------------------------------------------------------- hot-path indexes
-- Public vendor-review list: WHERE vendor_id ORDER BY created_at DESC.
create index if not exists vendor_reviews_vendor_created_idx
  on reviews.vendor_reviews (vendor_id, created_at desc);

-- Prescription list: WHERE user_id ORDER BY created_at DESC (already covered) + status filter.
create index if not exists prescriptions_user_status_idx
  on pharma.prescriptions (user_id, status);

-- ---------------------------------------------------------------- RLS default privileges (Supabase only)
-- New schemas were created after Supabase's bootstrap grants; give the API roles schema USAGE so
-- RLS (not a missing grant) is the only gate. Table-level access stays governed by each policy.
do $$
declare
  s text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping schema grants (non-Supabase environment)';
    return;
  end if;
  foreach s in array array['util', 'favourites', 'rewards', 'pharma', 'blood'] loop
    execute format('grant usage on schema %I to anon, authenticated', s);
  end loop;
end;
$$;