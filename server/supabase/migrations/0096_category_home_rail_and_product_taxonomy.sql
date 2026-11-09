-- Faazio MVP — curated Home category rail + product ↔ taxonomy link.
-- Authority: docs/architecture/db-schema.md §12.30 (taxonomy) and §12.4 (catalog); monolith-breakdown.md §1.
--
-- Why: `GET /categories/rail` returned every active top-level MART/PHARMA category, so the Home header
-- rail could not be curated. `show_on_home_rail` lets a SUPER_ADMIN mark the exact chips that appear
-- (max 3 active globally; FOOD is not eligible). Seller-created products were tagged only with the GST
-- master label, so the taxonomy `search_query` the drill-in relies on was missing from their tokens;
-- `taxonomy_category_id` links each product to the same tree the rail/drill-in reads.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

begin;

alter table taxonomy.categories
  add column if not exists show_on_home_rail boolean not null default false;

comment on column taxonomy.categories.show_on_home_rail is
  'When true, the category is a Home header rail chip. Max 3 active globally; FOOD is not eligible.';

create index if not exists categories_home_rail_idx
  on taxonomy.categories (show_on_home_rail) where show_on_home_rail;

alter table catalog.products
  add column if not exists taxonomy_category_id text references taxonomy.categories (id);

create index if not exists products_taxonomy_category_idx
  on catalog.products (taxonomy_category_id) where taxonomy_category_id is not null;

-- Preserve today's first three Home chips (MART top-level, sort 0/16/28) so the rail never goes blank
-- on deploy. Superadmins can curate these afterwards from the portal.
update taxonomy.categories
   set show_on_home_rail = true
 where id in ('cat_smart_gadgets', 'cat_mobiles', 'cat_electronics')
   and app = 'MART'::app_brand
   and parent_id is null
   and is_active;

commit;
