-- Faazio — FOOD taxonomy seed: carousel roots + dish facet master (migration 0139).
--
-- Authority: docs/architecture/db-schema.md §12.4 + §12.30,
-- docs/user-interaction-workflow/seller/web-portal/super-admin-categories.md,
-- server/gateway/internal/categories/repo.go (Create / replaceSubCategories / setCategoryGST)
-- and server/gateway/internal/categories/attributes.go (ReplaceAttributeGroups).
--
-- Seeds, for the FOOD app, the five seller carousel roots the portal exposes (Burger, Dosa,
-- Fried Rice, Chicken, Thali), one listable leaf under each, mandatory 5% FOOD GST, the FOOD
-- header label, and the superadmin-owned facet master (Dietary Preference on every leaf; Patty,
-- Patty Type, Cheese Type, Dressing / Sauce, Toppings, Bun Type and Region / Cuisine Origin on
-- the Burger leaf).
--
-- Idempotent: stable ids + INSERT ... ON CONFLICT DO UPDATE/NOTHING. Re-running never orphans a
-- seller dish tag because group/option ids never change. Tamil copy is intentionally left ''
-- (the raw-SQL path allows it; the portal form still requires it on manual edits).
--
-- Additive; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

-- ---------------------------------------------------------------- 1. validate FOOD GST slab
do $$
declare
  v_rate int;
begin
  select gst_rate_pct into v_rate
    from tax.gst_rate_categories
   where id = 'gst-food-standard'
     and sector = 'FOOD'::app_brand
     and is_active;
  if v_rate is null then
    raise exception 'seed 0139: FOOD GST slab gst-food-standard is missing or inactive';
  end if;
  if v_rate <> 5 then
    raise exception 'seed 0139: gst-food-standard is %%% not 5%%', v_rate;
  end if;
end $$;

-- ---------------------------------------------------------------- 2. validate seed rows
-- Non-empty names, unique (parent_id, name) against live FOOD rows not owned by this seed, and
-- a valid facet input type. A failed check aborts before any write.
do $$
declare
  v_dup text;
begin
  with seed(id, parent_id, name) as (values
    ('cat-burger', null, 'Burger'),
    ('cat-dosa', null, 'Dosa'),
    ('cat-fried-rice', null, 'Fried Rice'),
    ('cat-chicken', null, 'Chicken'),
    ('cat-thali', null, 'Thali'),
    ('sub-burger', 'cat-burger', 'Burger'),
    ('sub-dosa', 'cat-dosa', 'Dosa'),
    ('sub-fried-rice', 'cat-fried-rice', 'Fried Rice'),
    ('sub-chicken', 'cat-chicken', 'Chicken'),
    ('sub-thali', 'cat-thali', 'Thali')
  )
  select string_agg(s.name || ' (' || s.id || ')', ', ') into v_dup
    from seed s
    join taxonomy.categories c
      on c.app = 'FOOD'::app_brand
     and c.deleted_at is null
     and c.id <> s.id
     and coalesce(c.parent_id, '') = coalesce(s.parent_id, '')
     and lower(c.name) = lower(s.name);
  if v_dup is not null then
    raise exception 'seed 0139: duplicate FOOD (parent, name): %', v_dup;
  end if;
  if exists (select 1 from (values
      ('ag-burger-dietary-preference', 'Dietary Preference', 'single_select'), ('ag-dosa-dietary-preference', 'Dietary Preference', 'single_select'), ('ag-fried-rice-dietary-preference', 'Dietary Preference', 'single_select'), ('ag-chicken-dietary-preference', 'Dietary Preference', 'single_select'), ('ag-thali-dietary-preference', 'Dietary Preference', 'single_select'), ('ag-patty', 'Patty', 'multi_select'), ('ag-patty-type', 'Patty Type', 'multi_select'), ('ag-cheese-type', 'Cheese Type', 'multi_select'), ('ag-dressing-sauce', 'Dressing / Sauce', 'multi_select'), ('ag-toppings', 'Toppings', 'multi_select'), ('ag-bun-type', 'Bun Type', 'single_select'), ('ag-region-cuisine-origin', 'Region / Cuisine Origin', 'single_select')
  ) as g(id, display_name, input_type)
     where trim(display_name) = '' or input_type not in ('single_select', 'multi_select')) then
    raise exception 'seed 0139: invalid facet group name or input_type';
  end if;
end $$;

