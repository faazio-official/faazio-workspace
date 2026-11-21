-- Faazio MVP — make admins.district_master the single, writable source of truth for district coverage.
-- Authority: docs/architecture/db-schema.md §12.42, monolith-breakdown.md §1 (districts row),
-- user-interaction-workflow/seller/web-portal/super-admin-district-coverage.md.
--
-- 0046 shipped the district master read-only (seeded TN 38 + PY 4, SELECT for authenticated). Adding
-- a district therefore needed a migration + a gateway deploy, because internal/platform/geo carried a
-- hardcoded mirror. This migration is the write half:
--   1. updated_at — audit freshness for the portal list (created_at alone could not show an edit).
--   2. util.touch_updated_at() trigger — the generic 0014 helper, so the timestamp can never drift.
--   3. INSERT/UPDATE/DELETE RLS policies for SUPER_ADMIN only. SELECT stays open to authenticated
--      (the seller-onboarding district picker reads it directly). District creation is platform-level
--      governance, so it is deliberately not district-scoped: DISTRICT_ADMIN/STATE_ADMIN cannot write.
--   4. A DELETE guard: 0047/0048/0055 FK the master with ON DELETE RESTRICT and 0049/0111 with
--      ON DELETE SET NULL. The FKs alone are the hard block; this migration only documents it — a
--      district referenced by a seller, district admin or delivery payout row is the operator's
--      signal to deactivate (is_active = false) instead of deleting.
--
-- The gateway (service_role) remains the only writer in production; these policies exist so a direct
-- Supabase client with a SUPER_ADMIN JWT cannot silently bypass the write API.
--
-- Idempotent: safe to re-run.

alter table admins.district_master
  add column if not exists updated_at timestamptz;

-- Backfill: a row seeded by 0046 has no edit history, so updated_at starts at created_at.
update admins.district_master
   set updated_at = created_at
 where updated_at is null;

alter table admins.district_master
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists touch_updated_at on admins.district_master;
create trigger touch_updated_at before update on admins.district_master
  for each row execute function util.touch_updated_at();

-- Lookup path for the portal list: every row of a state (active and inactive), name-ordered.
create index if not exists district_master_state_all_idx
  on admins.district_master (state_code, district_name);

comment on column admins.district_master.updated_at is
  'Set by util.touch_updated_at() on every UPDATE; created_at is immutable.';

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'alter table admins.district_master enable row level security';

    execute 'drop policy if exists district_master_read on admins.district_master';
    execute $p$create policy district_master_read on admins.district_master
      for select to authenticated using (true)$p$;

    execute 'drop policy if exists district_master_insert on admins.district_master';
    execute $p$create policy district_master_insert on admins.district_master
      for insert to authenticated
      with check (coalesce(auth.jwt() ->> 'app_role', '') = 'SUPER_ADMIN')$p$;

    execute 'drop policy if exists district_master_update on admins.district_master';
    execute $p$create policy district_master_update on admins.district_master
      for update to authenticated
      using (coalesce(auth.jwt() ->> 'app_role', '') = 'SUPER_ADMIN')
      with check (coalesce(auth.jwt() ->> 'app_role', '') = 'SUPER_ADMIN')$p$;

    execute 'drop policy if exists district_master_delete on admins.district_master';
    execute $p$create policy district_master_delete on admins.district_master
      for delete to authenticated
      using (coalesce(auth.jwt() ->> 'app_role', '') = 'SUPER_ADMIN')$p$;
  end if;
end;
$$;
