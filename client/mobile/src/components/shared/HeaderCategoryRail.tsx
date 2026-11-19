import React, { memo, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { AppImage } from './AppImage';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { HEADER_RAIL_PAGE_SIZE, usePagedRail } from '@/hooks/usePagedRail';
import { neutral } from '@/theme/brandTokens';
import type { CategoryRailItem } from '@/services/categoryRail';
import type { VendorApp } from '@/services/categoryVendors';

interface HeaderCategoryRailProps {
  /** Fired when a category chip is tapped — opens the category drill-in for that tab. */
  onCategoryPress: (item: CategoryRailItem) => void;
  /** Scope the rail to one sub-app (set in a sub-app header); omit on the Home hub. */
  app?: VendorApp;
}

/**
 * Compact horizontal category rail pinned below a search bar. Shared by the
 * Home hub header (where it fades out on collapse) and the Mart sub-app header
 * (pinned below the searchbar). Chips are sourced from the server taxonomy
 * (`GET /categories/rail` via `usePagedRail`) and open the category drill-in page
 * on tap. Rendered as a plain horizontal ScrollView (not a FlashList) because this
 * region animates every frame — the virtualization machinery would otherwise
 * re-rasterize inside the sliding overlay.
 *
 * The rail is unbounded (Mart + Pharma, any tree level, no count cap), so paging must also
 * advance when a page does not overflow the viewport: a strip that fits on screen
 * never emits a scroll event, which would otherwise strand every chip past the
 * first page.
 */
const HeaderCategoryRail = memo(function HeaderCategoryRail({
  onCategoryPress,
  app,
}: HeaderCategoryRailProps) {
  const { items, loadMore, hasMore, error, refreshing, refresh } = usePagedRail(
    HEADER_RAIL_PAGE_SIZE,
    app,
  );
  const railViewportWidth = useRef(0);
  const railContentWidth = useRef(0);

  // Load the next page when the user scrolls near the right edge.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.width + contentOffset.x >= contentSize.width - hs(60)) {
        loadMore();
      }
    },
    [loadMore],
  );

  // A page that fits inside the viewport cannot be scrolled, so no scroll event ever fires. Grow the
  // visible window until the strip overflows (or every curated chip is rendered). Both measurements
  // are read through refs because `onLayout` and `onContentSizeChange` can arrive in either order.
  const growIfNotScrollable = useCallback(() => {
    const viewport = railViewportWidth.current;
    const content = railContentWidth.current;
    if (hasMore && viewport > 0 && content > 0 && content <= viewport) loadMore();
  }, [hasMore, loadMore]);

  const onContentSizeChange = useCallback(
    (contentWidth: number) => {
      railContentWidth.current = contentWidth;
      growIfNotScrollable();
    },
    [growIfNotScrollable],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      railViewportWidth.current = e.nativeEvent.layout.width;
      growIfNotScrollable();
    },
    [growIfNotScrollable],
  );

  // A failed rail with no chips advertises a retry instead of silently rendering a blank strip
  // (the fetch failure is otherwise indistinguishable from "no curated categories").
  if (items.length === 0 && error && !refreshing) {
    return (
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.chip}
          onPress={refresh}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry loading categories"
        >
          <RefreshCw size={ms(14)} color={neutral.ink} strokeWidth={2.2} />
          <AppText style={styles.chipLabel} numberOfLines={1}>
            Retry
          </AppText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      onScroll={onScroll}
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
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
          {item.icon ? (
            <AppImage
              source={{ uri: item.icon }}
              style={styles.chipIcon}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : null}
          <AppText style={styles.chipLabel} numberOfLines={1}>
            {item.name}
          </AppText>
        </TouchableOpacity>
      ))}
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
