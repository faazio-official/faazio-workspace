-- Faazio MVP — portal credential soft delete + 7-day trash window.
-- Authority: docs/architecture/db-schema.md §12.18, monolith-breakdown.md §1 (portal auth row),
-- docs/architecture/web-portal.md (credential surface), docs/user-interaction-workflow/seller/web-portal/credential-handover.md,
-- docs/RUNBOOKS/PORTAL_AUTH.md.
--
-- Why: the superadmin credentials board could disable a login but never remove one, so a mistyped or
-- abandoned credential lived forever. A hard delete is unrecoverable and silently loses the audit
-- trail; deactivating keeps a live-looking row in the roster. A soft delete gives a one-week undo
-- window (matching the catalogue product trash, 0089) and then the gateway purges the row for good.
--
-- Semantics:
--   deleted_at IS NULL          → the row is live (auth, roster lists, identity gates).
--   deleted_at IS NOT NULL      → trashed: every auth lookup, list and identity gate must exclude it.
--   deleted_at < now()-7 days   → purged by the gateway worker (portal.PurgeDeletedCredentials) and,
--                                 where pg_cron exists, by the scheduled function below.
--
-- The lower(email) uniqueness must NOT be blocked by a trashed row: otherwise deleting a mistyped
-- login would permanently burn that address. The full unique index is therefore replaced by a
-- partial one over live rows only. A trashed row's email is free the moment it is deleted — that is
-- the point of the trash window (undo restores the row, or the address is re-issued).
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal
-- per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table admins.portal_users
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_reason text not null default ''
    check (octet_length(delete_reason) <= 500);

comment on column admins.portal_users.deleted_at is
  'Soft-delete timestamp. Non-null = trashed: excluded from auth, admin lists and every identity gate; purged 7 days after this instant.';
comment on column admins.portal_users.delete_reason is
  'Why the credential was deleted, from the superadmin confirmation. Kept with the row until it is purged.';

-- Trash listing + purge sweep.
create index if not exists portal_users_deleted_idx
  on admins.portal_users (deleted_at) where deleted_at is not null;

-- Live-row-only email uniqueness (replaces the 0032 full index). Two statements so the swap is a
-- single migration step and re-running it is a no-op.
drop index if exists admins.portal_users_email_lower_uniq;
create unique index if not exists portal_users_email_lower_live_uniq
  on admins.portal_users (lower(email))
  where deleted_at is null;

-- Purge rows past the trash window. Sessions cascade (0032 FK on delete cascade) and a seller
-- sub-user's portal_user_id is set null (0098) — the roster row survives, the login is gone.
create or replace function admins.purge_deleted_portal_users(max_age interval default '7 days')
returns integer language plpgsql as $$
declare purged integer;
begin
  delete from admins.portal_users
   where deleted_at is not null
     and deleted_at < now() - max_age;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Optional scheduler where pg_cron is installed; the gateway worker is the primary authority
-- (mirrors the 0089 product-trash precedent). Idempotent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('faazio-purge-deleted-portal-users')
      where exists (select 1 from cron.job where jobname = 'faazio-purge-deleted-portal-users');
    perform cron.schedule('faazio-purge-deleted-portal-users', '23 * * * *',
      $cron$ select admins.purge_deleted_portal_users(); $cron$);
  end if;
end;
$$;
