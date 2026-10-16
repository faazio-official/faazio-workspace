-- Faazio MVP — Mart vendor-inventory read (app-aligned, additive).
-- Authority: docs/architecture/db-schema.md §12.15, monolith-breakdown.md §1, mvp-backend.md §3.
-- Why: the buyer vendor drill-in (`GET /stores/{id}/products`) filters `store_id = $1 AND status =
-- 'ACTIVE'`. The existing `products_store_idx` + `products_status_idx` do not cover the joint filter,
-- so add a composite index. The seeded catalog rows were inserted before `status` existed and
-- defaulted to `DRAFT` (0015), which would make the ACTIVE-only endpoint return empty; backfill them.
-- Idempotent; safe to re-run.

-- Joint filter index for the store-scoped ACTIVE list.
create index if not exists products_store_status_idx
  on catalog.products (store_id, status);

-- Backfill the seeded catalog rows (sellerless demo data) to ACTIVE. Scoped to `seller_id is null`
-- so a real seller's DRAFT/PENDING_REVIEW rows are never promoted. Pairs with the generator change
-- that now writes `status = 'ACTIVE'` for seed rows.
update catalog.products
   set status = 'ACTIVE'
 where status = 'DRAFT'
   and seller_id is null;