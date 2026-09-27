import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { topAdSlides } from '@data/home/rails';
import { AdBannerCarousel } from '@/components/shared';
import { subAppIdFor } from './common';
import type { SectionProps } from './common';

/**
 * Home hub top ad banner. Thin wrapper over the shared `AdBannerCarousel`:
 * supplies the hub's slides, the AppBrand → SubAppId press mapping and the
 * hub's margins (the carousel itself is margin-free so Food can reuse it).
 */
function AdBannerSection({ onLaunchSubApp }: SectionProps) {
  return (
    <AdBannerCarousel
      slides={topAdSlides}
      style={styles.carousel}
      onSlidePress={(slide) => slide.targetApp && onLaunchSubApp(subAppIdFor(slide.targetApp))}
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
