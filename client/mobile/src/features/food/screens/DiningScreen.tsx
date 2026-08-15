import React, { memo, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { hs, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { useDiningFeed } from '../hooks/useDiningFeed';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';
import DiningHeader from '../components/DiningHeader';
import SectionHeader from '../components/SectionHeader';
import TopRestaurantCarousel from '../components/TopRestaurantCarousel';
import FeaturedDishCarousel from '../components/FeaturedDishCarousel';
import RestaurantGrid from '../components/RestaurantGrid';
import LoadingSkeleton from '../components/LoadingSkeleton';

interface DiningScreenProps {
  onBack?: () => void;
  searchQuery?: string;
  autoScrollToGrid?: boolean;
  onRestaurantPress?: (restaurant: DiningRestaurant) => void;
  onDishPress?: (dish: SpecialDish) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/**
 * Dedicated Dining view. Section order is fixed:
 * Header → Top Rated carousel → Today's Special rail → Dining grid.
 * Pre-grid sections render as the grid's list header so the whole page scrolls
 * on a single surface (no nested vertical virtualized lists).
 */
const DiningScreen = memo(function DiningScreen({
  onBack,
  searchQuery = '',
  autoScrollToGrid = false,
  onRestaurantPress,
  onDishPress,
  onScroll,
}: DiningScreenProps) {
  const feed = useDiningFeed();

  const renderTopSections = useCallback((): ReactNode => {
    if (!feed) return null;
    return (
      <>
        <Animated.View entering={FadeIn.duration(260)}>
          <DiningHeader onBack={onBack} />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(320)}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Top Rated Restaurants" onSeeAll={() => undefined} />
          </View>
          <TopRestaurantCarousel restaurants={feed.topRated} onPress={onRestaurantPress} />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(360)}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Today's Special Near You" onSeeAll={() => undefined} />
          </View>
          <FeaturedDishCarousel dishes={feed.specials} onPress={onDishPress} />
        </Animated.View>
      </>
    );
  }, [feed, onBack, onRestaurantPress, onDishPress]);

  if (!feed) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RestaurantGrid
        restaurants={feed.dining}
        searchQuery={searchQuery}
        autoScrollToGrid={autoScrollToGrid}
        header={renderTopSections()}
        onPress={onRestaurantPress}
        onScroll={onScroll}
      />
    </View>
  );
});

export default DiningScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: foodTheme.background,
  },
  sectionHeaderWrap: {
    paddingHorizontal: hs(16),
    marginBottom: vs(10),
    marginTop: vs(16),
  },
});
