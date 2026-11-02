-- Faazio MVP — move static reference data out of the clients and into the database.
-- Authority: docs/architecture/db-schema.md §reference data, monolith-breakdown.md §1.
--
-- Why: the portal and the mobile app each hardcode the state list and the ad-placement catalogue.
-- Two copies drift, and adding a state or a placement needs a client release. Both are now DB-backed
-- and served by the gateway (/geo/states, /ads/placements), so the clients carry no literals.
--
-- admins.district_master already exists (0046) and is already served by GET /geo/districts — no new
-- table is needed for districts.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------- states / union territories
create table if not exists admins.states (
  state_code char(2) primary key,
  name       text not null,
  kind       text not null default 'STATE' check (kind in ('STATE', 'UT')),
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists states_active_idx on admins.states (is_active, sort_order, name);

insert into admins.states (state_code, name, kind, sort_order) values
  ('AN', 'Andaman and Nicobar Islands (UT)', 'UT',    1),
  ('AP', 'Andhra Pradesh',                   'STATE', 2),
  ('AR', 'Arunachal Pradesh',                'STATE', 3),
  ('AS', 'Assam',                            'STATE', 4),
  ('BR', 'Bihar',                            'STATE', 5),
  ('CH', 'Chandigarh (UT)',                  'UT',    6),
  ('CT', 'Chhattisgarh',                     'STATE', 7),
  ('DH', 'Dadra and Nagar Haveli and Daman and Diu (UT)', 'UT', 8),
  ('DL', 'Delhi — National Capital Territory (UT)', 'UT', 9),
  ('GA', 'Goa',                              'STATE', 10),
  ('GJ', 'Gujarat',                          'STATE', 11),
  ('HR', 'Haryana',                          'STATE', 12),
  ('HP', 'Himachal Pradesh',                 'STATE', 13),
  ('JK', 'Jammu and Kashmir (UT)',           'UT',    14),
  ('JH', 'Jharkhand',                        'STATE', 15),
  ('KA', 'Karnataka',                        'STATE', 16),
  ('KL', 'Kerala',                           'STATE', 17),
  ('LA', 'Ladakh (UT)',                      'UT',    18),
  ('LD', 'Lakshadweep (UT)',                 'UT',    19),
  ('MP', 'Madhya Pradesh',                   'STATE', 20),
  ('MH', 'Maharashtra',                      'STATE', 21),
  ('MN', 'Manipur',                          'STATE', 22),
  ('ML', 'Meghalaya',                        'STATE', 23),
  ('MZ', 'Mizoram',                          'STATE', 24),
  ('NL', 'Nagaland',                         'STATE', 25),
  ('OR', 'Odisha',                           'STATE', 26),
  ('PY', 'Puducherry (UT)',                  'UT',    27),
  ('PB', 'Punjab',                           'STATE', 28),
  ('RJ', 'Rajasthan',                        'STATE', 29),
  ('SK', 'Sikkim',                           'STATE', 30),
  ('TN', 'Tamil Nadu',                       'STATE', 31),
  ('TG', 'Telangana',                        'STATE', 32),
  ('TR', 'Tripura',                          'STATE', 33),
  ('UP', 'Uttar Pradesh',                    'STATE', 34),
  ('UT', 'Uttarakhand',                      'STATE', 35),
  ('WB', 'West Bengal',                      'STATE', 36)
on conflict (state_code) do update
  set name = excluded.name, kind = excluded.kind, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------- ad placements
-- Mirrors the ad_placement enum (0027:16-21) plus the portal's display metadata. `apps` and
-- `target_types` are arrays so one row can serve several brands without a join table.
create table if not exists ads.placements (
  placement    text primary key,
  label        text not null,
  reach_note   text not null default '',
  apps         app_brand[] not null default '{}',
  target_types text[] not null default '{}',
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists placements_active_idx on ads.placements (is_active, sort_order);

insert into ads.placements (placement, label, reach_note, apps, target_types, sort_order) values
  ('HOME_HERO',     'Home hero',        'Full-width banner at the top of the customer home screen.',
   '{MART,FOOD,PHARMA}', '{APP}',        1),
  ('MART_HERO',     'Mart home hero',   'Top banner on the Mart home tab.',
   '{MART}',             '{APP}',        2),
  ('FOOD_HERO',     'Food home hero',   'Top banner on the Food home tab.',
   '{FOOD}',             '{APP}',        3),
  ('PHARMA_HERO',   'Pharma home hero', 'Top banner on the Pharma home tab.',
   '{PHARMA}',           '{APP}',        4),
  ('CATEGORY_TOP',  'Category top',     'First slot inside a category listing.',
   '{MART,FOOD,PHARMA}', '{CATEGORY}',   5),
  ('STORE_TOP',     'Store top',        'Featured slot on a vendor store page.',
   '{MART,FOOD,PHARMA}', '{STORE}',      6)
on conflict (placement) do update
  set label        = excluded.label,
      reach_note   = excluded.reach_note,
      apps         = excluded.apps,
      target_types = excluded.target_types,
      sort_order   = excluded.sort_order;

-- ---------------------------------------------------------------- app brands
-- The app_brand enum is a type, not a table, so it cannot be listed by a query. Clients need the
-- brand list plus display labels (/geo/apps); this is the ops-facing mirror.
create table if not exists ops.app_brand (
  brand      app_brand primary key,
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

insert into ops.app_brand (brand, label, sort_order) values
  ('MART',   'Faazio Mart',   1),
  ('FOOD',   'Faazio Food',   2),
  ('PHARMA', 'Faazio Pharma', 3)
on conflict (brand) do update set label = excluded.label, sort_order = excluded.sort_order;
