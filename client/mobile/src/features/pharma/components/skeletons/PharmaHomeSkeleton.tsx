import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SkeletonBlock } from '@/components/shared/Skeleton';

/**
 * Pharma home loading skeleton — mirrors the Pharma feed layout (feature chips,
 * hero banner, category rail, quick reorder, top offers, popular medicines).
 */
const PharmaHomeSkeleton = memo(function PharmaHomeSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} width={hs(90)} height={vs(30)} radius={ms(15)} />
        ))}
      </View>

      <SkeletonBlock width="92%" height={vs(150)} radius={ms(16)} />

      <SkeletonBlock width="45%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.gridRow}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width={hs(70)} height={vs(86)} radius={ms(14)} />
        ))}
      </View>

      <SkeletonBlock width="38%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.railRow}>
        <SkeletonBlock width={hs(150)} height={vs(170)} radius={ms(16)} />
        <SkeletonBlock width={hs(150)} height={vs(170)} radius={ms(16)} />
      </View>
    </View>
  );
});

export default PharmaHomeSkeleton;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(24),
  },
  chipRow: {
    flexDirection: 'row',
    gap: hs(8),
    marginBottom: vs(16),
  },
  title: {
    marginTop: vs(22),
    marginBottom: vs(12),
  },
  gridRow: {
    flexDirection: 'row',
    gap: hs(12),
    overflow: 'hidden',
  },
  railRow: {
    flexDirection: 'row',
    gap: hs(12),
    overflow: 'hidden',
  },
});
