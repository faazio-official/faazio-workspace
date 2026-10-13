-- Faazio MVP — durable prescriptions (pharma launch blocker).
-- Authority: docs/architecture/db-schema.md §12.5, monolith-breakdown.md §1.
-- Why: the Rx flow (CAPTURE→NOTE→VENDORS→CONFIRMED) lived in screen state + ordersStore (in-memory),
-- so a prescription vanished on restart and its image had nowhere durable to live. Images are Supabase
-- Storage object keys (bucket `prescriptions`, private) — never bytes in Postgres, never URLs, never
-- logged. The gateway mints signed upload/download URLs (service_role).

create schema if not exists pharma;

do $$ begin
  create type prescription_status as enum ('RECEIVED', 'PROCESSING', 'FULFILLED', 'CANCELLED');
exception when duplicate_object then null;
end $$;

create table pharma.prescriptions (
  id          text primary key,                 -- 'RX-*'
  user_id     text not null references checkout.users (user_id) on delete cascade,
  vendor_id   text,
  fulfillment fulfillment_mode,
  pages       smallint not null default 1 check (pages between 1 and 10),
  note        text check (note is null or char_length(note) <= 2000),
  image_paths text[] not null default '{}',     -- Storage object keys (never URLs)
  status      prescription_status not null default 'RECEIVED',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index prescriptions_user_created_idx on pharma.prescriptions (user_id, created_at desc);

-- RLS (Supabase only): own rows read only; every write is service_role (gateway).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping prescriptions RLS (non-Supabase environment)';
    return;
  end if;
  execute 'alter table pharma.prescriptions enable row level security';
  execute $p$create policy own_rows on pharma.prescriptions for select to authenticated
    using (user_id = checkout.current_app_user_id())$p$;
end;
$$;

-- Storage bucket (Supabase only): private, no anon access. Created idempotently when the storage
-- schema is present; a bare local Postgres has no storage schema and skips.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema absent — prescriptions bucket not created (non-Supabase environment)';
    return;
  end if;
  insert into storage.buckets (id, name, public)
  values ('prescriptions', 'prescriptions', false)
  on conflict (id) do nothing;
end;
$$;