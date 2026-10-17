import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import CampaignHero from '@/components/shared/CampaignHero';
import { openHeroTarget } from '@/services/adsTarget';
import type { HeroAd } from '@/services/api/GatewayClient';
import type { SectionProps } from './common';

/**
 * Home hub top hero — a paid, labelled `HOME_HERO` placement (every hero is a paid ad; the old
 * static `topAdSlides` fixture is retired). Collapses to nothing when there is no LIVE fill and
 * resolves the deep-link target server-side (product → PDP, store → vendor/medical shop).
 */
function AdBannerSection({ onProductClick, onStoreClick }: SectionProps) {
  const handleHeroPress = useCallback(
    (ad: HeroAd) => {
      void openHeroTarget(ad, {
        onProduct: (product) => onProductClick?.(product),
        onStore: (store) => onStoreClick?.(store),
      });
    },
    [onProductClick, onStoreClick],
  );

  return <CampaignHero placement="HOME_HERO" onPress={handleHeroPress} style={styles.carousel} />;
}

export default memo(AdBannerSection);

const styles = StyleSheet.create({
  carousel: {
    marginHorizontal: hs(16),
    marginTop: vs(4),
    marginBottom: SPACE.BLOCK,
  },
});