import { useRef } from 'react';
import type { ViewToken } from 'react-native';

interface ViewableTrackingOptions {
  /** Fraction of an item that must be on screen before it counts as viewed (default 60%). */
  itemVisiblePercentThreshold?: number;
}

/**
 * Stable `onViewableItemsChanged` + `viewabilityConfig` for a FlatList/FlashList. Reports each item
 * that becomes viewable to `onView`; the caller owns any cross-list/session dedupe (e.g.
 * `services/productViews.trackProductView`). Refs keep the handler identity stable, satisfying RN's
 * "onViewableItemsChanged must not change on the fly" rule.
 */
export function useViewableTracking<T extends { id: string }>(
  onView: (item: T) => void,
  options: ViewableTrackingOptions = {},
) {
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const token of viewableItems) {
        const item = token.item as T | undefined;
        if (item?.id) onViewRef.current(item);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: options.itemVisiblePercentThreshold ?? 60,
  }).current;

  return { onViewableItemsChanged, viewabilityConfig };
}