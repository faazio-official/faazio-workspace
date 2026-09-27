import React, { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Pressable, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { ChevronDown, Search, X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs, useBottomInset } from '@/utils/responsive';
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
  autoScrollToGrid?: boolean;
  header?: ReactNode;
  onPress?: (restaurant: DiningRestaurant) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/**
 * Primary content — exactly two vertical cards per row. Also owns the outer
 * scroll container: the pre-grid sections (Header, banners, carousels) render
 * as the list header so nothing nests vertical virtualized lists.
 */
const RestaurantGrid = memo(function RestaurantGrid({
  restaurants,
  searchQuery = '',
  autoScrollToGrid = false,
  header,
  onPress,
  onScroll,
}: RestaurantGridProps) {
  const bottomInset = useBottomInset();
  const [sort, setSort] = useState<DiningSort>('nearest');
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gridY, setGridY] = useState<number | null>(null);
  const listRef = useRef<FlashListRef<DiningRestaurant>>(null);

  const filtered = useMemo(() => {
    const q = (query || searchQuery).trim().toLowerCase();
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
  }, [restaurants, searchQuery, query, sort]);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    setGridY(e.nativeEvent.layout.y);
  }, []);

  useEffect(() => {
    if (autoScrollToGrid && gridY != null) {
      listRef.current?.scrollToOffset({ offset: Math.max(0, gridY - vs(8)), animated: false });
    }
  }, [autoScrollToGrid, gridY]);

  const renderItem = useCallback(
    ({ item }: { item: DiningRestaurant }) => <RestaurantCard restaurant={item} onPress={onPress} />,
    [onPress],
  );

  const headerRow = useCallback(
    () => (
      <View onLayout={onGridLayout}>
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
        <View style={styles.searchWrap}>
          <View style={styles.searchPill}>
            <Search size={ms(19)} color={foodTheme.textMuted} strokeWidth={2.2} />
            <AppTextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search restaurants for dining"
              placeholderTextColor={foodTheme.textMuted}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search restaurants for dining"
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <X size={ms(16)} color={foodTheme.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    ),
    [sort, query, onGridLayout],
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
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: vs(104) + bottomInset - vs(8) }}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
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
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    marginBottom: vs(4),
    marginTop: vs(16),
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
  searchWrap: {
    paddingHorizontal: hs(16),
    marginBottom: vs(8),
  },
  searchPill: {
    height: vs(42),
    borderRadius: ms(22),
    backgroundColor: foodTheme.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(14),
    gap: hs(8),
    ...foodTheme.shadowSoft,
  },
  searchInput: {
    flex: 1,
    fontSize: ms(13),
    fontWeight: '500',
    color: foodTheme.textPrimary,
    padding: 0,
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
