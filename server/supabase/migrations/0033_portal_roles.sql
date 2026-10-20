-- Faazio MVP — portal credentials for SELLER and STATE_ADMIN roles.
-- Authority: docs/architecture/web-portal.md ("Portal superadmin auth"), db-schema.md §12.19,
-- monolith-breakdown.md §1 (portal auth row), docs/RUNBOOKS/PORTAL_AUTH.md.
--
-- 0032 shipped the SUPER_ADMIN credential store. This migration widens it so the superadmin can
-- issue scoped logins: a SELLER login carries seller_id, a STATE_ADMIN login carries state_code.
-- Role/scope is enforced again in the token verifier (auth.PortalVerifier) — the DB check is the
-- second layer, not the only one.

alter table admins.portal_users
  drop constraint if exists portal_users_role_check;

alter table admins.portal_users
  add constraint portal_users_role_check
  check (role in ('SUPER_ADMIN', 'STATE_ADMIN', 'SELLER'));

alter table admins.portal_users
  add column if not exists seller_id text references sellers.sellers (seller_id) on delete cascade,
  add column if not exists state_code text;

alter table admins.portal_users
  drop constraint if exists portal_users_scope_check;

alter table admins.portal_users
  add constraint portal_users_scope_check check (
    (role = 'SUPER_ADMIN' and seller_id is null and state_code is null) or
    (role = 'SELLER'      and seller_id is not null and state_code is null) or
    (role = 'STATE_ADMIN' and seller_id is null and state_code is not null)
  );

alter table admins.portal_users
  drop constraint if exists portal_users_state_code_check;

alter table admins.portal_users
  add constraint portal_users_state_code_check
  check (state_code is null or state_code ~ '^[A-Z]{2}$');

create index if not exists portal_users_seller_idx on admins.portal_users (seller_id)
  where seller_id is not null;
create index if not exists portal_users_state_idx on admins.portal_users (state_code)
  where state_code is not null;
