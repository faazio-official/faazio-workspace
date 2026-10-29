import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { AppImage } from './AppImage';
import AppText from '@/components/AppText';
import InfoButton from './InfoButton';
import { hs, ms, vs } from '@/utils/responsive';
import { usePagedRail } from '@/hooks/usePagedRail';
import type { CategoryRailItem } from '@data/categories/railFeed';

interface HeaderCategoryRailProps {
  /** Fired when a category chip is tapped — opens the category drill-in for that tab. */
  onCategoryPress: (item: CategoryRailItem) => void;
  /** Opt-in registry key that renders a small "i" guidance badge at the rail end. */
  infoKey?: string;
}

/**
 * Compact horizontal category rail pinned below a search bar. Shared by the
 * Home hub header (where it fades out on collapse) and the Mart sub-app header
 * (pinned below the searchbar). Chips are sourced from the merged Mart category
 * tree via `usePagedRail` and open the category drill-in page on tap. Rendered
 * as a plain horizontal ScrollView (not a FlashList) because this region
 * animates every frame — the virtualization machinery would otherwise
 * re-rasterize inside the sliding overlay.
 */
const HeaderCategoryRail = memo(function HeaderCategoryRail({
  onCategoryPress,
  infoKey,
}: HeaderCategoryRailProps) {
  const { items, loadMore } = usePagedRail();

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
          <AppImage
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
      {infoKey ? <InfoButton variant="badge" contentKey={infoKey} /> : null}
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
});
