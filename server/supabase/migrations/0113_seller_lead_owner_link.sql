-- Faazio MVP — close the two open gaps in the landing-page lead queue.
-- SUPERSEDED BY 0129: sellers.seller_leads was merged into sellers.sellers as status = 'INQUIRY'
-- (source = 'web'). This migration is kept only so the applied history stays reproducible.
-- Authority: docs/architecture/db-schema.md §12.41, monolith-breakdown.md §1 (sellers row),
-- user-interaction-workflow/seller/onboarding/seller-lead-queue.md.
--
-- Gap 1 — an approved lead was never linked to the application it became: the merchant re-entered
--   their details in the mobile app and nothing recorded the resulting seller. `seller_id` is
--   back-filled when `POST /sellers` arrives with the same contact phone or email, so the queue shows
--   "applied" instead of silently going stale.
-- Gap 2 — a lead had no owner: any admin in the district could act on it, and no one was told a lead
--   existed. `assigned_to`/`assigned_at` let an admin claim a lead (and release it), and the district
--   dashboard surfaces the NEW count so a lead is never invisible.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal per
-- docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table sellers.seller_leads
  -- The seller application this enquiry became, once the merchant applies in the app. Nullable:
  -- most leads never apply, and a deleted seller must not delete the enquiry record.
  add column if not exists seller_id text references sellers.sellers (seller_id) on delete set null,
  -- admins.portal_users id of the admin who took the call-back. Empty = unclaimed, anyone may claim.
  add column if not exists assigned_to text not null default '',
  add column if not exists assigned_at timestamptz;

-- The queue's "who is mine" view, and the unclaimed NEW view the dashboard counts.
create index if not exists seller_leads_assigned_status_idx
  on sellers.seller_leads (assigned_to, status, created_at desc);
create index if not exists seller_leads_seller_idx
  on sellers.seller_leads (seller_id) where seller_id is not null;

comment on column sellers.seller_leads.seller_id is
  'The seller application this lead became, back-filled on POST /sellers when the contact phone or email matches. Null until the merchant applies.';
comment on column sellers.seller_leads.assigned_to is
  'admins.portal_users id of the admin who claimed the call-back; empty = unclaimed.';
