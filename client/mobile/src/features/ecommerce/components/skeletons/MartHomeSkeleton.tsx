import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SkeletonBlock } from '@/components/shared/Skeleton';

/**
 * Mart home loading skeleton — mirrors the Mart feed layout (hero carousel,
 * category rail, deals, flash sale, top brands, local vendors).
 */
const MartHomeSkeleton = memo(function MartHomeSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonBlock width="90%" height={vs(150)} radius={ms(16)} />

      <SkeletonBlock width="45%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.gridRow}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width={hs(70)} height={vs(86)} radius={ms(14)} />
        ))}
      </View>

      <SkeletonBlock width="40%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.railRow}>
        <SkeletonBlock width={hs(150)} height={vs(180)} radius={ms(16)} />
        <SkeletonBlock width={hs(150)} height={vs(180)} radius={ms(16)} />
      </View>

      <SkeletonBlock width="42%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.railRow}>
        <SkeletonBlock width={hs(130)} height={vs(150)} radius={ms(16)} />
        <SkeletonBlock width={hs(130)} height={vs(150)} radius={ms(16)} />
        <SkeletonBlock width={hs(130)} height={vs(150)} radius={ms(16)} />
      </View>
    </View>
  );
});

export default MartHomeSkeleton;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(24),
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
