-- Faazio MVP — store live flag (partner moderation surface).
-- Authority: docs/architecture/db-schema.md §12.10, monolith-breakdown.md §1.
-- Why: 0015 added seller scoping to directory.stores and its comment assumed a live flag already
-- existed there — it did not. The Portal `Store.isLive` field and the directory moderation flow
-- (W12) need a durable column, so this additive migration supplies it. Never rewrites 0001–0015.
--
-- Additive + idempotent: safe to re-run. Writes remain service_role (the gateway is the only
-- write path); stores keep their public anon read, so no new RLS policy is needed.

alter table directory.stores add column if not exists is_live boolean not null default true;

-- Moderation reads filter by state + live. 0015 created stores_state_live_idx on (state_code) only;
-- replace it with the composite so the live predicate is index-aligned (the composite still serves
-- state_code-only lookups, so nothing is lost).
drop index if exists directory.stores_state_live_idx;
create index if not exists stores_state_live_idx on directory.stores (state_code, is_live);