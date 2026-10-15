-- Faazio MVP — app-gap contract deltas (W25). Additive only; contract freeze intact.
-- Authority: docs/architecture/db-schema.md §12.4, monolith-breakdown.md §1.
--
-- Why: the Food restaurant menus still served `@data/food/menus.ts` because the durable
-- directory.menus projection dropped the display fields the SpecialDish card needs
-- (description / emoji / deliveryTime). RestaurantProfileScreen + RestaurantMenuScreen cannot
-- leave the fixture without them. Columns are nullable-with-default so every existing
-- seller-menu insert (which omits them) keeps working unchanged.
--
-- Venue list + blood-card projection need no DDL: `GET /venues` reads the existing
-- directory.dining_venues (0013) columns, and the blood dashboard deliberately stays on the
-- redacted blood.requests projection (no PII widening — db-schema.md §12.6).

alter table directory.menus
  add column if not exists description   text not null default '',
  add column if not exists emoji         text not null default '',
  add column if not exists delivery_time text not null default '';

-- RLS is unchanged: directory.menus remains public catalog data (anon_read from 0013); the
-- new columns carry no PII, so no policy change is needed.