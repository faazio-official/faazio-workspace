-- Faazio MVP — seed the Home top hero placement (HOME_HERO) so the customer's first screen is never
-- a blank band. Authority: docs/architecture/db-schema.md §12.17 (ads), monolith-breakdown.md §1.
--
-- Why: HOME_HERO was declared in `ads.placements` but never seeded, so
-- `GET /ads/hero?placement=HOME_HERO` returned `[]` and `AdBannerSection` collapsed to nothing.
-- The DB-driven house fallback is the SDUI `adBanner.banners` leaf (`GET /sdui/home`); this LIVE
-- demo creative exercises the paid path (mirrors the MART_HERO / FOOD_HERO / STORE_TOP demo rows).
--
-- Idempotent (`on conflict (placement_id) do nothing`) and **safe on a fresh DB**: the row is only
-- inserted once its demo seller and catalog product exist (CI applies migrations before the seed,
-- which then inserts the same row from `DEMO_HEROES`). Re-running is a no-op.

begin;

insert into ads.campaigns
  (placement_id, campaign_id, seller_id, placement, target_type, target_id, target_app,
   category, store_id, title, subtitle, image_url, cta, state_code, starts_at, ends_at, status)
select
  'ad-cmp-demo-homehero-1', 'cmp-demo-homehero', 'sel-tiruchi-01', 'HOME_HERO'::ad_placement,
  'PRODUCT'::ad_target_type, 'fm-m1', 'MART'::app_brand, null, null,
  'Everything Delivered', 'MART · FOOD · PHARMA',
  'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?fm=jpg&fit=crop&q=80&w=800&h=450',
  'Shop Now', 'TN', now() - interval '1 day', now() + interval '60 days', 'LIVE'::ad_status
where exists (select 1 from sellers.sellers where seller_id = 'sel-tiruchi-01')
  and exists (select 1 from catalog.products where id = 'fm-m1')
on conflict (placement_id) do nothing;

commit;