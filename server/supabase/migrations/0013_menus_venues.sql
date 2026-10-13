-- Faazio MVP — dining venue data + per-venue menus (no more hollow restaurant profiles).
-- Authority: docs/architecture/db-schema.md §12.4, monolith-breakdown.md §1.
-- Why: `directory.dining_venues(id,name)` was an identity stub, so every restaurant profile was
-- hollow in the DB. These columns + a menu table replace the `data/food/menus.ts` fixture.
--
-- No FK on `menus.venue_id` (deliberate): a menu belongs to a *vendor* id, which resolves either to
-- `directory.stores` (food stores) or `directory.dining_venues` (pure dining rooms) — the
-- `directory.vendors` union. A FK to either table would reject the other half.

alter table directory.dining_venues
  add column if not exists app         app_brand not null default 'FOOD',
  add column if not exists rating      real,
  add column if not exists cover_image text not null default '',
  add column if not exists address     text,           -- PII (physical)
  add column if not exists phone       text,           -- PII
  add column if not exists hours       text,
  add column if not exists categories  text[] not null default '{}';

create table directory.menus (
  venue_id   text not null,
  dish_id    text not null,
  name       text not null,
  price_paisa int8 not null check (price_paisa >= 0),
  is_veg     bool,
  cuisine    text,
  rating     real,
  image      text not null default '',
  primary key (venue_id, dish_id)
);
create index menus_venue_idx on directory.menus (venue_id);

-- RLS (Supabase only): public catalog data; PII columns are redacted in the gateway projection.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping menus RLS (non-Supabase environment)';
    return;
  end if;
  execute 'alter table directory.menus enable row level security';
  execute 'create policy anon_read on directory.menus for select to anon, authenticated using (true)';
end;
$$;