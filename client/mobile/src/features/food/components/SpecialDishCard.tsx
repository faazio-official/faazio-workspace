import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { SpecialDish } from '../mocks/types';
import RemoteImage from './RemoteImage';

export const SPECIAL_CARD_W = hs(116);

interface SpecialDishCardProps {
  dish: SpecialDish;
  onPress?: (dish: SpecialDish) => void;
}

/**
 * Compact special-dish card — a square dish image with the name / restaurant /
 * price stacked underneath (no image overlay). Sized to the content height.
 */
const SpecialDishCard = memo(function SpecialDishCard({ dish, onPress }: SpecialDishCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.94}
      onPress={() => onPress?.(dish)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${dish.dishName} from ${dish.restaurant}, ₹${dish.price}`}
    >
      <RemoteImage uri={dish.image} variant="dish" style={styles.image} />
      <View style={styles.content}>
        <AppText style={styles.dishName} numberOfLines={1}>
          {dish.dishName}
        </AppText>
        <AppText style={styles.restaurant} numberOfLines={1}>
          {dish.restaurant}
        </AppText>
        <AppText style={styles.price}>₹{dish.price.toLocaleString('en-IN')}</AppText>
      </View>
    </TouchableOpacity>
  );
});

export default SpecialDishCard;

const styles = StyleSheet.create({
  card: {
    width: SPECIAL_CARD_W,
    marginRight: hs(12),
    borderRadius: ms(12),
    backgroundColor: foodTheme.card,
    overflow: 'hidden',
    ...foodTheme.shadowCard,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  content: {
    paddingHorizontal: hs(10),
    paddingTop: vs(8),
    paddingBottom: vs(10),
  },
  dishName: {
    fontSize: ms(12.5),
    fontWeight: '700',
    color: foodTheme.textPrimary,
  },
  restaurant: {
    fontSize: ms(10.5),
    fontWeight: '400',
    color: foodTheme.textSecondary,
    marginTop: vs(2),
  },
  price: {
    fontSize: ms(12.5),
    fontWeight: '700',
    color: foodTheme.primary,
    marginTop: vs(5),
  },
});
