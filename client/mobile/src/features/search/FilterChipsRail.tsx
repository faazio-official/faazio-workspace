import React, { memo, useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, Zap, Leaf, Star, Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { SearchFilterChip, SortOption } from './types';

interface FilterChipsRailProps {
  chips: SearchFilterChip[];
  activeIds: string[];
  onToggleChip: (id: string) => void;
  sortOptions: SortOption[];
  activeSortId: string;
  onSelectSort: (id: string) => void;
  accentColor?: string;
}

/**
 * Horizontally scrollable filter rail. The leading "Sort by" pill is a dropdown
 * (down arrow + vertical divider); the remaining chips are toggle filters with
 * a leading icon. Selecting a sort option expands the rail downward with an
 * option list.
 */
const FilterChipsRail = memo(function FilterChipsRail({
  chips,
  activeIds,
  onToggleChip,
  sortOptions,
  activeSortId,
  onSelectSort,
  accentColor = '#FF4500',
}: FilterChipsRailProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const activeSort = sortOptions.find((o) => o.id === activeSortId);

  const toggleSort = () => setSortOpen((open) => !open);

  const chooseSort = (id: string) => {
    onSelectSort(id);
    setSortOpen(false);
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Leading sort pill */}
        <TouchableOpacity
          onPress={toggleSort}
          style={styles.sortPill}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Sort by"
          accessibilityState={{ expanded: sortOpen }}
        >
          <AppText style={styles.sortLabel}>{activeSort ? activeSort.label : 'Sort by'}</AppText>
          <View style={styles.divider} />
          <ChevronDown size={ms(14)} color="#374151" strokeWidth={2.2} />
        </TouchableOpacity>

        {chips.map((chip) => {
          const isActive = activeIds.includes(chip.id);
          const Icon = chip.icon;
          return (
            <TouchableOpacity
              key={chip.id}
              onPress={() => onToggleChip(chip.id)}
              style={[styles.chip, isActive && styles.chipActive]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={chip.label}
              accessibilityState={{ selected: isActive }}
            >
              {Icon ? <Icon size={ms(13)} color={isActive ? '#FFFFFF' : '#374151'} strokeWidth={2.4} /> : null}
              <AppText style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{chip.label}</AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {sortOpen ? (
        <View style={styles.sortPanel}>
          {sortOptions.map((option) => {
            const isSelected = option.id === activeSortId;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => chooseSort(option.id)}
                style={styles.sortOption}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <AppText style={[styles.sortOptionLabel, isSelected && { color: accentColor, fontWeight: '800' }]}>
                  {option.label}
                </AppText>
                {isSelected ? <Check size={ms(15)} color={accentColor} strokeWidth={2.6} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

export default FilterChipsRail;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(6),
    gap: hs(8),
    alignItems: 'center',
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingLeft: hs(14),
    paddingRight: hs(8),
    paddingVertical: vs(7),
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  sortLabel: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#374151',
  },
  divider: {
    width: 1,
    height: vs(14),
    backgroundColor: '#E0E0E0',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    paddingHorizontal: hs(13),
    paddingVertical: vs(7),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  chipActive: {
    backgroundColor: '#FF4500',
    borderColor: '#FF4500',
  },
  chipLabel: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#374151',
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  sortPanel: {
    marginHorizontal: hs(16),
    marginTop: vs(4),
    borderRadius: ms(14),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  sortOptionLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#111827',
  },
});
