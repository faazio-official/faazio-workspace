-- Faazio MVP — backfill a mandatory GST rate for every existing taxonomy category.
-- Authority: docs/architecture/db-schema.md §7.6 (tax) + §12.30 (taxonomy), monolith-breakdown.md §1,
-- user-interaction-workflow/seller/web-portal/super-admin-categories.md.
--
-- Strict, non-failing: this migration must succeed on every environment, so it never raises on an
-- unmatched category. Every existing `taxonomy.categories` row gets exactly one
-- `tax.category_gst_rates` row:
--   * FOOD  → always 5% (`gst-food-standard`, hard policy — every food category is 5%).
--   * MART / PHARMA / MAIN_APP_HEADER → matched against the seeded slab names by keyword; when no rule
--     matches, the sector default (5%) is used so checkout always resolves a rate.
--   * Unmatched non-FOOD rows are reported with `raise notice` for superadmin review — they are
--     backfilled at the default, not skipped.
--   * Already-linked rows are left untouched (`on conflict do nothing`), so a re-run never re-rates a
--     category the superadmin has since edited.
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

insert into tax.category_gst_rates (category_id, gst_rate_pct, gst_rate_category_id, updated_by)
select resolved.category_id, g.gst_rate_pct, resolved.slab_id, 'migration-0120'
  from (
    select c.id as category_id,
           case
             when c.app = 'FOOD'::app_brand then 'gst-food-standard'
             else coalesce(m.slab_id, d.slab_id)
           end as slab_id,
           m.slab_id is null as unmatched
      from taxonomy.categories c
      left join lateral (
        select v.slab_id
          from (values
            -- MART: demerit (40%) wins first, then general goods (18%), then fresh (0%), then 5%.
            ('MART', 1, 'aerated',    'gst-mart-aerated'),
            ('MART', 1, 'carbonated', 'gst-mart-aerated'),
            ('MART', 1, 'energy drink', 'gst-mart-aerated'),
            ('MART', 1, 'tobacco',    'gst-mart-aerated'),
            ('MART', 1, 'cigarette',  'gst-mart-aerated'),
            ('MART', 1, 'pan masala', 'gst-mart-aerated'),
            ('MART', 2, 'clean',      'gst-mart-household'),
            ('MART', 2, 'detergent',  'gst-mart-household'),
            ('MART', 2, 'stationery', 'gst-mart-household'),
            ('MART', 2, 'batter',     'gst-mart-household'),
            ('MART', 2, 'plastic',    'gst-mart-household'),
            ('MART', 2, 'cosmetic',   'gst-mart-household'),
            ('MART', 2, 'deodorant',  'gst-mart-household'),
            ('MART', 2, 'electronic', 'gst-mart-household'),
            ('MART', 2, 'gadget',     'gst-mart-household'),
            ('MART', 2, 'mobile',     'gst-mart-household'),
            ('MART', 2, 'appliance',  'gst-mart-household'),
            ('MART', 2, 'beauty',     'gst-mart-household'),
            ('MART', 2, 'home',       'gst-mart-household'),
            ('MART', 2, 'toy',        'gst-mart-household'),
            ('MART', 2, 'sport',      'gst-mart-household'),
            ('MART', 3, 'fresh',      'gst-mart-fresh'),
            ('MART', 3, 'fruit',      'gst-mart-fresh'),
            ('MART', 3, 'vegetable',  'gst-mart-fresh'),
            ('MART', 3, 'veg',        'gst-mart-fresh'),
            ('MART', 3, 'dairy',      'gst-mart-fresh'),
            ('MART', 3, 'milk',       'gst-mart-fresh'),
            ('MART', 3, 'egg',        'gst-mart-fresh'),
            ('MART', 3, 'salt',       'gst-mart-fresh'),
            ('MART', 3, 'bread',      'gst-mart-fresh'),
            ('MART', 4, 'packaged',   'gst-mart-packaged'),
            ('MART', 4, 'snack',      'gst-mart-packaged'),
            ('MART', 4, 'grain',      'gst-mart-packaged'),
            ('MART', 4, 'rice',       'gst-mart-packaged'),
            ('MART', 4, 'spice',      'gst-mart-packaged'),
            ('MART', 4, 'beverage',   'gst-mart-packaged'),
            ('MART', 4, 'fashion',    'gst-mart-packaged'),
            -- PHARMA: nil-rated life-saving first, then devices, then 18% cosmetics, then 5% general.
            ('PHARMA', 1, 'life',       'gst-pharma-lifesaving'),
            ('PHARMA', 2, 'device',     'gst-pharma-devices'),
            ('PHARMA', 2, 'first aid',  'gst-pharma-devices'),
            ('PHARMA', 2, 'bandage',    'gst-pharma-devices'),
            ('PHARMA', 2, 'diagnostic', 'gst-pharma-devices'),
            ('PHARMA', 3, 'cosmetic',   'gst-pharma-cosmetics'),
            ('PHARMA', 3, 'deodorant',  'gst-pharma-cosmetics'),
            ('PHARMA', 3, 'nicotine',   'gst-pharma-cosmetics'),
            ('PHARMA', 4, 'otc',          'gst-pharma-otc'),
            ('PHARMA', 4, 'personal care','gst-pharma-otc'),
            ('PHARMA', 4, 'medicine',     'gst-pharma-general'),
            ('PHARMA', 4, 'formulation',  'gst-pharma-general'),
            ('PHARMA', 4, 'vitamin',      'gst-pharma-general'),
            ('PHARMA', 4, 'tablet',       'gst-pharma-general'),
            ('PHARMA', 4, 'syrup',        'gst-pharma-general')
          ) as v(sector, prio, needle, slab_id)
         where v.sector = case
                 when c.app = 'MAIN_APP_HEADER'::app_brand then 'MART'
                 else c.app::text
               end
           and position(v.needle in lower(c.name)) > 0
         order by v.prio
         limit 1
      ) m on true
      left join lateral (
        select v.slab_id
          from (values
            ('FOOD', 'gst-food-standard'),
            ('MART', 'gst-mart-packaged'),
            ('PHARMA', 'gst-pharma-general'),
            ('MAIN_APP_HEADER', 'gst-mart-packaged')
          ) as v(sector, slab_id)
         where v.sector = c.app::text
      ) d on true
  ) resolved
  join tax.gst_rate_categories g on g.id = resolved.slab_id
on conflict (category_id) do nothing;

-- Report (never abort) the non-FOOD categories that fell back to the sector default so a superadmin
-- can re-rate them from the portal.
do $$
declare
  unmatched text;
begin
  select string_agg(c.id || ' (' || c.app::text || ': ' || c.name || ')', ', ' order by c.id)
    into unmatched
    from taxonomy.categories c
    left join tax.category_gst_rates r on r.category_id = c.id
   where c.app <> 'FOOD'::app_brand
     and r.gst_rate_category_id in ('gst-mart-packaged', 'gst-pharma-general')
     -- Only rows this migration actually created; a superadmin edit is not "unmatched".
     and r.updated_by = 'migration-0120'
     and not exists (
       select 1 from tax.gst_rate_categories s
        where s.id = r.gst_rate_category_id
          and position(lower(s.name) in lower(c.name)) > 0
     );
  if unmatched is not null then
    raise notice '0120: categories backfilled at the sector default rate (review in the portal): %', unmatched;
  end if;
end $$;

commit;
