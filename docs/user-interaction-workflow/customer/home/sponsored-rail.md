# Sponsored rail / hero ads

**App / route:** customer · Home and sector surfaces (`src/components/shared/SponsoredRail.tsx`,
`CampaignHero.tsx`, `features/home/sections/SponsoredRailSection.tsx`)
**Status:** Shipped
**Trigger:** Home/sector section renders an ad slot.

## Steps

1. The section requests live ads for its placement (`getLiveAds` or `getHeroAds`).
2. `getSponsoredProducts` performs `GET /ads/live` then `POST /products/batch` to resolve products.
3. The rail renders labelled sponsored cards; hero surfaces render the campaign creative.
   The Home hub (`AdBannerSection`, `HOME_HERO`) is **paid-first with a DB-driven house fallback**:
   a LIVE `HOME_HERO` campaign wins; otherwise it renders the SDUI `adBanner.banners` house hero
   (`HomeHouseHero`, no AD pill, no ad events, non-interactive); when both are empty it collapses.
4. Impression/click calls `recordAdEvent` (`POST /ads/events`). `gateway.reportHeroAd`
   (`POST /ads/campaigns/{placementId}/report`) exists but has no UI caller today.

## State

- Section-local state (no shared ad store).
- `useCartStore` for add-to-cart from sponsored product cards.

## Data path

- `gateway.getLiveAds(placement?)` → `GET /ads/live?slot=` → `ads.sponsored_slots`.
- `gateway.getHeroAds(placement?, ctx)` → `GET /ads/hero?placement&app&category&storeId` →
  `ads.campaigns`.
- `gateway.getSponsoredProducts(placement?)` → `/ads/live` + `POST /products/batch`.
- `gateway.recordAdEvent(slotId, event)` → `POST /ads/events`.
- Cache: `faazio:v1:ads:live:{placement}` 600 s,
  `faazio:v1:ads:hero:{placement}:{app}:{category}:{store}` 300 s.
- **ATT / tracking determination:** the rail and hero campaigns are first-party, closed-loop retail
  media served by Faazio's own gateway (`GET /ads/hero`, `GET /ads/live`). Impression/click events
  post to `POST /ads/events` (auth-gated) and last-click attribution credits
  `ads.sponsored_slots.orders_attributed` by **slot id only** (`services/adsAttribution.ts` — "Module
  state only — never persisted, never PII, consumed once"). Phone number is not used in attribution;
  there is no third-party ad network, no data broker and no IDFA/AD_ID — so this is **not** App
  Tracking Transparency tracking and needs no ATT prompt or `NSUserTrackingUsageDescription`.

## Success / error / empty

- **Success:** labelled sponsored cards/hero.
- **Error:** the section hides or falls back to editorial content; no fake ads.
- **Empty:** no live ads → section omitted (not filled with fixtures).

## Known gaps

- Ad availability depends on live `ads` rows, but the **Home top hero is never blank**: `HOME_HERO`
  has a seeded LIVE demo creative (`0095`, `ad-cmp-demo-homehero-1`) plus the `adBanner.banners`
  house fallback in the SDUI doc.
- Every shop has 2 seeded LIVE `STORE_TOP` campaigns (`0094`, `ad-cmp-shop-<store>-{1,2}`), so the
  store-page hero band is testable without manually publishing ads.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (ads row)
- `docs/architecture/caching-cloudflare-valkey.md`
- `data/DATA_CONTROL.md` (`@data/home` sponsored fixtures are offline only)
