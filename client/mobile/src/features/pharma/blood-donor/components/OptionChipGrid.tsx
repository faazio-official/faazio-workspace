import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_RED, BLOOD_RED_SOFT, BLOOD_TEXT, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

interface OptionChipGridProps<T extends string> {
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  /** Number of columns (defaults to 4). */
  columns?: number;
}

export function OptionChipGrid<T extends string>({
  options,
  selected,
  onSelect,
  columns = 4,
}: OptionChipGridProps<T>) {
  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.chip,
              { width: `${100 / columns}%` },
              isSelected && styles.chipSelected,
            ]}
          >
            <AppText
              style={[styles.chipText, isSelected && styles.chipTextSelected]}
            >
              {option}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(10),
  },
  chip: {
    height: ms(46),
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1.5,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: BLOOD_RED,
    backgroundColor: BLOOD_RED_SOFT,
  },
  chipText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: BLOOD_TEXT,
  },
  chipTextSelected: {
    color: BLOOD_RED,
    fontWeight: '900',
  },
});
