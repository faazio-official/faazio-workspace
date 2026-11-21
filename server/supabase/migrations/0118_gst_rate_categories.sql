-- Faazio MVP — the superadmin-managed GST rate category pick-list.
-- Authority: docs/architecture/db-schema.md §7.6 (tax) + §12.30 (taxonomy), monolith-breakdown.md §1,
-- user-interaction-workflow/seller/web-portal/super-admin-gst-rates.md.
--
-- Why: the superadmin no longer types a bare percentage per category. Each GST slab is a named,
-- sector-scoped row the portal renders as an editable table ("GST rates" page). A `taxonomy.categories`
-- row then points at exactly one of these rows (`tax.category_gst_rates`, 0119) and copies its
-- percentage, so the pick-list stays the single source for the rate and the category link stays
-- auditable.
--
-- Contract:
--   * `id`        — URL-safe slug ('gst-pharma-general'), stable key the portal edits by.
--   * `sector`    — which pool the slab belongs to (MART/FOOD/PHARMA).
--   * `gst_rate_pct` — one of 0/5/12/18/28/40 (GST slabs in force). 40 covers aerated drinks + tobacco.
--   * `is_active` — a deleted slab is deactivated so existing category links never dangle.
--   * Names are the superadmin's own labels; the seeded rows below are the starting rate card.
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

create table if not exists tax.gst_rate_categories (
  id             text primary key,
  name           text not null,
  sector         app_brand not null,
  gst_rate_pct   smallint not null check (gst_rate_pct in (0, 5, 12, 18, 28, 40)),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text not null default '',
  unique (sector, name)
);

create index if not exists gst_rate_categories_sector_idx
  on tax.gst_rate_categories (sector, is_active, gst_rate_pct);

comment on table tax.gst_rate_categories is
  'SUPER_ADMIN-managed GST rate pick-list. Each row is one named slab per sector; a taxonomy category links to exactly one (tax.category_gst_rates).';
comment on column tax.gst_rate_categories.gst_rate_pct is
  'GST percentage slab. 0 nil-rated, 5 merit, 12/18 standard, 28 luxury, 40 demerit (aerated drinks, tobacco).';
comment on column tax.gst_rate_categories.is_active is
  'Soft delete. A deactivated slab is hidden from the picker but existing category links keep their rate.';

-- Starting rate card. The superadmin owns these rows and can rename, re-rate or add more.
-- FOOD: every food category is 5% by policy — one slab covers the whole pool.
insert into tax.gst_rate_categories (id, name, sector, gst_rate_pct)
values
  ('gst-food-standard', 'Food & Beverage (all food)', 'FOOD'::app_brand, 5),

  ('gst-pharma-general', 'General Medicines & Formulations', 'PHARMA'::app_brand, 5),
  ('gst-pharma-devices', 'Medical Devices & First Aid', 'PHARMA'::app_brand, 5),
  ('gst-pharma-lifesaving', 'Notified Life-Saving Drugs', 'PHARMA'::app_brand, 0),
  ('gst-pharma-otc', 'OTC Wellness (soaps, shampoo, toothpaste)', 'PHARMA'::app_brand, 5),
  ('gst-pharma-cosmetics', 'Specialist Cosmetics & Nicotine Gum', 'PHARMA'::app_brand, 18),

  ('gst-mart-fresh', 'Fresh & Unbranded Staples', 'MART'::app_brand, 0),
  ('gst-mart-packaged', 'Packaged Foods & Daily Care', 'MART'::app_brand, 5),
  ('gst-mart-household', 'Household Cleaning & General Goods', 'MART'::app_brand, 18),
  ('gst-mart-aerated', 'Aerated Drinks & Tobacco', 'MART'::app_brand, 40)
on conflict (id) do nothing;

-- RLS (Supabase only): the gateway (service_role) is the only writer; signed-in accounts may read the
-- active pick-list (sellers need it to preview the rate of the category they list in).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on tax.gst_rate_categories to authenticated;
    alter table tax.gst_rate_categories enable row level security;
    drop policy if exists gst_rate_categories_public_read on tax.gst_rate_categories;
    create policy gst_rate_categories_public_read on tax.gst_rate_categories
      for select to authenticated
      using (is_active);
  end if;
end $$;

commit;
