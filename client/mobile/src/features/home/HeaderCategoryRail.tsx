import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { usePagedRail } from '@/hooks/usePagedRail';
import type { CategoryRailItem } from '@data/categories/railFeed';

interface HeaderCategoryRailProps {
  /** Fired when a category chip is tapped — opens Master Categories deep-linked to its tab. */
  onCategoryPress: (item: CategoryRailItem) => void;
  /** Fired when the trailing "View All" is tapped — opens Master Categories scoped to Mart. */
  onViewAll: () => void;
  /** Accent color for the active chip border / icon tint. */
  accent?: string;
}

/**
 * Compact horizontal category rail pinned inside the Home header below the
 * search bar. Fades out while the header collapses. Chips are sourced from the
 * merged Mart category tree via `usePagedRail` and deep-link the Master
 * Categories sidebar on tap. Rendered as a plain horizontal ScrollView (not a
 * FlashList) because this region animates every frame — the virtualization
 * machinery would otherwise re-rasterize inside the sliding overlay.
 */
const HeaderCategoryRail = memo(function HeaderCategoryRail({
  onCategoryPress,
  onViewAll,
  accent = '#1162D3',
}: HeaderCategoryRailProps) {
  const { items, loadMore, hasMore } = usePagedRail();

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <TouchableOpacity
        style={[styles.chip, styles.viewAllChip]}
        onPress={onViewAll}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="View all categories"
      >
        <AppText style={[styles.chipLabel, { color: accent }]}>View All</AppText>
        <ChevronRight size={ms(12)} color={accent} strokeWidth={2.6} />
      </TouchableOpacity>
    );
  }, [hasMore, onViewAll, accent]);

  // Load the next static page when the user scrolls near the right edge
  // (the feed is tiny and fixed, so this is a lightweight equivalent of the
  // FlashList onEndReached it replaced).
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.width + contentOffset.x >= contentSize.width - hs(60)) {
        loadMore();
      }
    },
    [loadMore],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.chip}
          onPress={() => onCategoryPress(item)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Browse ${item.name}`}
        >
          <ExpoImage
            source={{ uri: item.icon }}
            style={styles.chipIcon}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
          <AppText style={styles.chipLabel} numberOfLines={1}>
            {item.name}
          </AppText>
        </TouchableOpacity>
      ))}
      {renderFooter()}
    </ScrollView>
  );
});

export default HeaderCategoryRail;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: hs(2),
    gap: hs(8),
    alignItems: 'center',
  },
  chip: {
    height: vs(30),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    paddingHorizontal: hs(10),
  },
  chipIcon: {
    width: ms(16),
    height: ms(16),
  },
  chipLabel: {
    fontSize: ms(10.5),
    fontWeight: '700',
    color: '#000000',
  },
  viewAllChip: {},
});
