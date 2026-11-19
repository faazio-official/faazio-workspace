-- Faazio MVP — Home header rail becomes unbounded (Mart + Pharma only).
-- Authority: docs/architecture/db-schema.md §12.30 (taxonomy) and monolith-breakdown.md §1.
--
-- Why: 0096 curated the Home rail with a 3-chip global cap (Mart + Pharma shared the slots). The
-- rail is a horizontally scrolling strip, so the cap is a product choice rather than a technical
-- limit: superadmins now curate any number of MART/PHARMA categories and the customer app scrolls
-- them to the end. FOOD stays ineligible (no consumer vendor pool for the drill-in).
--
-- Any node in the tree is eligible, not just a root: the drill-in resolves the tapped id and walks
-- its subtree, so a child chip is a valid entry point (e.g. "Mobiles" straight to its leaves).
--
-- No structural change: `taxonomy.categories.show_on_home_rail` and the partial index
-- `categories_home_rail_idx` from 0096 are reused as-is. Only the column comment (schema
-- documentation) changes, so no data migration runs and `GET /categories/rail` is untouched.
--
-- Idempotent: safe to re-run.

begin;

comment on column taxonomy.categories.show_on_home_rail is
  'When true, the category appears on the mobile Home header rail. Curated by a superadmin; MART and PHARMA only, any tree level; unbounded count (the app scrolls horizontally). FOOD is not eligible.';

commit;
