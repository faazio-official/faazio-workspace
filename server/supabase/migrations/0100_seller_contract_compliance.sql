-- Faazio MVP — seller contract & compliance layer.
-- Authority: docs/architecture/db-schema.md §12.38, monolith-breakdown.md §1 (sellers row),
-- user-interaction-workflow/seller/onboarding/seller-registration.md.
--
-- Why: onboarding captured business/KYC data and a phone OTP signature, but no clickwrap acceptance,
-- no IP-licence grant, no contract tier/rate card and no government-validation status. A merchant
-- could be activated without an auditable agreement. This migration adds the acceptance audit, the
-- server-owned tier catalogue and the append-only compliance validation log.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.
--
-- IP columns hold a short SHA-256 hash of the request IP (never the plaintext address), matching the
-- portal session/audit posture (internal/portal/handler.go shortHash).

-- ================================================================ contract tiers / rate cards
-- Server-owned so the client never hardcodes commission or settlement terms.
create table if not exists sellers.contract_tiers (
  tier_code         text primary key,
  name              text not null,
  description       text not null default '',
  commission_pct    smallint not null check (commission_pct between 1 and 100),
  settlement_days   integer not null default 3 check (settlement_days between 0 and 30),
  settlement_terms  text not null default '',
  rate_card_version text not null default 'v1',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

insert into sellers.contract_tiers
  (tier_code, name, description, commission_pct, settlement_days, settlement_terms, rate_card_version)
values
  ('STARTER', 'Starter', 'Single-shop partners getting started.', 12, 3,
   'Payouts settle T+3 business days after delivery, net of commission, TCS and TDS.', 'v1'),
  ('STANDARD', 'Standard', 'Established partners with steady order volume.', 10, 2,
   'Payouts settle T+2 business days after delivery, net of commission, TCS and TDS.', 'v1'),
  ('ENTERPRISE', 'Enterprise', 'Multi-shop partners on negotiated volume terms.', 8, 1,
   'Payouts settle T+1 business day after delivery, net of commission, TCS and TDS.', 'v1')
on conflict (tier_code) do nothing;

-- ================================================================ acceptance + compliance audit
alter table sellers.sellers
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_accepted_ip text,
  add column if not exists terms_accepted_account_id text,
  add column if not exists partner_agreement_accepted_at timestamptz,
  add column if not exists partner_agreement_accepted_ip text,
  add column if not exists partner_agreement_accepted_account_id text,
  add column if not exists ip_license_granted_at timestamptz,
  add column if not exists ip_license_granted_ip text,
  add column if not exists ip_license_granted_account_id text,
  add column if not exists contract_tier text references sellers.contract_tiers (tier_code),
  add column if not exists rate_card_version text,
  add column if not exists commission_pct smallint,
  add column if not exists settlement_terms text,
  add column if not exists compliance_status text not null default 'PENDING'
    check (compliance_status in ('PENDING', 'VALIDATED', 'FAILED')),
  add column if not exists compliance_note text,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by text;

create index if not exists sellers_contract_tier_idx
  on sellers.sellers (contract_tier);

-- Append-only record of every compliance attempt (format or government provider). The full
-- PAN/GSTIN/FSSAI is never stored here: subject_masked keeps only the tail.
create table if not exists sellers.compliance_validations (
  log_id         text primary key,
  seller_id      text not null references sellers.sellers (seller_id) on delete cascade,
  check_type     text not null check (check_type in ('GSTIN', 'PAN', 'FSSAI', 'BANK')),
  subject_masked text not null default '',
  status         text not null check (status in ('PENDING', 'VALIDATED', 'FAILED')),
  source         text not null default 'format',
  reason         text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists compliance_validations_seller_idx
  on sellers.compliance_validations (seller_id, created_at desc);

-- ================================================================ RLS + grants (Supabase only)
-- The gateway connects as service_role (bypasses RLS) and is the write authority. These policies are
-- defence-in-depth for direct Supabase clients: the tier catalogue is readable by authenticated
-- users, a seller reads only its own compliance attempts, admins read in scope. Writes stay
-- service_role only.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on sellers.contract_tiers to authenticated;
    grant select on sellers.compliance_validations to authenticated;

    execute 'alter table sellers.contract_tiers enable row level security';
    execute 'alter table sellers.compliance_validations enable row level security';

    execute 'drop policy if exists authenticated_read on sellers.contract_tiers';
    execute $p$create policy authenticated_read on sellers.contract_tiers for select to authenticated
      using (is_active) $p$;

    execute 'drop policy if exists seller_read on sellers.compliance_validations';
    execute $p$create policy seller_read on sellers.compliance_validations for select to authenticated
      using (seller_id = sellers.current_seller_id()
             or sellers.is_super()
             or exists (
               select 1 from sellers.sellers s
                where s.seller_id = compliance_validations.seller_id
                  and sellers.is_admin_for(s.state_code, s.district_code))) $p$;
  end if;
end;
$$;
