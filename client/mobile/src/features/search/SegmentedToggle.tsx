import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { SearchToggleOption } from './types';

interface SegmentedToggleProps {
  options: SearchToggleOption[];
  activeKey: string;
  onChange: (key: string) => void;
}

/**
 * Two-pill segmented control. Active pill = dark slate background with white
 * text and a leading icon; inactive pill = white background, thin grey border,
 * dark text. Icon leads the label on both pills.
 */
const SegmentedToggle = memo(function SegmentedToggle({ options, activeKey, onChange }: SegmentedToggleProps) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isActive = option.key === activeKey;
        const Icon = option.icon;
        const tint = isActive ? '#FFFFFF' : '#111827';
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isActive }}
          >
            <Icon size={ms(14)} color={tint} strokeWidth={2.4} />
            <AppText style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
              {option.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

export default SegmentedToggle;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: hs(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(6),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: '#1E2022',
  },
  pillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  label: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: '#111827',
  },
});
