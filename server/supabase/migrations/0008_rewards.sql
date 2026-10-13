-- Faazio MVP — server-authoritative rewards (coins / streak / ledger / discount card).
-- Authority: docs/architecture/db-schema.md §12.3, monolith-breakdown.md §1; mirrors
-- client `@data/rewards` + `features/rewards/rewardsLogic.ts` (COIN_EARN_RATE=1000 ₹/coin,
-- COIN_REDEEM_RATE=100 coins/₹, STREAK_TARGET_DAYS=7, DISCOUNT_CARD_PERCENT=10).
-- Why: coins were client-forgeable (AsyncStorage) and money-adjacent. Balances + an append-only
-- ledger make the server the single authority; the client stays optimistic and reconciles on read.
create schema if not exists rewards;

create type reward_entry_type as enum ('EARN', 'REDEEM', 'EXPIRE', 'STREAK');

create table rewards.balances (
  user_id        text primary key references checkout.users (user_id) on delete cascade,
  coins          int4 not null default 0 check (coins >= 0),
  streak         int4 not null default 0 check (streak >= 0),
  last_order_day date,
  card           jsonb check (card is null or octet_length(card::text) <= 2048),
  updated_at     timestamptz not null default now()
);

-- Append-only audit: no UPDATE/DELETE from anon/authenticated; service_role only.
create table rewards.ledger (
  id         text primary key,                -- 'rw-*'
  user_id    text not null references checkout.users (user_id) on delete cascade,
  type       reward_entry_type not null,
  coins      int4 not null,                   -- signed delta (EARN +, REDEEM/EXPIRE −)
  rupees     int4 not null default 0,
  order_id   text,
  created_at timestamptz not null default now()
);
create index rewards_ledger_user_created_idx on rewards.ledger (user_id, created_at desc);

-- Card-size guard for balances is inline; ledger is naturally bounded (append-only).

-- RLS (Supabase only): authenticated may read own balance + ledger; every write is service_role.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping rewards RLS (non-Supabase environment)';
    return;
  end if;

  execute 'alter table rewards.balances enable row level security';
  execute 'alter table rewards.ledger   enable row level security';
  execute $p$create policy own_rows on rewards.balances for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on rewards.ledger for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
end;
$$;