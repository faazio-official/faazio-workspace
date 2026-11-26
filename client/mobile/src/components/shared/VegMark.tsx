import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { categorical } from '@/theme/categorical';
import { ms } from '@/utils/responsive';

/**
 * FSSAI-style veg / non-veg mark: a square outline with a filled dot for vegetarian, and a brown
 * triangle-in-a-square for non-vegetarian. Screen-reader text is explicit; this is never the only
 * signal for a dietary claim.
 */
export default function VegMark({ isVeg, showLabel = false }: { isVeg: boolean; showLabel?: boolean }) {
  const color = isVeg ? categorical.green : categorical.brown;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
    >
      <View style={[styles.box, { borderColor: color }]}>
        {isVeg ? (
          <View style={[styles.dot, { backgroundColor: color }]} />
        ) : (
          <View style={[styles.triangle, { borderBottomColor: color }]} />
        )}
      </View>
      {showLabel ? (
        <AppText style={[styles.label, { color }]}>{isVeg ? 'VEG' : 'NON-VEG'}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  box: {
    width: ms(12),
    height: ms(12),
    borderWidth: 1.5,
    borderRadius: ms(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: ms(6), height: ms(6), borderRadius: ms(3) },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: ms(4),
    borderRightWidth: ms(4),
    borderBottomWidth: ms(7),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  label: { fontSize: ms(11), fontWeight: '600' },
});
