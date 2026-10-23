-- Faazio MVP — make seller-side RLS district-precise for DISTRICT_ADMIN.
-- Authority: docs/architecture/db-schema.md §12.24.
--
-- 0048 renamed the roster and taught sellers.is_state_admin_for to accept DISTRICT_ADMIN, but the
-- predicate only compared state_code. This migration adds a 2-arg predicate and repoints the
-- seller-data policies at the seller's district, while keeping the 1-arg helper for the older
-- state-scoped surfaces (campaigns, coupons, delivery) that are still state-level by design.
--
-- Semantics:
--   SUPER_ADMIN                      -> all rows
--   STATE_ADMIN / DISTRICT_ADMIN     -> same state, and (no district claim OR row has no district
--                                       OR district matches). The legacy branch keeps pre-0047
--                                       sellers and non-TN/PY state admins readable.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'auth schema or Supabase roles absent — skipping 0050 RLS (non-Supabase environment)';
    return;
  end if;

  execute $fn$
    create or replace function sellers.is_admin_for(p_state char(2), p_district text)
    returns boolean
    language sql stable as $body$
      select coalesce(auth.jwt() ->> 'app_role', '') = 'SUPER_ADMIN'
         or (
           coalesce(auth.jwt() ->> 'app_role', '') in ('STATE_ADMIN', 'DISTRICT_ADMIN')
           and coalesce(auth.jwt() ->> 'state_code', '') = p_state
           and (
             coalesce(auth.jwt() ->> 'district_code', '') = ''
             or p_district is null
             or p_district = ''
             or auth.jwt() ->> 'district_code' = p_district
           )
         )
    $body$
  $fn$;

  execute $fn$
    create or replace function sellers.is_state_admin_for(p_state char(2)) returns boolean
    language sql stable as $body$ select sellers.is_admin_for(p_state, null) $body$
  $fn$;

  execute 'drop policy if exists seller_read on sellers.sellers';
  execute $p$create policy seller_read on sellers.sellers for select to authenticated
    using (seller_id = sellers.current_seller_id()
           or sellers.is_admin_for(state_code, district_code))$p$;

  execute 'drop policy if exists seller_read on sellers.kyc_documents';
  execute $p$create policy seller_read on sellers.kyc_documents for select to authenticated
    using (seller_id = sellers.current_seller_id()
           or exists (select 1 from sellers.sellers s where s.seller_id = kyc_documents.seller_id
                       and sellers.is_admin_for(s.state_code, s.district_code)))$p$;

  execute 'drop policy if exists seller_read on sellers.bank_accounts';
  execute $p$create policy seller_read on sellers.bank_accounts for select to authenticated
    using (seller_id = sellers.current_seller_id()
           or exists (select 1 from sellers.sellers s where s.seller_id = bank_accounts.seller_id
                       and sellers.is_admin_for(s.state_code, s.district_code)))$p$;

  execute 'drop policy if exists kyc_log_read on sellers.kyc_verification_log';
  execute $p$create policy kyc_log_read on sellers.kyc_verification_log for select to authenticated
    using (exists (
      select 1 from sellers.sellers s
       where s.seller_id = kyc_verification_log.seller_id
         and (s.seller_id = sellers.current_seller_id()
              or sellers.is_admin_for(s.state_code, s.district_code))))$p$;

  execute 'drop policy if exists request_history_read on sellers.seller_request_history';
  execute $p$create policy request_history_read on sellers.seller_request_history for select to authenticated
    using (exists (
      select 1 from sellers.sellers s
       where s.seller_id = seller_request_history.seller_id
         and (s.seller_id = sellers.current_seller_id()
              or sellers.is_admin_for(s.state_code, s.district_code))))$p$;

  execute 'drop policy if exists admin_read on promo.festival_optins';
  execute $p$create policy admin_read on promo.festival_optins for select to authenticated
    using (seller_id = sellers.current_seller_id()
           or exists (select 1 from sellers.sellers s where s.seller_id = festival_optins.seller_id
                       and sellers.is_admin_for(s.state_code, s.district_code)))$p$;

  execute 'drop policy if exists fee_request_read on sellers.seller_fee_change_requests';
  execute $p$create policy fee_request_read on sellers.seller_fee_change_requests for select to authenticated
    using (seller_id = sellers.current_seller_id()
           or exists (select 1 from sellers.sellers s
                       where s.seller_id = seller_fee_change_requests.seller_id
                         and sellers.is_admin_for(s.state_code, coalesce(s.district_code, seller_fee_change_requests.district_code))))$p$;
end;
$$;
