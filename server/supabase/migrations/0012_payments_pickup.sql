-- Faazio MVP — durable pickup points + payments ledger + order pickup snapshot.
-- Authority: docs/architecture/db-schema.md §6.4, §7.5, §12; monolith-breakdown.md §1.
-- Why: PICKUP orders dropped their "Pickup From" snapshot on write (only the fulfillment enum was
-- persisted), and real money had no ledger. Pickup points replace the runtime-only NEUTRAL_PICKUP
-- derivation with a durable, cacheable row.
--
-- Pickup-point ids are the source `store.id` (so `pickup-<store>` resolution stays stable) or
-- `pickup-neutral` for the fallback hub; the gateway serves them publicly (business locations).

-- ---------------------------------------------------------------- pickup points
create table inventory.pickup_points (
  id         text primary key,
  store_id   text unique references directory.stores (id),
  name       text not null,
  address    text not null,
  phone      text,
  hours      text,
  is_active  bool not null default true,
  updated_at timestamptz not null default now()
);
create index pickup_points_active_idx on inventory.pickup_points (is_active);

-- ---------------------------------------------------------------- payments
create table checkout.payments (
  id              text primary key,                -- 'pay-*'
  order_id        text not null references checkout.orders (order_id) on delete cascade,
  user_id         text not null references checkout.users (user_id),
  method          text not null default '',
  amount_paisa    int8 not null check (amount_paisa >= 0),
  coins_redeemed  int4 not null default 0 check (coins_redeemed >= 0),
  status          text not null default 'PAID',
  created_at      timestamptz not null default now()
);
create index payments_order_idx on checkout.payments (order_id);
create index payments_user_created_idx on checkout.payments (user_id, created_at desc);

-- ---------------------------------------------------------------- order pickup snapshot
-- Persists today's PlacedOrder.pickup (single) / pickups (multi-vendor) snapshot so the "Pickup From"
-- card survives a server round-trip instead of living only on the device.
alter table checkout.orders add column if not exists pickup  jsonb
  check (pickup  is null or octet_length(pickup::text)  <= 2048);
alter table checkout.orders add column if not exists pickups jsonb
  check (pickups is null or octet_length(pickups::text) <= 2048);

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping payments/pickup RLS (non-Supabase environment)';
    return;
  end if;

  -- Public business locations (no customer PII).
  execute 'alter table inventory.pickup_points enable row level security';
  execute 'create policy anon_read on inventory.pickup_points for select to anon, authenticated using (true)';

  -- Payments: own rows read only; writes are service_role (checkout transaction) only.
  execute 'alter table checkout.payments enable row level security';
  execute $p$create policy own_rows on checkout.payments for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
end;
$$;