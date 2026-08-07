import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { filterChips, filterFeedPools } from '@data/home/filterFeed';
import type { FilterChipId } from '@data/home/filterFeed';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import FilterChipsRail from '@/features/home/cards/FilterChipsRail';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';
import { useBatchedFeed } from '@/hooks/useBatchedFeed';
import AppText from '@/components/AppText';

const BATCH_SIZE = 8;

interface FilterFeedSectionProps extends SectionProps {
  scrollY?: number;
  viewportHeight?: number;
}

// Filter-chip carousel + batched 2-column feed. Auto-loads the next batch when
// the user has scrolled through ~80% of the currently visible grid. The grid is
// a plain flexWrap View (NOT a nested FlatList) because the whole home feed is
// already one outer FlatList — nesting a second vertical list would hit RN's
// "VirtualizedLists should never be nested" warning.
export default function FilterFeedSection({
  onProductClick,
  addToCart,
  scrollY = 0,
  viewportHeight = 0,
}: FilterFeedSectionProps) {
  const [activeChip, setActiveChip] = useState<FilterChipId>(filterChips[0].id);
  const pool = filterFeedPools[activeChip] ?? [];
  const { visibleItems, hasMore, loadMore, total } = useBatchedFeed(pool, BATCH_SIZE);
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);

  const [sectionTop, setSectionTop] = useState(0);
  const [sectionHeight, setSectionHeight] = useState(0);
  const lastLoadHeight = useRef(0);

  const onSectionLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setSectionTop(y);
    setSectionHeight(height);
  };

  const visibleBottom = scrollY + viewportHeight;
  const reached80 = sectionHeight > 0 && visibleBottom - sectionTop >= sectionHeight * 0.8;

  useEffect(() => {
    if (reached80 && hasMore && sectionHeight > lastLoadHeight.current) {
      lastLoadHeight.current = sectionHeight;
      loadMore();
    }
  }, [reached80, hasMore, sectionHeight, loadMore]);

  useEffect(() => {
    lastLoadHeight.current = 0;
  }, [pool]);

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
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
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
