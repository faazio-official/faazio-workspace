-- Faazio MVP — Central Remote Config (the "Central Digital Menu").
-- Authority: docs/architecture/mvp-backend.md §3, docs/architecture/db-schema.md §12.25b,
-- docs/architecture/server-gateway-plan.md (endpoints), docs/architecture/monolith-breakdown.md §1.
--
-- App settings that used to be baked into the binary at build time (client/mobile/scripts/configure.js)
-- are now a superadmin-editable key/value singleton set. The app fetches public rows on cold boot
-- (GET /app-config) and overrides its baked defaults for that key; no store review needed. Private
-- rows (is_public = false, value_secret) are only visible to SUPER_ADMIN via the gateway.
--
-- Security model:
--   - value is JSONB (string / number / boolean / object / array), capped at 4 KiB.
--   - is_public gates what anonymous/authenticated Supabase clients may SELECT (RLS policy below).
--     The gateway reads with service_role (bypasses RLS) and is the only writer.
--   - value_secret rows are masked in the portal and never returned to the app. The gateway refuses
--     is_public = true when value_secret = true.
--   - Every write is audited (admins.audit_logs) with the raw secret value omitted from the audit
--     snapshot.
--   - Only non-chicken-and-egg settings live here. GATEWAY_URL / USE_GATEWAY / APP_VARIANT stay
--     build-time baked (the app needs the URL before it can fetch config).
--
-- Additive only (never rewrites 0001–0058). Idempotent: safe to re-run.

create schema if not exists admins;

create table if not exists admins.app_config (
  key          text        primary key check (key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  category     text        not null check (category in ('brand', 'maps', 'region', 'feature', 'maintenance', 'limits')),
  value        jsonb       not null default 'null'::jsonb check (octet_length(value::text) <= 4096),
  is_public    boolean     not null default false,
  app_variant  text        not null default 'all' check (app_variant in ('customer', 'delivery', 'seller', 'all')),
  value_secret boolean     not null default false,
  description  text        not null default '' check (octet_length(description) <= 300),
  updated_by   text        not null default '',
  updated_at   timestamptz not null default now(),
  check (not is_public or not value_secret)
);

create index if not exists app_config_public_idx on admins.app_config (is_public) where is_public;
create index if not exists app_config_variant_idx on admins.app_config (app_variant);
create index if not exists app_config_category_idx on admins.app_config (category);

-- Defaults so a fresh install already has a sensible public config. Values are placeholders only:
-- empty string for maps means "keep the build-time baked key" (so first boot matches a baked build);
-- the superadmin turns these live from the partner portal without an app-store release.
insert into admins.app_config
  (key, category, value, is_public, app_variant, description, updated_by) values
  ('brand.primary_color',    'brand',       '"#4250FF"'::jsonb, true, 'all', 'Faazio brand blue used by the SuperApp splash and hero surfaces. Reserved for a portal-driven theme; not yet consumed at runtime.', 'system'),
  ('maps.places_api_key',    'maps',        '""'::jsonb,        true, 'all', 'Google Places (New) key for location autocomplete (restricted client key). Empty keeps the build-time baked value; a value set here is picked up on the next app boot, no store release.', 'system'),
  ('region.default',         'region',      '"IN"'::jsonb,      true, 'all', 'Default customer region code. Informational for now.', 'system'),
  ('maintenance.enabled',    'maintenance', 'false'::jsonb,     true, 'all', 'Global maintenance flag the app can read at boot; false = normal operation. Available to a future maintenance banner.', 'system')
on conflict (key) do nothing;

-- ================================================================ RLS + grants (Supabase only)
-- Public rows are readable by anon/authenticated Supabase clients (the app itself reads through the
-- gateway with service_role). Only the gateway (service_role, bypasses RLS) can insert/update/delete.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0059 RLS (non-Supabase environment)';
    return;
  end if;

  grant usage on schema admins to anon, authenticated;
  grant select on admins.app_config to anon, authenticated;
  alter table admins.app_config enable row level security;
  execute 'drop policy if exists app_config_public_read on admins.app_config';
  execute $p$create policy app_config_public_read on admins.app_config
    for select to anon, authenticated using (is_public)$p$;
end;
$$;