import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SPACE } from '@/theme/spacing';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { homeSections } from '@data/home/sections';
import type { HomeSectionKind } from '@data/home/sections';
import type { Product } from '@data/types';
import type { SubAppId } from '@/state/uiStore';
import { useHomeFeed } from './hooks/useHomeFeed';

import AdBannerSection from '@/features/home/sections/AdBannerSection';
import DiningSpecialsSection from '@/features/home/sections/DiningSpecialsSection';
import BrandCampaignsSection from '@/features/home/sections/BrandCampaignsSection';
import DealsOfDaySection from '@/features/home/sections/DealsOfDaySection';
import MostRatedDiningSection from '@/features/home/sections/MostRatedDiningSection';
import RecentlyViewedRailSection from '@/features/home/sections/RecentlyViewedRailSection';
import NearbyOffersSection from '@/features/home/sections/NearbyOffersSection';
import MensSection from '@/features/home/sections/MensSection';
import WomensSection from '@/features/home/sections/WomensSection';
import ChildrensSection from '@/features/home/sections/ChildrensSection';
import HairSkinCareSection from '@/features/home/sections/HairSkinCareSection';
import FilterFeedSection from '@/features/home/sections/FilterFeedSection';

import { recentlyViewedMart, recentlyViewedFood, recentlyViewedPharma } from '@data/home/rails';

interface HomeViewProps {
  onLaunchSubApp: (subAppId: SubAppId) => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
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
  onOpenDeals,
  scrollY,
  clamp,
  collapseCap,
  viewportH,
  contentPaddingTop,
}: HomeViewProps) {
  const sectionProps = useMemo(
    () => ({ onLaunchSubApp, addToCart, onProductClick, onOpenDeals }),
    [onLaunchSubApp, addToCart, onProductClick, onOpenDeals],
  );

  // Server-driven SDUI registry: section order (and the rail product rows) come from
  // the gateway doc once loaded; the static registry renders first and is the offline
  // fallback. Section components keep their local data where the doc has no join.
  const feed = useHomeFeed();
  const rows = useMemo<{ id: HomeSectionKind; products?: Product[] }[]>(() => {
    if (feed && feed.length > 0) {
      return feed.map((s) => ({ id: s.id, products: s.products as unknown as Product[] }));
    }
    return homeSections.map((s) => ({ id: s.id }));
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
    ({ id, products }: { id: HomeSectionKind; products?: Product[] }): React.ReactElement | null => {
      const rail = (fallback: Product[]) => (products && products.length > 0 ? products : fallback);
      switch (id) {
        case 'adBanner': return <AdBannerSection {...sectionProps} />;
        case 'diningSpecials': return <DiningSpecialsSection {...sectionProps} />;
        case 'hotBrandDeals': return <BrandCampaignsSection {...sectionProps} />;
        case 'dealsOfDay': return <DealsOfDaySection {...sectionProps} />;
        case 'mostRatedDining': return <MostRatedDiningSection {...sectionProps} />;
        case 'recentlyViewedMart': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Mart" products={rail(recentlyViewedMart)} accent="#1162D3" appBrand="MART" />;
        case 'recentlyViewedFood': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Food" products={rail(recentlyViewedFood)} accent="#1E5D44" appBrand="FOOD" />;
        case 'recentlyViewedPharma': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Pharma" products={rail(recentlyViewedPharma)} accent="#065F46" appBrand="PHARMA" />;
        case 'nearbyOffers': return <NearbyOffersSection {...sectionProps} />;
        case 'mens': return <MensSection {...sectionProps} />;
        case 'womens': return <WomensSection {...sectionProps} />;
        case 'childrens': return <ChildrensSection {...sectionProps} />;
        case 'hairSkinCare': return <HairSkinCareSection {...sectionProps} />;
        case 'filterFeed': return <FilterFeedSection {...sectionProps} scrollY={scrollY} viewportH={viewportH} />;
        default: return null;
      }
    },
    [sectionProps, scrollY, viewportH],
  );

  const renderItem = useCallback(
    ({ item }: { item: { id: HomeSectionKind; products?: Product[] } }) => renderSection(item),
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
