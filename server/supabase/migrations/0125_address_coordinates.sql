-- 0125_address_coordinates.sql — persist the exact lat/lng of a saved address.
--
-- Why: a saved address was text-only. Two things need real coordinates:
--
--   1. Proximity auto-select. On a fresh fix the app compares the device position against the
--      caller's saved rows and adopts the one it is standing in (≤200 m). Without a stored point
--      the comparison would need a forward geocode on every cold start — a network round-trip
--      that fails offline and can resolve to a different point than the one the user saved.
--   2. Delivery pricing + auto-dispatch. checkout.orders stores the drop fix captured at
--      placement (0044); if the customer picks a saved address in another city, the order's drop
--      point must be that address's point, not the device position. Storing the point on the
--      address makes the two agree by construction.
--
-- Additive and nullable: a row saved before this migration (or one whose pin was never dropped)
-- keeps working — the app falls back to the text address and its existing forward geocode. A
-- stored point is always both-or-neither, enforced below.
--
-- Apply after 0124_menu_taxonomy_dietary.sql.

alter table checkout.addresses
  add column if not exists latitude  float8,
  add column if not exists longitude float8;

-- Both-or-neither: a lone latitude (or lone longitude) is a bug, never a valid partial fix.
alter table checkout.addresses
  drop constraint if exists addresses_coordinates_both_or_neither;
alter table checkout.addresses
  add constraint addresses_coordinates_both_or_neither
  check ((latitude is null) = (longitude is null));

alter table checkout.addresses
  drop constraint if exists addresses_latitude_range;
alter table checkout.addresses
  add constraint addresses_latitude_range
  check (latitude is null or latitude between -90 and 90);

alter table checkout.addresses
  drop constraint if exists addresses_longitude_range;
alter table checkout.addresses
  add constraint addresses_longitude_range
  check (longitude is null or longitude between -180 and 180);

comment on column checkout.addresses.latitude is
  'Exact delivery point latitude (PII, paired with longitude). Null = text-only row saved before 0125 or never pinned.';
comment on column checkout.addresses.longitude is
  'Exact delivery point longitude (PII, paired with latitude). Null = text-only row saved before 0125 or never pinned.';
