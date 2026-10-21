-- 0041_store_geo.sql — live-location retrieval.
--
-- Adds public store/venue coordinates so the gateway can answer nearby reads
-- (GET /stores/nearby, GET /products/nearby) with a bounding-box + Haversine
-- pass. Rows are nullable: a seller application may not have a pinned location
-- yet. Fixture coordinates are the deterministic points from @data/storeGeo.ts.
--
-- Apply after 0040_route_webhook_reversal.sql.

alter table directory.stores
  add column if not exists latitude  float8,
  add column if not exists longitude float8;

alter table directory.dining_venues
  add column if not exists latitude  float8,
  add column if not exists longitude float8;

-- Bounding-box scans then Haversine ordering; partial so un-pinned rows are skipped.
create index if not exists stores_geo_idx
  on directory.stores (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists dining_venues_geo_idx
  on directory.dining_venues (latitude, longitude)
  where latitude is not null and longitude is not null;

-- Seller applications capture the shop pin (foreground place-picker on mobile).
alter table sellers.sellers
  add column if not exists latitude  float8,
  add column if not exists longitude float8;

-- Backfill the fixture directory. Re-running is safe; live rows added later are untouched.
update directory.stores s
set latitude = v.latitude,
    longitude = v.longitude,
    updated_at = now()
from (values
  ('store-m1', 17.429824, 78.366828),
  ('store-m2', 17.453858, 78.397311),
  ('store-m3', 17.421730, 78.357970),
  ('store-m4', 17.446028, 78.389367),
  ('store-m5', 17.435363, 78.373058),
  ('store-m6', 17.447920, 78.391426),
  ('store-m7', 17.415672, 78.346160),
  ('store-m8', 17.463356, 78.422403),
  ('store-m9', 17.427045, 78.357401),
  ('store-g1', 17.445668, 78.371516),
  ('store-m10', 17.450163, 78.390653),
  ('store-m11', 17.426272, 78.365099),
  ('store-m12', 17.460830, 78.403414),
  ('store-m13', 17.423771, 78.361107),
  ('store-f1', 17.427377, 78.394695),
  ('store-f2', 17.447915, 78.369755),
  ('store-f3', 17.435381, 78.385770),
  ('store-f4', 17.460326, 78.358694),
  ('store-f5', 17.432892, 78.387195),
  ('store-f6', 17.464506, 78.352454),
  ('store-f7', 17.421903, 78.399642),
  ('store-f8', 17.464407, 78.357761),
  ('store-f9', 17.433119, 78.386052),
  ('store-f10', 17.417761, 78.376724),
  ('store-f11', 17.479231, 78.385049),
  ('store-f12', 17.434640, 78.379409),
  ('store-p1', 17.427082, 78.373396),
  ('store-p2', 17.448804, 78.384702),
  ('store-p3', 17.421757, 78.369833),
  ('store-p4', 17.463482, 78.389448),
  ('store-p5', 17.411681, 78.368007),
  ('store-p6', 17.472249, 78.394349)
) as v(id, latitude, longitude)
where s.id = v.id;

update directory.dining_venues v
set latitude = g.latitude,
    longitude = g.longitude
from (values
  ('store-f1', 17.427377, 78.394695),
  ('store-f2', 17.447915, 78.369755),
  ('store-f3', 17.435381, 78.38577),
  ('store-f4', 17.460326, 78.358694),
  ('store-f5', 17.432892, 78.387195),
  ('store-f6', 17.464506, 78.352454),
  ('store-f7', 17.421903, 78.399642),
  ('store-f8', 17.464407, 78.357761),
  ('store-f9', 17.433119, 78.386052),
  ('store-f10', 17.417761, 78.376724),
  ('store-f11', 17.479231, 78.385049),
  ('store-f12', 17.43464, 78.379409),
  ('tr-1', 17.422, 78.442),
  ('tr-2', 17.4319, 78.414),
  ('tr-3', 17.4435, 78.3772),
  ('tr-4', 17.4156, 78.4348),
  ('tr-5', 17.4287, 78.4041),
  ('tr-6', 17.4137, 78.4621),
  ('dn-1', 17.4435, 78.3772),
  ('dn-2', 17.4496, 78.3914),
  ('dn-3', 17.448, 78.3868),
  ('dn-4', 17.4435, 78.3772),
  ('dn-5', 17.4367, 78.3577),
  ('dn-6', 17.4849, 78.3993),
  ('dn-7', 17.4258, 78.3697),
  ('dn-8', 17.4415, 78.3813),
  ('dn-9', 17.4879, 78.3993),
  ('dn-10', 17.4297, 78.4094),
  ('dn-11', 17.4803, 78.3923),
  ('dn-12', 17.4419, 78.3806)
) as g(id, latitude, longitude)
where v.id = g.id;
