-- Faazio MVP — rich product attributes for an enterprise PDP (MRP, brand, pack, gallery, variants)
-- plus a saved per-shop compliance profile.
--
-- Authority: docs/architecture/db-schema.md §5.1, docs/architecture/monolith-breakdown.md §1
-- (catalog + directory rows), docs/user-interaction-workflow/seller/catalog/add-product.md,
-- docs/user-interaction-workflow/customer/discovery/product-detail.md.
--
-- Why this reverses 0079:
--   0079 retired `catalog.products.mrp_paisa` because the selling price was intended to be the
--   single seller-authored price. A discounted PDP needs an honest list price to strike through
--   (MRP > price), otherwise the app can only invent a discount. `mrp_paisa` returns as an
--   OPTIONAL list price, validated in the gateway (`mrp >= price`), never synthesized on the client.
--
-- The other columns close the PDP data gaps the seller form could not express:
--   brand             — the actual product brand (was falling back to the platform name "Faazio")
--   pack_type/net_qty/net_unit — structured "1 kg / 500 g / Pack of 6 / Bundle of 4" answers;
--                        the gateway derives the legacy display `unit` from these (single source)
--   variant_group_id / variant_label / variant_order — grouped sibling SKUs (sizes, shades) so the
--                        PDP can offer tappable variant chips; pricing/stock stay per-row
--   gallery_keys      — ordered extra image keys for the PDP carousel + pagination dots
--   compliance_defaults (directory.stores) — a seller's saved legal-metrology defaults (country of
--                        origin, manufacturer/packer, return policy) so each new product prefills
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

-- ---------------------------------------------------------------- catalog.products
alter table catalog.products
  add column if not exists mrp_paisa int8,
  add column if not exists brand text,
  add column if not exists pack_type text,
  add column if not exists net_qty numeric(10,3),
  add column if not exists net_unit text,
  add column if not exists variant_group_id text,
  add column if not exists variant_label text,
  add column if not exists variant_order int not null default 0,
  add column if not exists gallery_keys text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_mrp_nonneg') then
    alter table catalog.products
      add constraint products_mrp_nonneg check (mrp_paisa is null or mrp_paisa >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_pack_type_valid') then
    alter table catalog.products
      add constraint products_pack_type_valid check (
        pack_type is null or pack_type in
          ('PIECE','PACKET','BUNDLE','BOX','KG','G','L','ML','STRIP','DOZEN','SET'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_net_unit_valid') then
    alter table catalog.products
      add constraint products_net_unit_valid check (
        net_unit is null or net_unit in ('g','kg','ml','l','piece','tablet','sheet','pack'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_net_qty_positive') then
    alter table catalog.products
      add constraint products_net_qty_positive check (net_qty is null or net_qty > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_brand_len') then
    alter table catalog.products
      add constraint products_brand_len check (brand is null or octet_length(brand) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_variant_label_len') then
    alter table catalog.products
      add constraint products_variant_label_len check (
        variant_label is null or octet_length(variant_label) <= 60);
  end if;
end $$;

comment on column catalog.products.mrp_paisa is
  'Seller-declared list price (MRP) in paisa. Null = no declared list price. A strike-through renders only when mrp_paisa > price_paisa; the gateway validates mrp >= price on auth writes.';
comment on column catalog.products.brand is
  'Product brand shown above the PDP title. Null/empty = fall back to the store name (never the platform name).';
comment on column catalog.products.pack_type is
  'Packaging form (PIECE/PACKET/BUNDLE/BOX/KG/G/L/ML/STRIP/DOZEN/SET). net_qty + net_unit carry the amount; the gateway derives the legacy unit display string.';
comment on column catalog.products.variant_group_id is
  'Groups sibling SKUs (sizes/shades). Siblings remain independent catalog rows with their own price/stock.';
comment on column catalog.products.gallery_keys is
  'Ordered extra image keys for the PDP carousel (primary image stays image_key). Resolved to CDN URLs on detail reads.';

create index if not exists products_variant_group_idx
  on catalog.products (variant_group_id) where variant_group_id is not null;
create index if not exists products_mrp_idx
  on catalog.products (mrp_paisa) where mrp_paisa is not null;

-- ---------------------------------------------------------------- directory.stores
alter table directory.stores
  add column if not exists compliance_defaults jsonb;

comment on column directory.stores.compliance_defaults is
  'Saved legal-metrology defaults (countryOfOrigin, manufacturer/packer, return policy) used to prefill a new listing. Per shop because FSSAI/drug licence and the legal seller entity are per shop.';
