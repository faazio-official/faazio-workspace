-- 0126_catalog_taxonomy_link.sql — link catalog rows to the taxonomy tree and fill the empty MART
-- drill-in leaves.
--
-- Authority: docs/architecture/db-schema.md §12.30 (taxonomy) / §12.4 (catalog),
-- docs/architecture/monolith-breakdown.md §1 (categories + catalog rows).
--
-- Why: `catalog.products.taxonomy_category_id` (0096) exists so a listing resolves its GST rate and
-- its drill-in through the same tree the superadmin console edits, and `taxonomyLeaf` in the catalog
-- repo only accepts an ACTIVE LEAF. Measured before this migration:
--   * 0 of 787 live rows carried a link, so every GST lookup fell back to the coarse label;
--   * 36 of the 179 active MART leaves returned an EMPTY drill-in — no ACTIVE product carried the
--     leaf's `search_query`, so a superadmin-chosen category rendered a blank page in the app.
--
-- This is a bootstrap DATA LOAD (no schema change), in the same shape as 0093/0094: idempotent
-- (deterministic ids, `on conflict do nothing`, `is distinct from` guards) and gap-filling only. It
-- never rewrites a row that already resolves and never invents a new category. Where a MART leaf
-- would otherwise render nothing it adds one representative listing under an existing live MART
-- store, with the leaf's own `search_query` in `search_tokens` so the generated FTS column matches
-- the drill-in read.
--
-- Editorial rail buckets (e.g. '🌧️ Monsoon Home Essentials', 'mart-foot') are deliberately NOT
-- re-labelled here: they group heterogeneous SKUs, so any single leaf target would be wrong data.
-- They stay as display labels with a null link, which checkout already tolerates.
--
-- Apply after 0125_address_coordinates.sql.

begin;

-- ================================================================ 1. exact leaf-name link
-- Every ACTIVE LEAF (a childless active node) whose name a product already carries. Non-leaf name
-- matches are skipped on purpose — `taxonomyLeaf` would reject them.
update catalog.products p
   set taxonomy_category_id = c.id,
       updated_at            = now()
  from taxonomy.categories c
 where c.app = p.app
   and c.is_active
   and c.name = p.category
   and not exists (select 1 from taxonomy.categories k where k.parent_id = c.id and k.is_active)
   and p.taxonomy_category_id is distinct from c.id;

-- ================================================================ 2. the 'Groceries' bucket
-- Six seed rows carry the coarse label 'Groceries', which is not a taxonomy node. Each is a known
-- SKU, so link it to its real leaf (and re-label it to that leaf's name) one row at a time. A row
-- with no clean leaf (the whole-wheat bread — MART has no bakery leaf) is left untouched rather than
-- forced into an unrelated aisle.
update catalog.products p
   set category             = m.leaf_name,
       taxonomy_category_id = m.leaf_id,
       updated_at           = now()
  from (values
    ('md-1', 'sub_milk',     'Fresh Milk'),
    ('md-2', 'sub_basmati',  'Basmati Rice'),
    ('md-3', 'sub_oils',     'Cooking Oils'),
    ('md-4', 'sub_nuts',     'Dry Fruits & Nuts'),
    ('md-5', 'sub_eggs',     'Eggs')
  ) as m(product_id, leaf_id, leaf_name)
  join taxonomy.categories c on c.id = m.leaf_id and c.app = 'MART'::app_brand and c.is_active
 where p.id = m.product_id
   and p.app = 'MART'::app_brand
   and p.deleted_at is null;

-- ================================================================ 3. fill an empty MART leaf
-- One representative listing per active MART leaf that still has no ACTIVE product carrying its
-- `search_query`, so no superadmin-chosen category renders a blank drill-in. The store is the live
-- MART store with the smallest id (deterministic), and price/rating/count derive from the leaf id so
-- the load is stable across re-runs.
do $$
declare
  v_store text;
begin
  select s.id into v_store
    from directory.stores s
   where s.app = 'MART'::app_brand and s.is_live
   order by s.id
   limit 1;

  if v_store is null then
    raise notice '0126: no live MART store present — skipping the empty-leaf fill';
    return;
  end if;

  insert into catalog.products
    (id, app, category, name, search_tokens, price_paisa, rating, reviews_count,
     emoji, image_url, desc_text, store_id, is_prescription, is_veg, status, taxonomy_category_id)
  select
    'taxseed-' || leaf.id,
    'MART'::app_brand,
    leaf.name,
    leaf.name || ' — Faazio Mart',
    array(select distinct tok
            from unnest(regexp_split_to_array(
                   lower(coalesce(nullif(leaf.search_query, ''), leaf.name) || ' ' || leaf.name),
                   '[^a-z0-9]+')) as tok
           where tok <> ''),
    (199 + (abs(hashtext('taxseed-' || leaf.id)) % 1200)) * 100,
    round((3.9 + (abs(hashtext(leaf.id || 'r')) % 10)::numeric / 10), 1),
    12 + (abs(hashtext(leaf.id || 'c')) % 300),
    '🛍️',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=600&h=300',
    leaf.name || ' picks fulfilled by a verified Faazio Mart partner.',
    v_store,
    false,
    true,
    'ACTIVE'::product_status,
    leaf.id
  from taxonomy.categories leaf
 where leaf.app = 'MART'::app_brand
   and leaf.is_active
   and not exists (select 1 from taxonomy.categories k where k.parent_id = leaf.id and k.is_active)
   and not exists (
     select 1
       from catalog.products p
      where p.app = 'MART'::app_brand
        and p.deleted_at is null
        and p.status = 'ACTIVE'
        and p.search_vec @@ websearch_to_tsquery('simple',
              catalog.immutable_unaccent(coalesce(nullif(leaf.search_query, ''), leaf.name)))
   )
  on conflict (id) do nothing;

  insert into inventory.stock (product_id, available, in_stock_qty, price_paisa, eta, is_prescription)
  select p.id, true, 20 + (abs(hashtext(p.id || 'q')) % 80), p.price_paisa, '45 min', false
    from catalog.products p
   where p.id like 'taxseed-%'
  on conflict (product_id) do nothing;
end $$;

commit;
