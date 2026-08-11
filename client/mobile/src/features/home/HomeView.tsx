import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { vs } from '@/utils/responsive';
import Animated, { useAnimatedScrollHandler, useSharedValue, runOnJS } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { homeSections } from '@data/home/sections';
import type { HomeSectionKind } from '@data/home/sections';
import type { SubAppId } from '@/state/uiStore';

import AdBannerSection from '@/features/home/sections/AdBannerSection';
import DiningSpecialsSection from '@/features/home/sections/DiningSpecialsSection';
import HotBrandDealsSection from '@/features/home/sections/HotBrandDealsSection';
import StoreOffersSection from '@/features/home/sections/StoreOffersSection';
import MostRatedDiningSection from '@/features/home/sections/MostRatedDiningSection';
import RecentlyViewedRailSection from '@/features/home/sections/RecentlyViewedRailSection';
import NearbyOffersSection from '@/features/home/sections/NearbyOffersSection';
import MensSection from '@/features/home/sections/MensSection';
import WomensSection from '@/features/home/sections/WomensSection';
import ChildrensSection from '@/features/home/sections/ChildrensSection';
import HairSkinCareSection from '@/features/home/sections/HairSkinCareSection';
import FilterFeedSection from '@/features/home/sections/FilterFeedSection';

import { recentlyViewedMart, recentlyViewedFood, recentlyViewedGrocery, recentlyViewedPharma } from '@data/home/rails';

interface HomeViewProps {
  onLaunchSubApp: (subAppId: SubAppId) => void;
  addToCart: (id: string, name: string, price: number, emoji: string) => void;
  onProductClick?: (product: any) => void;
  scrollY: SharedValue<number>;
  clamp: SharedValue<number>;
  collapseH: SharedValue<number>;
  expandedH: number;
}

export default function HomeView({
  onLaunchSubApp,
  addToCart,
  onProductClick,
  scrollY,
  clamp,
  collapseH,
  expandedH,
}: HomeViewProps) {
  const sectionProps = useMemo(
    () => ({ onLaunchSubApp, addToCart, onProductClick }),
    [onLaunchSubApp, addToCart, onProductClick],
  );
  const [scrollYState, setScrollYState] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const lastEmit = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - scrollY.value;
      scrollY.value = y;

      if (y <= 0) {
        clamp.value = 0;
      } else {
        clamp.value = Math.min(collapseH.value, Math.max(0, clamp.value + dy));
      }

      if (Math.abs(y - lastEmit.value) > 40 || y <= 0) {
        lastEmit.value = y;
        runOnJS(setScrollYState)(y);
      }
    },
  });

  const renderSection = useCallback(
    (id: HomeSectionKind): React.ReactElement | null => {
      switch (id) {
        case 'adBanner': return <AdBannerSection {...sectionProps} />;
        case 'diningSpecials': return <DiningSpecialsSection {...sectionProps} />;
        case 'hotBrandDeals': return <HotBrandDealsSection {...sectionProps} />;
        case 'storeOffers': return <StoreOffersSection {...sectionProps} />;
        case 'mostRatedDining': return <MostRatedDiningSection {...sectionProps} />;
        case 'recentlyViewedMart': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Mart" products={recentlyViewedMart} accent="#1162D3" appBrand="MART" />;
        case 'recentlyViewedFood': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Food" products={recentlyViewedFood} accent="#1E5D44" appBrand="FOOD" />;
        case 'recentlyViewedGrocery': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Grocery" products={recentlyViewedGrocery} accent="#10B981" appBrand="GROCERY" />;
        case 'recentlyViewedPharma': return <RecentlyViewedRailSection {...sectionProps} title="Recently Viewed — Pharma" products={recentlyViewedPharma} accent="#065F46" appBrand="PHARMA" />;
        case 'nearbyOffers': return <NearbyOffersSection {...sectionProps} />;
        case 'mens': return <MensSection {...sectionProps} />;
        case 'womens': return <WomensSection {...sectionProps} />;
        case 'childrens': return <ChildrensSection {...sectionProps} />;
        case 'hairSkinCare': return <HairSkinCareSection {...sectionProps} />;
        case 'filterFeed': return <FilterFeedSection {...sectionProps} scrollY={scrollYState} viewportHeight={viewportHeight} />;
        default: return null;
      }
    },
    [sectionProps, scrollYState, viewportHeight],
  );

  const renderItem = useCallback(
    ({ item }: { item: { id: HomeSectionKind } }) => renderSection(item.id),
    [renderSection],
  );

  return (
    <Animated.FlatList
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingTop: expandedH }]}
      data={homeSections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      scrollEventThrottle={16}
      removeClippedSubviews
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={9}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    paddingBottom: vs(40),
  },
});
