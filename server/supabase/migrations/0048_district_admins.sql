-- Faazio MVP — rename state admins to district admins and scope the roster by district.
-- Authority: docs/architecture/db-schema.md §12.19, monolith-breakdown.md §1 (admins row),
-- docs/RUNBOOKS/PORTAL_AUTH.md.
--
-- Backward compatibility: the legacy state_code column is KEPT on both roster and portal rows.
-- Existing state admins created before the district rollout have no district yet (district_code is
-- null) and keep working with state-level scope; new district admins carry district_code. The
-- gateway verifier accepts both shapes, so applying this migration does not lock anyone out.

-- ================================================================ roster rename
do $$
begin
  if to_regclass('admins.state_admins') is not null
     and to_regclass('admins.district_admins') is null then
    alter table admins.state_admins rename to district_admins;
  end if;
end;
$$;

alter table admins.district_admins
  add column if not exists district_code text
    references admins.district_master (district_code) on delete restrict;

create index if not exists district_admins_district_idx
  on admins.district_admins (district_code, active)
  where district_code is not null;

create index if not exists district_admins_state_idx
  on admins.district_admins (state_code, active);

-- Rename legacy indexes so operators see the new vocabulary.
alter index if exists admins.state_admins_state_idx rename to district_admins_state_legacy_idx;
alter index if exists admins.state_admins_email_lower_uniq rename to district_admins_email_lower_uniq;
alter index if exists admins.state_admins_phone_digits_idx rename to district_admins_phone_digits_idx;

-- ================================================================ audit actor role
-- DISTRICT_ADMIN is a first-class actor. Keep STATE_ADMIN allowed so historical rows stay valid.
alter table admins.audit_logs drop constraint if exists audit_logs_actor_role_check;
alter table admins.audit_logs
  add constraint audit_logs_actor_role_check
  check (actor_role in ('SELLER', 'STATE_ADMIN', 'DISTRICT_ADMIN', 'SUPER_ADMIN'));

-- ================================================================ portal credentials
alter table admins.portal_users
  add column if not exists district_code text
    references admins.district_master (district_code) on delete restrict;

create index if not exists portal_users_district_idx
  on admins.portal_users (district_code)
  where district_code is not null;

alter table admins.portal_users drop constraint if exists portal_users_role_check;
alter table admins.portal_users
  add constraint portal_users_role_check
  check (role in ('SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN', 'SELLER'));

alter table admins.portal_users drop constraint if exists portal_users_scope_check;
alter table admins.portal_users
  add constraint portal_users_scope_check check (
    (role = 'SUPER_ADMIN' and seller_id is null and state_code is null and district_code is null) or
    (role = 'SELLER' and seller_id is not null and state_code is null and district_code is null) or
    (role in ('DISTRICT_ADMIN', 'STATE_ADMIN')
      and seller_id is null
      and (district_code is not null or state_code is not null))
  );

-- The replacement role/scope checks above must accept DISTRICT_ADMIN BEFORE any existing
-- STATE_ADMIN row is renamed with the UPDATE below (0033's checks only allowed
-- SUPER_ADMIN/STATE_ADMIN/SELLER).
update admins.portal_users
   set role = 'DISTRICT_ADMIN'
 where role = 'STATE_ADMIN';

alter table admins.portal_users drop constraint if exists portal_users_district_code_check;
alter table admins.portal_users
  add constraint portal_users_district_code_check
  check (district_code is null or district_code ~ '^[A-Z]{2}[A-Z0-9]$');

-- ================================================================ Supabase RLS helper
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $fn$
      create or replace function sellers.is_state_admin_for(p_state char(2)) returns boolean
      language sql stable as $body$
        select coalesce(auth.jwt() ->> 'app_role', '') in ('STATE_ADMIN', 'DISTRICT_ADMIN')
           and coalesce(auth.jwt() ->> 'state_code', '') = p_state
      $body$
    $fn$;
  end if;
end;
$$;
