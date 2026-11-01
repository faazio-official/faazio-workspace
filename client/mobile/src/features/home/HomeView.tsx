import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SPACE } from '@/theme/spacing';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { homeSections } from '@data/home/sections';
import type { HomeSectionKind } from '@data/home/sections';
import type { SduiCampaign } from '@data/home/sdui';
import type { Product, StoreProfile } from '@data/types';
import type { StoreRecord } from '@data/directory/stores';
import type { SubAppId } from '@/state/uiStore';
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
import { parentRamp } from '@/theme/brandTokens';
import { brandRamp } from '@/theme/brandTokens';

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

  // Server-driven SDUI registry: section order (and the rail product rows) come from
  // the gateway doc once loaded; the static registry renders first and is the offline
  // fallback. Section components keep their local data where the doc has no join.
  const feed = useHomeFeed();

  // Feed rows: the SDUI doc supplies the ordered sections plus the joined product/store rows
  // and filter chips. The static `homeSections` registry is the offline fallback; each section
  // still carries its own first-paint fixture so the rail never flashes empty.
  interface HomeRow {
    id: HomeSectionKind;
    products?: Product[];
    stores?: StoreRecord[];
    chipProducts?: Record<string, string[]>;
    campaigns?: SduiCampaign[];
  }

  const rows = useMemo<HomeRow[]>(() => {
    if (feed && feed.length > 0) {
      return feed.map((s): HomeRow => ({
        id: s.id,
        products: s.products as unknown as Product[],
        stores: s.stores,
        campaigns: s.campaigns,
        chipProducts: s.chips?.length
          ? Object.fromEntries(s.chips.map((c) => [c.id, c.productIds]))
          : undefined,
      }));
    }
    return homeSections.map((s): HomeRow => ({ id: s.id }));
  }, [feed]);

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
      const rail = (fallback: Product[]) => (products && products.length > 0 ? products : fallback);
      switch (id) {
        case 'adBanner': return <AdBannerSection {...sectionProps} />;
        case 'diningSpecials': return <TodaysSpecialsSection {...sectionProps} products={products} />;
        case 'hotBrandDeals': return <BrandCampaignsSection {...sectionProps} campaigns={campaigns} />;
        case 'dealsOfDay': return <DealsOfDaySection {...sectionProps} />;
        case 'sponsoredRail': return <SponsoredRailSection {...sectionProps} />;
        case 'mostRatedDining': return <MostRatedRestaurantsSection {...sectionProps} stores={stores} />;
        case 'recentlyViewedMart': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Mart" products={rail(recentlyViewedMart)} accent={brandRamp.MART.base} appBrand="MART" />;
        case 'recentlyViewedFood': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Food" products={rail(recentlyViewedFood)} accent={brandRamp.FOOD.base} appBrand="FOOD" />;
        case 'recentlyViewedPharma': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Pharma" products={rail(recentlyViewedPharma)} accent={brandRamp.PHARMA.base} appBrand="PHARMA" />;
        case 'nearbyOffers': return <NearbyOffersSection {...sectionProps} products={rail(nearbyOffers)} />;
        case 'mens': return <MensSection {...sectionProps} products={rail(mensPicks)} />;
        case 'womens': return <WomensSection {...sectionProps} products={rail(womensPicks)} />;
        case 'childrens': return <ChildrensSection {...sectionProps} products={rail(childrensPicks)} />;
        case 'hairSkinCare': return <HairSkinCareSection {...sectionProps} products={rail(hairSkinPicks)} />;
        case 'filterFeed': return <FilterFeedSection {...sectionProps} chipProducts={chipProducts} scrollY={scrollY} viewportH={viewportH} />;
        default: return null;
      }
    },
    [sectionProps, scrollY, viewportH],
  );

  const renderItem = useCallback(
    ({ item }: { item: HomeRow }) => renderSection(item),
    [renderSection],
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
});
