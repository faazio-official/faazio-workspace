-- Faazio MVP — universal account-nav defaults (DB-backed chrome, no client fixture).
-- Authority: docs/architecture/db-schema.md, monolith-breakdown.md §1 (checkout row),
-- user-interaction-workflow/customer/profile/index.md.
--
-- Why: the "My Account" menu rows moved to the server-only `GET /account-nav` path, but only the
-- demo `user-1` had accounts.nav rows; every other user got titled groups with zero rows (no
-- destinations, no client fallback). This table holds the universal default row membership — fixed
-- app destinations, not user data — so a fresh user sees the real menu with no per-user
-- provisioning and no @data fallback. Per-user customisation still overrides via accounts.nav; the
-- gateway allowlists known keys and omits any group whose effective rows are empty.
--
-- Additive and idempotent; apply from a dev terminal per docs/RUNBOOKS/DATABASE_MIGRATIONS.md.
-- Never auto-run on Render.

create table if not exists accounts.nav_defaults (
  key        text primary key,
  title      text not null,
  sort_order integer not null,
  rows       jsonb not null default '[]',
  constraint nav_defaults_rows_size check (octet_length(rows::text) <= 8192)
);

insert into accounts.nav_defaults (key, title, sort_order, rows) values
  ('profile', 'Profile settings', 10, '[
    {"key":"orders","icon":"package","title":"My Orders","subtitle":"Track and manage your orders"},
    {"key":"details","icon":"idcard","title":"My Profile","subtitle":"Manage your personal information"},
    {"key":"addresses","icon":"map-pin","title":"Addresses","subtitle":"Manage saved addresses"},
    {"key":"favourites","icon":"heart","title":"Favourites","subtitle":"Your favourite items across all apps"}
  ]'::jsonb),
  ('privacy', 'Privacy and security', 20, '[
    {"key":"delete-account","icon":"trash","title":"Delete account","subtitle":"Permanently delete your Faazio account"},
    {"key":"request-data-deletion","icon":"shield","title":"Request data deletion","subtitle":"Erase selected data and keep your account"}
  ]'::jsonb),
  ('earn', 'Earn with us', 30, '[
    {"key":"sell-with-us","icon":"store","title":"Sell with us","subtitle":"Partner with Faazio & list your products"}
  ]'::jsonb),
  ('legal', 'Terms and policies', 40, '[
    {"key":"terms","icon":"file-text","title":"Terms & Conditions","subtitle":"How Faazio works and what you agree to"},
    {"key":"privacy","icon":"lock","title":"Privacy Policy","subtitle":"How we collect, use, and protect your data"},
    {"key":"refunds","icon":"receipt","title":"Refund & Cancellation Policy","subtitle":"Returns, refunds, and cancellations"},
    {"key":"cookies","icon":"cookie","title":"Cookie Policy","subtitle":"Cookies used on faazio.com"},
    {"key":"disclaimer","icon":"info","title":"Disclaimer","subtitle":"Health, pricing, and third-party notices"}
  ]'::jsonb)
on conflict (key) do update
  set title = excluded.title,
      sort_order = excluded.sort_order,
      rows = excluded.rows;

-- Legacy rows for groups the app no longer renders (dead destinations). The gateway ignores them
-- too; this is a one-time cleanup so the override table cannot drift into dead menu entries.
delete from accounts.nav where key in ('payments', 'support');

-- Drop the removed "Recently viewed" row from any stored profile override (unwired destination).
update accounts.nav n
set rows = coalesce((
  select jsonb_agg(elem)
  from jsonb_array_elements(n.rows) elem
  where elem->>'key' <> 'recently-viewed'
), '[]'::jsonb)
where n.key = 'profile'
  and jsonb_typeof(n.rows) = 'array'
  and n.rows @> '[{"key":"recently-viewed"}]'::jsonb;
