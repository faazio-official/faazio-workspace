import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { MartEssential } from '../../mocks/martHomeFeed';
import MartSectionHeader from './MartSectionHeader';
import MartDealCard from './MartDealCard';

const SALE_CARD_W = hs(150);

interface DailyEssentialsRailProps {
  items: MartEssential[];
  onItemPress?: (item: MartEssential) => void;
  onViewAll?: () => void;
}

const DailyEssentialsRail = memo(function DailyEssentialsRail({
  items,
  onItemPress,
  onViewAll,
}: DailyEssentialsRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: MartEssential }) => (
      <MartDealCard
        image={item.imageUrl}
        name={item.name}
        rating={item.rating}
        price={item.price}
        originalPrice={item.originalPrice}
        priceNote={item.priceNote}
        width={SALE_CARD_W}
        onPress={() => onItemPress?.(item)}
      />
    ),
    [onItemPress],
  );

  return (
    <View style={styles.wrap}>
      <MartSectionHeader title="Daily Essentials" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      />
    </View>
  );
});

export default DailyEssentialsRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
});
