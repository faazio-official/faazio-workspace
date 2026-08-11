import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { vs } from '@/utils/responsive';
import FoodSectionHeader from '../FoodSectionHeader';
import type { SpecialDish } from '../../mocks/types';
import PopularDishCard from './PopularDishCard';

interface PopularDishRailProps {
  dishes: SpecialDish[];
  onSeeAll?: () => void;
  onPress?: (dish: SpecialDish) => void;
}

/**
 * Section 5 — "Popular Dishes" horizontal rail. Section header + horizontal
 * FlashList of dish cards with ADD-to-cart.
 */
const PopularDishRail = memo(function PopularDishRail({
  dishes,
  onSeeAll,
  onPress,
}: PopularDishRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: SpecialDish }) => (
      <PopularDishCard dish={item} onPress={onPress} />
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <FoodSectionHeader title="Popular Dishes" onSeeAll={onSeeAll} />
      <FlashList
        data={dishes}
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

export default PopularDishRail;

const styles = StyleSheet.create({
  wrap: {
    paddingTop: vs(8),
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: vs(4),
  },
});
