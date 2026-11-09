import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import CampaignHero from '@/components/shared/CampaignHero';
import HomeHouseHero from '@/features/home/components/HomeHouseHero';
import { openHeroTarget } from '@/services/adsTarget';
import type { HeroAd } from '@/services/api/GatewayClient';
import type { SduiBanner } from '@data/home/sdui';
import type { SectionProps } from './common';

interface AdBannerSectionProps extends SectionProps {
  /** Editorial house banners (`adBanner.banners`) — the DB-driven fallback when no LIVE paid fill. */
  banners?: SduiBanner[];
}

/**
 * Home hub top hero — a paid, labelled `HOME_HERO` placement (every hero is a paid ad; the old
 * static `topAdSlides` fixture is retired). When there is no LIVE fill it shows the SDUI `adBanner`
 * house banners (`HomeHouseHero`), or collapses when those are empty — never a blank 16:9 slot and
 * never a fabricated ad. Resolves the deep-link target server-side (product → PDP, store →
 * vendor/medical shop).
 */
function AdBannerSection({ banners, onProductClick, onStoreClick }: AdBannerSectionProps) {
  const handleHeroPress = useCallback(
    (ad: HeroAd) => {
      void openHeroTarget(ad, {
        onProduct: (product) => onProductClick?.(product),
        onStore: (store) => onStoreClick?.(store),
      });
    },
    [onProductClick, onStoreClick],
  );

  return (
    <CampaignHero
      placement="HOME_HERO"
      onPress={handleHeroPress}
      fallback={banners?.length ? <HomeHouseHero banners={banners} /> : null}
      style={styles.carousel}
    />
  );
}

export default memo(AdBannerSection);

const styles = StyleSheet.create({
  carousel: {
    marginHorizontal: hs(16),
    marginTop: vs(4),
    marginBottom: SPACE.BLOCK,
  },
});
