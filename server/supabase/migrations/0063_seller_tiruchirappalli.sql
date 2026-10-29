-- Faazio MVP — seed a pre-approved Tiruchirappalli seller via migration.
-- Authority: AGENTS.md ("run the migration" => server/supabase/apply-migration.sh),
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md, docs/architecture/db-schema.md §12 (sellers.sellers).
--
-- Why: Razorpay Route is not configured yet, so we bypass the normal registration flow
-- (no OTP signature, no KYC documents, no bank passbook upload, no linked account) AND admin
-- approval. The row is inserted ACTIVE so the seller is usable immediately; the superadmin page
-- (/admin/super/sellers, global scope) can overwrite any field afterward, and /admin/district/
-- sellers/{id} can complete KYC once documents exist.
--
-- District TTC = Tiruchirappalli, TN — already present in admins.district_master (migration 0046)
-- and validated by internal/platform/geo (IsValid("TTC") == true). district_code carries a FK to
-- admins.district_master(district_code), so TTC is required to already exist (it does).
--
-- ACTIVE is set directly (skipping PENDING_REVIEW => no approval queue), and otp_verified = true is
-- an explicit operator bypass of the OTP check the registration flow enforces. Both are intentional.
--
-- Column note: the live columns are `address` and `phone` (not `business_address` / `contact_phone`;
-- those are only the Go/JSON field names). razorpay_linked_account_id stays NULL until Route is set up
-- (POST /sellers/{id}/verify-kyc creates it then). platform_fee_pct 1–100 (FOOD floor 5).
--
-- Placeholder identity fields (blank GSTIN/PAN/email/phone) follow the demo-seller convention in
-- seed/0001_seed.sql and MUST be corrected via the portal before this seller is used for real orders.
--
-- Idempotent: safe to re-run; never duplicates, never overwrites operator edits.

insert into sellers.sellers (
  seller_id, business_name, owner_name, category,
  address, state_code, district_code, status,
  platform_fee_pct, otp_verified, otp_verified_at,
  latitude, longitude
) values (
  'sel-tiruchi-01',
  'Faazio Mart Tiruchirappalli',
  'Faazio Retail',
  'MART'::app_brand,
  'Tiruchirappalli, Tamil Nadu',
  'TN',
  'TTC',
  'ACTIVE'::seller_status,
  10,
  true,
  now(),
  10.7905,
  78.7047
)
on conflict (seller_id) do nothing;
