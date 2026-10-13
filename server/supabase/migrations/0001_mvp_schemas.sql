-- Faazio MVP — schemas, extensions, and tables.
-- Authority: docs/architecture/mvp-backend.md §2, docs/architecture/db-schema.md §2–§8.
-- Datatypes are the frozen contract (monolith-breakdown.md §4): stable string slug PKs,
-- INT8 paisa money, TIMESTAMPTZ, native ENUMs. Postgres-compatible with Future Prod CockroachDB.
--
-- Ordering note: directory.stores is created before catalog.products because products.store_id
-- references it.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fuzzy / autocomplete
create extension if not exists unaccent;   -- accent-insensitive FTS

-- pg_cron is present on Supabase; tolerate its absence on a bare local Postgres.
do $$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable — skipping (non-Supabase environment)';
end $$;

create schema if not exists catalog;
create schema if not exists directory;
create schema if not exists reviews;
create schema if not exists checkout;
create schema if not exists accounts;
create schema if not exists inventory;

-- ---------------------------------------------------------------- shared enums
create type app_brand as enum ('MART', 'FOOD', 'PHARMA');
create type order_status as enum ('Processing', 'Shipped', 'Delivered', 'Cancelled');
create type fulfillment_mode as enum ('DELIVERY', 'PICKUP');

