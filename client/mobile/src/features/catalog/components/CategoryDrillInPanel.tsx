import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { MASTER_CATEGORIES, MART_ACCENT, PHARMA_ACCENT } from '@data/categories/masterCategories';
import type { CategoryItem, CategoryTab } from '@data/categories/masterCategories';
import { getVendorsForApp, type VendorApp, type VendorMatch } from '@/services/categoryVendors';
import SubgroupTextRail from './SubgroupTextRail';
import VendorRowCard from './VendorRowCard';

interface CategoryDrillInPanelProps {
  tabId: string;
  title: string;
  app: VendorApp;
  onBack: () => void;
  onVendorPress: (storeId: string, initialQuery: string) => void;
  onDeepSearch: (query: string) => void;
}

/** Vendor rows for one sub-category item, via its search query. */
function vendorsForItem(app: VendorApp, item: CategoryItem): VendorMatch[] {
  return getVendorsForApp(app, item.searchQuery);
}

/** A titled section of vendor rows (one sub-category). */
const VendorSection = memo(function VendorSection({
  app,
  item,
  accent,
  searchQuery,
  onVendorPress,
  onDeepSearch,
}: {
  app: VendorApp;
  item: CategoryItem;
  accent: string;
  searchQuery: string;
  onVendorPress: (storeId: string, initialQuery: string) => void;
  onDeepSearch: (query: string) => void;
}) {
  const vendors = useMemo(() => {
    let list = vendorsForItem(app, item);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const store = m.store;
        const haystack = `${store.name} ${store.address ?? ''} ${store.distance}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [app, item, searchQuery]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionTitle} numberOfLines={1}>{item.name}</AppText>
        <TouchableOpacity
          style={[styles.sectionArrow, { backgroundColor: accent }]}
          onPress={() => onDeepSearch(item.searchQuery)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Search ${item.name}`}
        >
          <ChevronRight size={ms(15)} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {vendors.length === 0 ? (
        <View style={styles.emptySection}>
          <AppText style={styles.emptySectionText}>No vendors yet</AppText>
        </View>
      ) : (
        vendors.map((match) => (
          <VendorRowCard
            key={match.store.id}
            match={match}
            onPress={() => onVendorPress(match.store.id, item.searchQuery)}
          />
        ))
      )}
    </View>
  );
});

/**
 * Category drill-in page panel. Resolves the tapped main category (`tabId`) from
 * `MASTER_CATEGORIES[app]`, shows its subgroups as a plain-text rail (first auto-
 * selected), and renders a section per sub-category listing one-per-row vendor
 * cards. An inline searchbar (this page only) filters the vendor rows live.
 */
export function CategoryDrillInPanel({
  tabId,
  title,
  app,
  onBack,
  onVendorPress,
  onDeepSearch,
}: CategoryDrillInPanelProps) {
  const insets = useSafeAreaInsets();
  const accent = app === 'FA_MART' ? MART_ACCENT : PHARMA_ACCENT;

  const tab: CategoryTab | undefined = useMemo(
    () => (MASTER_CATEGORIES[app] ?? []).find((t) => t.id === tabId),
    [tabId, app],
  );
  const activeTab = tab ?? (MASTER_CATEGORIES[app] ?? [])[0];

  const [activeSubgroupId, setActiveSubgroupId] = useState<string | null>(null);
  const activeSubgroup =
    activeTab?.subgroups.find((s) => s.id === activeSubgroupId) ??
    activeTab?.subgroups[0];

  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectSubgroup = useCallback((id: string) => {
    setActiveSubgroupId(id);
    setSearchQuery('');
  }, []);

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
          <AppText style={styles.emptySectionText}>Category not found</AppText>
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

      {/* Subgroup rail (plain text). */}
      <View style={styles.railWrap}>
        <SubgroupTextRail
          options={activeTab.subgroups.map((s) => ({ id: s.id, title: s.title }))}
          activeId={activeSubgroup?.id ?? ''}
          accent={accent}
          onSelect={handleSelectSubgroup}
        />
      </View>

      {/* Sections per sub-category in the active subgroup. */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeSubgroup?.items.map((item) => (
          <VendorSection
            key={item.id}
            app={app}
            item={item}
            accent={accent}
            searchQuery={searchQuery}
            onVendorPress={onVendorPress}
            onDeepSearch={onDeepSearch}
          />
        ))}
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
    paddingBottom: vs(28),
  },
  section: {
    marginTop: vs(8),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    gap: hs(8),
  },
  sectionTitle: {
    flex: 1,
    fontSize: ms(14),
    fontWeight: '800',
    color: '#1E2022',
  },
  sectionArrow: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySection: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
  },
  emptySectionText: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: vs(60),
  },
});
