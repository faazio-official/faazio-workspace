import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { GroceryProductItem } from '../../mocks/groceryHomeFeed';
import GrocerySectionHeader from './GrocerySectionHeader';
import TopPickCard from './cards/TopPickCard';

const TOP_PICK_W = hs(140);

const TopPickSeparator = () => <View style={styles.separator} />;

interface TopPicksRailProps {
  items: GroceryProductItem[];
  onProductPress?: (item: GroceryProductItem) => void;
  onViewAll?: () => void;
}

const TopPicksRail = memo(function TopPicksRail({
  items,
  onProductPress,
  onViewAll,
}: TopPicksRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: GroceryProductItem }) => (
      <TopPickCard
        item={item}
        width={TOP_PICK_W}
        onPress={() => onProductPress?.(item)}
      />
    ),
    [onProductPress],
  );

  return (
    <View style={styles.wrap}>
      <GrocerySectionHeader title="Top Picks For You" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={TopPickSeparator}
        bounces={false}
      />
    </View>
  );
});

export default TopPicksRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  separator: {
    width: hs(12),
  },
});
