-- Faazio MVP — platform-fee change requests target a VENDOR, not the account.
-- Authority: docs/architecture/db-schema.md §sellers, monolith-breakdown.md §1.
--
-- Why: the fee is a property of the shop (0069 moved it onto directory.stores). A seller who owns a
-- 6% Food kitchen and a 12% Mart electronics shop must be able to request a change to one of them
-- without touching the other, and an admin must approve against the specific shop.
--
-- The existing seller_id column stays: it is the account that filed the request (scope + audit).
-- store_id is what the decision actually applies to.
--
-- Idempotent: safe to re-run.

alter table sellers.seller_fee_change_requests
  add column if not exists store_id text references directory.stores (id) on delete cascade;

create index if not exists seller_fee_requests_store_idx
  on sellers.seller_fee_change_requests (store_id, status, requested_at desc);

-- One pending request per VENDOR (was: per seller, 0049:35). An account with three vendors may have
-- three pending requests open at once, one per shop.
drop index if exists sellers.seller_fee_requests_one_pending_idx;
create unique index if not exists seller_fee_requests_one_pending_per_store_idx
  on sellers.seller_fee_change_requests (store_id)
  where status = 'PENDING' and store_id is not null;

-- Backfill: pre-existing requests were account-level. Point them at the account's first store so the
-- approval path (which now writes directory.stores.platform_fee_pct) has a target. Requests whose
-- account owns no store stay NULL and are treated as legacy account-level rows by the handler.
update sellers.seller_fee_change_requests f
   set store_id = (
         select d.id from directory.stores d
          where d.seller_id = f.seller_id
          order by d.id
          limit 1)
 where f.store_id is null;
