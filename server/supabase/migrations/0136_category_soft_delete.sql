-- Faazio MVP — category taxonomy soft delete + 7-day trash window.
-- Authority: docs/architecture/db-schema.md §12.30, monolith-breakdown.md §1 (categories row),
-- docs/architecture/web-portal.md (superadmin category surface),
-- docs/user-interaction-workflow/seller/web-portal/super-admin-categories.md.
--
-- Why: the categories page could only deactivate a row (`is_active = false`) or run a delete that
-- permanently hid it with no undo. A mistyped taxonomy row was therefore unrecoverable, and a hidden
-- row was indistinguishable from a deactivated one. A soft delete gives the same one-week undo window
-- as credentials (0128), districts (0134) and catalogue products (0089): the row moves to the trash,
-- can be restored, or be purged early; the gateway purger removes it for good after 7 days.
--
-- Semantics:
--   deleted_at IS NULL           → the row is live (app reads, seller pickers, admin lists).
--   deleted_at IS NOT NULL       → trashed: excluded from every read, the rail, the drill-in, seller
--                                  pickers and the admin list; still a valid FK target for rows that
--                                  already point at it (products, stores, menus).
--   deleted_at < now()-7 days    → purged by the gateway worker (categories.Purger) and, where pg_cron
--                                  exists, by the scheduled function below — but ONLY when nothing and
--                                  no child row still references the node.
--
-- `is_active` keeps its own meaning (a plain hide, no trash); a delete sets both is_active = false and
-- deleted_at = now() for the node and its whole subtree.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal
-- per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table taxonomy.categories
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_reason text not null default ''
    check (octet_length(delete_reason) <= 500);

comment on column taxonomy.categories.deleted_at is
  'Soft-delete timestamp. Non-null = trashed: excluded from app reads, the rail and the admin list; purged 7 days after this instant once unreferenced.';
comment on column taxonomy.categories.delete_reason is
  'Why the category was deleted, from the superadmin confirmation. Kept with the row until it is purged.';

-- Trash listing + purge sweep.
create index if not exists categories_deleted_idx
  on taxonomy.categories (deleted_at) where deleted_at is not null;

-- Live-row index used by every app/admin read (the partial active index from 0067 stays untouched).
create index if not exists categories_live_idx
  on taxonomy.categories (app, sort_order) where deleted_at is null;

-- Purge one pass: remove trashed rows that nothing references. Child rows are removed before their
-- parent across sweeps (a parent with a child row still present is skipped), and a row still used by
-- a listing, store or menu is kept until that reference goes away — the FKs are NO ACTION/RESTRICT.
create or replace function taxonomy.purge_deleted_categories(max_age interval default '7 days')
returns integer language plpgsql as $$
declare purged integer;
begin
  delete from taxonomy.categories c
   where c.deleted_at is not null
     and c.deleted_at < now() - max_age
     and not exists (select 1 from taxonomy.categories k where k.parent_id = c.id)
     and not exists (select 1 from catalog.products p where p.taxonomy_category_id = c.id)
     and not exists (select 1 from directory.stores s where s.seller_category_id = c.id)
     and not exists (select 1 from directory.menus m
                      where m.sub_category_id = c.id or m.section_id = c.id);
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Optional scheduler where pg_cron is installed; the gateway worker is the primary authority
-- (mirrors the 0089/0128/0134 precedent). Idempotent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'faazio-purge-deleted-categories') then
      perform cron.unschedule('faazio-purge-deleted-categories');
    end if;
    perform cron.schedule('faazio-purge-deleted-categories', '53 * * * *',
      $cron$ select taxonomy.purge_deleted_categories(); $cron$);
  end if;
end;
$$;
