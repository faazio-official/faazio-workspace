-- Faazio MVP — Postgres FTS search index.
-- Authority: docs/architecture/mvp-backend.md §2/§5; replaces the Future Prod Tantivy index.
-- The generated tsvector column lives on the base table (so it can be GIN-indexed); the
-- `catalog.products_search` view exposes it for read queries. No refresh needed — it is
-- maintained by the write, unlike a materialized view.

-- unaccent() is STABLE (dictionary-dependent); wrap it IMMUTABLE so it can be used in a
-- generated column. This is the standard Postgres/Supabase pattern.
create or replace function catalog.immutable_unaccent(txt text)
returns text language sql immutable parallel safe as $$
  select unaccent('unaccent', coalesce(txt, ''))
$$;

-- array_to_string() is STABLE (element output fn may be non-immutable); wrap it IMMUTABLE
-- so the token array can feed a generated column.
create or replace function catalog.immutable_array_to_string(arr text[], sep text)
returns text language sql immutable parallel safe as $$
  select array_to_string(arr, sep)
$$;

alter table catalog.products
  add column search_vec tsvector generated always as (
    setweight(to_tsvector('simple', catalog.immutable_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('simple', catalog.immutable_unaccent(coalesce(catalog.immutable_array_to_string(search_tokens, ' '), ''))), 'B') ||
    setweight(to_tsvector('simple', catalog.immutable_unaccent(coalesce(category, ''))), 'C')
  ) stored;

create index products_search_vec_idx on catalog.products using gin (search_vec);
create index products_name_trgm_idx  on catalog.products using gin (name gin_trgm_ops);

-- Read surface the gateway/search context queries. ID-only refs stay in Mongo; this view
-- is the durable FTS source. Search cache key: faazio:v1:search:q:{query} (TTL 600 s).
create view catalog.products_search as
  select
    p.id, p.slug_uid, p.app, p.category, p.name, p.search_tokens,
    p.price_paisa, p.mrp_paisa, p.rating, p.reviews_count,
    p.emoji, p.image_url, p.desc_text, p.badge, p.shop, p.unit,
    p.attributes, p.store_id, p.is_prescription, p.is_veg,
    p.updated_at, p.search_vec
  from catalog.products p;