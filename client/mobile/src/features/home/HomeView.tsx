import React, { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SPACE } from '@/theme/spacing';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { homeSections } from '@data/home/sections';
import type { HomeSectionKind } from '@data/home/sections';
import type { SduiCampaign } from '@data/home/sdui';
import type { Product, StoreProfile } from '@data/types';
import type { StoreRecord } from '@data/directory/stores';
import type { SubAppId } from '@/state/uiStore';
import { gateway } from '@/services/api/GatewayClient';
import { useHomeFeed } from './hooks/useHomeFeed';
import {
  mensPicks,
  womensPicks,
  childrensPicks,
  hairSkinPicks,
} from '@data/home/demographics';
import { nearbyOffers } from '@data/home/nearbyOffers';

import AdBannerSection from '@/features/home/sections/AdBannerSection';
import TodaysSpecialsSection from '@/features/home/sections/TodaysSpecialsSection';
import BrandCampaignsSection from '@/features/home/sections/BrandCampaignsSection';
import DealsOfDaySection from '@/features/home/sections/DealsOfDaySection';
import SponsoredRailSection from '@/features/home/sections/SponsoredRailSection';
import MostRatedRestaurantsSection from '@/features/home/sections/MostRatedRestaurantsSection';
import RecentlyViewedRailSection from '@/features/home/sections/RecentlyViewedRailSection';
import NearbyOffersSection from '@/features/home/sections/NearbyOffersSection';
import MensSection from '@/features/home/sections/MensSection';
import WomensSection from '@/features/home/sections/WomensSection';
import ChildrensSection from '@/features/home/sections/ChildrensSection';
import HairSkinCareSection from '@/features/home/sections/HairSkinCareSection';
import FilterFeedSection from '@/features/home/sections/FilterFeedSection';

import { recentlyViewedMart, recentlyViewedFood, recentlyViewedPharma } from '@data/home/rails';
import { brandRamp } from '@/theme/brandTokens';
import AppText from '@/components/AppText';
import { ms, vs, hs } from '@/utils/responsive';
import { neutral } from '@/theme/brandTokens';

interface HomeViewProps {
  onLaunchSubApp: (subAppId: SubAppId) => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  onStoreClick?: (store: StoreProfile) => void;
  onOpenDeals?: (params: { mode: 'campaign' | 'discounts'; campaignId?: string; storeId?: string }) => void;
  scrollY: SharedValue<number>;
  clamp: SharedValue<number>;
  collapseCap: SharedValue<number>;
  /** Stable outer-container height (does not change during header collapse). */
  viewportH: SharedValue<number>;
  /** Top padding so the first section sits flush below the expanded (overlay) header. */
  contentPaddingTop: number;
}

interface HomeRow {
  id: HomeSectionKind;
  products?: Product[];
  stores?: StoreRecord[];
  chipProducts?: Record<string, string[]>;
  campaigns?: SduiCampaign[];
}

