import React, { memo, useMemo } from 'react';
import type { AdSlide } from '@data/types';
import type { SduiBanner } from '@data/home/sdui';
import AdBannerCarousel from '@/components/shared/AdBannerCarousel';

interface MartHouseHeroProps {
  /** Editorial house banners from `GET /sdui/home` (`martHero.banners`). */
  banners: SduiBanner[];
}

/**
 * Organic Mart hero fallback (house banners), shown by `CampaignHero` only when there is no LIVE
 * paid `MART_HERO` fill. Presentation is the shared `AdBannerCarousel`, but **no AD pill, no
 * impression/click POST and no tap target** — this is editorial content, never money. Collapses to
 * `null` when empty so the paid-first contract never leaves a blank 16:9 slot. Image-only banners
 * without a URL are dropped rather than rendering an empty card.
 */
const MartHouseHero = memo(function MartHouseHero({ banners }: MartHouseHeroProps) {
  const slides = useMemo<AdSlide[]>(
    () =>
      banners
        .filter((b) => b.imageUrl)
        .map((b) => ({
          title: b.title,
          tagline: b.subtitle ?? '',
          badge: '',
          imageUrl: b.imageUrl ?? '',
          targetApp: 'MART',
        })),
    [banners],
  );

  if (slides.length === 0) return null;

  return <AdBannerCarousel slides={slides} />;
});

export default MartHouseHero;