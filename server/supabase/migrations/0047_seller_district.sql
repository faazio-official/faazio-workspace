-- Faazio MVP — district scoping for sellers.
-- Authority: docs/architecture/db-schema.md §12, monolith-breakdown.md §1 (sellers row).
--
-- Sellers now belong to a district. The column is nullable for legacy rows (created before the
-- district rollout) and backfilled by operators; the gateway falls back to state scope for those
-- rows so no existing seller becomes unreachable. New onboarding requires a district.

alter table sellers.sellers
  add column if not exists district_code text
    references admins.district_master (district_code) on delete restrict;

create index if not exists sellers_district_status_idx
  on sellers.sellers (district_code, status, created_at desc)
  where district_code is not null;

-- Direct Supabase clients keep the existing state-scoped read policy; the new column inherits it
-- (RLS is row-level, not column-level). Nothing to grant.
