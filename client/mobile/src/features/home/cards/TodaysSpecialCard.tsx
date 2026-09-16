import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import type { SpecialDish } from '@data/types';
import AppText from '@/components/AppText';
import RemoteImage from '@/features/food/components/RemoteImage';

interface TodaysSpecialCardProps {
  dish: SpecialDish;
  width: number;
  onPress?: (dish: SpecialDish) => void;
}

/**
 * Square (1:1) "Today's Special" card for the Home stacked rail. Image on top,
 * a 2-line ellipsized title below. Home-local so it doesn't disturb the Food
 * sub-app's shared portrait `SpecialDishCard`.
 */
const TodaysSpecialCard = memo(function TodaysSpecialCard({ dish, width, onPress }: TodaysSpecialCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.94}
      onPress={() => onPress?.(dish)}
      style={[styles.card, { width }]}
      accessibilityRole="button"
      accessibilityLabel={`${dish.dishName} from ${dish.restaurant}, ₹${dish.price}`}
    >
      <RemoteImage uri={dish.image} variant="dish" style={styles.image} />
      <View style={styles.titleWrap}>
        <AppText style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {dish.dishName}
        </AppText>
      </View>
    </TouchableOpacity>
  );
});

export default TodaysSpecialCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: ms(14),
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8fafc',
  },
  titleWrap: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(10),
  },
  title: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: ms(17),
  },
});
