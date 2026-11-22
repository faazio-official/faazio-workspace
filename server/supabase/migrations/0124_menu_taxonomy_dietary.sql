-- Faazio MVP — restaurant menu section/sub-category + dietary classification (additive).
-- Authority: docs/architecture/db-schema.md, monolith-breakdown.md §1 (directory.menus),
-- docs/user-interaction-workflow/seller/catalog/inventory.md,
-- docs/user-interaction-workflow/seller/web-portal/menu-creation.md.
--
-- Why: a restaurant owner builds a dish under a leaf sub-category of the superadmin taxonomy
-- (parent category = section header, leaf = the selectable target). The menu row carried no
-- section/sub-category link and only a binary is_veg flag, so the portal could not group dishes
-- the way the customer app does (section → sub-category) and could not express an EGG dish.
--
--   section_id       — the section header (parent category) the dish is grouped under. Resolved from
--                      the picked leaf's parent when the caller omits it; kept denormalised so a
--                      rename/repare of the taxonomy does not require rewriting every dish.
--   sub_category_id  — the leaf category the dish belongs to (the only selectable level).
--   dietary_type     — VEG / NON_VEG / EGG. NULL for legacy rows; is_veg stays the source of truth for
--                      the veg mark, and the gateway keeps the two consistent on every write.
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

alter table directory.menus
  add column if not exists section_id      text references taxonomy.categories (id),
  add column if not exists sub_category_id text references taxonomy.categories (id),
  add column if not exists dietary_type    text;

-- Constrain dietary_type to the three culinary values the portal offers (NULL = unclassified).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menus_dietary_type_check'
  ) then
    alter table directory.menus
      add constraint menus_dietary_type_check
      check (dietary_type is null or dietary_type in ('VEG','NON_VEG','EGG'));
  end if;
end $$;

create index if not exists menus_sub_category_idx on directory.menus (sub_category_id);
create index if not exists menus_section_idx on directory.menus (section_id);

-- RLS is unchanged: directory.menus remains public catalog data (anon_read from 0013); the new
-- columns carry no PII, so no policy change is needed.
