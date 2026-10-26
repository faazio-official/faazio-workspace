import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { SkeletonBlock } from '@/components/shared/Skeleton';
import { foodTheme } from '../constants/theme';

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <View style={styles.container}>
      {/* Location header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <SkeletonBlock width={ms(24)} height={ms(24)} radius={ms(12)} />
          <View>
            <SkeletonBlock width={hs(120)} height={ms(18)} radius={ms(6)} />
            <SkeletonBlock width={hs(90)} height={ms(13)} radius={ms(6)} style={styles.headerSub} />
          </View>
        </View>
        <View style={styles.headerRight}>
          <SkeletonBlock width={ms(34)} height={ms(34)} radius={ms(17)} />
          <SkeletonBlock width={ms(34)} height={ms(34)} radius={ms(17)} />
        </View>
      </View>

      {/* Hero carousel */}
      <SkeletonBlock width="38%" height={vs(16)} radius={ms(6)} style={styles.sectionTitle} />
      <SkeletonBlock width="90%" height={vs(250)} radius={ms(20)} />

      {/* Specials rail */}
      <SkeletonBlock width="46%" height={vs(16)} radius={ms(6)} style={styles.sectionTitle} />
      <View style={styles.railRow}>
        <SkeletonBlock width={hs(168)} height={vs(250)} radius={ms(18)} />
        <SkeletonBlock width={hs(168)} height={vs(250)} radius={ms(18)} />
        <SkeletonBlock width={hs(168)} height={vs(250)} radius={ms(18)} />
      </View>

      {/* Restaurant grid */}
      <SkeletonBlock width="52%" height={vs(16)} radius={ms(6)} style={styles.sectionTitle} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonBlock width={ms(100)} height={ms(100)} radius={ms(12)} />
          <View style={styles.rowBody}>
            <SkeletonBlock width="70%" height={ms(14)} radius={ms(6)} />
            <SkeletonBlock width="55%" height={ms(11)} radius={ms(6)} />
            <SkeletonBlock width="40%" height={ms(11)} radius={ms(6)} style={styles.headerSub} />
            <SkeletonBlock width="82%" height={ms(10)} radius={ms(6)} style={styles.headerSub} />
          </View>
        </View>
      ))}
    </View>
  );
});

export default LoadingSkeleton;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(12),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  headerSub: {
    marginTop: vs(6),
  },
  sectionTitle: {
    marginTop: SPACE.SECTION,
    marginBottom: SPACE.BLOCK,
  },
  railRow: {
    flexDirection: 'row',
    gap: hs(10),
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    padding: hs(10),
    borderRadius: ms(14),
    backgroundColor: foodTheme.card,
    marginBottom: vs(12),
  },
  rowBody: {
    flex: 1,
    gap: vs(5),
  },
});
