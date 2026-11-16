-- Faazio — delivery calling sessions (masked VoIP + PSTN fallback).
-- Authority: docs/architecture/db-schema.md (§12.23 delivery.*), monolith-breakdown.md §1
-- (delivery row), user-interaction-workflow/delivery/calling/*.
--
-- Why: the rider app needs a server-authoritative call session so the gateway (not the app) decides
-- VOIP vs PSTN_BRIDGING, records the ringing acknowledgement, and enforces one open call per rider.
-- The row never stores a provider secret, the customer's phone number, or either peer's raw number:
-- VOIP keeps only the 100ms room id; PSTN keeps only the platform virtual number.
--
-- Additive and idempotent; apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md.
-- Never auto-run on Render.

create schema if not exists delivery;

do $$ begin
  create type delivery_call_mode as enum ('VOIP', 'PSTN_BRIDGING');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_call_status as enum (
    'RINGING', 'ACTIVE', 'ENDED', 'REJECTED', 'FAILED', 'MISSED', 'BUSY'
  );
exception when duplicate_object then null; end $$;

create table if not exists delivery.calls (
  call_id            text primary key,
  order_id           text not null references delivery.delivery_orders (order_id) on delete cascade,
  rider_id           text not null references delivery.delivery_boys (rider_id) on delete cascade,
  -- RIDER for the partner-app outgoing flow; CUSTOMER for the customer-app mirror.
  initiated_by       text not null check (initiated_by in ('RIDER', 'CUSTOMER')),
  -- Masked peer role only (never a name or phone number).
  peer_role          text not null default 'CUSTOMER' check (peer_role in ('CUSTOMER', 'DELIVERY_PARTNER')),
  mode               delivery_call_mode not null,
  status             delivery_call_status not null default 'RINGING',
  -- 100ms room id for VOIP; empty for PSTN.
  provider_room_id   text not null default '',
  -- Telephony provider call reference (Exotel/Edesy); empty until the provider webhook lands.
  provider_call_ref  text not null default '',
  -- Masked virtual landline the rider dials for PSTN_BRIDGING; empty for VOIP.
  virtual_number     text not null default '',
  ringing_ack_at     timestamptz,
  accepted_at        timestamptz,
  ended_at           timestamptz,
  end_reason         text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- At most one open call per rider. A second initiate is rejected until the first ends/rejects.
create unique index if not exists calls_one_open_per_rider
  on delivery.calls (rider_id)
  where status in ('RINGING', 'ACTIVE');

create index if not exists calls_order_idx
  on delivery.calls (order_id, created_at desc);
create index if not exists calls_rider_idx
  on delivery.calls (rider_id, created_at desc);

comment on table delivery.calls is
  'Server-authoritative delivery call sessions. Masked identities only; no phone numbers or provider secrets.';
comment on column delivery.calls.ringing_ack_at is
  'Set when the callee device acknowledges the ring; a VOIP call with no ack after 3 s can fall back to PSTN.';

-- RLS + grants (Supabase only). The gateway (service_role) is the only writer; riders read their own
-- rows and state/super admins read rows in scope, mirroring delivery_boys.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0104 RLS + grants (non-Supabase environment)';
    return;
  end if;

  grant select on delivery.calls to authenticated;

  alter table delivery.calls enable row level security;

  execute 'drop policy if exists calls_read on delivery.calls';
  execute $p$create policy calls_read on delivery.calls for select to authenticated
    using (rider_id = delivery.current_rider_id()
           or delivery.is_super()
           or exists (select 1 from delivery.delivery_boys b
                       where b.rider_id = calls.rider_id
                         and delivery.is_state_admin_for(b.state_code)))$p$;
end $$;
