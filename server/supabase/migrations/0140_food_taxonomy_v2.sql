-- Faazio — FOOD taxonomy v2: one curated tree, Tamil names, no descriptions, seller-item remap.
--
-- Authority: docs/architecture/db-schema.md §12.4 + §12.30,
-- docs/user-interaction-workflow/seller/web-portal/super-admin-categories.md,
-- server/gateway/internal/categories/{repo,handler,attributes}.go.
--
-- Why: the first FOOD seed (0139) landed beside the legacy 0067/0091/0092 FOOD shelves, so the
-- seller picker still showed dozens of old cuisine rows (and test rows). This migration makes the
-- curated list the only FOOD tree:
--   * drops the unused category `description` / `description_ta` columns (the gateway + portal no
--     longer read or write them; dish descriptions on directory.menus are untouched),
--   * keeps the five carousel roots + one listable leaf each, with Tamil names,
--   * keeps the mandatory 5% gst-food-standard link + FOOD header label on every row,
--   * remaps every FOOD seller item (catalog.products, directory.menus, directory.stores) onto the
--     new leaves so no listing is orphaned when the old rows are deleted,
--   * deletes every other FOOD category.
--
-- Idempotent: fixed ids + INSERT ... ON CONFLICT DO UPDATE; the remap/delete pass is safe to re-run.
-- The facet master itself is seeded by 0139 (deterministic `ag-`/`ao-` ids); this file leaves those
-- rows in place and only touches the category tree.
--
-- Additive + destructive (drops two unused columns); apply from a dev terminal via
-- server/supabase/apply-migration.sh per docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on
-- Render. Deploy the gateway that no longer selects description/description_ta with this migration.

begin;

-- ---------------------------------------------------------------- 1. remove category descriptions
alter table taxonomy.categories drop column if exists description;
alter table taxonomy.categories drop column if exists description_ta;

-- ---------------------------------------------------------------- 2. curated FOOD tree (Tamil names)
insert into taxonomy.categories
  (id, app, name, slug, icon_url, parent_id, search_query, is_active,
   show_on_home_rail, sort_order, created_by, updated_by, name_ta)
values
  ('cat-burger', 'FOOD'::app_brand, 'Burger', 'burger', null, null, null,
   true, false, 9700, 'superadmin-seed', 'superadmin-seed', 'பர்கர்'),
  ('cat-dosa', 'FOOD'::app_brand, 'Dosa', 'dosa', null, null, null,
   true, false, 9701, 'superadmin-seed', 'superadmin-seed', 'தோசை'),
  ('cat-fried-rice', 'FOOD'::app_brand, 'Fried Rice', 'fried-rice', null, null, null,
   true, false, 9702, 'superadmin-seed', 'superadmin-seed', 'ஃப்ரைடு ரைஸ்'),
  ('cat-chicken', 'FOOD'::app_brand, 'Chicken', 'chicken', null, null, null,
   true, false, 9703, 'superadmin-seed', 'superadmin-seed', 'சிக்கன்'),
  ('cat-thali', 'FOOD'::app_brand, 'Thali', 'thali', null, null, null,
   true, false, 9704, 'superadmin-seed', 'superadmin-seed', 'தாலி'),
  ('sub-burger', 'FOOD'::app_brand, 'Burger', 'burger', null, 'cat-burger', 'Burger',
   true, false, 9710, 'superadmin-seed', 'superadmin-seed', 'பர்கர்'),
  ('sub-dosa', 'FOOD'::app_brand, 'Dosa', 'dosa', null, 'cat-dosa', 'Dosa',
   true, false, 9711, 'superadmin-seed', 'superadmin-seed', 'தோசை'),
  ('sub-fried-rice', 'FOOD'::app_brand, 'Fried Rice', 'fried-rice', null, 'cat-fried-rice', 'Fried Rice',
   true, false, 9712, 'superadmin-seed', 'superadmin-seed', 'ஃப்ரைடு ரைஸ்'),
  ('sub-chicken', 'FOOD'::app_brand, 'Chicken', 'chicken', null, 'cat-chicken', 'Chicken',
   true, false, 9713, 'superadmin-seed', 'superadmin-seed', 'சிக்கன்'),
  ('sub-thali', 'FOOD'::app_brand, 'Thali', 'thali', null, 'cat-thali', 'Thali',
   true, false, 9714, 'superadmin-seed', 'superadmin-seed', 'தாலி')
