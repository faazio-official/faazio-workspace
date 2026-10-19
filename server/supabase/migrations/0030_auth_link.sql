-- Faazio MVP — link Supabase phone-OTP auth users into checkout.users.
-- Authority: docs/architecture/mvp-backend.md §1 (Auth), db-schema.md §7.1, monolith-breakdown.md §1.
-- Why: `checkout.users.auth_uid` already maps a Supabase auth subject → app user slug (0001), but
-- nothing ever inserted a row for a real phone-OTP user, so auth.Require 401'd every new sign-in.
-- checkout.Repo.ProvisionUserID now upserts on first authenticated call; last_login_at records the
-- link event so ops can see active real sessions (the mapping itself stays immutable).
alter table checkout.users
  add column if not exists last_login_at timestamptz;

-- The `auth_uid uuid unique` constraint (0001) already backs the mapping lookup; no extra index.
-- Backfill nothing: existing rows keep a NULL last_login_at until their next authenticated call.
