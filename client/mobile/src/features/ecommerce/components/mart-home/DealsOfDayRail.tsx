import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import { useViewableTracking } from '@/hooks/useViewableTracking';
import type { MartDeal } from '../../mocks/martHomeFeed';
import MartSectionHeader from './MartSectionHeader';
import MartDealCard from './MartDealCard';

const DEAL_CARD_W = hs(150);

interface DealsOfDayRailProps {
  deals: MartDeal[];
  onDealPress?: (deal: MartDeal) => void;
  onViewAll?: () => void;
  /** Passive impression callback, fired once per card that scrolls into view (caller dedupes). */
  onItemView?: (deal: MartDeal) => void;
}

const DealsOfDayRail = memo(function DealsOfDayRail({
  deals,
  onDealPress,
  onViewAll,
  onItemView,
}: DealsOfDayRailProps) {
  const { onViewableItemsChanged, viewabilityConfig } = useViewableTracking<MartDeal>((deal) =>
    onItemView?.(deal),
  );

  const renderItem = useCallback(
    ({ item }: { item: MartDeal }) => (
      <MartDealCard
        image={item.imageUrl}
        name={item.name}
        rating={item.rating}
        price={item.price}
        originalPrice={item.originalPrice}
        priceNote={item.priceNote}
        width={DEAL_CARD_W}
        onPress={() => onDealPress?.(item)}
      />
    ),
    [onDealPress],
  );

  return (
    <View style={styles.wrap}>
      <MartSectionHeader title="Deals of the Day" onViewAll={onViewAll} />
      <FlashList
        data={deals}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />
    </View>
  );
});

export default DealsOfDayRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
});
