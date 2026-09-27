import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { SpecialDish } from '../mocks/types';
import SpecialDishCard from './SpecialDishCard';

interface FeaturedDishCarouselProps {
  dishes: SpecialDish[];
  onPress?: (dish: SpecialDish) => void;
}

/**
 * "Today's Special Near You" — horizontal rail of compact square-image cards.
 */
const FeaturedDishCarousel = memo(function FeaturedDishCarousel({
  dishes,
  onPress,
}: FeaturedDishCarouselProps) {
  const renderItem = useCallback(
    ({ item }: { item: SpecialDish }) => <SpecialDishCard dish={item} onPress={onPress} />,
    [onPress],
  );

  return (
    <FlashList
      data={dishes}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      bounces={false}
    />
  );
});

export default FeaturedDishCarousel;

const styles = StyleSheet.create({
  content: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(8),
  },
});
