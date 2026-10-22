-- Faazio Delivery Partner — delivery schema, KYC, dispatch, multi-stop routes and ratings.
-- Authority: docs/architecture/db-schema.md §12.23, docs/architecture/server-gateway-plan.md
-- (§delivery), docs/architecture/monolith-breakdown.md §1 (delivery context row).
--
-- Additive only (never rewrites 0001–0041). The existing customer/marketplace tables are untouched.
--
-- SECURITY / PII:
--   * Phone numbers, addresses and bank tails are PII. They are service_role-write only and are never
--     cached in Valkey or exposed to anon reads.
--   * KYC images live in the private R2 bucket; these tables hold object keys / media asset ids only,
--     never URLs, bytes or data-URLs.
--   * The delivery handover OTP is stored hashed by the gateway (delivery_stops.customer_otp_hash);
--     the plaintext never reaches Postgres and is never returned to the rider app.
--   * Live rider coordinates are authoritative in Valkey (delivery:rider:{id}:location, TTL 300 s).
--     rider_heartbeats is a low-frequency optional mirror, not the dispatch source.
--
-- Phase 5 (payout engine: seller/platform/rider splits, COD reconciliation, TDS, payout frequency)
-- is explicitly OUT OF SCOPE. `delivery_orders.payout_amount_paisa` is a display-only placeholder
-- and no payout table is created until the product decision is approved.

create schema if not exists delivery;