-- ---------------------------------------------------------------- directory
create table directory.stores (
  id            text primary key,             -- stable slug, e.g. 'store-m3'
  app           app_brand not null,
  name          text not null,
  categories    text[] not null default '{}',
  rating        float8 not null default 0,
  reviews_count int8 not null default 0,
  delivery_time text not null default '',
  distance      text not null default '',
  cover_image   text not null default '',
  emoji         text not null default '',
  desc_text     text not null default '',
  offer_tag     text,
  is_veg        bool,
  address       text,                          -- PII (physical)
  phone         text,                          -- PII
  hours         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index stores_app_idx on directory.stores (app);

-- Identity-only dining venues (feature mocks). Full venue-data migration is a separate task.
create table directory.dining_venues (
  id   text primary key,
  name text not null
);

-- Vendor identity view: Mart/Pharma stores + Food dining venues, identity only.
create view directory.vendors as
  select id, app, name from directory.stores
  union all
  select id, 'FOOD'::app_brand, name from directory.dining_venues;

-- ---------------------------------------------------------------- catalog
create table catalog.products (
  id              text primary key,            -- stable slug, e.g. 'md-1'
  slug_uid        uuid not null default gen_random_uuid(),
  app             app_brand not null,
  category        text not null,
  name            text not null,
  search_tokens   text[] not null default '{}',
  price_paisa     int8 not null,
  mrp_paisa       int8,
  rating          float8 not null default 0,
  reviews_count   int8 not null default 0,
  emoji           text not null default '',
  image_url       text not null default '',
  desc_text       text not null default '',
  badge           text,
  shop            text,
  unit            text,
  attributes      jsonb,
  store_id        text references directory.stores (id),
  is_prescription boolean not null default false,
  is_veg          bool,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index products_app_idx      on catalog.products (app);
create index products_category_idx on catalog.products (category);
create index products_store_idx    on catalog.products (store_id);
create index products_price_idx    on catalog.products (price_paisa);
create index products_rating_idx   on catalog.products (rating desc);
create index products_attrs_idx    on catalog.products using gin (attributes);

-- ---------------------------------------------------------------- inventory
create table inventory.stock (
  product_id      text primary key,
  available       bool not null default true,
  in_stock_qty    int8 not null default 0,
  price_paisa     int8 not null,
  mrp_paisa       int8,
  eta             text not null default '',
  is_prescription bool,
  updated_at      timestamptz not null default now()
);

-- Auth-scoped cart (one row per user). Never edge-cached.
create table inventory.carts (
  user_id    text primary key,
  items      jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Reservation TTL (released back to stock by the pg_cron sweep in 0003).
create table inventory.stock_reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  user_id        text not null,
  product_id     text not null,
  qty            int8 not null check (qty > 0),
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);
create index stock_reservations_expiry_idx on inventory.stock_reservations (expires_at);

-- ---------------------------------------------------------------- checkout
create table checkout.users (
  user_id            text primary key,          -- 'user-1' (stable slug)
  user_uid           uuid not null default gen_random_uuid(),
  auth_uid           uuid unique,               -- Supabase Auth (auth.users.id) → app user
  name               text not null,
  email              text not null,
  phone              text not null,             -- PII
  default_address_id text,
  created_at         timestamptz not null default now()
);

create table checkout.addresses (
  address_id text primary key,
  user_id    text not null references checkout.users (user_id),
  label      text not null default '',
  name       text,                              -- PII
  phone      text,                              -- PII
  address    text not null,                     -- PII
  is_default bool not null default false
);

create table checkout.coupons (
  code             text primary key,
  discount_percent int8 not null default 0,
  label            text not null,
  min_order_paisa  int8,
  is_free_delivery bool not null default false
);

create table checkout.orders (
  order_id        text primary key,
  order_number    text not null,
  user_id         text not null references checkout.users (user_id),
  address_id      text,
  placed_at       timestamptz not null,
  status          order_status not null,
  status_date     timestamptz,
  fulfillment     fulfillment_mode,             -- null = delivery
  total_paisa     int8 not null default 0,
  vendor_store_ids text[] not null default '{}',-- vendor identity snapshot (§7.7)
  created_at      timestamptz not null default now()
);
create index orders_user_placed_idx on checkout.orders (user_id, placed_at desc);

create table checkout.order_items (
  line_id          text primary key,
  order_id         text not null references checkout.orders (order_id),
  product_id       text,
  name             text not null,
  variant          text,
  qty              int8 not null,
  unit_price_paisa int8 not null
);
create index order_items_order_idx on checkout.order_items (order_id);

-- ---------------------------------------------------------------- accounts
create table accounts.profile (
  id         text primary key,                  -- 'user-1'
  account_id text not null,
  name       text not null,
  email      text not null,                     -- PII
  phone      text not null,                     -- PII
  updated_at timestamptz not null default now()
);

create table accounts.membership (
  id          text primary key,
  user_id     text not null,
  title       text not null,
  saved_label text,
  saved_amount int8
);

create table accounts.order_status (
  id     text primary key,
  user_id text not null,
  key    text not null,
  label  text not null,
  count  int8 not null default 0
);

create table accounts.nav (
  user_id text not null,
  key     text not null,
  rows    jsonb not null default '[]',
  primary key (user_id, key)
);

create table accounts.details (
  user_id    text primary key,
  account_id text,
  data       jsonb not null default '{}'
);

-- ---------------------------------------------------------------- reviews
create table reviews.reviews (
  id         text primary key,                  -- 'rev-1','prv-1'
  product_id text not null,
  app        app_brand not null,
  user_name  text not null,                     -- reviewer name (PII-ish)
  avatar     text,
  rating     int8 not null check (rating between 1 and 5),
  comment    text not null default '',
  date_label text not null default '',          -- display label ('2 days ago')
  created_at timestamptz not null default now()
);
create index reviews_product_idx on reviews.reviews (product_id);

create table reviews.specs (
  id    text primary key,
  app   app_brand not null,
  label text not null,
  value text not null
);

create table reviews.highlights (
  id   text primary key,
  app  app_brand not null,
  text text not null
);

create table reviews.vendor_reviews (
  id         text primary key,                  -- 'vr-g1-1'
  vendor_id  text not null,                     -- → directory.vendors.id
  app        app_brand not null,
  user_id    text not null,                     -- author (PII linkage — never public)
  user_name  text not null,                     -- public display name only
  rating     int8 not null check (rating between 1 and 5),
  comment    text,
  order_ids  text[] not null default '{}',      -- verified-purchase provenance (never public)
  date_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, user_id)                   -- one live rating per (user, vendor)
);
create index vendor_reviews_vendor_idx on reviews.vendor_reviews (vendor_id);

-- ---------------------------------------------------------------- updated_at touch
create or replace function catalog.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- Notify the sync path (Future Prod: Tantivy reindex; MVP: cache purge hook).
  perform pg_notify('catalog_updated', new.id);
  return new;
end;
$$;

create trigger products_touch_updated_at
  before update on catalog.products
  for each row execute function catalog.touch_updated_at();