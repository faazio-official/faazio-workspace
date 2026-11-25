-- Faazio MVP — district master soft delete + 7-day trash window.
-- Authority: docs/architecture/db-schema.md §12.42, monolith-breakdown.md §1 (districts row),
-- docs/architecture/web-portal.md (district coverage surface),
-- docs/user-interaction-workflow/seller/web-portal/super-admin-district-coverage.md.
--
-- Why: the coverage board could deactivate a district but its delete was an immediate hard delete,
-- refused only when a seller/admin/payout referenced it. There was no undo and no trash. A soft
-- delete gives the same one-week undo window as credentials (0128) and catalogue products (0089);
-- the gateway purger then removes the row for good once it is unreferenced.
--
-- Semantics:
--   deleted_at IS NULL          → the row is live (picker, admin lists, geo mirror, onboarding gates).
--   deleted_at IS NOT NULL      → trashed: hidden from the picker/list reads and the geo mirror, but
--                                 still a valid FK target for rows already pointing at it.
--   deleted_at < now()-7 days   → purged by the gateway worker (districts.Purger) and, where pg_cron
--                                 exists, by the scheduled function below — but ONLY when nothing
--                                 references the row (the RESTRICT FKs in 0047/0048/0055).
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal
-- per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table admins.district_master
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_reason text not null default ''
    check (octet_length(delete_reason) <= 500);

comment on column admins.district_master.deleted_at is
  'Soft-delete timestamp. Non-null = trashed: excluded from picker/admin lists, the geo mirror and new onboarding; purged 7 days after this instant once unreferenced.';
comment on column admins.district_master.delete_reason is
  'Why the district was deleted, from the superadmin confirmation. Kept with the row until it is purged.';

-- Trash listing + purge sweep.
create index if not exists district_master_deleted_idx
  on admins.district_master (deleted_at) where deleted_at is not null;

-- Purge rows past the trash window. Referenced districts are skipped: sellers.sellers (0047),
-- admins.district_admins / admins.portal_users (0048) and delivery.delivery_orders (0055) FK the
-- master ON DELETE RESTRICT. A referenced trashed row stays hidden until its references go away.
create or replace function admins.purge_deleted_districts(max_age interval default '7 days')
returns integer language plpgsql as $$
declare purged integer;
begin
  delete from admins.district_master d
   where d.deleted_at is not null
     and d.deleted_at < now() - max_age
     and not exists (select 1 from sellers.sellers s where s.district_code = d.district_code)
     and not exists (select 1 from admins.district_admins a where a.district_code = d.district_code)
     and not exists (select 1 from admins.portal_users p where p.district_code = d.district_code)
     and not exists (select 1 from delivery.delivery_orders o where o.district_code = d.district_code);
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Optional scheduler where pg_cron is installed; the gateway worker is the primary authority
-- (mirrors the 0089/0128 precedent). Idempotent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('faazio-purge-deleted-districts')
      where exists (select 1 from cron.job where jobname = 'faazio-purge-deleted-districts');
    perform cron.schedule('faazio-purge-deleted-districts', '41 * * * *',
      $cron$ select admins.purge_deleted_districts(); $cron$);
  end if;
end;
$$;
