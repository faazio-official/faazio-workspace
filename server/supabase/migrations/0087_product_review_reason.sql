-- Faazio MVP — persist the admin review note on a listing decision.
--
-- Why: admins approve/reject a seller's PENDING_REVIEW listing from the portal, but the decision
-- only stored the status; a REJECTED listing gave the seller no reason. This bounded column keeps
-- the moderation message so it can be shown to the seller (product list + edit surface). It is
-- cleared whenever the listing is approved/delisted, so a stale rejection note never lingers.
--
-- Additive and idempotent; safe to apply after the gateway build ships. Apply from a dev terminal
-- per docs/RUNBOOKS/DATABASE_MIGRATIONS.md; never auto-run on Render.

alter table catalog.products add column if not exists review_reason text
  check (review_reason is null or octet_length(review_reason) <= 500);
