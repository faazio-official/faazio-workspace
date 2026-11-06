-- 0082_order_items_store_id_backfill.sql
-- Data fix: attribute every un-owned order_items line to its store.
--
-- 0078 added checkout.order_items.store_id and backfilled online at migration time, but rows
-- written outside checkout.InsertOrderTx (seed fixtures, order replays that pre-date the
-- column) still carry NULL. The per-store payout computation (payouts/repo.go) filters
-- `oi.store_id is not null`, so those lines are invisible on the seller ledger/payout board.
--
-- Two passes:
--   1. product-backed lines → the product's home store (catalog.products.store_id), same as 0078.
--   2. lines pass 1 could not resolve (product with no home store, or a product-less `past-*`
--      demo line) → the order's single vendor store (`vendor_store_ids`). Multi-vendor orders
--      are left NULL (no safe single attribution); dining-venue `dn-*` pickups have no
--      seller/payout and also stay NULL.
--
-- Idempotent — safe to re-run.

update checkout.order_items oi
   set store_id = p.store_id
  from catalog.products p
 where oi.product_id = p.id
   and oi.store_id is null
   and p.store_id is not null
   and p.store_id <> '';

update checkout.order_items oi
   set store_id = o.vendor_store_ids[1]
  from checkout.orders o
 where oi.order_id = o.order_id
   and oi.store_id is null
   and coalesce(array_length(o.vendor_store_ids, 1), 0) = 1
   and o.vendor_store_ids[1] <> ''
   and exists (select 1 from directory.stores s where s.id = o.vendor_store_ids[1]);
