import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { GroceryProductItem } from '../../mocks/groceryHomeFeed';
import GrocerySectionHeader from './GrocerySectionHeader';
import TopPickCard from './cards/TopPickCard';

const CARD_W = hs(140);

const CardSeparator = () => <View style={styles.separator} />;

interface AlsoNeedRailProps {
  items: GroceryProductItem[];
  onProductPress?: (item: GroceryProductItem) => void;
  onViewAll?: () => void;
}

const AlsoNeedRail = memo(function AlsoNeedRail({
  items,
  onProductPress,
  onViewAll,
}: AlsoNeedRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: GroceryProductItem }) => (
      <TopPickCard item={item} width={CARD_W} onPress={() => onProductPress?.(item)} />
    ),
    [onProductPress],
  );

  return (
    <View style={styles.wrap}>
      <GrocerySectionHeader title="You May Also Need" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={CardSeparator}
        bounces={false}
      />
    </View>
  );
});

export default AlsoNeedRail;

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