on conflict (id) do update
  set app = excluded.app,
      name = excluded.name,
      slug = excluded.slug,
      icon_url = excluded.icon_url,
      parent_id = excluded.parent_id,
      search_query = excluded.search_query,
      is_active = true,
      show_on_home_rail = false,
      sort_order = excluded.sort_order,
      updated_by = excluded.updated_by,
      name_ta = excluded.name_ta,
      deleted_at = null,
      delete_reason = '',
      updated_at = now();

-- ---------------------------------------------------------------- 3. mandatory FOOD GST (copy slab %)
insert into tax.category_gst_rates
  (category_id, gst_rate_pct, gst_rate_category_id, is_active, updated_by)
select c.id, r.gst_rate_pct, r.id, true, 'superadmin-seed'
  from taxonomy.categories c
  join tax.gst_rate_categories r on r.id = 'gst-food-standard'
 where c.id in (
   'cat-burger', 'cat-dosa', 'cat-fried-rice', 'cat-chicken', 'cat-thali',
   'sub-burger', 'sub-dosa', 'sub-fried-rice', 'sub-chicken', 'sub-thali'
 )
on conflict (category_id) do update
  set gst_rate_pct = excluded.gst_rate_pct,
      gst_rate_category_id = excluded.gst_rate_category_id,
      is_active = true,
      updated_by = excluded.updated_by,
      updated_at = now();

-- ---------------------------------------------------------------- 4. FOOD header label
insert into taxonomy.category_headers (category_id, header)
select id, 'FOOD' from taxonomy.categories where id in (
   'cat-burger', 'cat-dosa', 'cat-fried-rice', 'cat-chicken', 'cat-thali',
   'sub-burger', 'sub-dosa', 'sub-fried-rice', 'sub-chicken', 'sub-thali'
 )
on conflict (category_id, header) do nothing;

-- ---------------------------------------------------------------- 5. remap seller items
-- Every FOOD listing lands on one of the five new leaves. Keyword order is intentional: a thali
-- containing rice still lands in Thali; biryani/rice/noodles land in Fried Rice; the rest default to
-- Chicken (the broadest main-dish pool) so nothing is left on a deleted category.

with mapped as (
  select p.id,
         case
           when hay like '%burger%' or hay like '%sandwich%' or hay like '%patty%' then 'sub-burger'
           when hay like '%dosa%' or hay like '%dosai%' or hay like '%idli%' or hay like '%vada%'
             or hay like '%uttapam%' or hay like '%sambar%' or hay like '%pongal%' or hay like '%appam%'
             then 'sub-dosa'
           when hay like '%thali%' or hay like '%meals%' or hay like '%tiffin%' or hay like '%combo%'
             or hay like '%platter%' then 'sub-thali'
           when hay like '%fried rice%' or hay like '%biryani%' or hay like '%pulao%'
             or hay like '%rice%' or hay like '%noodle%' or hay like '%chow mein%'
             or hay like '%chowmein%' or hay like '%schezwan%' or hay like '%manchurian%'
             or hay like '%chinese%' or hay like '%pasta%' or hay like '%pizza%'
             then 'sub-fried-rice'
           else 'sub-chicken'
         end as leaf_id
    from catalog.products p
   cross join lateral (
     select lower(coalesce(p.name, '') || ' ' || coalesce(p.category, '')) as hay
   ) h
   where p.app = 'FOOD'::app_brand
)
update catalog.products p
   set taxonomy_category_id = c.id,
       category = c.name,
       updated_at = now()
  from mapped m
  join taxonomy.categories c on c.id = m.leaf_id
 where p.id = m.id;

with mapped as (
  select m.venue_id, m.dish_id,
         case
           when hay like '%burger%' or hay like '%sandwich%' or hay like '%patty%' then 'sub-burger'
           when hay like '%dosa%' or hay like '%dosai%' or hay like '%idli%' or hay like '%vada%'
             or hay like '%uttapam%' or hay like '%sambar%' or hay like '%pongal%' or hay like '%appam%'
             then 'sub-dosa'
           when hay like '%thali%' or hay like '%meals%' or hay like '%tiffin%' or hay like '%combo%'
             or hay like '%platter%' then 'sub-thali'
           when hay like '%fried rice%' or hay like '%biryani%' or hay like '%pulao%'
             or hay like '%rice%' or hay like '%noodle%' or hay like '%chow mein%'
             or hay like '%chowmein%' or hay like '%schezwan%' or hay like '%manchurian%'
             or hay like '%chinese%' or hay like '%pasta%' or hay like '%pizza%'
             then 'sub-fried-rice'
           else 'sub-chicken'
         end as leaf_id
    from directory.menus m
    join directory.dining_venues v on v.id = m.venue_id
   cross join lateral (
     select lower(coalesce(m.name, '') || ' ' || coalesce(m.cuisine, '')) as hay
   ) h
   where v.app = 'FOOD'::app_brand
)
update directory.menus m
   set section_id = c.parent_id,
       sub_category_id = c.id
  from mapped x
  join taxonomy.categories c on c.id = x.leaf_id
 where m.venue_id = x.venue_id and m.dish_id = x.dish_id;

