import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { GrocerySeasonSpecial } from '../../mocks/groceryHomeFeed';
import GrocerySectionHeader from './GrocerySectionHeader';
import SeasonSpecialCard from './cards/SeasonSpecialCard';

const CARD_W = hs(250);

const SeasonSeparator = () => <View style={styles.separator} />;

interface SeasonSpecialsRailProps {
  items: GrocerySeasonSpecial[];
  onSpecialPress?: (item: GrocerySeasonSpecial) => void;
  onViewAll?: () => void;
}

const SeasonSpecialsRail = memo(function SeasonSpecialsRail({
  items,
  onSpecialPress,
  onViewAll,
}: SeasonSpecialsRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: GrocerySeasonSpecial }) => (
      <SeasonSpecialCard
        item={item}
        width={CARD_W}
        onPress={() => onSpecialPress?.(item)}
      />
    ),
    [onSpecialPress],
  );

  return (
    <View style={styles.wrap}>
      <GrocerySectionHeader title="Season's Specials" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={SeasonSeparator}
        bounces={false}
      />
    </View>
  );
});

export default SeasonSpecialsRail;

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
