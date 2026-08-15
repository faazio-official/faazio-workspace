import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SkeletonBlock } from '@/components/shared/Skeleton';

/**
 * Grocery home loading skeleton — mirrors the Grocery feed layout (hero banner,
 * ad carousel, category rail, top picks, best deals, season specials, brands).
 */
const GroceryHomeSkeleton = memo(function GroceryHomeSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonBlock width="92%" height={vs(140)} radius={ms(16)} />

      <SkeletonBlock width="40%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.gridRow}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} width={hs(70)} height={vs(86)} radius={ms(14)} />
        ))}
      </View>

      <SkeletonBlock width="36%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.railRow}>
        <SkeletonBlock width={hs(140)} height={vs(170)} radius={ms(16)} />
        <SkeletonBlock width={hs(140)} height={vs(170)} radius={ms(16)} />
      </View>

      <SkeletonBlock width="38%" height={vs(16)} radius={ms(6)} style={styles.title} />
      <View style={styles.railRow}>
        <SkeletonBlock width={hs(120)} height={vs(140)} radius={ms(16)} />
        <SkeletonBlock width={hs(120)} height={vs(140)} radius={ms(16)} />
        <SkeletonBlock width={hs(120)} height={vs(140)} radius={ms(16)} />
      </View>
    </View>
  );
});

export default GroceryHomeSkeleton;

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
