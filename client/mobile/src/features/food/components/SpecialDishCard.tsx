import React, { memo } from 'react';
import { PRODUCT_CARD_WIDTH } from '@/theme/cards';
import FoodProductCard from '../cards/FoodProductCard';
import { dishToProduct } from '@data/food/specials';
import type { SpecialDish } from '../types';

export const SPECIAL_CARD_W = PRODUCT_CARD_WIDTH;

interface SpecialDishCardProps {
  dish: SpecialDish;
  onPress?: (dish: SpecialDish) => void;
}

/**
 * Adapter that renders a "Today's Special" dish with the exact card sizing the
 * 3-up grid and the Home "Today's Special" rail use (ProductCardBase via
 * FoodProductCard): PRODUCT_CARD_WIDTH wide, 1:1 rounded image, name-only body —
 * so Home and Food can't drift.
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
