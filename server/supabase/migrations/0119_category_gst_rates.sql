-- Faazio MVP — one mandatory GST row per taxonomy category.
-- Authority: docs/architecture/db-schema.md §7.6 (tax) + §12.30 (taxonomy), monolith-breakdown.md §1,
-- user-interaction-workflow/seller/web-portal/super-admin-categories.md.
--
-- Why: GST used to resolve from a free-text `catalog.products.category` name match against
-- `tax.tax_rates` (dropped in 0117). This table makes the rate a property of the taxonomy row itself:
-- a product's `taxonomy_category_id` resolves its GST with one primary-key lookup, and the superadmin
-- is forced to choose a rate when a category is created.
--
-- Contract:
--   * `category_id` is `taxonomy.categories.id` (1:1, ON DELETE CASCADE).
--   * `gst_rate_pct` is copied from the picked slab at write time so checkout never joins two tables
--     and a later re-rate of a slab is an explicit superadmin action, not a silent live change.
--   * `gst_rate_category_id` points at the pick-list row (`tax.gst_rate_categories`, 0118) so the
--     portal can show which slab was chosen. It is RESTRICT on delete: a slab in use cannot be
--     removed (deactivate it instead).
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

create table if not exists tax.category_gst_rates (
  category_id          text primary key references taxonomy.categories (id) on delete cascade,
  gst_rate_pct         smallint not null check (gst_rate_pct in (0, 5, 12, 18, 28, 40)),
  gst_rate_category_id text not null references tax.gst_rate_categories (id) on delete restrict,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           text not null default ''
);

create index if not exists category_gst_rates_rate_category_idx
  on tax.category_gst_rates (gst_rate_category_id);

comment on table tax.category_gst_rates is
  'Mandatory GST rate per taxonomy.categories row. Checkout resolves a product''s GST through its taxonomy_category_id (primary-key lookup).';
comment on column tax.category_gst_rates.gst_rate_pct is
  'Rate copied from the picked slab at write time. Slabs in force: 0/5/12/18/28/40.';
comment on column tax.category_gst_rates.gst_rate_category_id is
  'The tax.gst_rate_categories row the superadmin picked. RESTRICT: a slab in use cannot be deleted.';

-- RLS (Supabase only): the gateway (service_role) is the only writer; signed-in accounts may read the
-- active rows (a seller previews the GST of the category they list in).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on tax.category_gst_rates to authenticated;
    alter table tax.category_gst_rates enable row level security;
    drop policy if exists category_gst_rates_public_read on tax.category_gst_rates;
    create policy category_gst_rates_public_read on tax.category_gst_rates
      for select to authenticated
      using (is_active);
  end if;
end $$;

commit;
