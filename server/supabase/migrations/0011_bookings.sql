-- Faazio MVP — durable dinner/table bookings + food order bookings.
-- Authority: docs/architecture/db-schema.md §12.7, monolith-breakdown.md §1.
-- Why: bookingStore + foodBookingStore existed with zero durability; the schema previously pretended
-- they did not exist. Unify both before they diverge.
create schema if not exists bookings;

do $$ begin
  create type booking_status as enum ('pending', 'confirmed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table bookings.tables (
  id           text primary key,                -- 'BKG-*'
  user_id      text not null references checkout.users (user_id) on delete cascade,
  vendor_id    text not null,
  restaurant_name text not null default '',
  booking_date date not null,
  slot         text not null default '',
  guests       smallint not null default 1 check (guests between 1 and 30),
  status       booking_status not null default 'confirmed',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index bookings_user_date_idx on bookings.tables (user_id, booking_date desc);
-- Exclusion guard: one live booking per (vendor, date, slot); cancelled rows free the slot.
create unique index bookings_vendor_slot_live_idx
  on bookings.tables (vendor_id, booking_date, slot) where status <> 'cancelled';

create table bookings.food_orders (
  order_id    text primary key,                 -- 'BKG-*'
  user_id     text not null references checkout.users (user_id) on delete cascade,
  dish        jsonb not null check (octet_length(dish::text) <= 2048),
  guests      smallint not null default 1 check (guests between 1 and 30),
  booking_date date not null,
  slot        text not null default '',
  added_ids   text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index food_orders_user_created_idx on bookings.food_orders (user_id, created_at desc);

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping bookings RLS (non-Supabase environment)';
    return;
  end if;

  execute 'alter table bookings.tables     enable row level security';
  execute 'alter table bookings.food_orders enable row level security';
  execute $p$create policy own_rows on bookings.tables for all to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;
  execute $p$create policy own_rows on bookings.food_orders for all to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;
end;
$$;