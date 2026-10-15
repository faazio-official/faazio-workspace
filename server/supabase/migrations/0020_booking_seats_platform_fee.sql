-- Faazio MVP — seat-based bookings + ₹50/seat platform fee (Razorpay hold → settle/refund).
-- Authority: docs/architecture/db-schema.md §12.7, monolith-breakdown.md §1, mvp-backend.md §3.
-- Why: the 0011 booking model was a single live booking per (vendor, date, slot) — the opposite of
-- a restaurant opting into N-seat reservations with a per-seat fee. This migration is additive:
--   * a seller-private config row (a vendor opts in, sets total_seats / timings / tracking / pause);
--   * seats + fee + Razorpay ids on bookings.tables (status now defaults 'pending');
--   * a booking-scoped payments ledger (checkout.payments is order-only: order_id NOT NULL).
-- No slot/table model: pure seats. Rollback = booking_enabled stays false for every vendor.
--
-- Money freeze (§0.1): DB stores INT8 paisa; the gateway JSON projects whole rupees.
-- Razorpay Route is deliberately out of scope (100% of the fee is platform revenue in v1); the
-- ledger + gateway client are shaped so transfer/reversal calls can be added without schema churn.

create schema if not exists bookings;

-- ---------------------------------------------------------------- vendor ownership
-- A booking vendor is a store or a dining venue, but only stores carried seller_id (0015). Add the
-- same nullable owner to dining venues so config writes can be seller-scoped (a seller may only
-- configure a vendor they own; the gateway never trusts a client seller id). Additive + backfillable.
alter table directory.dining_venues add column if not exists seller_id text;
create index if not exists dining_venues_seller_idx on directory.dining_venues (seller_id);

-- ---------------------------------------------------------------- vendor booking config
-- One row per vendor. No FK on vendor_id: a vendor resolves to directory.stores (food stores) or
-- directory.dining_venues (pure dining rooms) — the directory.vendors union (same reason as
-- directory.menus.venue_id). seller_id is written by the gateway from the caller's claim, never a
-- client-supplied field. Config is seller-private: RLS enabled with no anon/authenticated policy,
-- so only service_role (the gateway) can read/write it — seat internals never reach the app.
create table if not exists bookings.venue_configs (
  vendor_id       text primary key,
  seller_id       text not null,
  booking_enabled bool not null default false,
  total_seats     int  not null default 0 check (total_seats between 0 and 500),
  track_occupancy bool not null default true,   -- false = "don't track filled seats" (no clearing during rush)
  open_time       time not null default '09:00',
  close_time      time not null default '21:00',
  paused          bool not null default false,  -- rush kill-switch: stops new requests instantly
  updated_at      timestamptz not null default now()
);
create index if not exists venue_configs_seller_idx on bookings.venue_configs (seller_id);

do $$ begin
  create trigger touch_venue_configs before update on bookings.venue_configs
    for each row execute function util.touch_updated_at();
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- booking lifecycle
-- confirmed = accepted (kept valid for 0011 rows); rejected = seller declined (refund);
-- completed = accepted party marked vacated (history kept for disputes). Never delete rows.
alter type booking_status add value if not exists 'rejected';
alter type booking_status add value if not exists 'completed';

alter table bookings.tables
  add column if not exists seats             int  not null default 1 check (seats between 1 and 30),
  add column if not exists fee_paisa         int8 not null default 0 check (fee_paisa >= 0),
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists idempotency_key   text;

-- New requests are holds (pending) for the seller to accept/reject; 0011 rows keep their value.
alter table bookings.tables alter column status set default 'pending';

-- Replay guard: one booking per (user, idempotency key) so a retried POST never double-holds.
create unique index if not exists tables_idempotency_idx
  on bookings.tables (user_id, idempotency_key) where idempotency_key is not null;

-- The 0011 exclusion index encodes the wrong model (one live booking per slot, not N seats).
drop index if exists bookings.bookings_vendor_slot_live_idx;

-- ---------------------------------------------------------------- booking payments ledger
-- money audit trail independent of booking status; webhook retries update one row idempotently.
create table if not exists bookings.payments (
  id                   text primary key,
  booking_id           text not null references bookings.tables (id) on delete cascade,
  user_id              text not null,
  amount_paisa         int8 not null check (amount_paisa >= 0),
  razorpay_order_id    text,
  razorpay_payment_id  text,
  status               text not null default 'CREATED',  -- CREATED|AUTHORIZED|CAPTURED|VOIDED|REFUNDED|FAILED
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists booking_payments_booking_idx on bookings.payments (booking_id);
-- One ledger row per Razorpay order/payment; webhook replays upsert onto it.
create unique index if not exists booking_payments_order_idx
  on bookings.payments (razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists booking_payments_payment_idx
  on bookings.payments (razorpay_payment_id) where razorpay_payment_id is not null;

do $$ begin
  create trigger touch_booking_payments before update on bookings.payments
    for each row execute function util.touch_updated_at();
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping booking seat-fee RLS (non-Supabase environment)';
    return;
  end if;

  -- Seller-private config: RLS on, no policy → anon/authenticated can never read seats/timings.
  execute 'alter table bookings.venue_configs enable row level security';

  -- Booking payments: own rows read only; writes are service_role (gateway transaction) only.
  execute 'alter table bookings.payments enable row level security';
  if not exists (
    select 1 from pg_policies
     where schemaname = 'bookings' and tablename = 'payments' and policyname = 'own_rows'
  ) then
    execute $p$create policy own_rows on bookings.payments for select to authenticated
      using (user_id = checkout.current_app_user_id())$p$;
  end if;
end;
$$;