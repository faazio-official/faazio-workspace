import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SkeletonBlock } from '@/components/shared/Skeleton';

/**
 * Mart home loading skeleton — mirrors the Mart feed layout (hero carousel,
 * deals, daily essentials, local vendors).
 */
const MartHomeSkeleton = memo(function MartHomeSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonBlock width="90%" height={vs(150)} radius={ms(16)} />

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
  railRow: {
    flexDirection: 'row',
    gap: hs(12),
    overflow: 'hidden',
  },
});
