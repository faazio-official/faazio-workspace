-- Faazio MVP — byte diet for scale. Rewrites tables (schedule off-peak); no wire/contract change.
-- Authority: docs/architecture/db-schema.md §2 (datatype policy), monolith-breakdown.md §4 (freeze).
--
-- Money columns intentionally stay INT8: INT4 paisa caps at ₹21M, unsafe for B2B / cart totals and
-- breaks CockroachDB INT8 parity (db-schema.md §2). Financial safety beats 4 B/row.

-- The products_search view depends on the columns narrowed/dropped below; drop it first and recreate
-- it at the end. It is a read surface only (the gateway queries the base table directly).
drop view if exists catalog.products_search;

-- Products: 1-decimal ratings fit real; counts fit int4 (2 B is unreachable).
alter table catalog.products alter column rating type real using rating::real;
alter table catalog.products alter column reviews_count type int4 using reviews_count::integer;

-- Drop the dead relational UUID: never selected by any repo/contract/view-consumer, and the seed
-- generator does not emit it.
alter table catalog.products drop column if exists slug_uid;

-- Stores / stock / quantity columns.
alter table directory.stores alter column reviews_count type int4 using reviews_count::integer;
alter table inventory.stock alter column in_stock_qty type int4 using in_stock_qty::integer;
alter table checkout.order_items alter column qty type smallint using qty::smallint;
alter table inventory.stock_reservations alter column qty type smallint using qty::smallint;

-- Fuzzy trigram index dropped: the hot search path is FTS (products_search_vec_idx). The `%` fallback
-- is removed from the query in the same change so the planner never seq-scans; re-add both if typo
-- analytics demand it.
drop index if exists catalog.products_name_trgm_idx;

create view catalog.products_search as
  select
    p.id, p.app, p.category, p.name, p.search_tokens,
    p.price_paisa, p.mrp_paisa, p.rating, p.reviews_count,
    p.emoji, p.image_url, p.desc_text, p.badge, p.shop, p.unit,
    p.attributes, p.store_id, p.is_prescription, p.is_veg,
    p.updated_at, p.search_vec
  from catalog.products p;