-- Faazio MVP — self-serve ads: instant-live publish, abuse takedown, user reports.
-- Authority: docs/architecture/db-schema.md §12.17, mvp-backend.md §3,
-- monolith-breakdown.md §1 (ads), caching-cloudflare-valkey.md §5a.
--
-- Why: the seller wizard used to create REQUESTED rows gated behind an admin approval queue. Faazio
-- moves to machine-checked instant publish (self-serve, like Meta Boost / Amazon Sponsored Brands):
-- a verified seller publishing their OWN item on a fitting placement goes LIVE immediately; admins
-- keep a takedown-only safety net and any user can report abuse. The gateway is the sole writer and
-- performs the ownership / placement-fit / creative-bounds / cap checks the admin used to.
--
-- Additive only (never rewrites 0015–0027): default flip + two columns + window guard + indexes.
-- Idempotent — safe to re-run.

-- ================================================================ instant-live default
-- New rows publish straight to LIVE; REQUESTED/APPROVED are deprecated (kept for old rows, never
-- minted again). REJECTED now means "taken down for abuse" and is set by an admin only.
alter table ads.campaigns alter column status set default 'LIVE';

-- ================================================================ abuse signals (no PII)
-- reports counts user "Report ad" taps; takedown_reason is the admin's short note on a REJECTED row.
alter table ads.campaigns add column if not exists reports int4 not null default 0 check (reports >= 0);
alter table ads.campaigns add column if not exists takedown_reason text
  check (takedown_reason is null or char_length(takedown_reason) <= 280);

-- Window guard: a self-serve campaign can never run longer than 90 days. NOT VALID so pre-existing
-- rows are not rescanned (add is instant + lock-light); every new write is enforced immediately.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_window_max') then
    alter table ads.campaigns
      add constraint campaigns_window_max check (ends_at <= starts_at + interval '90 days') not valid;
  end if;
end $$;

-- ================================================================ read + cap indexes
-- Cap lookup: "how many LIVE rows does this seller already hold on this placement?" (≤3 in handler).
create index if not exists campaigns_live_seller_placement_idx
  on ads.campaigns (seller_id, placement) where status = 'LIVE';
-- Anon hero read: filter by placement/app/category/store within the active window, newest-first.
create index if not exists campaigns_hero_read_idx
  on ads.campaigns (status, placement, target_app, category, store_id, ends_at, requested_at desc);