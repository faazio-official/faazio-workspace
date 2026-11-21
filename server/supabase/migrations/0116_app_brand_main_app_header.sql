-- Faazio MVP — allow a taxonomy category whose only home is the main app header.
-- Authority: docs/architecture/db-schema.md §12.30, monolith-breakdown.md §1 (categories row),
-- user-interaction-workflow/seller/web-portal/super-admin-categories.md.
--
-- Why: the superadmin portal could only create a category inside a vendor sub-app (MART/FOOD/PHARMA).
-- The main app header is now its own independent category pool: a header-only category (e.g.
-- "Electronics") belongs to no vendor sub-app and drills into its own sub-categories (e.g. "Android",
-- "iPhone"). Adding the enum value lets `taxonomy.categories.app` carry that pool.
--
-- `alter type ... add value` must run outside a transaction block and the new value cannot be used in
-- the same unit of work, so this file is a bare statement: the migrator sends each statement in
-- autocommit, and later migrations (0119/0120) are the first to use the value.
--
-- Additive and idempotent; apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

alter type app_brand add value if not exists 'MAIN_APP_HEADER';
