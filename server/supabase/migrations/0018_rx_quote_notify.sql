-- Faazio MVP — Pharma Rx quote → READY reveal → notify, plus a durable notification outbox.
-- Authority: docs/architecture/db-schema.md §12.12, monolith-breakdown.md §1, mvp-backend.md §2/§3.
-- Why: the partner quote workflow (seller prices the Rx, flips it READY, customer is told) and every
-- other "tell the customer" event had no row to live in. Additive only (never rewrites 0001–0017) so
-- the mobile app keeps running. Inherits the §0.1 lean dtype freeze. Idempotent: safe to re-run.

-- ================================================================ W24: prescription quote lifecycle
-- Extend the frozen enum with the two partner-quote states. ADD VALUE IF NOT EXISTS is idempotent.
alter type prescription_status add value if not exists 'QUOTED';
alter type prescription_status add value if not exists 'READY';

-- quote_items are the seller-entered lines behind a prescription quote. Money is INT8 paisa
-- (rupees on the wire, /100 at the repo boundary). A quote is replaced wholesale on each save.
create table if not exists pharma.quote_items (
  id              text primary key,             -- 'qi-*'
  prescription_id text not null references pharma.prescriptions (id) on delete cascade,
  name            text not null,
  qty             smallint not null default 1 check (qty between 1 and 99),
  mrp_paisa       int8 not null default 0 check (mrp_paisa >= 0),
  price_paisa     int8 not null default 0 check (price_paisa >= 0),
  discount_paisa  int8 not null default 0 check (discount_paisa >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists quote_items_rx_idx on pharma.quote_items (prescription_id, created_at);

-- quoted_total_paisa is the denormalized quote sum (server-derived, never client-set). revealed_at/by
-- record the exact moment a seller earned sight of the customer's contact (the READY gate).
alter table pharma.prescriptions add column if not exists quoted_total_paisa int8 not null default 0;
alter table pharma.prescriptions add column if not exists revealed_at timestamptz;
alter table pharma.prescriptions add column if not exists revealed_by text;
alter table pharma.prescriptions add column if not exists address_id text;

-- status_history is the append-only audit trail per prescription (from/to/actor). The gateway writes
-- one row per transition; no client ever reads it directly except the owner/vendor projections.
create table if not exists pharma.status_history (
  id              bigint generated always as identity primary key,
  prescription_id text not null references pharma.prescriptions (id) on delete cascade,
  from_status     prescription_status,
  to_status       prescription_status not null,
  actor_id        text not null,
  actor_role      text not null,
  created_at      timestamptz not null default now()
);
create index if not exists status_history_rx_idx on pharma.status_history (prescription_id, created_at);

-- ================================================================ W24: notification outbox + push tokens
-- notifications.outbox is a durable, transactional "tell the customer" record. The gateway enqueues
-- on Rx READY (and other lifecycle events); delivery (push/polling) drains it. Contains no PII beyond
-- the target user_id; body is user-facing copy only.
create schema if not exists notifications;

create table if not exists notifications.outbox (
  id         text primary key,                  -- 'ntf-*'
  user_id    text not null references checkout.users (user_id) on delete cascade,
  kind       text not null,                     -- e.g. RX_READY, ORDER_STATUS
  title      text not null,
  body       text not null,
  data       jsonb check (data is null or pg_column_size(data) <= 2048),
  status     text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists outbox_user_created_idx on notifications.outbox (user_id, created_at desc);
create index if not exists outbox_status_idx on notifications.outbox (status, created_at);

-- push_tokens is one row per (device/user) registration. The token is PII-adjacent (device credential)
-- and is never logged; only service_role reads/writes it.
create table if not exists notifications.push_tokens (
  user_id    text primary key,
  token      text not null,
  platform   text check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

-- ================================================================ W24b: review moderation flag
-- Admin moderation is a HIDDEN flag (never a hard DELETE — vendor_summary is trigger-maintained).
alter table reviews.vendor_reviews add column if not exists hidden boolean not null default false;
create index if not exists vendor_reviews_hidden_idx on reviews.vendor_reviews (vendor_id, hidden);

-- ================================================================ updated_at trigger
do $$
begin
  execute 'drop trigger if exists touch_updated_at on pharma.quote_items';
  execute 'create trigger touch_updated_at before update on pharma.quote_items
             for each row execute function util.touch_updated_at()';
end;
$$;

-- ================================================================ RLS (Supabase only)
-- Defence-in-depth for direct Supabase clients only; the gateway (service_role) bypasses RLS and is
-- the real enforcer. New tables are deny-all to anon/authenticated (no policies): quotes, status
-- history, outbox and push tokens are gateway-only projections. The prescriptions own-row policy
-- from 0009 is untouched.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0018 RLS (non-Supabase environment)';
    return;
  end if;

  execute 'alter table pharma.quote_items enable row level security';
  execute 'alter table pharma.status_history enable row level security';
  execute 'alter table notifications.outbox enable row level security';
  execute 'alter table notifications.push_tokens enable row level security';
end;
$$;