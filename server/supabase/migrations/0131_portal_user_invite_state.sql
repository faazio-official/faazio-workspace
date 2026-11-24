-- 0131_portal_user_invite_state.sql
-- Why: district admins were created with a temporary password the super admin had to copy and share
-- by hand. Invite-driven onboarding lets the admin set their own password: the creator mints the
-- login in a "pending invite" state with a single-use, time-bound token; accepting it sets the
-- password and flips the row to active.
--
-- Token storage mirrors 0098 (sellers.sub_users): only a SHA-256 hash is persisted, never the raw
-- capability token. The raw token is returned once to the creator and is never stored or logged.
--
-- Default 'active' + backfill keeps every existing live login working exactly as before.

alter table admins.portal_users
  add column if not exists invite_status text not null default 'active'
    check (invite_status in ('pending', 'active', 'expired')),
  add column if not exists invite_token_hash text,
  add column if not exists invite_expires_at timestamptz;

create unique index if not exists portal_users_invite_token_uniq
  on admins.portal_users (invite_token_hash)
  where invite_token_hash is not null;

-- Existing rows are already active; keep the invariant explicit for any pre-0131 'pending' value.
update admins.portal_users
   set invite_status = 'active'
 where invite_status <> 'active' and deleted_at is null;
