import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Star } from 'lucide-react-native';
import { hs, ms } from '@/utils/responsive';

interface StarRatingInputProps {
  /** Current rating 0..5 (0 = none selected). */
  value: number;
  onChange: (value: number) => void;
  /** Rendered star size (px, unscaled). */
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
  disabled?: boolean;
}

/** Interactive 1–5 star picker used by the Rate Vendor form. */
const StarRatingInput = memo(function StarRatingInput({
  value,
  onChange,
  size = 34,
  activeColor = '#F59E0B',
  inactiveColor = '#D1D5DB',
  disabled = false,
}: StarRatingInputProps) {
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel="Star rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            disabled={disabled}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
            accessibilityState={{ selected: filled }}
          >
            <Star
              size={ms(size)}
              color={filled ? activeColor : inactiveColor}
              fill={filled ? activeColor : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

export default StarRatingInput;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
});
