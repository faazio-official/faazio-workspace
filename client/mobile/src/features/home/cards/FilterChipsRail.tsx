import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';

export interface FilterChipItem {
  id: string;
  label: string;
  accent: string;
}

interface FilterChipsRailProps {
  chips: FilterChipItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function FilterChipsRail({ chips, activeId, onSelect }: FilterChipsRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {chips.map((chip) => {
        const active = chip.id === activeId;
        return (
          <TouchableOpacity
            key={chip.id}
            activeOpacity={0.8}
            style={[styles.chip, active && { backgroundColor: chip.accent }]}
            onPress={() => onSelect(chip.id)}
          >
            <AppText style={[styles.chipText, active && { color: '#ffffff' }]}>
              {chip.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: {
    paddingHorizontal: hs(16),
    gap: hs(8),
    paddingBottom: vs(12),
  },
  chip: {
    paddingHorizontal: hs(14),
    height: vs(32),
    borderRadius: ms(16),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#334155',
  },
});
