import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { SpecialDish } from '../mocks/types';
import RemoteImage from './RemoteImage';

export const SPECIAL_CARD_W = 175;
export const SPECIAL_CARD_H = 250;

interface SpecialDishCardProps {
  dish: SpecialDish;
  onPress?: (dish: SpecialDish) => void;
}

/**
 * Portrait special-dish card — close-up food fills the card, a dark gradient
 * rises from the bottom and the dish name / restaurant / price sit overlaid on
 * the image in white.
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
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.78)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <AppText style={styles.dishName} numberOfLines={2}>
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
    height: SPECIAL_CARD_H,
    marginRight: hs(12),
    borderRadius: ms(12),
    backgroundColor: foodTheme.card,
    overflow: 'hidden',
    ...foodTheme.shadowCard,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: hs(12),
    paddingBottom: vs(12),
    paddingTop: vs(40),
  },
  dishName: {
    fontSize: ms(15),
    fontWeight: '700',
    color: foodTheme.white,
    lineHeight: ms(19),
  },
  restaurant: {
    fontSize: ms(12),
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    marginTop: vs(2),
  },
  price: {
    fontSize: ms(15),
    fontWeight: '700',
    color: foodTheme.white,
    marginTop: vs(5),
  },
});
