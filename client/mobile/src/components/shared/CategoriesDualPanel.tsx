import React, { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { hs, vs, ms, wp } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import type { SubAppId } from '@/state/uiStore';
import {
  CATEGORY_RAIL,
  MASTER_CATEGORIES,
  ALL_TABS,
  ALL_ACCENT,
} from '@data/categories/masterCategories';
import type {
  CategoryItem,
  CategorySubgroup,
  CategoryTab,
} from '@data/categories/masterCategories';

export type { CategoryItem, CategorySubgroup, CategoryTab };

export interface CategoriesDualPanelProps {
  /** Back navigation handler for the header back button. */
  onBack: () => void;
  /** Opens the search screen for the active context. */
  onSearchPress: () => void;
  /** Fired when a subcategory card is tapped (routes to the source app's Search). */
  onProductPress?: (item: CategoryItem, subAppId: SubAppId) => void;
  /** Fired when a subgroup's title arrow is tapped (routes to the source app's Search). */
  onTitlePress?: (title: string, subAppId: SubAppId) => void;
  /** Rail chip active on mount — 'ALL' by default, or the originating sub-app. */
  initialChip?: 'ALL' | 'FA_MART' | 'PHARMA';
  /** Deep-link: sidebar tab id to mount as active (falls back to the first tab). */
  initialTabId?: string;
  /** Fired whenever the active rail chip changes (lets parents route search per app). */
  onChipChange?: (chip: CategoryRailId) => void;
}

export type CategoryRailId = 'ALL' | 'FA_MART' | 'PHARMA';

const SIDEBAR_W = wp(24);
const ACCENT_DEFAULT = '#1E50E6';
const SIDEBAR_BG = '#F5F6F8';
const INACTIVE_TEXT = '#666666';
const CARD_BG = '#F0F4FE';

/** Items shown in a subgroup grid before the user taps "View All" (client-side pagination). */
const INITIAL_VISIBLE = 5;

const RailChip = memo(function RailChip({
  label,
  active,
  accent,
  onAccent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  onAccent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.railChip, active && { backgroundColor: accent, borderColor: accent }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <AppText style={[styles.railChipLabel, active && { color: onAccent }]}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
});

const SidebarItem = memo(function SidebarItem({
  tab,
  active,
  accent,
  onPress,
}: {
  tab: CategoryTab;
  active: boolean;
  accent: string;
  onPress: (tab: CategoryTab) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.sidebarItem,
        active ? { backgroundColor: '#FFFFFF' } : { backgroundColor: SIDEBAR_BG },
      ]}
      onPress={() => onPress(tab)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.title}
    >
      {active && <View style={[styles.sidebarIndicator, { backgroundColor: accent }]} />}
      <ExpoImage
        source={{ uri: tab.icon }}
        style={styles.sidebarIcon}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
      <AppText
        style={[
          styles.sidebarLabel,
          active ? { color: accent, fontWeight: '700' } : { color: INACTIVE_TEXT },
        ]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {tab.title}
      </AppText>
    </TouchableOpacity>
  );
});

const GridItem = memo(function GridItem({
  item,
  onPress,
}: {
  item: CategoryItem;
  onPress?: (item: CategoryItem) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onPress?.(item)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.gridItemCard}>
        <ExpoImage
          source={{ uri: item.image }}
          style={styles.gridItemImage}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </View>
      <AppText style={styles.gridItemLabel} numberOfLines={2}>
        {item.name}
      </AppText>
    </TouchableOpacity>
  );
});

