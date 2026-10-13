-- Faazio MVP — blood donor registry, requests, interests, and donor-match requests.
-- Authority: docs/architecture/db-schema.md §12.6, monolith-breakdown.md §1.
-- Why: blood donor data is health PII and matching needs a queryable registry; it cannot stay in
-- AsyncStorage. Consent is mandatory before a donor appears in the public directory.
create schema if not exists blood;

-- ---------------------------------------------------------------- donors
create table blood.donors (
  user_id           text primary key references checkout.users (user_id) on delete cascade,
  name              text not null default '',
  blood_group       text not null check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  age_range         text,
  weight_kg         smallint check (weight_kg is null or weight_kg between 30 and 300),
  city              text not null default '',
  willing_to_travel bool not null default false,
  donation_type     text,
  notif             jsonb check (notif is null or octet_length(notif::text) <= 1024),
  available         bool not null default true,
  consent           bool not null default false,
  consent_at        timestamptz,
  updated_at        timestamptz not null default now()
);
create index blood_donors_group_city_idx on blood.donors (blood_group, city);

-- Public directory projection: consented donors only, and only display-safe columns (never age/weight/
-- notif). A security-definer view (default) so anon can read this subset without reading the table.
create view blood.donor_directory as
  select user_id, name, blood_group, city, donation_type, willing_to_travel, available
  from blood.donors where consent and available;

-- ---------------------------------------------------------------- requests
create table blood.requests (
  id              text primary key,               -- 'br-*'
  hospital        text not null default '',
  city            text not null default '',
  state           text not null default '',
  blood_group     text not null check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  units           smallint not null default 1 check (units between 1 and 20),
  patient_context text not null default '',
  needed_within   text not null default '',
  verified        bool not null default false,
  urgency         text not null default 'normal' check (urgency in ('urgent','high','normal')),
  contact         text,                            -- PII (hospital contact)
  address         text,                            -- PII
  remarks         text,
  posted_at       timestamptz not null default now(),
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index blood_requests_group_city_idx on blood.requests (blood_group, city);
create index blood_requests_expiry_idx on blood.requests (expires_at);

-- ---------------------------------------------------------------- interests + matches
create table blood.interests (
  request_id    text not null references blood.requests (id) on delete cascade,
  donor_user_id text not null references checkout.users (user_id) on delete cascade,
  kind          text not null check (kind in ('interested', 'accepted')),
  created_at    timestamptz not null default now(),
  primary key (request_id, donor_user_id, kind)
);

do $$ begin
  create type match_status as enum ('pending', 'accepted', 'declined', 'completed');
exception when duplicate_object then null;
end $$;

create table blood.match_requests (
  id                text primary key,              -- 'dmr-*'
  requester_user_id text not null references checkout.users (user_id) on delete cascade,
  donor_user_id     text not null references checkout.users (user_id) on delete cascade,
  blood_group       text not null,
  city              text not null default '',
  status            match_status not null default 'pending',
  created_at        timestamptz not null default now()
);
create index blood_match_requester_idx on blood.match_requests (requester_user_id, created_at desc);
create index blood_match_donor_idx on blood.match_requests (donor_user_id, created_at desc);

-- ---------------------------------------------------------------- expiry sweep (pg_cron)
create or replace function blood.expire_requests()
returns integer language plpgsql as $$
declare deleted integer;
begin
  delete from blood.requests where expires_at is not null and expires_at < now();
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('faazio-expire-blood-requests')
      where exists (select 1 from cron.job where jobname = 'faazio-expire-blood-requests');
    perform cron.schedule('faazio-expire-blood-requests', '30 3 * * *',
      $cron$ select blood.expire_requests(); $cron$);
  end if;
end;
$$;

-- ---------------------------------------------------------------- RLS (Supabase only)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'auth schema absent — skipping blood RLS (non-Supabase environment)';
    return;
  end if;

  -- Public directory view: consented donors, display-safe columns only.
  execute 'grant select on blood.donor_directory to anon, authenticated';

  -- Requests board: anon/auth may read; the gateway redacts contact/address for anon.
  execute 'alter table blood.requests enable row level security';
  execute 'create policy anon_read on blood.requests for select to anon, authenticated using (true)';

  -- Donors: own row only (direct table access); the public view is the shared surface.
  execute 'alter table blood.donors enable row level security';
  execute $p$create policy own_rows on blood.donors for all to authenticated
    using (user_id = checkout.current_app_user_id())
    with check (user_id = checkout.current_app_user_id())$p$;

  -- Interests + match requests: own rows only.
  execute 'alter table blood.interests enable row level security';
  execute $p$create policy own_rows on blood.interests for all to authenticated
    using (donor_user_id = checkout.current_app_user_id())
    with check (donor_user_id = checkout.current_app_user_id())$p$;
  execute 'alter table blood.match_requests enable row level security';
  execute $p$create policy own_rows on blood.match_requests for all to authenticated
    using (requester_user_id = checkout.current_app_user_id() or donor_user_id = checkout.current_app_user_id())
    with check (requester_user_id = checkout.current_app_user_id())$p$;
end;
$$;