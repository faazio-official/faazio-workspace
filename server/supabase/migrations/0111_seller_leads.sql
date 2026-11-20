-- Faazio MVP — public "Sell with us" lead intake from the landing page.
-- Authority: docs/architecture/db-schema.md §12.41, monolith-breakdown.md §1 (sellers row),
-- user-interaction-workflow/seller/onboarding/seller-web-intake.md.
--
-- Why: the landing page (/sell-with-us) lets any visitor register interest before they install the
-- app. That enquiry is NOT a seller account: it carries no PAN/bank/passbook/OTP, so it must never
-- touch sellers.sellers (whose create path stays auth-gated and KYC-complete). A lead is a durable
-- row an admin follows up on; the merchant later completes full onboarding in the mobile app
-- (`SellWithUs` → POST /sellers).
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

create table if not exists sellers.seller_leads (
  lead_id           text primary key,
  business_name     text not null check (octet_length(business_name) between 1 and 160),
  owner_name        text not null check (octet_length(owner_name) between 1 and 160),
  category          app_brand not null,
  contact_phone     text not null,
  contact_email     text not null,
  business_address  text not null default '' check (octet_length(business_address) <= 500),
  -- Resolved from the gateway's district master when the submitted names match; the raw names are
  -- kept so a near-miss ("Karaikal district") is still readable by the admin following up.
  state_code        char(2),
  district_code     text references admins.district_master (district_code) on delete set null,
  state_name        text not null default '',
  district_name     text not null default '',
  latitude          float8,
  longitude         float8,
  platform_fee_pct  smallint check (platform_fee_pct is null or platform_fee_pct between 1 and 100),
  notes             text not null default '' check (octet_length(notes) <= 500),
  status            text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED')),
  source            text not null default 'web',
  -- Abuse mitigation only: a 64-bit hex prefix of the submitter IP, never the plaintext address.
  ip_hash           text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A pin is either complete or absent; a half coordinate cannot be routed on a map.
  check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create index if not exists seller_leads_status_created_idx
  on sellers.seller_leads (status, created_at desc);
create index if not exists seller_leads_district_idx
  on sellers.seller_leads (district_code);

comment on table sellers.seller_leads is
  'Public landing-page "Sell with us" enquiries (no KYC, no auth). Followed up by an admin; the merchant completes onboarding in the mobile app (POST /sellers). Read/write only by the gateway (service_role).';

-- The gateway connects as service_role (bypasses RLS) and is the only writer/reader. Leads are PII,
-- so no direct Supabase client role is granted anything — defence in depth on top of that boundary.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'alter table sellers.seller_leads enable row level security';
  end if;
end;
$$;
