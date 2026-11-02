-- Faazio MVP — remove the denormalized seller_id copies from products and menus.
-- Authority: docs/architecture/db-schema.md §catalog/directory, monolith-breakdown.md §1.
--
-- Why: catalog.products.seller_id (0015:84) and directory.menus.seller_id (0017:33) duplicate
-- ownership that directory.stores already holds. Two sources of truth drift: a product could name a
-- seller its store does not belong to, and a store could be re-owned without its products following.
-- Ownership now derives through store_id (products) and venue_id (menus).
--
-- Food dining-venue menus have no owner at all (directory.dining_venues is restaurant-only and not
-- seller-bound), which the derived model expresses correctly: a menu row whose venue is not in
-- directory.stores simply has no owner.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------- drop the duplicate columns
drop index if exists catalog.products_seller_status_idx;
alter table catalog.products drop column if exists seller_id;

drop index if exists directory.menus_seller_idx;
alter table directory.menus drop column if exists seller_id;

-- ---------------------------------------------------------------- derived-ownership indexes
-- Ownership lookups now go product -> store -> seller, so the store side must be indexed for it.
create index if not exists stores_seller_live_idx on directory.stores (seller_id, is_live);
