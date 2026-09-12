import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { useFoodFilterStore } from '@/state/foodFilterStore';

/**
 * Small empty-rail note shown when an active diet filter empties a rail.
 * Reads the store so its copy reflects the current filter.
 */
const DietEmptyNote = memo(function DietEmptyNote() {
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);
  const label = dietFilter === 'veg' ? 'Veg' : 'Non-Veg';
  return (
    <View style={styles.wrap}>
      <AppText style={styles.text}>
        No {label} options here. Switch the filter to see more.
      </AppText>
    </View>
  );
});

export default DietEmptyNote;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(16),
    alignItems: 'center',
  },
  text: {
    fontSize: ms(12),
    fontWeight: '500',
    color: foodTheme.textMuted,
    textAlign: 'center',
  },
});
