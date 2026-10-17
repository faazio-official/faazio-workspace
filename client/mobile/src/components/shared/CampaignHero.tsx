import React, { memo, useEffect, useMemo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { AdSlide } from '@data/types';
import { gateway, type HeroAd } from '@/services/api/GatewayClient';
import { setLastClickedSlotId } from '@/services/adsAttribution';
import { useCampaignHero } from '@/hooks/useCampaignHero';
import AdBannerCarousel from './AdBannerCarousel';

interface HeroSlide extends AdSlide {
  ad: HeroAd;
}

interface CampaignHeroProps {
  /** Hero placement served by the ad-server (`GET /ads/hero?placement=…`). */
  placement: string;
  /** Scope filters: `app` for all heroes, `category` for CATEGORY_TOP, `storeId` for STORE_TOP. */
  app?: string;
  category?: string;
  storeId?: string;
  /** House fallback shown only when there is no LIVE paid fill (e.g. the SDUI Mart hero). */
  fallback?: ReactNode;
  /** Tap handler — the host resolves the target (see `services/adsTarget`). */
  onPress?: (ad: HeroAd) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Paid, labelled 16:9 hero carousel fed by the ad-server (`GET /ads/hero` → target resolver). The
 * shared `AdBannerCarousel` renders it with the AD pill always on; this wrapper owns fill, the
 * closed-loop impression/click events and the fallback contract (no LIVE fill → `fallback`, never a
 * fabricated ad). Lives in `components/shared` so Mart / category / store surfaces share one pipeline.
 */
const CampaignHero = memo(function CampaignHero({
  placement,
  app,
  category,
  storeId,
  fallback = null,
  onPress,
  style,
}: CampaignHeroProps) {
  const { ads } = useCampaignHero(placement, { app, category, storeId });

  const slides = useMemo<HeroSlide[]>(
    () =>
      ads.map((ad) => ({
        title: ad.title,
        tagline: ad.subtitle ?? ad.cta ?? '',
        badge: '',
        imageUrl: ad.imageUrl ?? '',
        targetApp: ad.targetApp,
        ad,
      })),
    [ads],
  );

  // One impression per rendered creative (server de-dupes per user + slot). Best-effort.
  useEffect(() => {
    for (const ad of ads) void gateway.recordAdEvent(ad.placementId, 'impression');
  }, [ads]);

  if (slides.length === 0) return <>{fallback}</>;

  return (
    <AdBannerCarousel
      slides={slides}
      showAdLabel
      slideKey={(slide) => (slide as HeroSlide).ad.placementId}
      style={style}
      onSlidePress={(slide) => {
        const ad = (slide as HeroSlide).ad;
        void gateway.recordAdEvent(ad.placementId, 'click');
        setLastClickedSlotId(ad.placementId);
        onPress?.(ad);
      }}
    />
  );
});

export default CampaignHero;