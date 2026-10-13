-- Faazio MVP — partner completion (the last control-plane surfaces the Portal needs).
-- Authority: docs/architecture/db-schema.md §12.11, monolith-breakdown.md §1, mvp-backend.md §7.
-- Why: 0015/0016 gave the Portal a durable origin but left four surfaces with no row to read:
-- customer monitoring (W17), food-menu editing (W18), admin-tunable rewards rates (W19) and a
-- state-scoped support queue (W20). Additive only (never rewrites 0001–0016), so the mobile app
-- keeps running. Inherits the §0.1 lean dtype freeze. Idempotent: safe to re-run.

-- ================================================================ W17: customer monitoring
-- A PII-redacted projection over checkout.users + their orders. The base table keeps its own-rows
-- RLS untouched; the view is created WITH (security_invoker = on) so it never becomes an RLS bypass
-- for direct Supabase clients, and no anon/authenticated SELECT is granted — only the gateway
-- (service_role) reads it. state_code is nullable and populated by signup/mobile in future.
alter table checkout.users add column if not exists state_code char(2);
create index if not exists users_state_idx on checkout.users (state_code);

create or replace view checkout.users_admin
  with (security_invoker = on) as
  select u.user_id,
         u.name,
         u.state_code,
         u.created_at,
         count(o.order_id)::int4              as orders_count,
         coalesce(sum(o.total_paisa), 0)::int8 as spend_paisa,
         max(o.placed_at)                     as last_order_at
    from checkout.users u
    left join checkout.orders o on o.user_id = u.user_id
   group by u.user_id, u.name, u.state_code, u.created_at;

-- ================================================================ W18: food-menu seller scope
-- directory.menus reuse the catalog.products seller/status model (0015) so menu edits are
-- seller-scoped and state-moddable. Nullable owner; status defaults DRAFT (seed rows stay readable
-- because listing tolerates any status, moderation filters on it).
alter table directory.menus add column if not exists seller_id text;
alter table directory.menus add column if not exists status product_status not null default 'DRAFT';
create index if not exists menus_seller_idx on directory.menus (seller_id, status);
create index if not exists menus_venue_idx2 on directory.menus (venue_id, status);

-- ================================================================ W19: admin-tunable rewards rates
-- Replaces the static gateway constants (@data/rewards COIN_EARN_RATE=1000 ₹/coin, COIN_REDEEM_RATE=100
-- coins/₹1, STREAK_TARGET_DAYS=7, DISCOUNT_CARD_PERCENT=10, valid 5 days) with one admin-editable row.
-- The gateway falls back to the constants when the row is absent, so an empty table is safe. The
-- ledger/balances stay server-only writes (Earn) — this only changes the *earn* factor, never history.
create table if not exists rewards.rates (
  rate_id               text primary key default 'default',
  coin_earn_rate        smallint not null check (coin_earn_rate        between 1 and 10000),
  coin_redeem_rate      smallint not null check (coin_redeem_rate      between 1 and 10000),
  streak_target_days    smallint not null check (streak_target_days    between 1 and 90),
  discount_card_percent smallint not null check (discount_card_percent between 0 and 90),
  card_validity_days    smallint not null check (card_validity_days    between 1 and 90),
  updated_at            timestamptz not null default now()
);

-- Default row mirrors the frozen constants (also asserted by seed/generate.mjs assertLeanContract).
insert into rewards.rates (rate_id, coin_earn_rate, coin_redeem_rate, streak_target_days, discount_card_percent, card_validity_days)
values ('default', 1000, 100, 7, 10, 5)
on conflict (rate_id) do nothing;

-- ================================================================ W20: state-scoped support queue
-- Nullable: customer-created tickets have no state; the gateway derives the state scope from the
-- caller's claim and leaves this column for admin-assigned tickets.
alter table support.tickets add column if not exists state_code char(2);
create index if not exists tickets_state_status_idx on support.tickets (state_code, status);

-- ================================================================ updated_at trigger
do $$
begin
  execute 'drop trigger if exists touch_updated_at on rewards.rates';
  execute 'create trigger touch_updated_at before update on rewards.rates
             for each row execute function util.touch_updated_at()';
end;
$$;

-- ================================================================ RLS + grants (Supabase only)
-- Defence-in-depth for direct Supabase clients only; the gateway (service_role) bypasses RLS and is
-- the real enforcer. The users_admin view is intentionally NOT granted to anon/authenticated.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0017 RLS (non-Supabase environment)';
    return;
  end if;

  execute 'grant usage on schema rewards to anon, authenticated';
  execute 'alter table rewards.rates enable row level security';

  execute 'drop policy if exists admin_read on rewards.rates';
  execute $p$create policy admin_read on rewards.rates for select to authenticated
    using (coalesce(auth.jwt() ->> 'app_role', '') in ('STATE_ADMIN', 'SUPER_ADMIN'))$p$;

  -- Menu status moderation mirrors products/stores: public reads stay anon (0001/0013 grants), so no
  -- new SELECT policy is needed; writes are service_role only.
  execute 'alter table directory.menus enable row level security';

  -- tickets: admins read by their state (or all when super); customer/seller own-row policies from
  -- 0015 still apply.
  execute 'drop policy if exists admin_state_read on support.tickets';
  execute $p$create policy admin_state_read on support.tickets for select to authenticated
    using (coalesce(auth.jwt() ->> 'app_role', '') = 'SUPER_ADMIN'
           or (coalesce(auth.jwt() ->> 'app_role', '') = 'STATE_ADMIN'
               and state_code = coalesce(auth.jwt() ->> 'state_code', ''))) $p$;
end;
$$;