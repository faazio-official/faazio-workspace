-- Faazio MVP — district master for the district-scoped partner platform.
-- Authority: docs/architecture/db-schema.md §12, docs/architecture/monolith-breakdown.md §1.
--
-- The platform now operates by district (not state). This is the authoritative allowlist used by
-- the gateway (internal/platform/geo) and the portal. MVP coverage is Tamil Nadu (38) + Puducherry
-- (4) = 42 districts; the table is additive so more states can be seeded later without a code ship.
--
-- district_code is a stable 3-character business code (e.g. TCH = Chennai, PY0 = Puducherry).
-- state_code is the ISO 3166-2:IN parent state/UT code and stays the coarse scope used by the
-- existing state-scoped read models (ads, support, customers) during the transition.

create table if not exists admins.district_master (
  district_code text primary key check (district_code ~ '^[A-Z]{2}[A-Z0-9]$'),
  district_name text not null,
  state_code    char(2) not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists district_master_state_idx
  on admins.district_master (state_code, district_name)
  where is_active;

insert into admins.district_master (district_code, district_name, state_code) values
  ('TNA', 'Ariyalur',         'TN'),
  ('TNC', 'Chengalpattu',     'TN'),
  ('TCH', 'Chennai',          'TN'),
  ('TCO', 'Coimbatore',       'TN'),
  ('TCD', 'Cuddalore',        'TN'),
  ('TDP', 'Dharmapuri',       'TN'),
  ('TDG', 'Dindigul',         'TN'),
  ('TER', 'Erode',            'TN'),
  ('TKL', 'Kallakurichi',     'TN'),
  ('TKP', 'Kanchipuram',      'TN'),
  ('TKK', 'Kanyakumari',      'TN'),
  ('TKR', 'Karur',            'TN'),
  ('TKG', 'Krishnagiri',      'TN'),
  ('TMD', 'Madurai',          'TN'),
  ('TMY', 'Mayiladuthurai',   'TN'),
  ('TNP', 'Nagapattinam',     'TN'),
  ('TNK', 'Namakkal',         'TN'),
  ('TNG', 'Nilgiris',         'TN'),
  ('TPE', 'Perambalur',       'TN'),
  ('TPK', 'Pudukkottai',      'TN'),
  ('TRT', 'Ramanathapuram',   'TN'),
  ('TRN', 'Ranipet',          'TN'),
  ('TSL', 'Salem',            'TN'),
  ('TSK', 'Sivaganga',        'TN'),
  ('TTK', 'Tenkasi',          'TN'),
  ('TTH', 'Thanjavur',        'TN'),
  ('TTE', 'Theni',            'TN'),
  ('TTT', 'Thoothukudi',      'TN'),
  ('TTC', 'Tiruchirappalli',  'TN'),
  ('TTL', 'Tirunelveli',      'TN'),
  ('TTP', 'Tirupathur',       'TN'),
  ('TPP', 'Tiruppur',         'TN'),
  ('TLV', 'Tiruvallur',       'TN'),
  ('TVA', 'Tiruvannamalai',   'TN'),
  ('TVR', 'Tiruvarur',        'TN'),
  ('VEL', 'Vellore',          'TN'),
  ('VLP', 'Villupuram',       'TN'),
  ('VIR', 'Virudhunagar',     'TN'),
  ('PY0', 'Puducherry',       'PY'),
  ('PY1', 'Karaikal',         'PY'),
  ('PY2', 'Mahé',             'PY'),
  ('PY3', 'Yanam',            'PY')
on conflict (district_code) do update
  set district_name = excluded.district_name,
      state_code    = excluded.state_code,
      is_active     = true;

-- Read-only for direct Supabase clients; the gateway (service_role) remains the only writer.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema admins to authenticated;
    grant select on admins.district_master to authenticated;
    execute 'alter table admins.district_master enable row level security';
    execute 'drop policy if exists district_master_read on admins.district_master';
    execute $p$create policy district_master_read on admins.district_master for select to authenticated using (true)$p$;
  end if;
end;
$$;
