-- 0098_sub_user_invites.sql
-- Complete the seller sub-user invite lifecycle and make seller alert preferences real.
--
-- Lifecycle (event-based, no scheduler):
--   invite (seller) -> one-time hashed accept token + expiry -> invitee accepts and sets a password
--   -> a scoped SELLER portal credential is minted with sub_role STAFF/VIEWER -> revoke deactivates it.
--
-- Authorization: a sub-user keeps app_role = 'SELLER' + the owning seller_id so the existing console
-- routes/UI work, while sub_role distinguishes owner (null) from STAFF (full) and VIEWER (read-only).
-- The gateway derives the role from the credential at login/refresh, never from the client.

-- ---------------------------------------------------------------- sellers.sub_users lifecycle
alter table sellers.sub_users
  add column if not exists invite_token_hash text,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists portal_user_id text,
  add column if not exists invited_by text,
  add column if not exists last_sent_at timestamptz;

create unique index if not exists sub_users_invite_token_uniq
  on sellers.sub_users (invite_token_hash) where invite_token_hash is not null;

create unique index if not exists sub_users_portal_user_uniq
  on sellers.sub_users (portal_user_id) where portal_user_id is not null;

alter table sellers.sub_users drop constraint if exists sub_users_portal_user_fk;
alter table sellers.sub_users
  add constraint sub_users_portal_user_fk
  foreign key (portal_user_id) references admins.portal_users (user_id) on delete set null;

-- ---------------------------------------------------------------- admins.portal_users sub-user link
alter table admins.portal_users
  add column if not exists sub_role text,
  add column if not exists sub_user_id text;

alter table admins.portal_users drop constraint if exists portal_users_sub_role_check;
alter table admins.portal_users
  add constraint portal_users_sub_role_check check (
    (sub_role is null and sub_user_id is null)
    or (
      role = 'SELLER'
      and seller_id is not null
      and sub_role in ('STAFF', 'VIEWER')
      and sub_user_id is not null
    )
  );

create unique index if not exists portal_users_sub_user_uniq
  on admins.portal_users (sub_user_id) where sub_user_id is not null;

alter table admins.portal_users drop constraint if exists portal_users_sub_user_fk;
alter table admins.portal_users
  add constraint portal_users_sub_user_fk
  foreign key (sub_user_id) references sellers.sub_users (sub_user_id) on delete set null;

-- The outbox must accept portal identities (`pu-*`), which are not checkout.users rows. Account
-- deletion already deletes outbox rows explicitly by user_id (checkout/repo.go), so the FK is not
-- the cleanup mechanism. Drop whichever FK points at checkout.users.
do $$
declare cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'notifications.outbox'::regclass
     and contype = 'f'
     and confrelid = 'checkout.users'::regclass
   limit 1;
  if cname is not null then
    execute format('alter table notifications.outbox drop constraint %I', cname);
  end if;
end $$;

-- Roster `last_login_at` follows the credential. A DB trigger keeps the two in sync on login without
-- a background job or a cross-context write from internal/portal.
create or replace function sellers.sync_sub_user_last_login() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.sub_user_id is not null and new.last_login_at is distinct from old.last_login_at then
    update sellers.sub_users
       set last_login_at = new.last_login_at
     where sub_user_id = new.sub_user_id;
  end if;
  return new;
end $$;

drop trigger if exists portal_users_sync_sub_user_login on admins.portal_users;
create trigger portal_users_sync_sub_user_login
  after update of last_login_at on admins.portal_users
  for each row execute function sellers.sync_sub_user_last_login();