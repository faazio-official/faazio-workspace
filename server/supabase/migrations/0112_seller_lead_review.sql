-- Faazio MVP — admin follow-up fields for the landing-page "Sell with us" lead queue.
-- Authority: docs/architecture/db-schema.md §12.41, monolith-breakdown.md §1 (sellers row),
-- user-interaction-workflow/seller/onboarding/seller-web-intake.md.
--
-- Why: 0111 created sellers.seller_leads but only the public write existed, so the
-- NEW → CONTACTED → APPROVED → REJECTED lifecycle was schema-only. The admin queue
-- (GET /seller-leads, PATCH /seller-leads/{id}) needs to record WHO decided, WHEN, and the
-- operator's note (the reason a lead was rejected, or what the call established).
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table sellers.seller_leads
  add column if not exists admin_note  text not null default '',
  add column if not exists reviewed_by text not null default '',
  add column if not exists reviewed_at timestamptz;

-- A note is operator prose, not a document: bound it so a paste cannot bloat the row.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'seller_leads_admin_note_len'
  ) then
    alter table sellers.seller_leads
      add constraint seller_leads_admin_note_len
      check (octet_length(admin_note) <= 500);
  end if;
end;
$$;

-- The queue opens on NEW leads per district, so the existing (status, created_at desc) index is not
-- enough: a district admin filters by district first. Partial-free composite keeps both filters and
-- the ORDER BY covered.
create index if not exists seller_leads_district_status_created_idx
  on sellers.seller_leads (district_code, status, created_at desc);

comment on column sellers.seller_leads.admin_note is
  'Operator note from the follow-up call / the reason a lead was rejected. Shown to the seller in the rejection copy only after review.';
comment on column sellers.seller_leads.reviewed_by is
  'admins.portal_users id of the admin who last moved the status; empty while the lead is NEW.';
