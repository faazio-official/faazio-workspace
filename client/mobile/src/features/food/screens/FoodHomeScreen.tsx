import React, { useCallback, useState, type ReactNode } from 'react';
import { View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { foodTheme } from '../constants/theme';
import AppText from '@/components/AppText';
import { useDiningFeed } from '../hooks/useDiningFeed';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';
import type { FoodType } from '../mocks/homeFeed';
import { SNACKS_BEVERAGES } from '../mocks/homeFeed';
import { dishToProduct } from '../mocks/specials';
import { useFoodFilterStore } from '@/state/foodFilterStore';
import { venueMatches, dishMatches } from '../utils/dietFilter';
import DiningHeader from '../components/DiningHeader';
import SectionHeader from '../components/SectionHeader';
import TopRestaurantCarousel from '../components/TopRestaurantCarousel';
import FeaturedDishCarousel from '../components/FeaturedDishCarousel';
import FoodSectionHeader from '../components/FoodSectionHeader';
import MindGridRail from '../components/MindGridRail';
import SnacksRail from '../components/SnacksRail';
import RestaurantGrid from '../components/RestaurantGrid';
import DietEmptyNote from '../components/DietEmptyNote';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';
import CampaignHero from '@/components/shared/CampaignHero';
import { openHeroTarget } from '@/services/adsTarget';
import { gateway } from '@/services/api/GatewayClient';
import FoodHouseHero from '../components/FoodHouseHero';
import type { StoreProfile } from '@data/types';

type Props = NativeStackScreenProps<FoodStackParamList, 'FoodHome'>;

/**
 * Dining-first Food sub-app home. Single scroll surface: the pre-grid sections
 * (DiningHeader, Top Rated carousel, Today's Special, "What's on your mind?",
 * "Snacks & Beverages") render as the RestaurantGrid's list header, and the
 * "Restaurants For Dining" grid is the body — no nested vertical lists.
 */
export function FoodHomeScreen({ navigation }: Props) {
  const feed = useDiningFeed();
  const [activeTab, setActiveTab] = useState<FoodTab>('Home');
  const scrollY = useSharedValue(0);
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const openRestaurant = useCallback(
    (restaurant: DiningRestaurant) => navigation.navigate('RestaurantProfile', { restaurant }),
    [navigation],
  );

  const openDishProduct = useCallback(
    (dish: SpecialDish) => {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.navigate('ProductDetail', { product: dishToProduct(dish) });
    },
    [navigation],
  );

  /** Resolve a paid FOOD_HERO venue target to a known restaurant; otherwise resolve the store/venue
   *  directly (delivery kitchens store-f* never appear in the dining feed) so a paid tap is never a
   *  silent no-op. Unknown ids stay a safe no-op. */
  const openVenue = useCallback(
    async (venueId: string) => {
      const known =
        feed?.topRated.find((r) => r.id === venueId) ?? feed?.dining.find((r) => r.id === venueId);
      if (known) {
        openRestaurant(known);
        return;
      }
      const store = await gateway.getStore(venueId).catch(() => undefined);
      if (!store) return;
      openRestaurant({
        id: store.id,
        name: store.name,
        image: store.coverImage,
        rating: store.rating ?? 0,
        ratingCount: store.reviewsCount ?? 0,
        distance: parseFloat(store.distance) || 0,
        deliveryTime: store.deliveryTime ?? '',
        priceForTwo: 0,
        cuisine: store.categories.join(' • '),
        cuisines: store.categories,
        neighborhood: store.address ?? '',
        address: store.address ?? '',
        latitude: 0,
        longitude: 0,
        isFavourite: false,
        dietType: 'both',
      });
    },
    [feed, openRestaurant],
  );

  const openSearch = useCallback(
    (query?: string) => navigation.navigate('Search', query ? { initialQuery: query } : undefined),
    [navigation],
  );

  const openMindSearch = useCallback((item: FoodType) => openSearch(item.name), [openSearch]);

  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Search') {
        navigation.navigate('Search');
      } else {
        setActiveTab(tab);
      }
    },
    [navigation],
  );

  const openCart = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Cart', {});
  }, [navigation]);

  const openYou = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('You');
  }, [navigation]);

  const openHubHome = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('MainTabs', { screen: 'Home' });
  }, [navigation]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const renderTopSections = useCallback((): ReactNode => {
    if (!feed) return null;
    const topRated = feed.topRated.filter((r) => venueMatches(dietFilter, r));
    const specials = feed.specials.filter((d) => dishMatches(dietFilter, d));
    const mind = feed.topFoods.filter((f) => venueMatches(dietFilter, f));
    const snacks = SNACKS_BEVERAGES.filter((s) => dishMatches(dietFilter, s));
    return (
      <>
        <Animated.View entering={FadeIn.duration(260)}>
          <CampaignHero
            placement="FOOD_HERO"
            app="FOOD"
            style={styles.heroWrap}
            fallback={feed.heroBanners.length ? <FoodHouseHero banners={feed.heroBanners} /> : null}
            onPress={(ad) =>
              void openHeroTarget(ad, {
                onProduct: (product) =>
                  navigation
                    .getParent<NativeStackNavigationProp<RootStackParamList>>()
                    ?.navigate('ProductDetail', { product }),
                onStore: (store: StoreProfile) => void openVenue(store.id),
                onVenue: (store: StoreProfile) => void openVenue(store.id),
              })
            }
          />
        </Animated.View>
        <Animated.View entering={FadeIn.duration(260)}>
          <DiningHeader onBack={goBack} />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(320)}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Top Rated Restaurants" />
          </View>
          {topRated.length > 0 ? (
            <TopRestaurantCarousel restaurants={topRated} onPress={openRestaurant} />
          ) : (
            <DietEmptyNote />
          )}
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(360)}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Today's Special Near You" />
          </View>
          {specials.length > 0 ? (
            <FeaturedDishCarousel dishes={specials} onPress={openDishProduct} />
          ) : (
            <DietEmptyNote />
          )}
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(380)}>
          <FoodSectionHeader title="What's on your mind?" />
          {mind.length > 0 ? (
            <MindGridRail items={mind} onPress={openMindSearch} />
          ) : (
            <DietEmptyNote />
          )}
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(400)}>
          <FoodSectionHeader title="Snacks & Beverages" />
          {snacks.length > 0 ? (
            <SnacksRail snacks={snacks} />
          ) : (
            <DietEmptyNote />
          )}
        </Animated.View>
      </>
    );
  }, [feed, dietFilter, openRestaurant, openDishProduct, openSearch, openMindSearch, goBack, openVenue, navigation]);

  if (!feed) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton />
        <FoodBottomNav activeTab={activeTab} onChange={handleTabChange} onCartPress={openCart} onYouPress={openYou} onHomePress={openHubHome} />
      </View>
    );
  }

  const dining = feed.dining.filter((r) => venueMatches(dietFilter, r));

  // Honest empty state: the server authoritatively lists no venues (all delisted / state-filtered)
  // and no diet filter is hiding anything — don't fall back to stale fixture restaurants.
  // A diet-emptied grid keeps the filter note.
  const gridEmpty =
    dining.length > 0 ? undefined : feed.diningAuthoritative && feed.dining.length === 0 ? (
      <View style={styles.emptyState}>
        <AppText style={styles.emptyTitle}>No restaurants available right now</AppText>
        <AppText style={styles.emptySub}>Please check back soon.</AppText>
      </View>
    ) : (
      <DietEmptyNote />
    );

  return (
    <View style={styles.container}>
      <RestaurantGrid
        restaurants={dining}
        header={renderTopSections()}
        empty={gridEmpty}
        onPress={openRestaurant}
        onScroll={onScroll}
      />
      <FoodStatusBarStrip scrollY={scrollY} />
      <FoodBottomNav activeTab={activeTab} onChange={handleTabChange} onCartPress={openCart} onYouPress={openYou} onHomePress={openHubHome} />
    </View>
  );
}

export default FoodHomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: foodTheme.background,
  },
  heroWrap: {
    paddingHorizontal: hs(16),
    marginTop: SPACE.BLOCK,
  },
  sectionHeaderWrap: {
    paddingHorizontal: hs(16),
    marginTop: SPACE.SECTION,
  },
  emptyState: {
    paddingHorizontal: hs(24),
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: foodTheme.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: foodTheme.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
});
