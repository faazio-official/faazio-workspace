-- 0081_payouts_seller_cycle_unique.sql
-- Restore the "one payout per (seller, cycle)" guarantee that 0077 intended.
--
-- 0015 created a NON-unique index named payouts_seller_cycle_idx on payments.payouts.
-- 0077 then ran `create unique index if not exists payouts_seller_cycle_idx` — because the
-- name already existed (non-unique), Postgres matches the name and silently skips creating
-- the unique index. The uniqueness constraint therefore never applied; duplicate payouts for
-- the same seller+cycle became possible.
--
-- Fix: drop the non-unique index, then create it unique. Wrapped in one transaction with a
-- duplicate preflight so a failure can never leave the table without its index: if duplicates
-- already exist, the DO block raises and the whole transaction (including the DROP) rolls back.
--
-- Idempotent — safe to re-run.

begin;

do $$
begin
  if exists (
    select 1
      from payments.payouts
     group by seller_id, cycle
    having count(*) > 1
  ) then
    raise exception 'payments.payouts has duplicate (seller_id, cycle) rows; merge them before applying 0081';
  end if;
end $$;

-- The DROP name MUST be schema-qualified: search_path here is "$user", public, extensions, so
-- an unqualified `drop index if exists payouts_seller_cycle_idx` silently resolves nothing and
-- no-ops. CREATE INDEX cannot take a schema-qualified name — it always creates in the table's
-- schema (payments) — so only the DROP is qualified here.
drop index if exists payments.payouts_seller_cycle_idx;
create unique index if not exists payouts_seller_cycle_idx on payments.payouts (seller_id, cycle);

commit;