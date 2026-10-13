-- Faazio MVP — durable checkout idempotency.
-- Authority: docs/architecture/monolith-breakdown.md §4 (idempotency), caching-cloudflare-valkey.md §7.
-- Pairs with the Valkey NX EX lock (guards concurrency); this table makes a completed POST /orders
-- replay return the original order instead of re-running snapshots + stock decrements.
create table if not exists checkout.idempotency_keys (
  user_id    text not null references checkout.users (user_id) on delete cascade,
  key        text not null check (char_length(key) between 1 and 128),
  order_id   text not null references checkout.orders (order_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists idempotency_keys_created_idx on checkout.idempotency_keys (created_at);