-- ---------------------------------------------------------------- 3. taxonomy.categories
insert into taxonomy.categories
  (id, app, name, slug, description, icon_url, parent_id, search_query, is_active,
   show_on_home_rail, sort_order, created_by, updated_by, name_ta, description_ta)
values
  ('cat-burger', 'FOOD'::app_brand, 'Burger', 'burger', null, null, null, null,
   true, false, 9700, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('cat-dosa', 'FOOD'::app_brand, 'Dosa', 'dosa', null, null, null, null,
   true, false, 9701, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('cat-fried-rice', 'FOOD'::app_brand, 'Fried Rice', 'fried-rice', null, null, null, null,
   true, false, 9702, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('cat-chicken', 'FOOD'::app_brand, 'Chicken', 'chicken', null, null, null, null,
   true, false, 9703, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('cat-thali', 'FOOD'::app_brand, 'Thali', 'thali', null, null, null, null,
   true, false, 9704, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('sub-burger', 'FOOD'::app_brand, 'Burger', 'burger', null, null, 'cat-burger', 'Burger',
   true, false, 9710, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('sub-dosa', 'FOOD'::app_brand, 'Dosa', 'dosa', null, null, 'cat-dosa', 'Dosa',
   true, false, 9711, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('sub-fried-rice', 'FOOD'::app_brand, 'Fried Rice', 'fried-rice', null, null, 'cat-fried-rice', 'Fried Rice',
   true, false, 9712, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('sub-chicken', 'FOOD'::app_brand, 'Chicken', 'chicken', null, null, 'cat-chicken', 'Chicken',
   true, false, 9713, 'superadmin-seed', 'superadmin-seed', '', ''),
  ('sub-thali', 'FOOD'::app_brand, 'Thali', 'thali', null, null, 'cat-thali', 'Thali',
   true, false, 9714, 'superadmin-seed', 'superadmin-seed', '', '')
on conflict (id) do update
  set app = excluded.app,
      name = excluded.name,
      slug = excluded.slug,
      description = excluded.description,
      icon_url = excluded.icon_url,
      parent_id = excluded.parent_id,
      search_query = excluded.search_query,
      is_active = excluded.is_active,
      show_on_home_rail = excluded.show_on_home_rail,
      sort_order = excluded.sort_order,
      updated_by = excluded.updated_by,
      name_ta = excluded.name_ta,
      description_ta = excluded.description_ta,
      deleted_at = null,
      delete_reason = '',
      updated_at = now();

-- ---------------------------------------------------------------- 4. mandatory FOOD GST (copy slab %)
insert into tax.category_gst_rates
  (category_id, gst_rate_pct, gst_rate_category_id, is_active, updated_by)
select c.id, r.gst_rate_pct, r.id, true, 'superadmin-seed'
  from taxonomy.categories c
  join tax.gst_rate_categories r on r.id = 'gst-food-standard'
 where c.id in (
   'cat-burger', 'cat-dosa', 'cat-fried-rice', 'cat-chicken', 'cat-thali', 'sub-burger', 'sub-dosa', 'sub-fried-rice', 'sub-chicken', 'sub-thali'
 )
on conflict (category_id) do update
  set gst_rate_pct = excluded.gst_rate_pct,
      gst_rate_category_id = excluded.gst_rate_category_id,
      is_active = true,
      updated_by = excluded.updated_by,
      updated_at = now();

-- ---------------------------------------------------------------- 5. FOOD header label (never MAIN_APP_HEADER)
insert into taxonomy.category_headers (category_id, header)
select id, 'FOOD' from taxonomy.categories where id in (
   'cat-burger', 'cat-dosa', 'cat-fried-rice', 'cat-chicken', 'cat-thali', 'sub-burger', 'sub-dosa', 'sub-fried-rice', 'sub-chicken', 'sub-thali'
 )
on conflict (category_id, header) do nothing;

-- ---------------------------------------------------------------- 6. facet groups
insert into taxonomy.subcategory_attribute_groups
  (id, subcategory_id, slug, display_name, input_type, display_order)
values
  ('ag-burger-dietary-preference', 'sub-burger', 'dietary-preference', 'Dietary Preference', 'single_select', 0),
  ('ag-dosa-dietary-preference', 'sub-dosa', 'dietary-preference', 'Dietary Preference', 'single_select', 0),
  ('ag-fried-rice-dietary-preference', 'sub-fried-rice', 'dietary-preference', 'Dietary Preference', 'single_select', 0),
  ('ag-chicken-dietary-preference', 'sub-chicken', 'dietary-preference', 'Dietary Preference', 'single_select', 0),
  ('ag-thali-dietary-preference', 'sub-thali', 'dietary-preference', 'Dietary Preference', 'single_select', 0),
  ('ag-patty', 'sub-burger', 'patty', 'Patty', 'multi_select', 1),
  ('ag-patty-type', 'sub-burger', 'patty-type', 'Patty Type', 'multi_select', 2),
  ('ag-cheese-type', 'sub-burger', 'cheese-type', 'Cheese Type', 'multi_select', 3),
  ('ag-dressing-sauce', 'sub-burger', 'dressing-sauce', 'Dressing / Sauce', 'multi_select', 4),
  ('ag-toppings', 'sub-burger', 'toppings', 'Toppings', 'multi_select', 5),
  ('ag-bun-type', 'sub-burger', 'bun-type', 'Bun Type', 'single_select', 6),
  ('ag-region-cuisine-origin', 'sub-burger', 'region-cuisine-origin', 'Region / Cuisine Origin', 'single_select', 7)
on conflict (id) do update
  set subcategory_id = excluded.subcategory_id,
      slug = excluded.slug,
      display_name = excluded.display_name,
      input_type = excluded.input_type,
      display_order = excluded.display_order,
      updated_at = now();

-- ---------------------------------------------------------------- 7. facet options
insert into taxonomy.attribute_options
  (id, group_id, parent_filter_tab, label, icon_url, keywords, display_order)
values
  ('ao-burger-dietary-preference-veg', 'ag-burger-dietary-preference', null, 'Veg', null,
   array['veg']::text[], 0),
  ('ao-burger-dietary-preference-non-veg', 'ag-burger-dietary-preference', null, 'Non-Veg', null,
   array['non-veg']::text[], 1),
  ('ao-burger-dietary-preference-egg', 'ag-burger-dietary-preference', null, 'Egg', null,
   array['egg']::text[], 2),
  ('ao-burger-dietary-preference-jain', 'ag-burger-dietary-preference', null, 'Jain', null,
   array['jain']::text[], 3),
  ('ao-burger-dietary-preference-vegan', 'ag-burger-dietary-preference', null, 'Vegan', null,
   array['vegan']::text[], 4),
  ('ao-dosa-dietary-preference-veg', 'ag-dosa-dietary-preference', null, 'Veg', null,
   array['veg']::text[], 0),
  ('ao-dosa-dietary-preference-non-veg', 'ag-dosa-dietary-preference', null, 'Non-Veg', null,
   array['non-veg']::text[], 1),
  ('ao-dosa-dietary-preference-egg', 'ag-dosa-dietary-preference', null, 'Egg', null,
   array['egg']::text[], 2),
  ('ao-dosa-dietary-preference-jain', 'ag-dosa-dietary-preference', null, 'Jain', null,
   array['jain']::text[], 3),
  ('ao-dosa-dietary-preference-vegan', 'ag-dosa-dietary-preference', null, 'Vegan', null,
   array['vegan']::text[], 4),
  ('ao-fried-rice-dietary-preference-veg', 'ag-fried-rice-dietary-preference', null, 'Veg', null,
   array['veg']::text[], 0),
  ('ao-fried-rice-dietary-preference-non-veg', 'ag-fried-rice-dietary-preference', null, 'Non-Veg', null,
   array['non-veg']::text[], 1),
  ('ao-fried-rice-dietary-preference-egg', 'ag-fried-rice-dietary-preference', null, 'Egg', null,
   array['egg']::text[], 2),
  ('ao-fried-rice-dietary-preference-jain', 'ag-fried-rice-dietary-preference', null, 'Jain', null,
   array['jain']::text[], 3),
  ('ao-fried-rice-dietary-preference-vegan', 'ag-fried-rice-dietary-preference', null, 'Vegan', null,
   array['vegan']::text[], 4),
  ('ao-chicken-dietary-preference-veg', 'ag-chicken-dietary-preference', null, 'Veg', null,
   array['veg']::text[], 0),
  ('ao-chicken-dietary-preference-non-veg', 'ag-chicken-dietary-preference', null, 'Non-Veg', null,
   array['non-veg']::text[], 1),
  ('ao-chicken-dietary-preference-egg', 'ag-chicken-dietary-preference', null, 'Egg', null,
   array['egg']::text[], 2),
  ('ao-chicken-dietary-preference-jain', 'ag-chicken-dietary-preference', null, 'Jain', null,
   array['jain']::text[], 3),
  ('ao-chicken-dietary-preference-vegan', 'ag-chicken-dietary-preference', null, 'Vegan', null,
   array['vegan']::text[], 4),
  ('ao-thali-dietary-preference-veg', 'ag-thali-dietary-preference', null, 'Veg', null,
   array['veg']::text[], 0),
  ('ao-thali-dietary-preference-non-veg', 'ag-thali-dietary-preference', null, 'Non-Veg', null,
   array['non-veg']::text[], 1),
  ('ao-thali-dietary-preference-egg', 'ag-thali-dietary-preference', null, 'Egg', null,
   array['egg']::text[], 2),
  ('ao-thali-dietary-preference-jain', 'ag-thali-dietary-preference', null, 'Jain', null,
   array['jain']::text[], 3),
  ('ao-thali-dietary-preference-vegan', 'ag-thali-dietary-preference', null, 'Vegan', null,
   array['vegan']::text[], 4),
  ('ao-patty-chicken', 'ag-patty', 'Chicken', 'Chicken', null,
   array['chicken']::text[], 0),
  ('ao-patty-fried-chicken', 'ag-patty', 'Chicken', 'Fried Chicken', null,
   array['fried chicken']::text[], 1),
  ('ao-patty-grilled-chicken', 'ag-patty', 'Chicken', 'Grilled Chicken', null,
   array['grilled chicken']::text[], 2),
  ('ao-patty-chicken-barbeque', 'ag-patty', 'Chicken', 'Chicken Barbeque', null,
   array['chicken barbeque']::text[], 3),
  ('ao-patty-tandoori-chicken', 'ag-patty', 'Chicken', 'Tandoori Chicken', null,
   array['tandoori chicken']::text[], 4),
  ('ao-patty-peri-peri-chicken', 'ag-patty', 'Chicken', 'Peri Peri Chicken', null,
   array['peri peri chicken']::text[], 5),
  ('ao-patty-smoked-chicken', 'ag-patty', 'Chicken', 'Smoked Chicken', null,
   array['smoked chicken']::text[], 6),
  ('ao-patty-butter-chicken', 'ag-patty', 'Chicken', 'Butter Chicken', null,
   array['butter chicken']::text[], 7),
  ('ao-patty-chicken-makhani', 'ag-patty', 'Chicken', 'Chicken Makhani', null,
   array['chicken makhani']::text[], 8),
  ('ao-patty-chicken-kebab', 'ag-patty', 'Chicken', 'Chicken Kebab', null,
   array['chicken kebab']::text[], 9),
  ('ao-patty-chicken-momo', 'ag-patty', 'Chicken', 'Chicken Momo', null,
   array['chicken momo']::text[], 10),
  ('ao-patty-chicken-shawarma', 'ag-patty', 'Chicken', 'Chicken Shawarma', null,
   array['chicken shawarma']::text[], 11),
  ('ao-patty-chicken-salami', 'ag-patty', 'Chicken', 'Chicken Salami', null,
   array['chicken salami']::text[], 12),
  ('ao-patty-fillet-chicken', 'ag-patty', 'Chicken', 'Fillet Chicken', null,
   array['fillet chicken']::text[], 13),
  ('ao-patty-chicken-keema', 'ag-patty', 'Chicken', 'Chicken Keema', null,
   array['chicken keema']::text[], 14),
  ('ao-patty-chicken-steak', 'ag-patty', 'Chicken', 'Chicken Steak', null,
   array['chicken steak']::text[], 15),
  ('ao-patty-chicken-seekh', 'ag-patty', 'Chicken', 'Chicken Seekh', null,
   array['chicken seekh']::text[], 16),
  ('ao-patty-pulled-chicken', 'ag-patty', 'Chicken', 'Pulled Chicken', null,
   array['pulled chicken']::text[], 17),
  ('ao-patty-chicken-popcorn', 'ag-patty', 'Chicken', 'Chicken Popcorn', null,
   array['chicken popcorn']::text[], 18),
  ('ao-patty-chicken-65', 'ag-patty', 'Chicken', 'Chicken 65', null,
   array['chicken 65']::text[], 19),
  ('ao-patty-roasted-chicken', 'ag-patty', 'Chicken', 'Roasted Chicken', null,
   array['roasted chicken']::text[], 20),
  ('ao-patty-chicken-sausage', 'ag-patty', 'Chicken', 'Chicken Sausage', null,
   array['chicken sausage']::text[], 21),
  ('ao-patty-chicken-strip', 'ag-patty', 'Chicken', 'Chicken Strip', null,
   array['chicken strip']::text[], 22),
  ('ao-patty-chicken-breast', 'ag-patty', 'Chicken', 'Chicken Breast', null,
   array['chicken breast']::text[], 23),
  ('ao-patty-chicken-cafreal', 'ag-patty', 'Chicken', 'Chicken Cafreal', null,
   array['chicken cafreal']::text[], 24),
  ('ao-patty-meat', 'ag-patty', 'Mutton & Seafood', 'Meat', null,
   array['meat']::text[], 0),
  ('ao-patty-mutton', 'ag-patty', 'Mutton & Seafood', 'Mutton', null,
   array['mutton']::text[], 1),
  ('ao-patty-fish', 'ag-patty', 'Mutton & Seafood', 'Fish', null,
   array['fish']::text[], 2),
  ('ao-patty-lamb', 'ag-patty', 'Mutton & Seafood', 'Lamb', null,
   array['lamb']::text[], 3),
  ('ao-patty-fillet-fish', 'ag-patty', 'Mutton & Seafood', 'Fillet Fish', null,
   array['fillet fish']::text[], 4),
  ('ao-patty-prawn', 'ag-patty', 'Mutton & Seafood', 'Prawn', null,
   array['prawn']::text[], 5),
  ('ao-patty-mutton-kebab', 'ag-patty', 'Mutton & Seafood', 'Mutton Kebab', null,
   array['mutton kebab']::text[], 6),
  ('ao-patty-mutton-seekh', 'ag-patty', 'Mutton & Seafood', 'Mutton Seekh', null,
   array['mutton seekh']::text[], 7),
  ('ao-patty-mutton-keema', 'ag-patty', 'Mutton & Seafood', 'Mutton Keema', null,
   array['mutton keema']::text[], 8),
  ('ao-patty-shami-kebab', 'ag-patty', 'Mutton & Seafood', 'Shami Kebab', null,
   array['shami kebab']::text[], 9),
  ('ao-patty-mutton-tikka', 'ag-patty', 'Mutton & Seafood', 'Mutton Tikka', null,
   array['mutton tikka']::text[], 10),
  ('ao-patty-pulled-mutton', 'ag-patty', 'Mutton & Seafood', 'Pulled Mutton', null,
   array['pulled mutton']::text[], 11),
  ('ao-patty-mutton-steak', 'ag-patty', 'Mutton & Seafood', 'Mutton Steak', null,
   array['mutton steak']::text[], 12),
  ('ao-patty-mutton-sausage', 'ag-patty', 'Mutton & Seafood', 'Mutton Sausage', null,
   array['mutton sausage']::text[], 13),
  ('ao-patty-chickpea', 'ag-patty', 'Vegetables', 'Chickpea', null,
   array['chickpea']::text[], 0),
  ('ao-patty-mix-vegetables', 'ag-patty', 'Vegetables', 'Mix Vegetables', null,
   array['mix vegetables']::text[], 1),
  ('ao-patty-potato', 'ag-patty', 'Vegetables', 'Potato', null,
   array['potato']::text[], 2),
  ('ao-patty-corn', 'ag-patty', 'Vegetables', 'Corn', null,
   array['corn']::text[], 3),
  ('ao-patty-mushroom', 'ag-patty', 'Vegetables', 'Mushroom', null,
   array['mushroom']::text[], 4),
  ('ao-patty-spinach', 'ag-patty', 'Vegetables', 'Spinach', null,
   array['spinach']::text[], 5),
  ('ao-patty-beans', 'ag-patty', 'Vegetables', 'Beans', null,
   array['beans']::text[], 6),
  ('ao-patty-beetroot', 'ag-patty', 'Vegetables', 'Beetroot', null,
   array['beetroot']::text[], 7),
  ('ao-patty-pea', 'ag-patty', 'Vegetables', 'Pea', null,
   array['pea']::text[], 8),
  ('ao-patty-grilled-mushroom', 'ag-patty', 'Vegetables', 'Grilled Mushroom', null,
   array['grilled mushroom']::text[], 9),
  ('ao-patty-mushroom-schezwan', 'ag-patty', 'Vegetables', 'Mushroom Schezwan', null,
   array['mushroom schezwan']::text[], 10),
  ('ao-patty-mushroom-tikka', 'ag-patty', 'Vegetables', 'Mushroom Tikka', null,
   array['mushroom tikka']::text[], 11),
  ('ao-patty-jackfruit', 'ag-patty', 'Vegetables', 'Jackfruit', null,
   array['jackfruit']::text[], 12),
  ('ao-patty-mushroom-barbeque', 'ag-patty', 'Vegetables', 'Mushroom Barbeque', null,
   array['mushroom barbeque']::text[], 13),
  ('ao-patty-tandoori-mushroom', 'ag-patty', 'Vegetables', 'Tandoori Mushroom', null,
   array['tandoori mushroom']::text[], 14),
  ('ao-patty-peri-peri-mushroom', 'ag-patty', 'Vegetables', 'Peri Peri Mushroom', null,
   array['peri peri mushroom']::text[], 15),
  ('ao-patty-smoked-mushroom', 'ag-patty', 'Vegetables', 'Smoked Mushroom', null,
   array['smoked mushroom']::text[], 16),
  ('ao-patty-mushroom-makhani', 'ag-patty', 'Vegetables', 'Mushroom Makhani', null,
   array['mushroom makhani']::text[], 17),
  ('ao-patty-vegetable-momo', 'ag-patty', 'Vegetables', 'Vegetable Momo', null,
   array['vegetable momo']::text[], 18),
  ('ao-patty-paneer', 'ag-patty', 'Paneer', 'Paneer', null,
   array['paneer']::text[], 0),
  ('ao-patty-paneer-tikka', 'ag-patty', 'Paneer', 'Paneer Tikka', null,
   array['paneer tikka']::text[], 1),
  ('ao-patty-tandoori-paneer', 'ag-patty', 'Paneer', 'Tandoori Paneer', null,
   array['tandoori paneer']::text[], 2),
  ('ao-patty-peri-peri-paneer', 'ag-patty', 'Paneer', 'Peri Peri Paneer', null,
   array['peri peri paneer']::text[], 3),
  ('ao-patty-paneer-makhani', 'ag-patty', 'Paneer', 'Paneer Makhani', null,
   array['paneer makhani']::text[], 4),
  ('ao-patty-grilled-paneer', 'ag-patty', 'Paneer', 'Grilled Paneer', null,
   array['grilled paneer']::text[], 5),
  ('ao-patty-butter-paneer', 'ag-patty', 'Paneer', 'Butter Paneer', null,
   array['butter paneer']::text[], 6),
  ('ao-patty-paneer-barbeque', 'ag-patty', 'Paneer', 'Paneer Barbeque', null,
   array['paneer barbeque']::text[], 7),
  ('ao-patty-paneer-steak', 'ag-patty', 'Paneer', 'Paneer Steak', null,
   array['paneer steak']::text[], 8),
  ('ao-patty-achari-paneer', 'ag-patty', 'Paneer', 'Achari Paneer', null,
   array['achari paneer']::text[], 9),
  ('ao-patty-malai-paneer', 'ag-patty', 'Paneer', 'Malai Paneer', null,
   array['malai paneer']::text[], 10),
  ('ao-patty-kadhai-paneer', 'ag-patty', 'Paneer', 'Kadhai Paneer', null,
   array['kadhai paneer']::text[], 11),
  ('ao-patty-paneer-shawarma', 'ag-patty', 'Paneer', 'Paneer Shawarma', null,
   array['paneer shawarma']::text[], 12),
  ('ao-patty-smoked-paneer', 'ag-patty', 'Paneer', 'Smoked Paneer', null,
   array['smoked paneer']::text[], 13),
  ('ao-patty-roasted-paneer', 'ag-patty', 'Paneer', 'Roasted Paneer', null,
   array['roasted paneer']::text[], 14),
  ('ao-patty-paneer-65', 'ag-patty', 'Paneer', 'Paneer 65', null,
   array['paneer 65']::text[], 15),
  ('ao-patty-paneer-keema', 'ag-patty', 'Paneer', 'Paneer Keema', null,
   array['paneer keema']::text[], 16),
  ('ao-patty-paneer-butter-masala', 'ag-patty', 'Paneer', 'Paneer Butter Masala', null,
   array['paneer butter masala']::text[], 17),
  ('ao-patty-paneer-momo', 'ag-patty', 'Paneer', 'Paneer Momo', null,
   array['paneer momo']::text[], 18),
  ('ao-patty-paneer-tikka-butter-masala', 'ag-patty', 'Paneer', 'Paneer Tikka Butter Masala', null,
   array['paneer tikka butter masala']::text[], 19),
  ('ao-patty-beef', 'ag-patty', 'Others', 'Beef', null,
   array['beef']::text[], 0),
  ('ao-patty-buff', 'ag-patty', 'Others', 'Buff', null,
   array['buff']::text[], 1),
  ('ao-patty-keema', 'ag-patty', 'Others', 'Keema', null,
   array['keema']::text[], 2),
  ('ao-patty-salami', 'ag-patty', 'Others', 'Salami', null,
   array['salami']::text[], 3),
  ('ao-patty-steak', 'ag-patty', 'Others', 'Steak', null,
   array['steak']::text[], 4),
  ('ao-patty-pork', 'ag-patty', 'Others', 'Pork', null,
   array['pork']::text[], 5),
  ('ao-patty-tenderloin', 'ag-patty', 'Others', 'Tenderloin', null,
   array['tenderloin']::text[], 6),
  ('ao-patty-sausage', 'ag-patty', 'Others', 'Sausage', null,
   array['sausage']::text[], 7),
  ('ao-patty-fried-egg', 'ag-patty', 'Others', 'Fried Egg', null,
   array['fried egg']::text[], 8),
  ('ao-patty-pulled-pork', 'ag-patty', 'Others', 'Pulled Pork', null,
   array['pulled pork']::text[], 9),
  ('ao-patty-crab', 'ag-patty', 'Others', 'Crab', null,
   array['crab']::text[], 10),
  ('ao-patty-turkey', 'ag-patty', 'Others', 'Turkey', null,
   array['turkey']::text[], 11),
  ('ao-patty-kebab', 'ag-patty', 'Others', 'Kebab', null,
   array['kebab']::text[], 12),
  ('ao-patty-shawarma', 'ag-patty', 'Others', 'Shawarma', null,
   array['shawarma']::text[], 13),
  ('ao-patty-noodles', 'ag-patty', 'Others', 'Noodles', null,
   array['noodles']::text[], 14),
  ('ao-patty-cutlet', 'ag-patty', 'Others', 'Cutlet', null,
   array['cutlet']::text[], 15),
  ('ao-patty-railway-cutlet', 'ag-patty', 'Others', 'Railway Cutlet', null,
   array['railway cutlet']::text[], 16),
  ('ao-patty-soya', 'ag-patty', 'Others', 'Soya', null,
   array['soya']::text[], 17),
  ('ao-patty-falafel', 'ag-patty', 'Others', 'Falafel', null,
   array['falafel']::text[], 18),
  ('ao-patty-black-beans', 'ag-patty', 'Others', 'Black Beans', null,
   array['black beans']::text[], 19),
  ('ao-patty-tofu', 'ag-patty', 'Others', 'Tofu', null,
   array['tofu']::text[], 20),
  ('ao-patty-quinoa', 'ag-patty', 'Others', 'Quinoa', null,
   array['quinoa']::text[], 21),
  ('ao-patty-hash-brown', 'ag-patty', 'Others', 'Hash Brown', null,
   array['hash brown']::text[], 22),
  ('ao-patty-schnitzel', 'ag-patty', 'Others', 'Schnitzel', null,
   array['schnitzel']::text[], 23),
  ('ao-patty-type-double-patty', 'ag-patty-type', null, 'Double Patty', null,
   array['double patty']::text[], 0),
  ('ao-patty-type-crispy', 'ag-patty-type', null, 'Crispy', null,
   array['crispy']::text[], 1),
  ('ao-patty-type-grilled', 'ag-patty-type', null, 'Grilled', null,
   array['grilled']::text[], 2),
  ('ao-patty-type-double-cheese', 'ag-patty-type', null, 'Double Cheese', null,
   array['double cheese']::text[], 3),
  ('ao-patty-type-smash', 'ag-patty-type', null, 'Smash', null,
   array['smash']::text[], 4),
  ('ao-patty-type-triple-patty', 'ag-patty-type', null, 'Triple Patty', null,
   array['triple patty']::text[], 5),
  ('ao-cheese-type-cheese', 'ag-cheese-type', null, 'Cheese', null,
   array['cheese']::text[], 0),
  ('ao-cheese-type-cheddar', 'ag-cheese-type', null, 'Cheddar', null,
   array['cheddar']::text[], 1),
  ('ao-cheese-type-american-cheese', 'ag-cheese-type', null, 'American Cheese', null,
   array['american cheese']::text[], 2),
  ('ao-cheese-type-gouda', 'ag-cheese-type', null, 'Gouda', null,
   array['gouda']::text[], 3),
  ('ao-cheese-type-mozzarella', 'ag-cheese-type', null, 'Mozzarella', null,
   array['mozzarella']::text[], 4),
  ('ao-cheese-type-feta', 'ag-cheese-type', null, 'Feta', null,
   array['feta']::text[], 5),
  ('ao-dressing-sauce-mayonnaise', 'ag-dressing-sauce', null, 'Mayonnaise', null,
   array['mayonnaise']::text[], 0),
  ('ao-dressing-sauce-thousand-island', 'ag-dressing-sauce', null, 'Thousand Island', null,
   array['thousand island']::text[], 1),
  ('ao-dressing-sauce-tangy', 'ag-dressing-sauce', null, 'Tangy', null,
   array['tangy']::text[], 2),
  ('ao-dressing-sauce-cheese-sauce', 'ag-dressing-sauce', null, 'Cheese Sauce', null,
   array['cheese sauce']::text[], 3),
  ('ao-dressing-sauce-tandoori', 'ag-dressing-sauce', null, 'Tandoori', null,
   array['tandoori']::text[], 4),
  ('ao-dressing-sauce-peri-peri', 'ag-dressing-sauce', null, 'Peri Peri', null,
   array['peri peri']::text[], 5),
  ('ao-toppings-ham', 'ag-toppings', null, 'Ham', null,
   array['ham']::text[], 0),
  ('ao-toppings-egg', 'ag-toppings', null, 'Egg', null,
   array['egg']::text[], 1),
  ('ao-toppings-bacon', 'ag-toppings', null, 'Bacon', null,
   array['bacon']::text[], 2),
  ('ao-toppings-omelette', 'ag-toppings', null, 'Omelette', null,
   array['omelette']::text[], 3),
  ('ao-toppings-vegetable', 'ag-toppings', null, 'Vegetable', null,
   array['vegetable']::text[], 4),
  ('ao-toppings-corn', 'ag-toppings', null, 'Corn', null,
   array['corn']::text[], 5),
  ('ao-bun-type-brioche', 'ag-bun-type', null, 'Brioche', null,
   array['brioche']::text[], 0),
  ('ao-bun-type-wheat', 'ag-bun-type', null, 'Wheat', null,
   array['wheat']::text[], 1),
  ('ao-bun-type-whole-wheat', 'ag-bun-type', null, 'Whole Wheat', null,
   array['whole wheat']::text[], 2),
  ('ao-bun-type-white', 'ag-bun-type', null, 'White', null,
   array['white']::text[], 3),
  ('ao-bun-type-brown', 'ag-bun-type', null, 'Brown', null,
   array['brown']::text[], 4),
  ('ao-bun-type-multigrain', 'ag-bun-type', null, 'Multigrain', null,
   array['multigrain']::text[], 5),
  ('ao-region-cuisine-origin-mexican', 'ag-region-cuisine-origin', null, 'Mexican', null,
   array['mexican']::text[], 0),
  ('ao-region-cuisine-origin-american', 'ag-region-cuisine-origin', null, 'American', null,
   array['american']::text[], 1),
  ('ao-region-cuisine-origin-indian', 'ag-region-cuisine-origin', null, 'Indian', null,
   array['indian']::text[], 2),
  ('ao-region-cuisine-origin-punjabi', 'ag-region-cuisine-origin', null, 'Punjabi', null,
   array['punjabi']::text[], 3),
  ('ao-region-cuisine-origin-italian', 'ag-region-cuisine-origin', null, 'Italian', null,
   array['italian']::text[], 4),
  ('ao-region-cuisine-origin-mumbai', 'ag-region-cuisine-origin', null, 'Mumbai', null,
   array['mumbai']::text[], 5),
  ('ao-region-cuisine-origin-korean', 'ag-region-cuisine-origin', null, 'Korean', null,
   array['korean']::text[], 6)
on conflict (id) do update
  set group_id = excluded.group_id,
      parent_filter_tab = excluded.parent_filter_tab,
      label = excluded.label,
      icon_url = excluded.icon_url,
      keywords = excluded.keywords,
      display_order = excluded.display_order,
      updated_at = now();

commit;
