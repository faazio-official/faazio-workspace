-- Seller-authored product MRP is retired: selling price is the single price a seller sets.
-- Food menu MRP (directory.menus.mrp_paisa, 0022) and pharma quote MRP (pharma.quote_items, 0023)
-- are separate domains and stay.
--
-- catalog.products_search depends on catalog.products.mrp_paisa, so recreate it first.
-- Idempotent — safe to re-run.

drop view if exists catalog.products_search;

alter table catalog.products drop column if exists mrp_paisa;
alter table inventory.stock  drop column if exists mrp_paisa;

create view catalog.products_search as
  select
    p.id, p.app, p.category, p.name, p.search_tokens,
    p.price_paisa, p.rating, p.reviews_count,
    p.emoji, p.image_url, p.desc_text, p.badge, p.shop, p.unit,
    p.attributes, p.store_id, p.is_prescription, p.is_veg,
    p.updated_at, p.search_vec
  from catalog.products p;
