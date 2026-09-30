import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import AdBannerCarousel from '@/components/shared/AdBannerCarousel';
import { MASTER_CATEGORIES } from '@data/categories/masterCategories';
import type { CategoryTab } from '@data/categories/masterCategories';
import type { Product, AdSlide } from '@data/types';
import {
  getVendorsWithProducts,
  getAdsForQuery,
  type VendorApp,
  type VendorAdSlide,
} from '@/services/categoryVendors';
import CategoryTitleRail from './CategoryTitleRail';
import StoreProductSection from './StoreProductSection';

/** Faazio brand blue — the category drill-in page is a brand surface. */
const FAAZIO_BLUE = '#1162D3';

interface CategoryDrillInPanelProps {
  tabId: string;
  title: string;
  app: VendorApp;
  onBack: () => void;
  onVendorPress: (storeId: string, initialQuery: string) => void;
  onProductPress: (product: Product) => void;
}

/**
 * Category drill-in page panel. Resolves the tapped main category (`tabId`) from
 * `MASTER_CATEGORIES[app]` and shows every sub-category title as one flat,
 * scrollable pill rail (first auto-selected). For the selected title it renders a
 * store-grouped body: a single 16:9 carousel of the title's top store ads under
 * the rail, then one section per matching store — a store-name heading followed
 * by a continuous vertical list of one-per-row product cards. An inline searchbar
 * (this page only) filters the store list by name/locality.
 */
export function CategoryDrillInPanel({
  tabId,
  title,
  app,
  onBack,
  onVendorPress,
  onProductPress,
}: CategoryDrillInPanelProps) {
  const insets = useSafeAreaInsets();
  const accent = FAAZIO_BLUE;
  const bodyRef = useRef<ScrollView>(null);

  const tab: CategoryTab | undefined = useMemo(
    () => (MASTER_CATEGORIES[app] ?? []).find((t) => t.id === tabId),
    [tabId, app],
  );
  const activeTab = tab ?? (MASTER_CATEGORIES[app] ?? [])[0];

  /** Flat list of every sub-category title in the tab (no grouping). */
  const items = useMemo(
    () => activeTab?.subgroups.flatMap((s) => s.items) ?? [],
    [activeTab],
  );

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const activeItem = items.find((i) => i.id === activeItemId) ?? items[0];

  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectItem = useCallback((id: string) => {
    setActiveItemId(id);
    setSearchQuery('');
    bodyRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  /** Top of the body: ads for the selected title's top-ranked stores. */
  const topAds = useMemo(
    () => (activeItem ? getAdsForQuery(app, activeItem.searchQuery) : []),
    [app, activeItem],
  );

  /** Store-grouped body for the selected title, filtered by the inline search. */
  const vendors = useMemo(() => {
    if (!activeItem) return [];
    let list = getVendorsWithProducts(app, activeItem.searchQuery);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(({ store }) => {
        const haystack = `${store.name} ${store.address ?? ''} ${store.distance}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [app, activeItem, searchQuery]);

  const handleTopAdPress = useCallback(
    (slide: AdSlide) => {
      const storeId = (slide as VendorAdSlide).storeId;
      if (storeId && activeItem) onVendorPress(storeId, activeItem.searchQuery);
    },
    [activeItem, onVendorPress],
  );

  if (!activeTab) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + vs(12) }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={ms(22)} color="#1E2022" strokeWidth={2.5} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle} numberOfLines={1}>{title}</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyWrap}>
          <AppText style={styles.emptyText}>Category not found</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header: back + title + inline searchbar. */}
      <View style={[styles.header, { paddingTop: insets.top + vs(12) }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={ms(22)} color="#1E2022" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <AppText style={styles.headerTitle} numberOfLines={1}>{title}</AppText>
          <View style={styles.searchWrap}>
            <Search size={ms(15)} color="#94a3b8" strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search vendors..."
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              clearButtonMode="never"
              accessibilityLabel="Search vendors"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={ms(15)} color="#94a3b8" strokeWidth={2.4} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Flat pill rail — every sub-category title, no grouping. */}
      <View style={styles.railWrap}>
        <CategoryTitleRail
          options={items.map((i) => ({ id: i.id, title: i.name }))}
          activeId={activeItem?.id ?? ''}
          accent={accent}
          onSelect={handleSelectItem}
        />
      </View>

      {/* Store-grouped body: title ad, then a per-store heading → product list. */}
      <ScrollView
        ref={bodyRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {topAds.length > 0 && activeItem && (
          <AdBannerCarousel
            slides={topAds}
            showAdLabel
            onSlidePress={handleTopAdPress}
            style={styles.topAd}
          />
        )}

        {vendors.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyText}>No vendors yet</AppText>
          </View>
        ) : (
          vendors.map(({ store, products }) => (
            <StoreProductSection
              key={store.id}
              app={app}
              store={store}
              products={products}
              onStorePress={() => onVendorPress(store.id, activeItem?.searchQuery ?? '')}
              onProductPress={onProductPress}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default CategoryDrillInPanel;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
  },
  backBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
  },
  headerMid: {
    flex: 1,
    gap: vs(6),
  },
  headerTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#1E2022',
  },
  headerSpacer: {
    width: ms(36),
  },
  searchWrap: {
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(12),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(12),
    color: '#1E2022',
    paddingVertical: 0,
  },
  railWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    paddingVertical: vs(2),
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  topAd: {
    marginHorizontal: hs(16),
    marginTop: SPACE.SECTION,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: vs(60),
    paddingHorizontal: hs(24),
  },
  emptyText: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
