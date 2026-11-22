import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import CampaignHero from '@/components/shared/CampaignHero';
import AppRefreshControl from '@/components/shared/AppRefreshControl';
import { ReportIssueButton } from '@/components/shared/ReportIssueButton';
import type { CategoryApp, Product } from '@data/types';
import { localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';
import { openHeroTarget } from '@/services/adsTarget';

import { useCategoryTree } from '@/features/catalog/hooks/useCategoryTree';
import type { VendorApp } from '@/services/categoryVendors';
import SubCategorySection from './SubCategorySection';
import { neutral, parentRamp } from '@/theme/brandTokens';

/** Faazio brand blue — the category drill-in page is a brand surface. */
const FAAZIO_BLUE = parentRamp.base;

interface CategoryDrillInPanelProps {
  tabId: string;
  title: string;
  app: VendorApp;
  /** Taxonomy pool to walk. Defaults to `app`'s own pool; a MAIN_APP_HEADER chip passes its own. */
  treeApp?: CategoryApp;
  onBack: () => void;
  onVendorPress: (storeId: string, initialQuery: string) => void;
  onProductPress: (product: Product) => void;
}

/**
 * Category drill-in page panel. Resolves the tapped main category (`tabId`) from the
 * server taxonomy (`GET /categories`, via `useCategoryTree`) and shows every
 * sub-category title as one flat, scrollable pill rail (first auto-selected). For the
 * selected title it renders a store-grouped body: the paid CATEGORY_TOP hero carousel
 * (ad-server fill; collapses when unfilled) under the rail, then one section per matching
 * store — a heading followed by a continuous vertical list of one-per-row product cards.
 * An inline searchbar (this page only) filters the store list by name/locality.
 */
export function CategoryDrillInPanel({
  tabId,
  title,
  app,
  treeApp,
  onBack,
  onVendorPress,
  onProductPress,
}: CategoryDrillInPanelProps) {
  const insets = useSafeAreaInsets();
  const accent = FAAZIO_BLUE;
  const language = useLanguageStore((s) => s.language);
  const scrollViewRef = useRef<ScrollView>(null);

  // Server-backed taxonomy for this pool (superadmin-owned; no fixture fallback).
  const {
    categories,
    loading: treeLoading,
    refreshing: treeRefreshing,
    refresh: refreshTree,
  } = useCategoryTree(app, treeApp);

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
        if (node) {
          out.push({
            id: node.id,
            // `searchQuery` stays the English taxonomy identity — only the label is translated.
            name: localizedName(node, language),
            searchQuery: node.searchQuery || node.name,
          });
        }
        return;
      }
      for (const k of kids) walk(k.id);
    };
    walk(activeTab.id);
    // A childless category is its own single title (e.g. a header-only category with no
    // sub-categories yet) rather than an empty rail over an unscoped body.
    if (out.length === 0) {
      out.push({
        id: activeTab.id,
        name: localizedName(activeTab, language),
        searchQuery: activeTab.searchQuery || activeTab.name,
      });
    }
    return out;
  }, [activeTab, byParent, categories, language]);

  const [searchQuery, setSearchQuery] = useState('');

  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});
  const handleSectionLayout = useCallback((id: string, y: number) => {
    setSectionOffsets((prev) => ({ ...prev, [id]: y }));
  }, []);

  const [menuVisible, setMenuVisible] = useState(false);

  /** Public `AppBrand` for the paid CATEGORY_TOP hero (drill-in app is Mart/Pharma). */
  const heroApp: 'MART' | 'PHARMA' = app === 'FA_MART' ? 'MART' : 'PHARMA';


  const handleHeroPress = useCallback(
    (ad: Parameters<typeof openHeroTarget>[0]) => {
      void openHeroTarget(ad, {
        onProduct: (product) => onProductPress(product as Product),
        onStore: (store) => onVendorPress(store.id, ''),
      });
    },
    [onVendorPress, onProductPress],
  );

  if (!activeTab) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + vs(12) }]}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
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
        <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
          <ChevronLeft size={ms(22)} color="#1E2022" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <AppText style={styles.headerTitle} numberOfLines={1}>{title}</AppText>
          <View style={styles.searchWrap}>
            <Search size={ms(15)} color="#94a3b8" strokeWidth={2.2} />
            <AppTextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search vendors"
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              clearButtonMode="never"
              accessibilityLabel="Search vendors"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={ms(15)} color="#94a3b8" strokeWidth={2.4} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

  {/* Stacked sub-category sections */}
  <ScrollView
    ref={scrollViewRef}
    style={styles.body}
    contentContainerStyle={styles.bodyContent}
    showsVerticalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    refreshControl={
      <AppRefreshControl
        refreshing={treeRefreshing}
        onRefresh={handleRefresh}
      />
    }
    >
    <CampaignHero
      placement="CATEGORY_TOP"
      app={heroApp}
      category={tabId}
      onPress={handleHeroPress}
      style={styles.topAd}
    />
    {items.map((item) => (
      <SubCategorySection
        key={item.id}
        item={item}
        app={app}
        searchQuery={searchQuery}
        onVendorPress={onVendorPress}
        onProductPress={onProductPress}
        onLayout={handleSectionLayout}
      />
    ))}
    {/* Empty state handling */}
{items.length === 0 && (
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyText}>No vendors in this category yet.</AppText>
          </View>
        )}
  </ScrollView>

  {/* Floating menu pill */}
  <TouchableOpacity
    style={styles.floatingPill}
    onPress={() => setMenuVisible(true)}
    accessibilityLabel="Sub categories"
    accessibilityRole="button"
  >
    <AppText style={styles.floatingPillText}>menu</AppText>
  </TouchableOpacity>

  {/* Sub-category selector modal */}
  <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalContent}>
        {items.map((it) => (
          <TouchableOpacity
            key={it.id}
            onPress={() => {
              setMenuVisible(false);
              const y = sectionOffsets[it.id];
              if (y !== undefined) {
                scrollViewRef.current?.scrollTo({ y, animated: true });
              }
            }}
            style={styles.modalItem}
          >
            <AppText>{it.name}</AppText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </Modal>
    </View>
  );
}

export default CategoryDrillInPanel;

const styles = StyleSheet.create({
  floatingPill: {
    position: 'absolute',
    right: SPACE.FLOATING_PILL_RIGHT,
    bottom: SPACE.FLOATING_PILL_BOTTOM,
    backgroundColor: '#000',
    borderRadius: hs(20),
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingPillText: {
    color: '#fff',
    fontSize: ms(14),
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: hs(8),
    width: '80%',
    maxHeight: '70%',
    padding: hs(16),
  },
  modalItem: {
    paddingVertical: vs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  container: {
    flex: 1,
    backgroundColor: neutral.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neutral.surfaceAlt,
  },
  headerMid: {
    flex: 1,
    gap: vs(6),
  },
  headerTitle: {
    fontSize: ms(16),
    fontWeight: '600',
    color: neutral.ink,
  },
  headerSpacer: {
    width: ms(36),
  },
  searchWrap: {
    minHeight: 44,
    borderRadius: ms(22),
    backgroundColor: neutral.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(12),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(12),
    color: neutral.ink,
    paddingVertical: 0,
  },
  railWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: neutral.border,
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
    fontSize: ms(13),
    fontWeight: '500',
    color: neutral.inkMuted,
    textAlign: 'center',
  },
});
