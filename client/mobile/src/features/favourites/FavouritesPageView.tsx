import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { ChevronLeft, Heart, LayoutGrid, ShoppingBag, Utensils, Pill } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { useFavoriteStore } from '@/state/favoriteStore';
import { getCatalogEntriesByIds } from '@data/catalog/products';
import type { CatalogEntry } from '@data/catalog/products';
import { gateway } from '@/services/api/GatewayClient';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import SegmentedToggle from '@/features/search/SegmentedToggle';
import FilterChipsRail from '@/features/search/FilterChipsRail';
import type { SortOption, SearchToggleOption } from '@/features/search/types';
import SearchProductRowCard from '@/components/shared/SearchProductRowCard';
import type { Product } from '@data/types';

interface FavouritesPageViewProps {
  onBack: () => void;
  onProductPress: (product: CatalogEntry) => void;
}

const ACCENT = '#1162D3';

const SORT_OPTIONS: SortOption[] = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'price-low', label: 'Price: Low to High' },
  { id: 'price-high', label: 'Price: High to Low' },
  { id: 'rating', label: 'Rating' },
];

const TOGGLES: SearchToggleOption[] = [
  { key: 'ALL', label: 'All', icon: Heart },
  { key: 'MART', label: 'Mart', icon: LayoutGrid },
  { key: 'FOOD', label: 'Food', icon: Utensils },
  { key: 'PHARMA', label: 'Pharma', icon: Pill },
];

const APP_BRAND: Record<string, 'MART' | 'FOOD' | 'PHARMA'> = {
  MART: 'MART',
  FOOD: 'FOOD',
  PHARMA: 'PHARMA',
};

/**
 * Search-results-style Favourites page opened from My Account. Reuses the search
 * shell widgets (SegmentedToggle + FilterChipsRail) and the shared row card, so
 * it looks exactly like a search result list while reading live favourite ids
 * from `useFavoriteStore` resolved via the catalog index. Each card's heart
 * toggles the favourite off/on in place.
 */
const FavouritesPageView = memo(function FavouritesPageView({
  onBack,
  onProductPress,
}: FavouritesPageViewProps) {
  const insets = useSafeAreaInsets();
  const favorites = useFavoriteStore((s) => s.favorites);
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);

  const [activeKey, setActiveKey] = useState('ALL');
  const [activeSortId, setActiveSortId] = useState('relevance');

  // Progressive enhancement: resolve the shelf from the local catalog index immediately,
  // then upgrade to the server projection (`/products/batch`) when it arrives. The
  // GatewayClient falls back to the local index offline, so this never regresses.
  const [entries, setEntries] = useState<CatalogEntry[]>(() => getCatalogEntriesByIds(favorites));
  useEffect(() => {
    if (favorites.length === 0) {
      setEntries([]);
      return;
    }
    let active = true;
    gateway
      .getProductsByIds(favorites)
      .then((rows) => {
        if (active) setEntries(rows as CatalogEntry[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [favorites]);

  // Overlay approved festival discounts on the shelf (no-op offline / when none apply).
  const discounts = useActiveDiscounts(entries.map((e) => e.id));
  const pricedEntries = useMemo(
    () => applyActiveDiscounts(entries, discounts),
    [entries, discounts],
  );

  const visibleEntries = useMemo(() => {
    const filtered =
      activeKey === 'ALL' ? pricedEntries : pricedEntries.filter((e) => e.app === activeKey);
    const sorted = [...filtered];
    switch (activeSortId) {
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }
    return sorted;
  }, [pricedEntries, activeKey, activeSortId]);

  const totalCount = entries.length;

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
    // Remove immediately so the card disappears without waiting for the refetch.
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const renderItem = ({ item }: { item: CatalogEntry }) => (
    <SearchProductRowCard
      product={item as unknown as Product}
      appBrand={APP_BRAND[item.app]}
      showFavorite
      isFavorite={true}
      onFavorite={() => handleToggleFavorite(item.id)}
      onPress={() => onProductPress(item)}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header — search-header geometry with a static title pill instead of an input */}
      <View style={[styles.bar, { paddingTop: insets.top + vs(6) }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(24)} color="#111827" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.titlePill}>
          <Heart size={ms(16)} color={ACCENT} strokeWidth={2.2} fill={ACCENT} />
          <AppText style={styles.titleText}>
            Favourites ({totalCount})
          </AppText>
        </View>
      </View>

      <SegmentedToggle options={TOGGLES} activeKey={activeKey} onChange={setActiveKey} />

      <FilterChipsRail
        chips={[]}
        activeIds={[]}
        onToggleChip={() => {}}
        sortOptions={SORT_OPTIONS}
        activeSortId={activeSortId}
        onSelectSort={setActiveSortId}
        accentColor={ACCENT}
      />

      <FlatList
        data={visibleEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Heart size={ms(24)} color="#9CA3AF" strokeWidth={1.75} />
            </View>
            <AppText style={styles.emptyTitle}>No favourites yet</AppText>
            <AppText style={styles.emptyDesc}>
              Tap the heart icon on any product across Mart, Food, or Pharma to
              add it to your favourites.
            </AppText>
          </View>
        }
        bounces={false}
      />
    </View>
  );
});

export default FavouritesPageView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(12),
    paddingBottom: SPACE.BLOCK,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  backBtn: {
    width: ms(40),
    height: vs(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    height: vs(42),
    paddingHorizontal: hs(14),
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  titleText: {
    flex: 1,
    fontSize: ms(13),
    fontWeight: '700',
    color: '#111827',
  },
  listContent: {
    paddingTop: SPACE.BLOCK,
    paddingBottom: vs(120),
    flexGrow: 1,
  },
  emptyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingVertical: SPACE.LIST_BOTTOM,
    paddingHorizontal: hs(24),
    marginHorizontal: hs(16),
    marginTop: SPACE.BLOCK,
  },
  emptyIconCircle: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: '#F0F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  emptyTitle: {
    fontSize: ms(15),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  emptyDesc: {
    fontSize: ms(13),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: vs(6),
    lineHeight: ms(19),
  },
});
