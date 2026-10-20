-- 0031 — Firebase auth subjects are strings, not UUIDs.
--
-- Firebase Authentication UIDs are 28-character strings (e.g. `kR3...`), so the original
-- `auth_uid uuid` link from 0001 cannot store a verified Firebase subject. Widen it to TEXT.
-- The existing unique constraint/index and the `ProvisionUserID` upsert keep their behaviour.
--
-- RLS note: the legacy `auth.uid()` policies stay for the portal/Supabase path; the Go gateway
-- connects with the database owner and enforces ownership in SQL predicates (never trusts a
-- client-supplied user id), so mobile Firebase tokens do not need a Supabase Auth session.

alter table checkout.users
  alter column auth_uid type text using auth_uid::text;

comment on column checkout.users.auth_uid is
  'Verified auth subject (Firebase UID; legacy Supabase auth.uid) → app user';

-- Keep the legacy RLS helper valid: compare text-to-text (the column is now TEXT).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute $f$
      create or replace function checkout.current_app_user_id() returns text
      language sql stable security definer set search_path = checkout, public as
      $body$ select u.user_id from checkout.users u where u.auth_uid = auth.uid()::text limit 1 $body$
    $f$;
  end if;
end;
$$;
