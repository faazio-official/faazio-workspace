import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_RED, BLOOD_BORDER, BLOOD_TEXT } from '../tokens';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioRowProps<T extends string> {
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Generic horizontal radio row — selected option gets a red ring + white dot. */
export function RadioRow<T extends string>({
  options,
  value,
  onChange,
}: RadioRowProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            style={styles.option}
          >
            <View style={[styles.ring, isSelected && styles.ringSelected]}>
              {isSelected && <View style={styles.dot} />}
            </View>
            <AppText style={[styles.label, isSelected && styles.labelSelected]}>
              {option.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: hs(24),
    rowGap: vs(12),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  ring: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 2,
    borderColor: BLOOD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: {
    borderColor: BLOOD_RED,
  },
  dot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: BLOOD_RED,
  },
  label: {
    fontSize: ms(14),
    color: BLOOD_TEXT,
    fontWeight: '600',
  },
  labelSelected: {
    color: BLOOD_RED,
    fontWeight: '800',
  },
});
