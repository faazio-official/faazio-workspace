-- Faazio MVP — set the Tiruchirappalli seller's contact email (operator-provided).
-- Authority: AGENTS.md, docs/RUNBOOKS/DATABASE_MIGRATIONS.md, docs/architecture/db-schema.md §12.
--
-- Follow-up to 0063 (which inserted sel-tiruchi-01 with placeholder identity fields). Only the
-- contact email is set here; the seller can correct the rest from the portal later.
--
-- The seller's LOGIN credential is NOT created here: repo policy (migrations 0032/0033 and
-- docs/RUNBOOKS/PORTAL_AUTH.md §2) forbids shipping a password hash in a migration. A SELLER
-- admins.portal_users row must be provisioned out-of-band (Supabase SQL editor / dev terminal) with
-- a hash from `tools/hash-password`, or issued by a superadmin from /admin/super/credentials.
--
-- Idempotent: safe to re-run.

update sellers.sellers
   set contact_email = 'faisalbashafaisalbasha@gmail.com'
 where seller_id = 'sel-tiruchi-01'
   and contact_email is distinct from 'faisalbashafaisalbasha@gmail.com';
