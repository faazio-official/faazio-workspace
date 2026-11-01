import React, { memo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { brandRamp } from '@/theme/brandTokens';
import type { SortOption } from './types';

interface SortDropdownProps {
  options: SortOption[];
  activeId: string;
  onSelect: (id: string) => void;
  accentColor?: string;
}

/**
 * Standalone sort pill + popover, extracted from FilterChipsRail. Used by the
 * facet-mode FilterSortBar next to the Filter button. Selecting an option
 * expands a dropdown panel with the saved choice check-marked.
 */
const SortDropdown = memo(function SortDropdown({
  options,
  activeId,
  onSelect,
  accentColor = brandRamp.FOOD.deep,
}: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.id === activeId);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={styles.pill}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Sort by"
        accessibilityState={{ expanded: open }}
      >
        <AppText style={styles.label} numberOfLines={1}>
          {active ? active.label : 'Sort'}
        </AppText>
        <ChevronDown size={ms(14)} color="#374151" strokeWidth={2.2} />
      </TouchableOpacity>

      {open ? (
        <View style={styles.panel}>
          {options.map((option) => {
            const isSelected = option.id === activeId;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => {
                  onSelect(option.id);
                  setOpen(false);
                }}
                style={styles.option}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <AppText style={[styles.optionLabel, isSelected && { color: accentColor, fontWeight: '800' }]}>
                  {option.label}
                </AppText>
                {isSelected ? (
                  <Check size={ms(15)} color={accentColor} strokeWidth={2.6} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

export default SortDropdown;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingHorizontal: hs(13),
    paddingVertical: vs(8),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    maxWidth: hs(168),
  },
  label: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#374151',
    flexShrink: 1,
  },
  panel: {
    position: 'absolute',
    top: vs(44),
    right: 0,
    minWidth: hs(220),
    backgroundColor: '#FFFFFF',
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
    overflow: 'hidden',
    zIndex: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  optionLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#111827',
  },
});
