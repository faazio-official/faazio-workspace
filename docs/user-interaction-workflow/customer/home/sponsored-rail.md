# Sponsored rail / hero ads

**App / route:** customer · Home and sector surfaces (`src/components/shared/SponsoredRail.tsx`,
`CampaignHero.tsx`, `features/home/sections/SponsoredRailSection.tsx`)
**Status:** Shipped
**Trigger:** Home/sector section renders an ad slot.

## Steps

1. The section requests live ads for its placement (`getLiveAds` or `getHeroAds`).
2. `getSponsoredProducts` performs `GET /ads/live` then `POST /products/batch` to resolve products.
3. The rail renders labelled sponsored cards; hero surfaces render the campaign creative.
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

## Success / error / empty

- **Success:** labelled sponsored cards/hero.
- **Error:** the section hides or falls back to editorial content; no fake ads.
- **Empty:** no live ads → section omitted (not filled with fixtures).

## Known gaps

- None specific. Ad availability depends on live `ads` rows.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (ads row)
- `docs/architecture/caching-cloudflare-valkey.md`
- `data/DATA_CONTROL.md` (`@data/home` sponsored fixtures are offline only)
