-- Faazio MVP — seller self-service settings: staff sub-users + alert preferences.
-- Authority: docs/architecture/db-schema.md §12.36 and §1 (sellers context),
-- monolith-breakdown.md §1 (sellers row), user-interaction-workflow/seller/web-portal/settings.md.
--
-- Why: the seller console settings page offered "Notifications" and "Sub-users" tabs that wrote to
-- endpoints with no server counterpart, so every toggle/invite optimistically updated then rolled
-- back. These two tables plus the gateway handlers make those writes durable.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

-- ================================================================ alert preferences
-- One row per seller (the account, not a vendor). Absent row == all alerts on (defaults encoded in
-- the gateway read, so a never-toggled seller needs no row).
create table if not exists sellers.notification_preferences (
  seller_id   text primary key references sellers.sellers (seller_id) on delete cascade,
  new_order   boolean not null default true,
  low_stock   boolean not null default true,
  sla_breach  boolean not null default true,
  campaigns   boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ================================================================ staff sub-users
-- A seller's limited console logins. Invite-first: a row starts PENDING_INVITE and is not a portal
-- credential yet; this table is the seller-owned roster (portal_users stays the auth authority).
create table if not exists sellers.sub_users (
  sub_user_id   text primary key,
  seller_id     text not null references sellers.sellers (seller_id) on delete cascade,
  name          text not null,
  email         text not null,
  role          text not null default 'STAFF' check (role in ('STAFF', 'VIEWER')),
  status        text not null default 'PENDING_INVITE'
                  check (status in ('PENDING_INVITE', 'ACTIVE', 'REVOKED')),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists sub_users_seller_idx
  on sellers.sub_users (seller_id, created_at desc);

-- One live invite per email within a seller (revoked rows may be re-invited).
create unique index if not exists sub_users_seller_email_uniq
  on sellers.sub_users (seller_id, lower(email))
  where status <> 'REVOKED';

-- ================================================================ RLS + grants (Supabase only)
-- The gateway connects as service_role (bypasses RLS) and is the real authority. These policies are
-- defence-in-depth for direct Supabase anon/authenticated clients, mirroring 0049/0050: the owning
-- seller reads their own rows, super/state admins read in scope; writes stay service_role only.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on sellers.notification_preferences to authenticated;
    grant select on sellers.sub_users to authenticated;

    execute 'alter table sellers.notification_preferences enable row level security';
    execute 'alter table sellers.sub_users enable row level security';

    execute 'drop policy if exists seller_read on sellers.notification_preferences';
    execute $p$create policy seller_read on sellers.notification_preferences for select to authenticated
      using (seller_id = sellers.current_seller_id()
             or sellers.is_super()
             or exists (
               select 1 from sellers.sellers s
                where s.seller_id = notification_preferences.seller_id
                  and sellers.is_admin_for(s.state_code, s.district_code))) $p$;

    execute 'drop policy if exists seller_read on sellers.sub_users';
    execute $p$create policy seller_read on sellers.sub_users for select to authenticated
      using (seller_id = sellers.current_seller_id()
             or sellers.is_super()
             or exists (
               select 1 from sellers.sellers s
                where s.seller_id = sub_users.seller_id
                  and sellers.is_admin_for(s.state_code, s.district_code))) $p$;
  end if;
end;
$$;