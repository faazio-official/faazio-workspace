-- Faazio MVP — production seller onboarding: platform fee, OTP digital signature, FSSAI,
-- manual PAN/GSTIN verification, rejection history and Razorpay Route linked accounts.
-- Authority: docs/architecture/db-schema.md §12, docs/architecture/mvp-backend.md §2/§12,
-- docs/architecture/monolith-breakdown.md §1 (sellers + settlement rows),
-- docs/RUNBOOKS/RELEASE.md (Razorpay Route env), docs/RUNBOOKS/TROUBLESHOOTING.md.
--
-- Additive only (never rewrites 0001–0038). Existing sellers keep working: platform_fee_pct defaults
-- to 10 and otp_verified defaults to false (legacy rows were created before OTP was mandatory).
--
-- SECURITY: the full bank account number is never stored. The mobile client sends it transiently at
-- onboarding so the gateway can create the Razorpay Route linked account; Postgres keeps only the
-- masked tail + IFSC + beneficiary + bank name. KYC bytes live in the private R2 bucket; the rows
-- here hold object keys / media asset ids only, never URLs or bytes.

-- ================================================================ seller columns
alter table sellers.sellers
  add column if not exists platform_fee_pct smallint not null default 10
    check (platform_fee_pct between 1 and 100),
  add column if not exists razorpay_linked_account_id text,
  add column if not exists contact_email text not null default '',
  add column if not exists fssai_number text,
  add column if not exists fssai_cert_key text,
  add column if not exists fssai_cert_asset_id text,
  add column if not exists otp_verified boolean not null default false,
  add column if not exists otp_verified_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejection_history jsonb not null default '[]'::jsonb;

create index if not exists sellers_status_created_idx
  on sellers.sellers (status, created_at desc);

-- ================================================================ bank + KYC extensions
alter table sellers.bank_accounts
  add column if not exists bank_name text not null default '';

-- New document classes: a bank passbook page (always) and an FSSAI certificate (FOOD only).
do $$ begin
  alter type kyc_doc_type add value if not exists 'PASSBOOK';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type kyc_doc_type add value if not exists 'FSSAI';
exception when duplicate_object then null; end $$;

-- Link a KYC row to its media.assets identity so the portal can mint a short-lived private GET.
alter table sellers.kyc_documents
  add column if not exists asset_id text;

-- ================================================================ manual verification log
-- Every PAN / GSTIN / FSSAI / passbook decision is an append-only audit row (who + when + notes).
create table if not exists sellers.kyc_verification_log (
  log_id      text primary key,
  seller_id   text not null references sellers.sellers (seller_id) on delete cascade,
  doc_type    kyc_doc_type not null,
  verified_by text not null,
  verified_at timestamptz not null default now(),
  notes       text not null default ''
);
create index if not exists kyc_verification_log_seller_idx
  on sellers.kyc_verification_log (seller_id, verified_at desc);

-- ================================================================ resubmission history
-- A rejected application can be edited and resubmitted. Each changed field is recorded here; the
-- rows are deleted when an admin approves (clean state after approval), per the product rule.
create table if not exists sellers.seller_request_history (
  history_id text primary key,
  seller_id  text not null references sellers.sellers (seller_id) on delete cascade,
  field_name text not null,
  old_value  text not null default '',
  new_value  text not null default '',
  changed_by text not null,
  changed_at timestamptz not null default now()
);
create index if not exists seller_request_history_seller_idx
  on sellers.seller_request_history (seller_id, changed_at desc);

-- ================================================================ settlement hold columns
-- A Route transfer is held (on_hold) for the 14-day buyer-protection window. The payout row is the
-- durable record of that hold; release marks it PAID and stamps released_at.
alter table payments.payouts
  add column if not exists razorpay_transfer_id text,
  add column if not exists release_after timestamptz,
  add column if not exists released_at timestamptz;

create index if not exists payouts_hold_idx
  on payments.payouts (status, release_after);

-- ================================================================ RLS + grants (Supabase only)
-- Same posture as 0015: the gateway (service_role) is the only writer. Direct authenticated clients
-- may read their own seller rows (or their state, for a state admin); nothing here is anon-readable.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0039 RLS + grants (non-Supabase environment)';
    return;
  end if;

  grant usage on schema sellers to authenticated;
  grant select on sellers.kyc_verification_log to authenticated;
  grant select on sellers.seller_request_history to authenticated;

  alter table sellers.kyc_verification_log enable row level security;
  alter table sellers.seller_request_history enable row level security;

  execute 'drop policy if exists kyc_log_read on sellers.kyc_verification_log';
  execute $p$create policy kyc_log_read on sellers.kyc_verification_log for select to authenticated
    using (exists (
      select 1 from sellers.sellers s
       where s.seller_id = kyc_verification_log.seller_id
         and (s.seller_id = sellers.current_seller_id()
              or sellers.is_super()
              or sellers.is_state_admin_for(s.state_code))))$p$;

  execute 'drop policy if exists request_history_read on sellers.seller_request_history';
  execute $p$create policy request_history_read on sellers.seller_request_history for select to authenticated
    using (exists (
      select 1 from sellers.sellers s
       where s.seller_id = seller_request_history.seller_id
         and (s.seller_id = sellers.current_seller_id()
              or sellers.is_super()
              or sellers.is_state_admin_for(s.state_code))))$p$;
end;
$$;