export default function HomeView({
  onLaunchSubApp,
  addToCart,
  onProductClick,
  onStoreClick,
  onOpenDeals,
  scrollY,
  clamp,
  collapseCap,
  viewportH,
  contentPaddingTop,
}: HomeViewProps) {
  const sectionProps = useMemo(
    () => ({ onLaunchSubApp, addToCart, onProductClick, onStoreClick, onOpenDeals }),
    [onLaunchSubApp, addToCart, onProductClick, onStoreClick, onOpenDeals],
  );

  // Server-driven SDUI registry: section order and joined product/store rows come from the
  // gateway doc. The static registry + authored fixtures are used only when the gateway is
  // disabled (offline shell); while online, an empty/failed read shows an honest state.
  const { feed, loading, error, reload } = useHomeFeed();
  const offline = !gateway.remoteEnabled;

  const rows = useMemo<HomeRow[]>(() => {
    if (offline) {
      return homeSections.map((s): HomeRow => ({ id: s.id }));
    }
    if (!feed) return [];
    return feed.map((s): HomeRow => ({
      id: s.id,
      products: s.products as unknown as Product[],
      stores: s.stores,
      campaigns: s.campaigns,
      chipProducts: s.chips?.length
        ? Object.fromEntries(s.chips.map((c) => [c.id, c.productIds]))
        : undefined,
    }));
  }, [feed, offline]);

  // 1:1 with finger scroll — matches native collapsing toolbars. Damping below 1
  // made content travel faster than the finger (the "surge" while panning down).
  const DAMPING = 1.0;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - scrollY.value;
      scrollY.value = y;

      // No hard teleport at the top: rubber-band deltas decay naturally, so the
      // header re-opens interpolated (Flipkart-style) instead of slamming open.
      clamp.value = Math.min(
        collapseCap.value,
        Math.max(0, clamp.value + dy * DAMPING),
      );
    },
  });

  const renderSection = useCallback(
    ({ id, products, stores, chipProducts, campaigns }: HomeRow): React.ReactElement | null => {
      // Offline: authored fixtures keep the shell usable. Online: only server rows; a section
      // whose server join is empty is omitted rather than padded with fixtures.
      const rail = (fallback: Product[]) => (offline ? fallback : products ?? []);
      const hasRail = (fallback: Product[]) => offline || (products?.length ?? 0) > 0;
      switch (id) {
        case 'adBanner': return <AdBannerSection {...sectionProps} />;
        case 'diningSpecials': return <TodaysSpecialsSection {...sectionProps} products={products} />;
        case 'hotBrandDeals': return <BrandCampaignsSection {...sectionProps} campaigns={campaigns} />;
        case 'dealsOfDay': return <DealsOfDaySection {...sectionProps} products={products} />;
        case 'sponsoredRail': return <SponsoredRailSection {...sectionProps} />;
        case 'mostRatedDining': return <MostRatedRestaurantsSection {...sectionProps} stores={stores} />;
        case 'recentlyViewedMart':
          return hasRail(recentlyViewedMart)
            ? <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Mart" products={rail(recentlyViewedMart)} accent={brandRamp.MART.base} appBrand="MART" />
            : null;
        case 'recentlyViewedFood':
          return hasRail(recentlyViewedFood)
            ? <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Food" products={rail(recentlyViewedFood)} accent={brandRamp.FOOD.base} appBrand="FOOD" />
            : null;
        case 'recentlyViewedPharma':
          return hasRail(recentlyViewedPharma)
            ? <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Pharma" products={rail(recentlyViewedPharma)} accent={brandRamp.PHARMA.base} appBrand="PHARMA" />
            : null;
        case 'nearbyOffers':
          return hasRail(nearbyOffers) ? <NearbyOffersSection {...sectionProps} products={rail(nearbyOffers)} /> : null;
        case 'mens':
          return hasRail(mensPicks) ? <MensSection {...sectionProps} products={rail(mensPicks)} /> : null;
        case 'womens':
          return hasRail(womensPicks) ? <WomensSection {...sectionProps} products={rail(womensPicks)} /> : null;
        case 'childrens':
          return hasRail(childrensPicks) ? <ChildrensSection {...sectionProps} products={rail(childrensPicks)} /> : null;
        case 'hairSkinCare':
          return hasRail(hairSkinPicks) ? <HairSkinCareSection {...sectionProps} products={rail(hairSkinPicks)} /> : null;
        case 'filterFeed': return <FilterFeedSection {...sectionProps} chipProducts={chipProducts} scrollY={scrollY} viewportH={viewportH} />;
        default: return null;
      }
    },
    [sectionProps, scrollY, viewportH, offline],
  );

  const renderItem = useCallback(
    ({ item }: { item: HomeRow }) => renderSection(item),
    [renderSection],
  );

  const emptyState = offline ? null : loading ? (
    <View style={styles.emptyWrap}>
      <AppText style={styles.emptyTitle}>Loading your feed…</AppText>
    </View>
  ) : error ? (
    <View style={styles.emptyWrap}>
      <AppText style={styles.emptyTitle}>Could not load your feed</AppText>
      <AppText style={styles.emptySub}>Check your connection and try again.</AppText>
      <TouchableOpacity style={styles.retryBtn} onPress={reload} activeOpacity={0.8} accessibilityRole="button">
        <AppText style={styles.retryText}>Try again</AppText>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.emptyWrap}>
      <AppText style={styles.emptyTitle}>Nothing here yet</AppText>
      <AppText style={styles.emptySub}>Check back soon for new offers.</AppText>
    </View>
  );

  return (
    <Animated.FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop }]}
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      initialNumToRender={2}
      maxToRenderPerBatch={6}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      ListEmptyComponent={emptyState}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  emptyWrap: {
    paddingHorizontal: hs(32),
    paddingVertical: vs(64),
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: neutral.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    textAlign: 'center',
    marginTop: vs(6),
  },
  retryBtn: {
    marginTop: vs(16),
    paddingHorizontal: hs(18),
    paddingVertical: vs(10),
    borderRadius: ms(999),
    backgroundColor: brandRamp.MART.base,
  },
  retryText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#ffffff',
  },
});
