-- The account (sellers.sellers) is brand-agnostic. Category, platform fee and FSSAI belong to the
-- vendor (directory.stores). Drop the legacy account-level copies now that code and seed no longer
-- read them.

drop index if exists sellers.sellers_category_idx;
drop index if exists sellers.sellers_seller_category_idx;

alter table sellers.sellers
  drop column if exists category,
  drop column if exists platform_fee_pct,
  drop column if exists seller_category_id,
  drop column if exists fssai_number,
  drop column if exists fssai_cert_key,
  drop column if exists fssai_cert_asset_id;
