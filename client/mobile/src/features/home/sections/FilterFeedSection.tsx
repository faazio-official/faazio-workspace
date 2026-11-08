import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import { AppImage } from '@/components/shared/AppImage';
import { hs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useDerivedValue, useSharedValue, runOnJS, type SharedValue } from 'react-native-reanimated';
import { filterChips, filterFeedPools } from '@data/home/filterFeed';
import type { FilterChipId } from '@data/home/filterFeed';
import type { Product } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import FilterChipsRail from '@/features/home/cards/FilterChipsRail';
import { SectionHeader, useAddToCartFeedback, usePricedProducts } from './common';
import type { SectionProps } from './common';
import { useBatchedFeed } from '@/hooks/useBatchedFeed';
import AppText from '@/components/AppText';
import { ActivityIndicator } from 'react-native';
import { brandRamp } from '@/theme/brandTokens';

const BATCH_SIZE = 8;

interface FilterFeedSectionProps extends SectionProps {
  /**
   * SDUI feed chips → product ids, keyed by chip id. When present the active chip's rows are
   * resolved through the gateway; the local `filterFeedPools` fixture is the offline fallback.
   */
  chipProducts?: Record<string, string[]>;
  scrollY: SharedValue<number>;
  viewportH: SharedValue<number>;
}

// Filter-chip carousel + batched 2-column feed. Auto-loads the next batch when
// the user has scrolled through ~60% of the currently visible grid, and
// prefetches the next batch's images (AppImage) so they decode ahead of the
// fold. The grid is a plain flexWrap View (NOT a nested FlatList) because the
// whole home feed is already one outer FlatList — nesting a second vertical
// list would hit RN's "VirtualizedLists should never be nested" warning.
//
// Scroll position is read as Reanimated SharedValues (never mirrored to JS
// state) so scrolling does not re-render the section or its cards. Batch
// loading is edge-triggered in a UI-thread worklet and dispatched via runOnJS.
function FilterFeedSection({
  chipProducts,
  onProductClick,
  addToCart,
  scrollY,
  viewportH,
}: FilterFeedSectionProps) {
  const [activeChip, setActiveChip] = useState<FilterChipId>(filterChips[0].id);
  const offline = !gateway.remoteEnabled;
  // SDUI-resolved rows for the active chip. Online, `null` means "not fetched yet"; an empty
  // array is an honest authoritative empty. Authored `filterFeedPools` are used only offline.
  const [feedPool, setFeedPool] = useState<Product[] | null>(null);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [reloadNonce, setReloadNonce] = useState(0);
  const feedIds = chipProducts?.[activeChip];

  useEffect(() => {
    if (offline) return;
    if (!feedIds || feedIds.length === 0) {
      setFeedPool([]);
      setFetchState('live');
      return;
    }
    let active = true;
    setFetchState('loading');
    gateway
      .getProductsByIds(feedIds)
      .then((rows) => {
        if (!active) return;
        setFeedPool(rows as unknown as Product[]);
        setFetchState('live');
      })
      .catch(() => {
        if (!active) return;
        setFeedPool([]);
        setFetchState('error');
      });
    return () => {
      active = false;
    };
  }, [feedIds, offline, reloadNonce]);

  const pool = offline ? filterFeedPools[activeChip] ?? [] : feedPool ?? [];
  const pricedPool = usePricedProducts(pool);
  const { visibleItems, hasMore, loadMore, total, visibleCount } = useBatchedFeed(pricedPool, BATCH_SIZE);
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
  // fire-and-forget into the native memory-disk image cache.
  const prefetchNextBatch = useCallback(() => {
    const next = pool.slice(visibleCount, visibleCount + BATCH_SIZE);
    if (next.length > 0) {
      AppImage.prefetch(next.map((p) => p.image));
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
      {!offline && fetchState === 'loading' ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={brandRamp.MART.base} />
        </View>
      ) : !offline && fetchState === 'error' ? (
        <View style={styles.stateWrap}>
          <AppText style={styles.emptyState}>Could not load this category.</AppText>
          <TouchableOpacity onPress={() => setReloadNonce((n) => n + 1)} activeOpacity={0.8} accessibilityRole="button">
            <AppText style={styles.retryText}>Try again</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
        </>
      )}
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
  stateWrap: {
    alignItems: 'center',
    paddingVertical: SPACE.SECTION,
    gap: 6,
  },
  emptyState: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: SPACE.SECTION,
  },
  retryText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: brandRamp.MART.base,
    textAlign: 'center',
  },
  endState: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: SPACE.BLOCK,
  },
});
