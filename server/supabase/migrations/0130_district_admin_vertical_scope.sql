-- 0130_district_admin_vertical_scope.sql
-- Why: a district admin had no per-vertical (Mart/Food/Pharma) scope — they either saw everything
-- or nothing in their district. Add per-vertical access flags so a super admin can grant exactly the
-- verticals the admin manages for that district.
--
-- Defaults are TRUE so every existing roster row keeps the access it has today; the admin creator
-- (POST /district-admins) writes the chosen flags. A district may still have several admins (the
-- district_code FK is not unique) — this migration only widens each row, it does not alter cardinality.

alter table admins.district_admins
  add column if not exists mart_access boolean not null default true,
  add column if not exists food_access boolean not null default true,
  add column if not exists pharma_access boolean not null default true;

create index if not exists district_admins_vertical_idx
  on admins.district_admins (district_code, mart_access, food_access, pharma_access)
  where district_code is not null;
