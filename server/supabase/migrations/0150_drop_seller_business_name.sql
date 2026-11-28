-- 0150 — Drop sellers.sellers.business_name.
--
-- The "Sell with us" application no longer asks for a business name: the account is identified by
-- the owner's name (step 1) and displayed everywhere through its first registered shop
-- (directory.stores.name). Existing rows are migrated by copying the business name into the shop
-- row that Create/CreateExtended already writes, so no display name is lost. Any legacy row
-- without a store keeps the name in the new backfill column-free form: owner_name is the fallback
-- used by the gateway's display-name coalesce.
--
-- Idempotent; safe to re-run.

-- 1. Copy the business name into each seller's first shop where the shop name is missing.
update directory.stores st
   set name = s.business_name
  from sellers.sellers s
 where st.seller_id = s.seller_id
   and s.business_name is not null
   and s.business_name <> ''
   and (st.name is null or st.name = '')
   and st.id = (
         select st2.id from directory.stores st2
          where st2.seller_id = s.seller_id
          order by st2.created_at
          limit 1
       );

-- 2. Drop the dependent indexes/constraints, then the column.
alter table sellers.sellers drop column if exists business_name;
