import React, { memo, useCallback, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { hs, vs, ms } from '@/utils/responsive';
import { useDerivedValue, useSharedValue, runOnJS, type SharedValue } from 'react-native-reanimated';
import { filterChips, filterFeedPools } from '@data/home/filterFeed';
import type { FilterChipId } from '@data/home/filterFeed';
import type { Product } from '@data/types';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import FilterChipsRail from '@/features/home/cards/FilterChipsRail';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';
import { useBatchedFeed } from '@/hooks/useBatchedFeed';
import AppText from '@/components/AppText';

const BATCH_SIZE = 8;

interface FilterFeedSectionProps extends SectionProps {
  scrollY: SharedValue<number>;
  viewportH: SharedValue<number>;
}

// Filter-chip carousel + batched 2-column feed. Auto-loads the next batch when
// the user has scrolled through ~60% of the currently visible grid, and
// prefetches the next batch's images (expo-image) so they decode ahead of the
// fold. The grid is a plain flexWrap View (NOT a nested FlatList) because the
// whole home feed is already one outer FlatList — nesting a second vertical
// list would hit RN's "VirtualizedLists should never be nested" warning.
//
// Scroll position is read as Reanimated SharedValues (never mirrored to JS
// state) so scrolling does not re-render the section or its cards. Batch
// loading is edge-triggered in a UI-thread worklet and dispatched via runOnJS.
function FilterFeedSection({
  onProductClick,
  addToCart,
  scrollY,
  viewportH,
}: FilterFeedSectionProps) {
  const [activeChip, setActiveChip] = useState<FilterChipId>(filterChips[0].id);
  const pool = filterFeedPools[activeChip] ?? [];
  const { visibleItems, hasMore, loadMore, total, visibleCount } = useBatchedFeed(pool, BATCH_SIZE);
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);

  const sectionTop = useSharedValue(0);
  const sectionH = useSharedValue(0);
  const lastLoadH = useSharedValue(0);

  const onSectionLayout = useCallback((e: LayoutChangeEvent) => {
    sectionTop.value = e.nativeEvent.layout.y;
    sectionH.value = e.nativeEvent.layout.height;
  }, [sectionTop, sectionH]);

  // Prefetches the image URLs of the next unloaded batch so they decode while
  // the user is still reading the current one — never mid-fling. Non-blocking;
  // fire-and-forget into expo-image's memory-disk cache.
  const prefetchNextBatch = useCallback(() => {
    const next = pool.slice(visibleCount, visibleCount + BATCH_SIZE);
    if (next.length > 0) {
      ExpoImage.prefetch(next.map((p) => p.image), 'memory-disk');
    }
  }, [pool, visibleCount]);

  const onLoadMore = useCallback(() => {
    // Defer the batch mount to the next frame so the 8-card mount (image decode +
    // layout) doesn't land mid-fling and cause a frame spike at threshold crossings.
    requestAnimationFrame(() => {
      loadMore();
      prefetchNextBatch();
    });
  }, [loadMore, prefetchNextBatch]);

  useDerivedValue(() => {
    const visibleBottom = scrollY.value + viewportH.value;
    // Load ahead at ~60% of the visible grid so the next batch mounts while the
    // user is still reading, not mid-scroll (Flipkart/Amazon prefetch pattern).
    const reached60 = sectionH.value > 0 && visibleBottom - sectionTop.value >= sectionH.value * 0.6;
    if (reached60 && hasMore && sectionH.value > lastLoadH.value) {
      lastLoadH.value = sectionH.value;
      runOnJS(onLoadMore)();
    }
  });

  const handlePress = useCallback(
    (product: Product) => onProductClick?.(product),
    [onProductClick],
  );
  const handleAddStable = useCallback(
    (product: Product) => handleAdd(product.id, product.name, product.price, product.emoji),
    [handleAdd],
  );

  return (
    <View onLayout={onSectionLayout}>
      <SectionHeader title="Discover" />
      <FilterChipsRail chips={filterChips} activeId={activeChip} onSelect={setActiveChip} />
      <View style={styles.grid}>
        {visibleItems.map((product) => (
          <UniversalFeedCard
            key={product.id}
            product={product}
            isAdded={addedId === product.id}
            onPress={handlePress}
            onAdd={handleAddStable}
          />
        ))}
      </View>
      {total === 0 ? (
        <AppText style={styles.emptyState}>No items in this category yet.</AppText>
      ) : !hasMore ? (
        <AppText style={styles.endState}>All {total} items loaded</AppText>
      ) : null}
    </View>
  );
}

export default memo(FilterFeedSection);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
  },
  emptyState: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: vs(32),
  },
  endState: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: vs(18),
  },
});
