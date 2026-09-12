import React, { memo, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { hs, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { useDiningFeed } from '../hooks/useDiningFeed';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';
import { useFoodFilterStore } from '@/state/foodFilterStore';
import { venueMatches, dishMatches } from '../utils/dietFilter';
import DiningHeader from '../components/DiningHeader';
import SectionHeader from '../components/SectionHeader';
import TopRestaurantCarousel from '../components/TopRestaurantCarousel';
import FeaturedDishCarousel from '../components/FeaturedDishCarousel';
import RestaurantGrid from '../components/RestaurantGrid';
import DietEmptyNote from '../components/DietEmptyNote';
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
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);

  const renderTopSections = useCallback((): ReactNode => {
    if (!feed) return null;
    const topRated = feed.topRated.filter((r) => venueMatches(dietFilter, r));
    const specials = feed.specials.filter((d) => dishMatches(dietFilter, d));
    return (
      <>
        <Animated.View entering={FadeIn.duration(260)}>
          <DiningHeader onBack={onBack} />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(320)}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Top Rated Restaurants" onSeeAll={() => undefined} />
          </View>
          {topRated.length > 0 ? (
            <TopRestaurantCarousel restaurants={topRated} onPress={onRestaurantPress} />
          ) : (
            <DietEmptyNote />
          )}
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(360)}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Today's Special Near You" onSeeAll={() => undefined} />
          </View>
          {specials.length > 0 ? (
            <FeaturedDishCarousel dishes={specials} onPress={onDishPress} />
          ) : (
            <DietEmptyNote />
          )}
        </Animated.View>
      </>
    );
  }, [feed, dietFilter, onBack, onRestaurantPress, onDishPress]);

  if (!feed) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton />
      </View>
    );
  }

  const dining = feed.dining.filter((r) => venueMatches(dietFilter, r));

  return (
    <View style={styles.container}>
      <RestaurantGrid
        restaurants={dining}
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
