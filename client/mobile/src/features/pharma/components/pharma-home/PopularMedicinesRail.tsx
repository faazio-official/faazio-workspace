import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { PharmaPopularMedicine } from '../../mocks/pharmaHomeFeed';
import PharmaSectionHeader from './PharmaSectionHeader';
import PopularMedicineCard from './cards/PopularMedicineCard';

const MEDICINE_W = hs(140);

const MedicineSeparator = () => <View style={styles.separator} />;

interface PopularMedicinesRailProps {
  items: PharmaPopularMedicine[];
  onPress?: (item: PharmaPopularMedicine) => void;
  onAdd?: (item: PharmaPopularMedicine) => void;
  addedIds?: Set<string>;
  onViewAll?: () => void;
}

const PopularMedicinesRail = memo(function PopularMedicinesRail({
  items,
  onPress,
  onAdd,
  addedIds,
  onViewAll,
}: PopularMedicinesRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: PharmaPopularMedicine }) => (
      <PopularMedicineCard
        item={item}
        width={MEDICINE_W}
        added={addedIds?.has(item.id) ?? false}
        onPress={() => onPress?.(item)}
        onAdd={() => onAdd?.(item)}
      />
    ),
    [onPress, onAdd, addedIds],
  );

  return (
    <View style={styles.wrap}>
      <PharmaSectionHeader title="Popular Medicines" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={MedicineSeparator}
        bounces={false}
      />
    </View>
  );
});

export default PopularMedicinesRail;

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
