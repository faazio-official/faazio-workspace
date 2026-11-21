-- Faazio MVP — retire the old GST rate master (`tax.tax_rates`).
-- Authority: docs/architecture/db-schema.md §12.30 (taxonomy) + §7.6 (tax), monolith-breakdown.md §1.
--
-- Why: GST is now a mandatory property of the category taxonomy itself. The per-(sector, category
-- name) rate card meant a seller's free-text category label decided tax, so two spellings of the same
-- category could be taxed differently and a new taxonomy row silently fell back to 5%. The replacement
-- is:
--   * `tax.gst_rate_categories` — the superadmin-managed pick-list (0118), e.g. "Fresh & Unbranded
--     Staples" → 0%.
--   * `tax.category_gst_rates`   — one mandatory row per `taxonomy.categories` id (0119/0120).
-- Checkout resolves GST from the product's `taxonomy_category_id`, never from a name match.
--
-- This file only removes the old table (and its index/grants, which go with it). The replacement
-- tables are created in the same migration run (0118–0120), so nothing is left pointing at a missing
-- object.
--
-- Apply from a dev terminal via server/supabase/apply-migration.sh per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md. Never auto-run on Render.

begin;

drop table if exists tax.tax_rates;

commit;
