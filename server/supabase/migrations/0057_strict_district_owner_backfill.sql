-- Faazio MVP — backfill seller ownership used by strict district scoping.
--
-- Why: DISTRICT_ADMIN access to catalog/directory/pharma is now district-precise (no state
-- fallback). Rows without a seller owner cannot be attributed to a district and are hidden from
-- district admins; SUPER_ADMIN still sees them. This migration derives ownership where the schema
-- already records it (store -> seller, product -> store, menu -> store) so live rows stay reachable.
-- It is additive/idempotent and does not invent an owner for orphan rows.
--
-- Apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

-- Store state follows its owning seller when the store row has no state yet.
update directory.stores s
   set state_code = se.state_code
  from sellers.sellers se
 where s.seller_id = se.seller_id
   and s.state_code is null;

-- Products inherit the seller of their store when the product itself has no owner.
update catalog.products p
   set seller_id = s.seller_id
  from directory.stores s
 where p.store_id = s.id
   and p.seller_id is null
   and s.seller_id is not null;

-- Menus inherit the seller of their store venue when the menu itself has no owner. Menus attached
-- only to a dining venue have no seller and remain SUPER_ADMIN-only under strict scoping.
update directory.menus m
   set seller_id = s.seller_id
  from directory.stores s
 where m.venue_id = s.id
   and m.seller_id is null
   and s.seller_id is not null;