function SubgroupSection({
  subgroup,
  accent,
  onAccent,
  sourceApp,
  expanded,
  onToggleMore,
  onItemPress,
  onTitlePress,
}: {
  subgroup: CategorySubgroup;
  accent: string;
  onAccent: string;
  sourceApp: SubAppId;
  expanded: boolean;
  onToggleMore: () => void;
  onItemPress: (item: CategoryItem) => void;
  onTitlePress: (title: string, subAppId: SubAppId) => void;
}) {
  const visible = subgroup.items.slice(0, expanded ? subgroup.items.length : INITIAL_VISIBLE);
  const hasMore = subgroup.items.length > INITIAL_VISIBLE;
  // The 6th cell is reserved for the round "View All" load-more button.
  const showLoadMore = hasMore && !expanded;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionTitle} numberOfLines={1}>
          {subgroup.title}
        </AppText>
        <TouchableOpacity
          style={[styles.sectionArrowBtn, { backgroundColor: accent }]}
          onPress={() => onTitlePress(subgroup.title, sourceApp)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Search ${subgroup.title}`}
        >
          <ChevronRight size={ms(16)} color={onAccent} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {visible.map((item) => (
          <GridItem key={item.id} item={item} onPress={onItemPress} />
        ))}
        {showLoadMore && (
          <View style={styles.gridItem}>
            <TouchableOpacity
              style={[styles.viewMoreBtn, { backgroundColor: accent }]}
              onPress={onToggleMore}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`View more ${subgroup.title}`}
            >
              <AppText style={[styles.viewMoreText, { color: onAccent }]} numberOfLines={2}>
                View more
              </AppText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Universal "Master Categories" dual-panel screen.
 *
 * Left: independent scrolling category rail (28%). Right: dynamic scrolling
 * content (72%) grouped into subcategory sections with a 3-column grid and
 * client-side "View All" pagination (first 5 + a 6th load-more cell).
 *
 * A top sub-app selector (optional) switches the active context. Clicking a
 * sidebar item only updates local state — product taps route to Search via
 * `onProductPress`; no Catalog navigation happens here.
 */
export function CategoriesDualPanel({
  onBack,
  onSearchPress,
  onProductPress,
  onTitlePress,
  initialChip = 'ALL',
  initialTabId,
  onChipChange,
}: CategoriesDualPanelProps) {
  const insets = useSafeAreaInsets();
  const [activeChip, setActiveChip] = useState<CategoryRailId>(initialChip);
  const tabs = activeChip === 'ALL' ? ALL_TABS : MASTER_CATEGORIES[activeChip];
  const accent =
    activeChip === 'ALL'
      ? ALL_ACCENT
      : CATEGORY_RAIL.find((c) => c.id === activeChip)?.accent ?? ACCENT_DEFAULT;
  const onAccent =
    activeChip === 'ALL'
      ? '#FFFFFF'
      : CATEGORY_RAIL.find((c) => c.id === activeChip)?.onAccent ?? '#FFFFFF';

  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    const target = initialTabId && tabs.some((t) => t.id === initialTabId) ? initialTabId : null;
    return target ?? (tabs.length > 0 ? tabs[0].id : null);
  });
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const [gridKey, setGridKey] = useState(0);
  // Per-subgroup "View All" expansion state (client-side pagination).
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const sidebarRef = useRef<ScrollView>(null);
  // Bring a deep-linked (non-first) tab into view once the sidebar mounts.
  useLayoutEffect(() => {
    if (initialTabId && tabs.some((t) => t.id === initialTabId)) {
      const index = tabs.findIndex((t) => t.id === initialTabId);
      if (index > 0) {
        const y = index * (ms(70) + vs(8));
        sidebarRef.current?.scrollTo({ y, animated: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChipSelect = useCallback(
    (chip: CategoryRailId) => {
      setActiveChip(chip);
      setActiveTabId(null);
      setExpandedGroups({});
      setGridKey((k) => k + 1);
      onChipChange?.(chip);
    },
    [onChipChange],
  );

  const handleTabSelect = useCallback((tab: CategoryTab) => {
    setActiveTabId(tab.id);
    setGridKey((k) => k + 1);
  }, []);

  const handleItemPress = useCallback(
    (item: CategoryItem) => {
      const app = activeChip === 'ALL' ? (item.app ?? 'FA_MART') : activeChip;
      onProductPress?.(item, app);
    },
    [onProductPress, activeChip],
  );

  const handleToggleMore = useCallback(
    (groupId: string) => {
      setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    },
    [],
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + vs(12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={ms(22)} color="#1E2022" strokeWidth={2.5} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>All Categories</AppText>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={onSearchPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Search categories"
        >
          <Search size={ms(21)} color="#1E2022" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* SUB-APP RAIL */}
      <View style={styles.railWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
        >
          {CATEGORY_RAIL.map((chip) => (
            <RailChip
              key={chip.id}
              label={chip.label}
              active={activeChip === chip.id}
              accent={chip.accent}
              onAccent={chip.onAccent}
              onPress={() => handleChipSelect(chip.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.body}>
        {/* LEFT SIDEBAR — independent vertical scroll */}
        <View style={styles.sidebar}>
          <ScrollView
            ref={sidebarRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarContent}
          >
            {tabs.map((tab) => (
              <SidebarItem
                key={tab.id}
                tab={tab}
                active={tab.id === activeTab?.id}
                accent={accent}
                onPress={handleTabSelect}
              />
            ))}
          </ScrollView>
        </View>

        {/* RIGHT CONTENT — dynamic by active tab */}
        <View style={styles.content}>
          <ScrollView
            key={gridKey}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentScroll}
          >
            {activeTab?.subgroups.map((subgroup) => {
              const sourceApp: SubAppId =
                activeChip === 'ALL' ? (subgroup.items[0]?.app ?? 'FA_MART') : activeChip;
              return (
                <SubgroupSection
                  key={subgroup.id}
                  subgroup={subgroup}
                  accent={accent}
                  onAccent={onAccent}
                  sourceApp={sourceApp}
                  expanded={!!expandedGroups[subgroup.id]}
                  onToggleMore={() => handleToggleMore(subgroup.id)}
                  onItemPress={handleItemPress}
                  onTitlePress={onTitlePress ?? (() => {})}
                />
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

export default CategoriesDualPanel;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
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
  headerTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#1E2022',
  },
  headerIconBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
    marginLeft: 'auto',
  },
  railWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.15)',
    paddingVertical: vs(10),
  },
  railContent: {
    paddingHorizontal: hs(16),
    gap: hs(8),
  },
  railChip: {
    paddingHorizontal: hs(14),
    height: vs(32),
    borderRadius: ms(16),
    backgroundColor: '#F5F6F8',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  railChipLabel: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#334155',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: SIDEBAR_BG,
    borderBottomRightRadius: ms(18),
  },
  sidebarContent: {
    paddingVertical: vs(8),
  },
  sidebarItem: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(8),
    paddingHorizontal: hs(4),
    borderRadius: ms(12),
  },
  sidebarIndicator: {
    position: 'absolute',
    left: 0,
    top: ms(10),
    bottom: ms(10),
    width: ms(4),
    borderTopRightRadius: ms(2),
    borderBottomRightRadius: ms(2),
  },
  sidebarIcon: {
    width: ms(34),
    height: ms(34),
    marginBottom: vs(5),
  },
  sidebarLabel: {
    fontSize: ms(10),
    textAlign: 'center',
    width: '100%',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: ms(18),
  },
  contentScroll: {
    paddingHorizontal: hs(14),
    paddingTop: vs(14),
    paddingBottom: vs(28),
  },
  section: {
    marginBottom: vs(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(12),
  },
  sectionTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#1E2022',
    flex: 1,
    marginRight: hs(8),
  },
  sectionArrowBtn: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: hs(8),
    rowGap: vs(16),
  },
  gridItem: {
    width: '31%',
    alignItems: 'center',
  },
  gridItemCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: ms(16),
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: hs(8),
  },
  gridItemImage: {
    width: '100%',
    height: '100%',
  },
  gridItemLabel: {
    marginTop: vs(9),
    textAlign: 'center',
    fontSize: ms(11),
    fontWeight: '500',
    color: '#333333',
    lineHeight: ms(15),
    width: '100%',
  },
  viewMoreBtn: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(6),
  },
  viewMoreText: {
    fontSize: ms(12),
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: ms(16),
    width: '100%',
  },
});
