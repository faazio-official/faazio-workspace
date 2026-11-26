import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';
import { useViewableTracking } from '@/hooks/useViewableTracking';
import type { MartEssential } from '../../types';
import MartSectionHeader from './MartSectionHeader';
import MartDealCard from './MartDealCard';
import { localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';

const SALE_CARD_W = PRODUCT_CARD_WIDTH;

interface DailyEssentialsRailProps {
  items: MartEssential[];
  onItemPress?: (item: MartEssential) => void;
  onViewAll?: () => void;
  quantityOf?: (id: string) => number;
  onAdd?: (item: MartEssential) => void;
  onIncrement?: (id: string) => void;
  onDecrement?: (id: string) => void;
  /** Passive impression callback, fired once per card that scrolls into view (caller dedupes). */
  onItemView?: (item: MartEssential) => void;
}

const DailyEssentialsRail = memo(function DailyEssentialsRail({
  items,
  onItemPress,
  onViewAll,
  quantityOf,
  onAdd,
  onIncrement,
  onDecrement,
  onItemView,
}: DailyEssentialsRailProps) {
  const language = useLanguageStore((s) => s.language);
  const { onViewableItemsChanged, viewabilityConfig } = useViewableTracking<MartEssential>((item) =>
    onItemView?.(item),
  );

  const renderItem = useCallback(
    ({ item }: { item: MartEssential }) => (
      <MartDealCard
        image={item.imageUrl}
        name={localizedName(item, language)}
        price={item.price}
        originalPrice={item.originalPrice}
        unit={item.size}
        width={SALE_CARD_W}
        quantity={quantityOf?.(item.id) ?? 0}
        onPress={() => onItemPress?.(item)}
        onAdd={onAdd ? () => onAdd(item) : undefined}
        onIncrement={onIncrement ? () => onIncrement(item.id) : undefined}
        onDecrement={onDecrement ? () => onDecrement(item.id) : undefined}
      />
    ),
    [onItemPress, language, quantityOf, onAdd, onIncrement, onDecrement],
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
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
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
