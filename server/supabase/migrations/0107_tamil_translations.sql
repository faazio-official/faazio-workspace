-- Faazio MVP — Tamil translations for the seller/admin-authored catalog copy.
-- Authority: docs/architecture/db-schema.md §catalog / §taxonomy, monolith-breakdown.md §1.
--
-- Product rule: sellers (products) and super admins (categories) may store a Tamil copy of the
-- name and description alongside the English ones. The English columns stay the canonical
-- identity (slug, FTS, GST label lookups); the `_ta` columns are display-only translations that
-- the customer app reads when the selected language is Tamil. Empty string = "not translated
-- yet", so the app falls back to English.
--
-- Idempotent: safe to re-run.

alter table taxonomy.categories
  add column if not exists name_ta text not null default '',
  add column if not exists description_ta text not null default '';

alter table catalog.products
  add column if not exists name_ta text not null default '',
  add column if not exists desc_text_ta text not null default '';
