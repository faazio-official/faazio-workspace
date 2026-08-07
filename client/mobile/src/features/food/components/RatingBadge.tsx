import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface RatingBadgeProps {
  rating: number;
  size?: 'sm' | 'md';
}

const RatingBadge = memo(function RatingBadge({ rating, size = 'md' }: RatingBadgeProps) {
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, isSmall && styles.badgeSm]}>
      <Star
        size={isSmall ? ms(9) : ms(11)}
        color={foodTheme.white}
        fill={foodTheme.white}
        strokeWidth={2.5}
      />
      <AppText style={[styles.text, isSmall && styles.textSm]}>{rating.toFixed(1)}</AppText>
    </View>
  );
});

export default RatingBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: foodTheme.ratingGreen,
    borderRadius: ms(6),
    paddingHorizontal: hs(7),
    paddingVertical: vs(2),
    gap: hs(3),
  },
  badgeSm: {
    borderRadius: ms(5),
    paddingHorizontal: hs(6),
    paddingVertical: vs(1),
  },
  text: {
    color: foodTheme.white,
    fontSize: ms(13),
    fontWeight: '800',
  },
  textSm: {
    fontSize: ms(11),
    fontWeight: '700',
  },
});
