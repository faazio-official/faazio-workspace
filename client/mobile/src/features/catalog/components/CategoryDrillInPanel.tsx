import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import CampaignHero from '@/components/shared/CampaignHero';
import type { Product } from '@data/types';
import { openHeroTarget } from '@/services/adsTarget';
import { useCategoryVendors } from '@/features/catalog/hooks/useCategoryVendors';
import { useCategoryTree } from '@/features/catalog/hooks/useCategoryTree';
import type { VendorApp } from '@/services/categoryVendors';
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
 * store-grouped body: the paid CATEGORY_TOP hero carousel (ad-server fill; collapses
 * when unfilled) under the rail, then one section per matching store — a heading followed
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

  // Server-backed taxonomy for this sub-app (superadmin-owned; no fixture fallback).
  const { categories, loading: treeLoading } = useCategoryTree(app);

  // Parent id → children map, built from the flat `GET /categories?app=` list.
  const byParent = useMemo(() => {
    const map = new Map<string | null, typeof categories>();
    for (const c of categories) {
      const key = c.parentId ?? null;
      const bucket = map.get(key);
      if (bucket) bucket.push(c);
      else map.set(key, [c]);
    }
    return map;
  }, [categories]);

  const topLevel = useMemo(() => byParent.get(null) ?? [], [byParent]);
  const activeTab = categories.find((c) => c.id === tabId) ?? topLevel[0];

  /** Flat list of every leaf sub-category in the tab (parent/child tree → leaves). */
  const items = useMemo(() => {
    if (!activeTab) return [] as { id: string; name: string; searchQuery: string }[];
    const out: { id: string; name: string; searchQuery: string }[] = [];
    const walk = (id: string) => {
      const kids = byParent.get(id) ?? [];
      if (kids.length === 0) {
        const node = categories.find((c) => c.id === id);
        if (node) out.push({ id: node.id, name: node.name, searchQuery: node.searchQuery || node.name });
        return;
      }
      for (const k of kids) walk(k.id);
    };
    walk(activeTab.id);
    return out;
  }, [activeTab, byParent, categories]);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const activeItem = items.find((i) => i.id === activeItemId) ?? items[0];

  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectItem = useCallback((id: string) => {
    setActiveItemId(id);
    setSearchQuery('');
    bodyRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  /** Public `AppBrand` for the paid CATEGORY_TOP hero (drill-in app is Mart/Pharma). */
  const heroApp: 'MART' | 'PHARMA' = app === 'FA_MART' ? 'MART' : 'PHARMA';

  // Store-grouped body for the selected title: server products (FTS), grouped by store and joined
  // to the directory, with approved festival discounts overlaid — the local pool is the offline
  // fallback. Then filtered by the inline vendor search.
  const { vendors: categoryVendors, loading } = useCategoryVendors(
    app,
    activeItem?.searchQuery ?? '',
  );

  const vendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryVendors;
    return categoryVendors.filter(({ store }) => {
      const haystack = `${store.name} ${store.address ?? ''} ${store.distance}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [categoryVendors, searchQuery]);

  const handleHeroPress = useCallback(
    (ad: Parameters<typeof openHeroTarget>[0]) => {
      void openHeroTarget(ad, {
        onProduct: (product) => onProductPress(product as Product),
        onStore: (store) => onVendorPress(store.id, activeItem?.searchQuery ?? ''),
      });
    },
    [activeItem, onVendorPress, onProductPress],
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
          {treeLoading ? (
            <ActivityIndicator color={accent} />
          ) : (
            <AppText style={styles.emptyText}>Category not found</AppText>
          )}
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
        <CampaignHero
          placement="CATEGORY_TOP"
          app={heroApp}
          category={tabId}
          onPress={handleHeroPress}
          style={styles.topAd}
        />

        {loading && vendors.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={accent} />
          </View>
        ) : vendors.length === 0 ? (
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
