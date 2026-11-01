import React, { memo, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { brandRamp } from '@/theme/brandTokens';
import SortDropdown from './SortDropdown';
import FilterOverlaySheet from './FilterOverlaySheet';
import type { ActiveFacets, FacetGroup, SortOption } from './types';

interface FilterSortBarProps {
  groups: FacetGroup[];
  activeFacets: ActiveFacets;
  onApply: (facets: ActiveFacets) => void;
  sortOptions: SortOption[];
  activeSortId: string;
  onSelectSort: (id: string) => void;
  accentColor?: string;
}

const countActive = (facets: ActiveFacets) =>
  Object.values(facets).reduce((acc, vals) => acc + vals.length, 0);

/**
 * Facet-mode filter + sort bar. A Filter pill (badge = active selection count)
 * opens the facet overlay; a SortDropdown sits beside it. Staged changes are
 * held inside the overlay and only committed via Apply.
 */
const FilterSortBar = memo(function FilterSortBar({
  groups,
  activeFacets,
  onApply,
  sortOptions,
  activeSortId,
  onSelectSort,
  accentColor = brandRamp.FOOD.deep,
}: FilterSortBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [staged, setStaged] = useState<ActiveFacets>(activeFacets);

  // Re-seed staged from the committed active selections each time the sheet opens.
  useEffect(() => {
    if (sheetOpen) setStaged(activeFacets);
  }, [sheetOpen, activeFacets]);

  const activeCount = countActive(activeFacets);
  const stagedCount = countActive(staged);

  const toggleOption = (facetKey: string, value: string) => {
    setStaged((prev) => {
      const current = prev[facetKey] ?? [];
      return {
        ...prev,
        [facetKey]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const clearAll = () => setStaged({});

  const apply = () => {
    onApply(staged);
    setSheetOpen(false);
  };

  const close = () => {
    setStaged(activeFacets);
    setSheetOpen(false);
  };

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        onPress={() => setSheetOpen(true)}
        style={styles.filterBtn}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Filters"
      >
        <SlidersHorizontal size={ms(14)} color="#374151" strokeWidth={2.4} />
        <AppText style={styles.filterLabel}>Filter</AppText>
        {activeCount > 0 ? (
          <View style={[styles.filterBadge, { backgroundColor: accentColor }]}>
            <AppText style={styles.filterBadgeText}>{activeCount}</AppText>
          </View>
        ) : null}
      </TouchableOpacity>

      <SortDropdown
        options={sortOptions}
        activeId={activeSortId}
        onSelect={onSelectSort}
        accentColor={accentColor}
      />

      <FilterOverlaySheet
        visible={sheetOpen}
        groups={groups}
        staged={staged}
        stagedCount={stagedCount}
        onSelectGroup={() => {}}
        onToggleOption={toggleOption}
        onClearAll={clearAll}
        onApply={apply}
        onClose={close}
        accentColor={accentColor}
      />
    </View>
  );
});

export default FilterSortBar;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(6),
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingHorizontal: hs(13),
    paddingVertical: vs(8),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  filterLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#374151',
  },
  filterBadge: {
    minWidth: ms(17),
    height: ms(17),
    borderRadius: ms(9),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: ms(9),
    fontWeight: '900',
  },
});
