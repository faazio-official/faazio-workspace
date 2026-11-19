-- Faazio MVP — Tamil translations for the directory surface + Tamil-aware product search.
-- Authority: docs/architecture/db-schema.md §directory / §catalog, monolith-breakdown.md §1.
-- Extends 0107 (products + categories) to every seller-authored name the customer app renders:
-- Food dishes, add-ons, vendor stores and dining venues.
--
-- Rules (unchanged from 0107):
--   * English stays the canonical identity (slug, GST label lookup, cart/order line copy).
--   * `_ta` columns are display-only translations; empty string = "not translated yet" so the
--     customer app falls back to English.
--   * Search DOES cover Tamil: `catalog.products.search_vec` gains the Tamil product name at the
--     same weight as the English name, so an Indic-script query matches. The `simple` tsvector
--     config tokenises Tamil correctly and `unaccent` leaves the Tamil block untouched.
--
-- Idempotent: safe to re-run.

alter table directory.menus
  add column if not exists name_ta        text not null default '',
  add column if not exists description_ta text not null default '';

alter table directory.addons
  add column if not exists name_ta       text not null default '',
  add column if not exists group_name_ta text not null default '';

alter table directory.stores
  add column if not exists name_ta      text not null default '',
  add column if not exists desc_text_ta text not null default '';

alter table directory.dining_venues
  add column if not exists name_ta text not null default '';

-- Rebuild the generated FTS column so the Tamil product name is indexed. The view is dropped and
-- recreated because it is defined over `search_vec` (same pattern as 0002/0079).
drop view if exists catalog.products_search;

alter table catalog.products drop column if exists search_vec;

alter table catalog.products
  add column search_vec tsvector generated always as (
    setweight(to_tsvector('simple', catalog.immutable_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_ta, '')), 'A') ||
    setweight(to_tsvector('simple', catalog.immutable_unaccent(coalesce(catalog.immutable_array_to_string(search_tokens, ' '), ''))), 'B') ||
    setweight(to_tsvector('simple', catalog.immutable_unaccent(coalesce(category, ''))), 'C')
  ) stored;

create index products_search_vec_idx on catalog.products using gin (search_vec);

create view catalog.products_search as
  select
    p.id, p.app, p.category, p.name, p.name_ta, p.search_tokens,
    p.price_paisa, p.rating, p.reviews_count,
    p.emoji, p.image_url, p.desc_text, p.desc_text_ta, p.badge, p.shop, p.unit,
    p.attributes, p.store_id, p.is_prescription, p.is_veg,
    p.updated_at, p.search_vec
  from catalog.products p;
