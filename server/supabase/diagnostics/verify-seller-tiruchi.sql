-- Read-only diagnostic — NOT a migration. Do not place SELECT-only checks under migrations/.
--
-- server/gateway/cmd/migrate discards query result rows (PgConn().Exec().ReadAll()), so running this
-- through server/supabase/apply-migration.sh prints no output. Run it in the Supabase SQL Editor (or
-- any pgx/psql client) instead. See docs/RUNBOOKS/DATABASE_MIGRATIONS.md §5.

-- 1. The migration-0063 seller: expect district_code='TTC', state_code='TN', status='ACTIVE'.
select * from sellers.sellers where seller_id = 'sel-tiruchi-01';

-- 2. The migration-0065 district-admin roster row.
select * from admins.district_admins where district_code = 'TTC';

-- 3. TTC is a valid district_master FK target.
select district_code, district_name, state_code, is_active
  from admins.district_master
 where district_code = 'TTC';

-- 4. District-admin portal logins and their scope (no secrets). The login must carry
--    district_code='TTC' for the JWT to be district-scoped; a NULL/empty value falls back to the
--    parent state on GET /sellers.
select user_id, email, role, active,
       coalesce(seller_id, '')   as seller_id,
       coalesce(state_code, '')  as state_code,
       coalesce(district_code, '') as district_code
  from admins.portal_users
 where role in ('DISTRICT_ADMIN', 'STATE_ADMIN')
 order by district_code, email;
