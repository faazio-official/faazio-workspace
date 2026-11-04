-- Read-only diagnostic — NOT a migration. Do not place SELECT-only checks under migrations/.
--
-- SDUI referential drift guardrail. Every storeId/productId the SDUI home layout
-- (Mongo sdui_layouts.home; source server/supabase/seed/mongo/sdui_layouts.json) references must
-- exist in Postgres directory.vendors (stores + dining venues) / catalog.products. A referenced id
-- with no Postgres row renders its SDUI section empty, so this check surfaces that before deploy.
--
-- server/gateway/cmd/migrate discards query result rows (PgConn().Exec().ReadAll()), so running this
-- through server/supabase/apply-migration.sh prints no output. Run it in the Supabase SQL Editor (or
-- any pgx/psql client) instead. See docs/RUNBOOKS/DATABASE_MIGRATIONS.md §5.
--
-- Regenerate when sdui_layouts.json changes:
--   node server/supabase/diagnostics/generate-sdui-references.mjs

-- 1. Referenced ids from the layout (regen: home v1, 2026-11-04T15:07:20.349Z).
with referenced(store_id, product_id) as (
  select store_id, product_id from (values
    ('store-f1', NULL) /* store */,
    ('store-f10', NULL) /* store */,
    ('store-f11', NULL) /* store */,
    ('store-f12', NULL) /* store */,
    ('store-f2', NULL) /* store */,
    ('store-f3', NULL) /* store */,
    ('store-f4', NULL) /* store */,
    ('store-f5', NULL) /* store */,
    ('store-f6', NULL) /* store */,
    ('store-f7', NULL) /* store */,
    ('store-f8', NULL) /* store */,
    ('store-f9', NULL) /* store */,
    ('store-m1', NULL) /* store */,
    ('store-m11', NULL) /* store */,
    ('store-m12', NULL) /* store */,
    ('store-m3', NULL) /* store */,
    ('store-m4', NULL) /* store */,
    ('store-m6', NULL) /* store */,
    ('store-m7', NULL) /* store */,
    ('store-m8', NULL) /* store */,
    ('tr-1', NULL) /* store */,
    ('tr-2', NULL) /* store */,
    ('tr-3', NULL) /* store */,
    ('tr-4', NULL) /* store */,
    ('tr-5', NULL) /* store */,
    ('tr-6', NULL) /* store */,
    (NULL, 'bf-1') /* product */,
    (NULL, 'bf-2') /* product */,
    (NULL, 'fm-bk1') /* product */,
    (NULL, 'fm-bk2') /* product */,
    (NULL, 'fm-bk3') /* product */,
    (NULL, 'fm-e4') /* product */,
    (NULL, 'fm-e5') /* product */,
    (NULL, 'fm-e6') /* product */,
    (NULL, 'fm-f1') /* product */,
    (NULL, 'fm-f2') /* product */,
    (NULL, 'fm-f3') /* product */,
    (NULL, 'fm-fur1') /* product */,
    (NULL, 'fm-fur3') /* product */,
    (NULL, 'fm-fur4') /* product */,
    (NULL, 'fm-ha1') /* product */,
    (NULL, 'fm-ha2') /* product */,
    (NULL, 'fm-ha3') /* product */,
    (NULL, 'fm-m1') /* product */,
    (NULL, 'fm-m2') /* product */,
    (NULL, 'fm-s2') /* product */,
    (NULL, 'fm-s3') /* product */,
    (NULL, 'fm-s4') /* product */,
    (NULL, 'fm-v1') /* product */,
    (NULL, 'fm-v2') /* product */,
    (NULL, 'fm-v4') /* product */,
    (NULL, 'gr-p3') /* product */,
    (NULL, 'gr-p4') /* product */,
    (NULL, 'gr-p5') /* product */,
    (NULL, 'gr-p6') /* product */,
    (NULL, 'gr-p7') /* product */,
    (NULL, 'hbd-1') /* product */,
    (NULL, 'hbd-2') /* product */,
    (NULL, 'hbd-3') /* product */,
    (NULL, 'hbd-4') /* product */,
    (NULL, 'hbd-5') /* product */,
    (NULL, 'hs-1') /* product */,
    (NULL, 'hs-2') /* product */,
    (NULL, 'hs-3') /* product */,
    (NULL, 'hs-4') /* product */,
    (NULL, 'hs-5') /* product */,
    (NULL, 'kid-1') /* product */,
    (NULL, 'kid-2') /* product */,
    (NULL, 'kid-3') /* product */,
    (NULL, 'kid-4') /* product */,
    (NULL, 'kid-5') /* product */,
    (NULL, 'lm-1') /* product */,
    (NULL, 'm-chicken-rice') /* product */,
    (NULL, 'm-crispy-dumplings') /* product */,
    (NULL, 'm-mushroom-soup') /* product */,
    (NULL, 'm-seafood-ramen') /* product */,
    (NULL, 'md-1') /* product */,
    (NULL, 'md-2') /* product */,
    (NULL, 'md-3') /* product */,
    (NULL, 'md-4') /* product */,
    (NULL, 'md-5') /* product */,
    (NULL, 'md-6') /* product */,
    (NULL, 'men-1') /* product */,
    (NULL, 'men-2') /* product */,
    (NULL, 'men-3') /* product */,
    (NULL, 'men-4') /* product */,
    (NULL, 'men-5') /* product */,
    (NULL, 'men-6') /* product */,
    (NULL, 'nb-1') /* product */,
    (NULL, 'nb-2') /* product */,
    (NULL, 'nb-3') /* product */,
    (NULL, 'nb-4') /* product */,
    (NULL, 'nb-5') /* product */,
    (NULL, 'nb-6') /* product */,
    (NULL, 'ph-ayur2') /* product */,
    (NULL, 'ph-c1') /* product */,
    (NULL, 'ph-c2') /* product */,
    (NULL, 'ph-c3') /* product */,
    (NULL, 'ph-cal3') /* product */,
    (NULL, 'ph-dig4') /* product */,
    (NULL, 'ph-om1') /* product */,
    (NULL, 'ph-otc3') /* product */,
    (NULL, 'ph-per2') /* product */,
    (NULL, 'ph-per3') /* product */,
    (NULL, 'ph-s1') /* product */,
    (NULL, 'ph-t1') /* product */,
    (NULL, 'rvf-1') /* product */,
    (NULL, 'rvf-2') /* product */,
    (NULL, 'rvf-3') /* product */,
    (NULL, 'rvg-1') /* product */,
    (NULL, 'rvg-4') /* product */,
    (NULL, 'rvm-1') /* product */,
    (NULL, 'rvm-2') /* product */,
    (NULL, 'rvm-3') /* product */,
    (NULL, 'rvm-4') /* product */,
    (NULL, 'rvp-1') /* product */,
    (NULL, 'rvp-2') /* product */,
    (NULL, 'rvp-3') /* product */,
    (NULL, 'sp-1') /* product */,
    (NULL, 'sp-10') /* product */,
    (NULL, 'sp-11') /* product */,
    (NULL, 'sp-12') /* product */,
    (NULL, 'sp-13') /* product */,
    (NULL, 'sp-14') /* product */,
    (NULL, 'sp-15') /* product */,
    (NULL, 'sp-16') /* product */,
    (NULL, 'sp-2') /* product */,
    (NULL, 'sp-3') /* product */,
    (NULL, 'sp-4') /* product */,
    (NULL, 'sp-5') /* product */,
    (NULL, 'sp-6') /* product */,
    (NULL, 'sp-7') /* product */,
    (NULL, 'sp-8') /* product */,
    (NULL, 'sp-9') /* product */,
    (NULL, 'wom-1') /* product */,
    (NULL, 'wom-2') /* product */,
    (NULL, 'wom-3') /* product */,
    (NULL, 'wom-4') /* product */,
    (NULL, 'wom-5') /* product */,
    (NULL, 'wom-6') /* product */
  ) as v(store_id, product_id)
  where store_id is not null or product_id is not null
),
-- 2. Postgres side (the vendor identity set = directory.stores ∪ directory.dining_venues; the menu
--    items food rails point at are catalog.products rows, so that is the only product table to check).
missing_stores as (
  select r.store_id
    from referenced r
   where r.store_id is not null
     and not exists (select 1 from directory.vendors d where d.id = r.store_id)
),
missing_products as (
  select r.product_id
    from referenced r
   where r.product_id is not null
     and not exists (select 1 from catalog.products c where c.id = r.product_id)
)
-- 3. Drift. Empty result = clean. Non-empty = SDUI sections that will render empty.
select 'store'   as ref_type, store_id as ref_id from missing_stores
union all
select 'product' as ref_type, product_id as ref_id from missing_products
order by ref_type, ref_id;