-- ================================================================ enums
do $$ begin
  create type delivery_partner_status as enum (
    'APPLIED', 'PENDING_REVIEW', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'BLACKLISTED', 'REJECTED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_vehicle_type as enum ('BICYCLE', 'TWO_WHEELER', 'FOUR_WHEELER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_doc_type as enum (
    'AADHAAR', 'PAN', 'SELFIE', 'DL_FRONT', 'DL_BACK', 'RC_FRONT', 'RC_BACK',
    'INSURANCE_FRONT', 'INSURANCE_BACK'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_doc_status as enum ('PENDING', 'VERIFIED', 'REJECTED', 'REUPLOAD_REQUESTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_bank_status as enum ('PENDING', 'VERIFIED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_order_status as enum (
    'ASSIGNED', 'ACCEPTED', 'REJECTED', 'ROUTE_COMPLETE', 'CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_stop_type as enum ('PICKUP', 'DROP');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_stop_status as enum (
    'PENDING', 'AT_PICKUP', 'PICKED_UP', 'AT_CUSTOMER', 'DELIVERED', 'FAILED'
  );
exception when duplicate_object then null; end $$;

-- ================================================================ delivery_boys
create table if not exists delivery.delivery_boys (
  rider_id          text primary key,                    -- stable slug, e.g. 'rider-1'
  auth_uid          text unique,                         -- Firebase UID (never the phone)
  -- checkout.users identity, linked at registration by auth middleware. Target of the shared
  -- notifications.outbox push path; never projected to a client.
  user_id           text,
  phone             text not null,                       -- E.164, PII — auth-scoped only
  full_name         text not null default '',
  state_code        char(2) not null,
  hub_zone          text not null default '',
  address           text not null default '',            -- PII
  city              text not null default '',
  pincode           text not null default '',
  emergency_contact text not null default '',            -- PII
  vehicle_type      delivery_vehicle_type not null default 'TWO_WHEELER',
  -- Capacity is hard-capped by vehicle at intake: BICYCLE=1, TWO_WHEELER=2, FOUR_WHEELER=5.
  max_capacity      smallint not null default 2 check (max_capacity between 1 and 5),
  status            delivery_partner_status not null default 'PENDING_REVIEW',
  is_available      boolean not null default false,
  current_load      smallint not null default 0 check (current_load >= 0),
  rating            real not null default 0 check (rating between 0 and 5),
  completed_orders  int4 not null default 0,
  last_heartbeat_at timestamptz,
  rejection_reason  text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists delivery_boys_state_status_idx
  on delivery.delivery_boys (state_code, status);
create index if not exists delivery_boys_available_idx
  on delivery.delivery_boys (state_code, is_available)
  where status = 'ACTIVE';
create unique index if not exists delivery_boys_phone_idx
  on delivery.delivery_boys (phone);

-- ================================================================ documents
create table if not exists delivery.delivery_documents (
  doc_id            text primary key,
  rider_id          text not null references delivery.delivery_boys (rider_id) on delete cascade,
  doc_type          delivery_doc_type not null,
  file_key          text not null,                       -- private R2 object key, never a URL
  asset_id          text,                                -- media.assets identity for private GET
  status            delivery_doc_status not null default 'PENDING',
  reviewed_by       text,
  reviewed_at       timestamptz,
  rejection_reason  text not null default '',
  uploaded_at       timestamptz not null default now(),
  unique (rider_id, doc_type)
);
create index if not exists delivery_documents_rider_idx
  on delivery.delivery_documents (rider_id);

-- ================================================================ bank accounts
create table if not exists delivery.delivery_bank_accounts (
  bank_account_id       text primary key,
  rider_id              text not null references delivery.delivery_boys (rider_id) on delete cascade,
  account_name          text not null,
  -- Only the masked tail is stored; the full number is never persisted (mirrors sellers.bank_accounts).
  account_number_masked text not null,
  ifsc                  text not null,
  cheque_key            text,                            -- private R2 key for the cancelled cheque
  cheque_asset_id       text,
  status                delivery_bank_status not null default 'PENDING',
  reviewed_by           text,
  reviewed_at           timestamptz,
  rejection_reason      text not null default '',
  created_at            timestamptz not null default now(),
  unique (rider_id)
);

-- ================================================================ delivery orders
create table if not exists delivery.delivery_orders (
  order_id                  text primary key,            -- dispatch job id, e.g. 'dlv-1'
  customer_order_id         text not null,               -- checkout.orders id (cross-context by id)
  store_id                  text not null,               -- directory.stores id
  rider_id                  text not null references delivery.delivery_boys (rider_id),
  status                    delivery_order_status not null default 'ASSIGNED',
  route_sequence            jsonb not null default '[]'::jsonb check (octet_length(route_sequence::text) <= 8192),
  total_distance_meters     int8 not null default 0,
  estimated_duration_seconds int8 not null default 0,
  -- Display-only placeholder. Phase 5 owns the real money split; do not treat as a ledger.
  payout_amount_paisa       int8 not null default 0,
  require_otp               boolean not null default false,
  assigned_at               timestamptz not null default now(),
  accepted_at               timestamptz,
  expires_at                timestamptz,
  completed_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists delivery_orders_rider_status_idx
  on delivery.delivery_orders (rider_id, status, created_at desc);
create index if not exists delivery_orders_customer_order_idx
  on delivery.delivery_orders (customer_order_id);

-- ================================================================ stops
create table if not exists delivery.delivery_stops (
  stop_id             text primary key,
  delivery_order_id   text not null references delivery.delivery_orders (order_id) on delete cascade,
  sequence            smallint not null check (sequence >= 1),
  stop_type           delivery_stop_type not null,
  status              delivery_stop_status not null default 'PENDING',
  label               text not null default '',          -- store/customer display name
  address             text not null default '',          -- PII (customer drop)
  latitude            float8,
  longitude           float8,
  customer_name       text not null default '',          -- PII
  customer_phone      text not null default '',          -- PII
  -- Handover OTP: SHA-256 of the 4-digit code + stop id. Never store plaintext.
  customer_otp_hash   text,
  otp_expires_at      timestamptz,
  failure_reason      text,
  arrived_at          timestamptz,
  completed_at        timestamptz,
  unique (delivery_order_id, sequence)
);
create index if not exists delivery_stops_order_idx
  on delivery.delivery_stops (delivery_order_id, sequence);

-- ================================================================ heartbeat mirror (optional)
-- The live dispatch source is Valkey. This table is a best-effort low-frequency mirror used for
-- auditing/analytics; writes must never block the rider request path.
create table if not exists delivery.rider_heartbeats (
  rider_id  text primary key references delivery.delivery_boys (rider_id) on delete cascade,
  last_seen timestamptz not null default now(),
  latitude  float8 not null,
  longitude float8 not null
);

-- ================================================================ ratings
create table if not exists delivery.delivery_ratings (
  rating_id          text primary key,
  delivery_order_id  text not null references delivery.delivery_orders (order_id) on delete cascade,
  rider_id           text not null references delivery.delivery_boys (rider_id) on delete cascade,
  customer_id        text not null,                      -- checkout.users id
  rating             smallint not null check (rating between 1 and 5),
  comment            text not null default '' check (char_length(comment) <= 1000),
  created_at         timestamptz not null default now(),
  unique (delivery_order_id)
);
create index if not exists delivery_ratings_rider_idx
  on delivery.delivery_ratings (rider_id, created_at desc);

-- ================================================================ RLS + grants (Supabase only)
-- The gateway (service_role) is the only writer. Authenticated clients may read their own rider
-- rows or, for admins, the rows in their state. Nothing here is anon-readable.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0042 RLS + grants (non-Supabase environment)';
    return;
  end if;

  grant usage on schema delivery to authenticated;

  create or replace function delivery.current_rider_id() returns text
    language sql stable
  as $$
    select rider_id from delivery.delivery_boys where auth_uid = auth.uid()::text limit 1
  $$;

  create or replace function delivery.is_super() returns boolean
    language sql stable
  as $$
    select coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'app_role',
      current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,app_role}',
      ''
    ) = 'SUPER_ADMIN'
  $$;

  create or replace function delivery.is_state_admin_for(p_state text) returns boolean
    language sql stable
  as $$
    select coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'app_role',
      current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,app_role}',
      ''
    ) = 'STATE_ADMIN'
    and coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'state_code',
      current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,state_code}',
      ''
    ) = upper(p_state)
  $$;

  grant select on delivery.delivery_boys to authenticated;
  grant select on delivery.delivery_documents to authenticated;
  grant select on delivery.delivery_bank_accounts to authenticated;
  grant select on delivery.delivery_orders to authenticated;
  grant select on delivery.delivery_stops to authenticated;
  grant select on delivery.delivery_ratings to authenticated;

  alter table delivery.delivery_boys enable row level security;
  alter table delivery.delivery_documents enable row level security;
  alter table delivery.delivery_bank_accounts enable row level security;
  alter table delivery.delivery_orders enable row level security;
  alter table delivery.delivery_stops enable row level security;
  alter table delivery.delivery_ratings enable row level security;

  execute 'drop policy if exists delivery_boys_read on delivery.delivery_boys';
  execute $p$create policy delivery_boys_read on delivery.delivery_boys for select to authenticated
    using (rider_id = delivery.current_rider_id()
           or delivery.is_super()
           or delivery.is_state_admin_for(state_code))$p$;

  execute 'drop policy if exists delivery_documents_read on delivery.delivery_documents';
  execute $p$create policy delivery_documents_read on delivery.delivery_documents for select to authenticated
    using (rider_id = delivery.current_rider_id() or delivery.is_super()
           or exists (select 1 from delivery.delivery_boys b
                       where b.rider_id = delivery_documents.rider_id
                         and delivery.is_state_admin_for(b.state_code)))$p$;

  execute 'drop policy if exists delivery_bank_read on delivery.delivery_bank_accounts';
  execute $p$create policy delivery_bank_read on delivery.delivery_bank_accounts for select to authenticated
    using (rider_id = delivery.current_rider_id() or delivery.is_super()
           or exists (select 1 from delivery.delivery_boys b
                       where b.rider_id = delivery_bank_accounts.rider_id
                         and delivery.is_state_admin_for(b.state_code)))$p$;

  execute 'drop policy if exists delivery_orders_read on delivery.delivery_orders';
  execute $p$create policy delivery_orders_read on delivery.delivery_orders for select to authenticated
    using (rider_id = delivery.current_rider_id() or delivery.is_super()
           or exists (select 1 from delivery.delivery_boys b
                       where b.rider_id = delivery_orders.rider_id
                         and delivery.is_state_admin_for(b.state_code)))$p$;

  execute 'drop policy if exists delivery_stops_read on delivery.delivery_stops';
  execute $p$create policy delivery_stops_read on delivery.delivery_stops for select to authenticated
    using (exists (select 1 from delivery.delivery_orders o
                   join delivery.delivery_boys b on b.rider_id = o.rider_id
                    where o.order_id = delivery_stops.delivery_order_id
                      and (o.rider_id = delivery.current_rider_id()
                           or delivery.is_super()
                           or delivery.is_state_admin_for(b.state_code))))$p$;

  execute 'drop policy if exists delivery_ratings_read on delivery.delivery_ratings';
  execute $p$create policy delivery_ratings_read on delivery.delivery_ratings for select to authenticated
    using (rider_id = delivery.current_rider_id() or delivery.is_super()
           or exists (select 1 from delivery.delivery_boys b
                       where b.rider_id = delivery_ratings.rider_id
                         and delivery.is_state_admin_for(b.state_code)))$p$;
end $$;
