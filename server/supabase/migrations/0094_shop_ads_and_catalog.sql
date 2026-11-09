-- Faazio MVP — per-shop demo coverage: top-level category alignment + shop catalog + 2 ads per shop.
-- Authority: docs/architecture/db-schema.md §12.30 (categories) and §12.17 (ads), monolith-breakdown.md
-- §1 (catalog + ads ownership).
--
-- Why: the seeded vendors were unevenly populated — the 14 `store-demo-*` shops (from
-- seed/demo_sellers_ttc_karaikal.sql) carried no products at all, several active catalog rows used
-- coarse category labels that no superadmin taxonomy node matches, and only one seller account
-- (`sel-tiruchi-01`) had any ad campaigns, so a per-shop ad surface had nothing to render.
--
-- This migration is a set-based DATA LOAD (no schema change):
--   1. Aligns coarse `catalog.products.category` labels to their superadmin TOP-LEVEL taxonomy name
--      (labels already equal to a taxonomy node, and editorial emoji/deal buckets, are untouched).
--   2. Gives every `store-demo-*` shop one ACTIVE product under each top-level category of its app
--      (mapped to the representative leaf that sits under that top-level), plus an inventory row.
--   3. Publishes 2 LIVE, store-scoped `STORE_TOP` hero campaigns per shop (targets that shop's own
--      top-2 products) so the Mart/Food/Pharma store page hero is never empty.
--
-- Ids are deterministic (`demop-*`, `ad-cmp-shop-*`) so the file is idempotent: safe to re-run.
-- Requires 0067/0091/0092 (taxonomy), 0027/0028 (campaigns) and demo_sellers_ttc_karaikal.sql
-- (store-demo-* shops). Shops/products that do not exist are simply skipped — no hard dependency.

begin;

-- ================================================================ 1. top-level category alignment
-- Map only coarse labels that have no taxonomy node of their own to their best-fit TOP-LEVEL name.
update catalog.products p
   set category = m.to_name, updated_at = now()
  from (values
    ('MART',   'Fresh Produce', 'Fruits & Veggies'),
    ('MART',   'Mobiles',       'Mobiles & Tablets'),
    ('MART',   'Snacks',        'Snacks & Beverages'),
    ('MART',   'Sports',        'Sports & Fitness'),
    ('PHARMA', 'vitamin',       'Vitamins & Supplements'),
    ('PHARMA', 'supplements',   'Vitamins & Supplements'),
    ('PHARMA', 'cough',         'Medicines & Rx'),
    ('PHARMA', 'fever',         'Medicines & Rx'),
    ('PHARMA', 'hypertension',  'Medicines & Rx'),
    ('PHARMA', 'asthma',        'Medicines & Rx'),
    ('PHARMA', 'allergy',       'Medicines & Rx'),
    ('PHARMA', 'diarrhea',      'Medicines & Rx'),
    ('PHARMA', 'vaccine',       'Medicines & Rx'),
    ('PHARMA', 'antiseptic',    'Personal Care'),
    ('PHARMA', 'personal-care', 'Personal Care'),
    ('FOOD',   'Beverage',      'Beverages & Shakes'),
    ('FOOD',   'Beverages',     'Beverages & Shakes')
  ) as m(app, from_name, to_name)
 where p.app::text = m.app
   and p.category = m.from_name
   and exists (select 1 from taxonomy.categories t
                where t.app = p.app and t.parent_id is null and t.name = m.to_name and t.is_active);

-- ================================================================ 2. shop catalog for the demo shops
-- One representative leaf per top-level category (a childless root is its own leaf), so a product
-- under every superadmin top-level is matched by the drill-in's leaf `search_query`.
with recursive tree as (
  select c.id, c.app, c.name, c.search_query, c.parent_id, c.id as root_id, c.sort_order
    from taxonomy.categories c
   where c.parent_id is null and c.is_active
  union all
  select ch.id, ch.app, ch.name, ch.search_query, ch.parent_id, t.root_id, ch.sort_order
    from taxonomy.categories ch
    join tree t on ch.parent_id = t.id
   where ch.is_active
),
rep as (
  select distinct on (root_id) root_id, app, id, name, coalesce(search_query, name) as q
    from tree
   where not exists (select 1 from taxonomy.categories x where x.parent_id = tree.id and x.is_active)
   order by root_id, sort_order, id
)
insert into catalog.products
  (id, app, category, name, search_tokens, price_paisa, rating, reviews_count,
   emoji, image_url, desc_text, store_id, is_prescription, is_veg, status)
select
  'demop-' || st.id || '-' || r.root_id,
  st.app,
  r.name,
  r.name || ' — ' || st.name,
  array(select distinct tok
          from unnest(regexp_split_to_array(lower(r.q || ' ' || r.name || ' ' || st.name), '[^a-z0-9]+')) as tok
         where tok <> ''),
  (200 + (abs(hashtext('demop-' || st.id || '-' || r.root_id)) % 800)) * 100,
  round((3.8 + (abs(hashtext(r.root_id || st.id || 'r')) % 12)::numeric / 10), 1),
  20 + (abs(hashtext(r.root_id || st.id || 'c')) % 480),
  case st.app when 'FOOD' then '🍽️' when 'PHARMA' then '💊' else '🛍️' end,
  case st.app when 'FOOD'
         then 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=600&h=300'
       when 'PHARMA'
         then 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=600&h=300'
       else 'https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=600&h=300' end,
  r.name || ' listing at ' || st.name || ', mapped under the ' || r.name || ' category.',
  st.id, false, null, 'ACTIVE'::product_status
from directory.stores st
join rep r on r.app = st.app
where st.id like 'store-demo-%'
on conflict (id) do nothing;

insert into inventory.stock (product_id, available, in_stock_qty, price_paisa, eta, is_prescription)
select p.id, true, 25 + (abs(hashtext(p.id || 'q')) % 75), p.price_paisa,
       case p.app when 'FOOD' then '30 min' else '45 min' end, false
  from catalog.products p
 where p.id like 'demop-%'
on conflict (product_id) do nothing;

-- ================================================================ 3. two store-scoped hero ads per shop
-- LIVE STORE_TOP creative for every shop that has a live seller, deep-linking that shop's own top-2
-- rated products. An already-seeded row for the same placement_id is left untouched.
insert into ads.campaigns
  (placement_id, campaign_id, seller_id, creative_type, placement, target_type, target_id, target_app,
   category, store_id, title, subtitle, image_url, cta, state_code, starts_at, ends_at, status)
select
  'ad-cmp-shop-' || st.id || '-' || p.rn,
  'cmp-shop-' || st.id,
  st.seller_id,
  'HERO'::ad_creative_type,
  'STORE_TOP'::ad_placement,
  'PRODUCT'::ad_target_type,
  p.id,
  st.app,
  null,
  st.id,
  left(st.name, 40),
  left(p.name, 60),
  coalesce(nullif(st.cover_image, ''), p.image_url),
  case st.app when 'FOOD' then 'Order Now' when 'PHARMA' then 'Buy Now' else 'Shop Now' end,
  st.state_code,
  now() - interval '1 day',
  now() + interval '60 days',
  'LIVE'::ad_status
from directory.stores st
join sellers.sellers s on s.seller_id = st.seller_id
join lateral (
  select p.id, p.name, p.image_url,
         row_number() over (order by p.rating desc, p.id) as rn
    from catalog.products p
   where p.store_id = st.id and p.status = 'ACTIVE' and p.deleted_at is null
) p on p.rn <= 2
on conflict (placement_id) do nothing;

commit;
