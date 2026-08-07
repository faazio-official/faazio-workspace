import React, { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ChevronDown } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { DiningRestaurant } from '../mocks/types';
import SectionHeader from './SectionHeader';
import RestaurantCard from './RestaurantCard';

export type DiningSort = 'nearest' | 'rating' | 'price';

const SORT_LABELS: Record<DiningSort, string> = {
  nearest: 'Nearest',
  rating: 'Top Rated',
  price: 'Price: Low to High',
};

const SORT_OPTIONS: DiningSort[] = ['nearest', 'rating', 'price'];

interface RestaurantGridProps {
  restaurants: DiningRestaurant[];
  searchQuery?: string;
  header?: ReactNode;
  onPress?: (restaurant: DiningRestaurant) => void;
}

/**
 * Primary content — exactly two vertical cards per row. Also owns the outer
 * scroll container: the pre-grid sections (Header, banners, carousels) render
 * as the list header so nothing nests vertical virtualized lists.
 */
const RestaurantGrid = memo(function RestaurantGrid({
  restaurants,
  searchQuery = '',
  header,
  onPress,
}: RestaurantGridProps) {
  const [sort, setSort] = useState<DiningSort>('nearest');
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = restaurants;
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === 'nearest') sorted.sort((a, b) => a.distance - b.distance);
    else if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => a.priceForTwo - b.priceForTwo);
    return sorted;
  }, [restaurants, searchQuery, sort]);

  const renderItem = useCallback(
    ({ item }: { item: DiningRestaurant }) => <RestaurantCard restaurant={item} onPress={onPress} />,
    [onPress],
  );

  const headerRow = useCallback(
    () => (
      <View style={styles.gridHeaderRow}>
        <SectionHeader title="Restaurants For Dining" />
        <TouchableOpacity
          style={styles.sortChip}
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${SORT_LABELS[sort]}`}
          accessibilityHint="Opens sorting options"
        >
          <AppText style={styles.sortChipLabel}>Sort by: {SORT_LABELS[sort]}</AppText>
          <ChevronDown size={ms(15)} color={foodTheme.primary} strokeWidth={2.6} />
        </TouchableOpacity>
      </View>
    ),
    [sort],
  );

  const listHeader = useMemo(
    () => (
      <View>
        {header}
        {headerRow()}
      </View>
    ),
    [header, headerRow],
  );

  return (
    <>
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      />
      <SortMenu
        visible={menuOpen}
        current={sort}
        onSelect={(next) => {
          setSort(next);
          setMenuOpen(false);
        }}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
});

const SortMenu = memo(function SortMenu({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: DiningSort;
  onSelect: (sort: DiningSort) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuOverlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sort menu">
        <Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
          <AppText style={styles.menuTitle}>Sort restaurants</AppText>
          {SORT_OPTIONS.map((option) => {
            const active = option === current;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={() => onSelect(option)}
                accessibilityRole="button"
                accessibilityLabel={SORT_LABELS[option]}
                accessibilityState={{ selected: active }}
              >
                <AppText style={[styles.menuItemText, active && styles.menuItemTextActive]}>
                  {SORT_LABELS[option]}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default RestaurantGrid;

const styles = StyleSheet.create({
  content: {
    paddingBottom: vs(104),
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    marginBottom: vs(4),
    marginTop: vs(4),
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    minHeight: vs(44),
    paddingHorizontal: hs(8),
    borderRadius: ms(10),
    marginLeft: hs(8),
  },
  sortChipLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    color: foodTheme.primary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'center',
    paddingHorizontal: hs(32),
  },
  menuCard: {
    backgroundColor: foodTheme.card,
    borderRadius: ms(20),
    paddingVertical: vs(8),
    paddingHorizontal: hs(8),
    ...foodTheme.shadowCard,
  },
  menuTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: foodTheme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: hs(14),
    paddingVertical: vs(10),
  },
  menuItem: {
    minHeight: vs(48),
    justifyContent: 'center',
    paddingHorizontal: hs(14),
    borderRadius: ms(12),
  },
  menuItemActive: {
    backgroundColor: foodTheme.primarySoft,
  },
  menuItemText: {
    fontSize: ms(16),
    fontWeight: '500',
    color: foodTheme.textPrimary,
  },
  menuItemTextActive: {
    color: foodTheme.primary,
    fontWeight: '600',
  },
});
