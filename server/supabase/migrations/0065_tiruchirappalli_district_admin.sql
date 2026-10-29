-- Faazio MVP — Tiruchirappalli (TTC) district admin roster seed.
-- Authority: docs/architecture/db-schema.md §12 (admins), docs/RUNBOOKS/DATABASE_MIGRATIONS.md,
-- AGENTS.md ("run the migration" => server/supabase/apply-migration.sh).
--
-- Why: /admin/super/district-admins is now district-locked to Tiruchirappalli. The roster must
-- contain at least one TTC row so the page is not empty on a freshly migrated DB. The superadmin
-- provisions the portal login separately (migrations never ship password hashes — PORTAL_AUTH.md §2).
--
-- District TTC = Tiruchirappalli, TN already exists in admins.district_master (0046) and passes
-- internal/platform/geo (IsValid("TTC") == true); district_code carries an FK to district_master.
-- state_code stays populated (TTC's parent state TN) for the legacy nullable column.
--
-- Idempotent: safe to re-run; never overwrites operator edits.

insert into admins.district_admins (admin_id, name, email, phone, district_code, state_code, active)
values (
  'adm-tiruchi-01',
  'Tiruchirappalli District Admin',
  'district.ttc@faazio.example',
  '9000000001',
  'TTC', 'TN', true
)
on conflict do nothing;
