import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { usePagedRail } from '@/hooks/usePagedRail';
import type { CategoryRailItem } from '@data/categories/railFeed';

interface VendorCategoryPillsProps {
  /** Currently selected chip (null = "All" active). */
  active: CategoryRailItem | null;
  /** Called when a chip is tapped (item) or "All" is tapped (null). */
  onSelect: (item: CategoryRailItem | null) => void;
}

const ACCENT = '#1162D3';

/**
 * Pilled category filter for the "Local Vendors Near You" section. Shows the
 * same category feed as the Mart header rail (via `usePagedRail`) plus a leading
 * "All" pill that clears the filter. Tapping a pill filters the vendor list in
 * place (no navigation) — combined AND with the section's free-text search.
 * Rendered as a plain horizontal ScrollView (small animated region).
 */
const VendorCategoryPills = memo(function VendorCategoryPills({
  active,
  onSelect,
}: VendorCategoryPillsProps) {
  const { items, loadMore, hasMore } = usePagedRail();

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.width + contentOffset.x >= contentSize.width - hs(60)) {
        loadMore();
      }
    },
    [loadMore],
  );

  const renderPill = (item: CategoryRailItem | null) => {
    const isActive = active?.id === item?.id;
    return (
      <TouchableOpacity
        key={item ? item.id : '__all__'}
        style={[styles.pill, isActive && styles.pillActive]}
        onPress={() => onSelect(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item ? `Filter by ${item.name}` : 'Show all vendors'}
      >
        {item && (
          <ExpoImage
            source={{ uri: item.icon }}
            style={styles.pillIcon}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        )}
        <AppText style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
          {item ? item.name : 'All'}
        </AppText>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {renderPill(null)}
      {items.map((item) => renderPill(item))}
    </ScrollView>
  );
});

export default VendorCategoryPills;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: hs(16),
    gap: hs(8),
    alignItems: 'center',
  },
  pill: {
    height: vs(32),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    paddingHorizontal: hs(12),
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  pillActive: {
    backgroundColor: '#EAF2FE',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  pillIcon: {
    width: ms(14),
    height: ms(14),
  },
  pillLabel: {
    fontSize: ms(10.5),
    fontWeight: '700',
    color: '#334155',
  },
  pillLabelActive: {
    color: ACCENT,
    fontWeight: '900',
  },
});
