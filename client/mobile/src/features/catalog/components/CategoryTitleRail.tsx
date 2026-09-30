import React, { memo } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';

export interface CategoryTitleRailOption {
  id: string;
  title: string;
}

interface CategoryTitleRailProps {
  options: CategoryTitleRailOption[];
  activeId: string;
  accent: string;
  onSelect: (id: string) => void;
}

/**
 * Pill-chip category-title rail for the category drill-in page. Inactive chips
 * are transparent with dark text; the active one is filled with the accent
 * colour and white text (brand blue on this surface). Fed a flat list of every
 * sub-category title (no grouping), so the rail can run long.
 */
const CategoryTitleRail = memo(function CategoryTitleRail({
  options,
  activeId,
  accent,
  onSelect,
}: CategoryTitleRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {options.map((opt) => {
        const active = opt.id === activeId;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            activeOpacity={0.7}
            style={[styles.chip, active && { backgroundColor: accent }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.title}
          >
            <AppText style={[styles.label, active && styles.labelActive]}>
              {opt.title}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

export default CategoryTitleRail;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    gap: hs(8),
  },
  chip: {
    paddingHorizontal: hs(14),
    height: vs(32),
    borderRadius: ms(16),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#111827',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