with mapped as (
  select s.id,
         case
           when hay like '%burger%' or hay like '%sandwich%' or hay like '%patty%' then 'sub-burger'
           when hay like '%dosa%' or hay like '%dosai%' or hay like '%idli%' or hay like '%vada%'
             or hay like '%uttapam%' or hay like '%sambar%' or hay like '%pongal%' or hay like '%appam%'
             then 'sub-dosa'
           when hay like '%thali%' or hay like '%meals%' or hay like '%tiffin%' or hay like '%combo%'
             or hay like '%platter%' then 'sub-thali'
           when hay like '%fried rice%' or hay like '%biryani%' or hay like '%pulao%'
             or hay like '%rice%' or hay like '%noodle%' or hay like '%chow mein%'
             or hay like '%chowmein%' or hay like '%schezwan%' or hay like '%manchurian%'
             or hay like '%chinese%' or hay like '%pasta%' or hay like '%pizza%'
             then 'sub-fried-rice'
           else 'sub-chicken'
         end as leaf_id
    from directory.stores s
   cross join lateral (
     select lower(coalesce(s.name, '') || ' ' || coalesce(array_to_string(s.categories, ' '), '')) as hay
   ) h
   where s.app = 'FOOD'::app_brand
)
update directory.stores s
   set seller_category_id = c.parent_id
  from mapped x
  join taxonomy.categories c on c.id = x.leaf_id
 where s.id = x.id;

-- Defensive: nothing should still point at an old FOOD row, but clearing leftovers guarantees the
-- delete below cannot be blocked by a stray reference.
update catalog.products p
   set taxonomy_category_id = null
 where p.taxonomy_category_id in (
   select id from taxonomy.categories
    where app = 'FOOD'::app_brand
      and id not in ('cat-burger','cat-dosa','cat-fried-rice','cat-chicken','cat-thali',
                     'sub-burger','sub-dosa','sub-fried-rice','sub-chicken','sub-thali')
 );
update directory.menus m
   set section_id = null
 where m.section_id in (
   select id from taxonomy.categories
    where app = 'FOOD'::app_brand
      and id not in ('cat-burger','cat-dosa','cat-fried-rice','cat-chicken','cat-thali',
                     'sub-burger','sub-dosa','sub-fried-rice','sub-chicken','sub-thali')
 );
update directory.menus m
   set sub_category_id = null
 where m.sub_category_id in (
   select id from taxonomy.categories
    where app = 'FOOD'::app_brand
      and id not in ('cat-burger','cat-dosa','cat-fried-rice','cat-chicken','cat-thali',
                     'sub-burger','sub-dosa','sub-fried-rice','sub-chicken','sub-thali')
 );
update directory.stores s
   set seller_category_id = null
 where s.seller_category_id in (
   select id from taxonomy.categories
    where app = 'FOOD'::app_brand
      and id not in ('cat-burger','cat-dosa','cat-fried-rice','cat-chicken','cat-thali',
                     'sub-burger','sub-dosa','sub-fried-rice','sub-chicken','sub-thali')
 );

-- ---------------------------------------------------------------- 6. delete every other FOOD row
-- Children first: the parent_id self-FK has no cascade, so loop until no childless old row remains.
do $$
declare
  v_deleted int;
  v_total   int := 0;
begin
  loop
    delete from taxonomy.categories c
     where c.app = 'FOOD'::app_brand
       and c.id not in ('cat-burger','cat-dosa','cat-fried-rice','cat-chicken','cat-thali',
                        'sub-burger','sub-dosa','sub-fried-rice','sub-chicken','sub-thali')
       and not exists (select 1 from taxonomy.categories ch where ch.parent_id = c.id);
    get diagnostics v_deleted = row_count;
    v_total := v_total + v_deleted;
    exit when v_deleted = 0;
  end loop;
  raise notice 'seed 0140: removed % old FOOD category row(s)', v_total;
end $$;

commit;
