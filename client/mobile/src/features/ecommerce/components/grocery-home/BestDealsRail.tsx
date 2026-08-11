import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { GroceryBestDeal } from '../../mocks/groceryHomeFeed';
import GrocerySectionHeader from './GrocerySectionHeader';
import BestDealCard from './cards/BestDealCard';

const DEAL_W = hs(260);

const DealSeparator = () => <View style={styles.separator} />;

interface BestDealsRailProps {
  items: GroceryBestDeal[];
  onDealPress?: (item: GroceryBestDeal) => void;
  onViewAll?: () => void;
}

const BestDealsRail = memo(function BestDealsRail({
  items,
  onDealPress,
  onViewAll,
}: BestDealsRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: GroceryBestDeal }) => (
      <BestDealCard item={item} width={DEAL_W} onPress={() => onDealPress?.(item)} />
    ),
    [onDealPress],
  );

  return (
    <View style={styles.wrap}>
      <GrocerySectionHeader title="Best Deals" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={DealSeparator}
        bounces={false}
      />
    </View>
  );
});

export default BestDealsRail;

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
