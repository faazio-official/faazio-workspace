import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';
import { useViewableTracking } from '@/hooks/useViewableTracking';
import type { MartDeal } from '../../types';
import MartSectionHeader from './MartSectionHeader';
import MartDealCard from './MartDealCard';
import { localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';

const DEAL_CARD_W = PRODUCT_CARD_WIDTH;

interface DealsOfDayRailProps {
  deals: MartDeal[];
  onDealPress?: (deal: MartDeal) => void;
  onViewAll?: () => void;
  quantityOf?: (id: string) => number;
  onAdd?: (deal: MartDeal) => void;
  onIncrement?: (id: string) => void;
  onDecrement?: (id: string) => void;
  /** Passive impression callback, fired once per card that scrolls into view (caller dedupes). */
  onItemView?: (deal: MartDeal) => void;
}

const DealsOfDayRail = memo(function DealsOfDayRail({
  deals,
  onDealPress,
  onViewAll,
  quantityOf,
  onAdd,
  onIncrement,
  onDecrement,
  onItemView,
}: DealsOfDayRailProps) {
  const language = useLanguageStore((s) => s.language);
  const { onViewableItemsChanged, viewabilityConfig } = useViewableTracking<MartDeal>((deal) =>
    onItemView?.(deal),
  );

  const renderItem = useCallback(
    ({ item }: { item: MartDeal }) => (
      <MartDealCard
        image={item.imageUrl}
        name={localizedName(item, language)}
        price={item.price}
        originalPrice={item.originalPrice}
        unit={item.size}
        width={DEAL_CARD_W}
        quantity={quantityOf?.(item.id) ?? 0}
        onPress={() => onDealPress?.(item)}
        onAdd={onAdd ? () => onAdd(item) : undefined}
        onIncrement={onIncrement ? () => onIncrement(item.id) : undefined}
        onDecrement={onDecrement ? () => onDecrement(item.id) : undefined}
      />
    ),
    [onDealPress, language, quantityOf, onAdd, onIncrement, onDecrement],
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
