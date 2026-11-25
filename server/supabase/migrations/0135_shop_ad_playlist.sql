-- Faazio MVP — per-shop storefront ad playlist: drafts + explicit carousel order.
-- Authority: docs/architecture/db-schema.md §12.17 (ads), monolith-breakdown.md §1 (ads ownership),
-- caching-cloudflare-valkey.md §5 (hero cache purge).
--
-- Why: a seller manages the STORE_TOP band on their shop page as an ordered playlist in the portal.
-- Before this, `ads.campaigns` could only be published straight to LIVE and the app carousel ordered
-- by `requested_at desc` (seller could not control play order or keep unsaved work). Additive only:
--   * DRAFT — saved in the seller console, never served by `GET /ads/hero`.
--   * sort_order — ascending play order within one store's STORE_TOP carousel.
--
-- Idempotent — safe to re-run. `ALTER TYPE ... ADD VALUE` is applied statement-by-statement in
-- autocommit (cmd/migrate), so it is not inside a transaction block.

-- ================================================================ draft status
alter type ad_status add value if not exists 'DRAFT';

-- ================================================================ explicit playlist order
alter table ads.campaigns add column if not exists sort_order int not null default 0
  check (sort_order >= 0);

-- ================================================================ playlist read index
-- Seller console: this store's rows (draft + live) in play order.
-- Anon hero read: LIVE rows for a store in play order (order by sort_order, requested_at desc).
create index if not exists campaigns_storefront_playlist_idx
  on ads.campaigns (store_id, placement, status, sort_order, requested_at desc);
