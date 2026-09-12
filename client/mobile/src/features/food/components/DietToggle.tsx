import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { useFoodFilterStore, type DietFilter } from '@/state/foodFilterStore';

const SEGMENTS: { value: DietFilter; label: string; activeBg: string }[] = [
  { value: 'all', label: 'All', activeBg: '#111827' },
  { value: 'veg', label: 'Veg', activeBg: '#16A34A' },
  { value: 'nonveg', label: 'Non-Veg', activeBg: '#DC2626' },
];

/**
 * Zomato-style 3-segment All / Veg / Non-Veg pill. Reads + writes the shared
 * `foodFilterStore`, so flipping it on any screen updates every Food screen at
 * once. Rendered in the empty top-right slot of the food headers.
 */
const DietToggle = memo(function DietToggle() {
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);
  const setDietFilter = useFoodFilterStore((s) => s.setDietFilter);

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {SEGMENTS.map((seg) => {
        const active = dietFilter === seg.value;
        return (
          <TouchableOpacity
            key={seg.value}
            style={[styles.segment, active && { backgroundColor: seg.activeBg }]}
            onPress={() => setDietFilter(seg.value)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel={seg.label}
            accessibilityState={{ selected: active }}
          >
            <AppText style={[styles.label, active && styles.labelActive]}>
              {seg.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

export default DietToggle;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ECECEC',
    borderRadius: ms(20),
    padding: vs(2),
  },
  segment: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(5),
    borderRadius: ms(18),
  },
  label: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#6B7280',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
