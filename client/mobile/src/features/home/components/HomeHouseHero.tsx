import React, { memo, useMemo } from 'react';
import type { AdSlide } from '@data/types';
import type { SduiBanner } from '@data/home/sdui';
import AdBannerCarousel from '@/components/shared/AdBannerCarousel';

interface HomeHouseHeroProps {
  /** Editorial house banners from `GET /sdui/home` (`adBanner.banners`). */
  banners: SduiBanner[];
}

/**
 * Organic Home hero fallback (house banners), shown by `CampaignHero` only when there is no LIVE
 * paid `HOME_HERO` fill. Presentation is the shared `AdBannerCarousel`, but **no AD pill, no
 * impression/click POST and no tap target** — this is editorial content, never money. Collapses to
 * `null` when empty so the paid-first contract never leaves a blank 16:9 slot. `targetApp` is a
 * presentation placeholder the carousel ignores (house heroes are not tappable).
 */
const HomeHouseHero = memo(function HomeHouseHero({ banners }: HomeHouseHeroProps) {
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

export default HomeHouseHero;
