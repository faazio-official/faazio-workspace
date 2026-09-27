import React, { memo } from 'react';
import { hs } from '@/utils/responsive';
import FoodProductCard from '../cards/FoodProductCard';
import { dishToProduct } from '@data/food/specials';
import type { SpecialDish } from '../mocks/types';

export const SPECIAL_CARD_W = hs(116);

interface SpecialDishCardProps {
  dish: SpecialDish;
  onPress?: (dish: SpecialDish) => void;
}

/**
 * Adapter that renders a "Today's Special" dish with the exact card the Home
 * "Today's Special" rail uses (ProductCardBase via FoodProductCard): hs(116)
 * wide, 1:1 rounded image, name-only body — so Home and Food can't drift.
 */
const SpecialDishCard = memo(function SpecialDishCard({ dish, onPress }: SpecialDishCardProps) {
  return (
    <FoodProductCard
      product={dishToProduct(dish)}
      variant="rail"
      width={SPECIAL_CARD_W}
      imageAspect={1}
      roundedImageBottom
      showRating={false}
      showPrice={false}
      showAddButton={false}
      showBadge={false}
      showHeart={false}
      onPress={() => onPress?.(dish)}
    />
  );
});

export default SpecialDishCard;
