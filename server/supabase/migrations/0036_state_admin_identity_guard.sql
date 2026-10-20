-- Faazio MVP — state-admin identity guard: duplicates become DB-impossible and the
-- unified POST /state-admins creator (roster + optional portal login in one tx) gets
-- a race-proof frontier.
-- Authority: docs/architecture/db-schema.md §12.19, monolith-breakdown.md §1 (admins row),
-- mvp-backend.md §3, web-portal.md ("Unified state-admin creation"), RUNBOOKS/PORTAL_AUTH.md §3.
--
-- Identity policy (superadmin decision, 2026-10): email is the ONE-PERSON-ONE-ROLE key and is
-- hard-unique everywhere (portal_users lower(email) 0032 + the roster index below). PHONE is a SOFT
-- warning only — a single line can legitimately cover several people (team/SME phones), so a shared
-- phone is allowed and surfaced as a 201 `warnings[]` notice, never blocked.
--
-- Why: 0015 shipped admins.state_admins with NO uniqueness constraint, so two roster rows could
-- share Admin@x.com / ADMIN@x.com, and portal login + roster were two disconnected inserts
-- (POST /admin/portal-users after POST /state-admins) that could diverge. The gateway collision
-- gate (internal/admins/provision.go) is the friendly 409/warning path; these indexes are the
-- for-sure rule that races cannot slip past, and they make a partial orphan row impossible to
-- re-create.

-- Roster email uniqueness (case-insensitive). The missing guard: API checks race, this does not.
-- Fails loudly if existing rows share an email (different casing) — merge/dedupe before applying.
create unique index if not exists state_admins_email_lower_uniq
  on admins.state_admins (lower(email));

-- Policy change (2026-10): a phone is SOFT — shared lines are legitimate, so a phone must never
-- hard-block creation. An earlier draft of this migration shipped a UNIQUE phone index; drop it so
-- the soft-warning policy holds everywhere (idempotent no-op where it was never applied).
drop index if exists admins.state_admins_phone_digits_uniq;

-- Roster phone lookup (NOT unique): digits-only equality, so '091-90000-00000', '+91 90000 00000'
-- and '919000000000' are the same person. The gateway stores the bare 10 digits going forward; the
-- expression index also matches legacy formatted rows so the soft "shared phone" warning can find
-- them fast.
create index if not exists state_admins_phone_digits_idx
  on admins.state_admins (regexp_replace(phone, '\D', '', 'g'));

-- Seller phone digit lookup: the state-admin collision gate warns when the phone is already a seller
-- phone (sellers.sellers has no email column — 0015). Partial index avoids scanning empty-row
-- sellers.
create index if not exists sellers_phone_digits_idx
  on sellers.sellers (regexp_replace(phone, '\D', '', 'g'))
  where phone is not null and phone <> '';

-- portal_users_email_lower_uniq (0032) is the documented cross-role email gate (SUPER_ADMIN/SELLER
-- logins share the lower(email) uniqueness) — no change here.