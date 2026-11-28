import React, { useCallback, useState, type ReactNode } from 'react';
import { View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { foodTheme } from '../constants/theme';
import AppText from '@/components/AppText';
import { useRestaurantFeed } from '../hooks/useRestaurantFeed';
import { storeToRestaurant } from '../services/restaurantFeedService';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { FoodRestaurant, SpecialDish, FoodType } from '../types';
import { dishToProduct } from '@data/food/specials';
import { useFoodFilterStore } from '@/state/foodFilterStore';
import { venueMatches, dishMatches } from '../utils/dietFilter';
import FoodHeader from '../components/FoodHeader';
import FoodCategoryRail from '../components/FoodCategoryRail';
import SectionHeader from '../components/SectionHeader';
import FeaturedDishCarousel from '../components/FeaturedDishCarousel';
import FoodSectionHeader from '../components/FoodSectionHeader';
import MindGridRail from '../components/MindGridRail';
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
import Button from '@/components/Button';
import { driveNavBarFromDelta } from '@/hooks/useAutoHideNavBar';
import { useServiceabilityStore } from '@/state/serviceabilityStore';
import { useSduiScreenLayout } from '../sdui/useSduiScreenLayout';
import { resolveHeroTarget } from '../sdui/heroResolver';
import SduiHeroSlot from '../sdui/SduiHeroSlot';
import type { SduiWidget } from '@/services/api/sduiLayout';

type Props = NativeStackScreenProps<FoodStackParamList, 'FoodHome'>;

/**
 * Food-first sub-app home. Single scroll surface: the pre-grid sections
 * (FoodHeader, the FOOD_HERO ad banner, the category rail, Today's Special,
 * "What's on your mind?") render as the RestaurantGrid's list header, and the
 * "Restaurants" grid is the body — no nested vertical lists.
 */
export function FoodHomeScreen({ navigation }: Props) {
  const { feed, error, reload, refreshing, refresh } = useRestaurantFeed();
  const [activeTab, setActiveTab] = useState<FoodTab>('Home');
  const scrollY = useSharedValue(0);
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);
  const scheduleOnly = useFoodFilterStore((s) => s.scheduleOnly);
  const districtCode = useServiceabilityStore((s) => s.districtCode);
  const districtName = useServiceabilityStore((s) => s.districtName);
  // Published SDUI layout for this district (PAN_INDIA when null). Null payload = no layout,
  // and the home keeps its own paid hero + untinted header.
  const sdui = useSduiScreenLayout('food', 'home', districtCode ?? undefined);

  /** SDUI hero tap: only `faazio://food/offers/<CODE>` resolves today — it hands the coupon to the
   *  central cart, the surface that actually applies it. Unresolvable actions render no CTA. */
  const onSduiHeroPress = useCallback(
    (widget: SduiWidget) => {
      const target = resolveHeroTarget(widget);
      if (!target?.couponCode) return;
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.navigate('Cart', { couponCode: target.couponCode });
    },
    [navigation],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - scrollY.value;
      scrollY.value = y;
      // Hide/show the Food bottom nav on the same gesture, like the other sub-apps.
      driveNavBarFromDelta(dy, y);
    },
    [scrollY],
  );

  const openRestaurant = useCallback(
    (restaurant: FoodRestaurant) => navigation.navigate('RestaurantProfile', { restaurant }),
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

  /** Resolve a paid FOOD_HERO venue target to a known restaurant; the vendor feed already includes
   *  seller-owned FOOD stores, so the fallback only covers an id the feed does not carry (e.g. a
   *  delisted store) — resolve it directly so a paid tap is never a silent no-op. Unknown ids stay a
   *  safe no-op. */
  const openVenue = useCallback(
    async (venueId: string) => {
      const known = feed?.restaurants.find((r) => r.id === venueId);
      if (known) {
        openRestaurant(known);
        return;
      }
      const store = await gateway.getStore(venueId).catch(() => undefined);
      if (!store) return;
      openRestaurant(storeToRestaurant(store));
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
    const specials = feed.specials.filter((d) => dishMatches(dietFilter, d));
    const mind = feed.topFoods.filter((f) => venueMatches(dietFilter, f));
    return (
      <>
        <Animated.View entering={FadeIn.duration(260)}>
          <FoodHeader
            onBack={goBack}
            onSearch={() => openSearch()}
            locationLabel={districtName ?? 'All India'}
            theme={sdui.layout?.header_theme}
          />
        </Animated.View>
        <Animated.View entering={FadeIn.duration(260)}>
          {sdui.layout ? (
            <SduiHeroSlot layout={sdui.layout} clockOffset={sdui.clockOffset} onPress={onSduiHeroPress} />
          ) : (
            <CampaignHero
              placement="FOOD_HERO"
              app="FOOD"
              style={styles.heroWrap}
              adLabelPosition="bottom-right"
              adLabelTone="light"
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
          )}
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(340)} style={styles.categoryRailWrap}>
          <FoodCategoryRail />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(360)}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Today's Special Near You" />
          </View>
          {specials.length > 0 ? (
            <FeaturedDishCarousel dishes={specials} onPress={openDishProduct} />
          ) : feed.specials.length === 0 ? (
            <View style={styles.sectionEmpty}>
              <AppText style={styles.emptySub}>No specials available right now.</AppText>
            </View>
          ) : (
            <DietEmptyNote />
          )}
        </Animated.View>
        {mind.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(380)}>
            <FoodSectionHeader title="What's on your mind?" />
            <MindGridRail items={mind} onPress={openMindSearch} />
          </Animated.View>
        ) : null}
      </>
    );
  }, [
    feed,
    dietFilter,
    openDishProduct,
    openMindSearch,
    goBack,
    openVenue,
    navigation,
    openSearch,
    districtName,
    sdui.layout,
    sdui.clockOffset,
    onSduiHeroPress,
  ]);

  if (!feed) {
    return (
      <View style={styles.container}>
        {error ? (
          <View style={styles.errorState}>
            <AppText style={styles.errorTitle}>Could not load restaurants</AppText>
            <AppText style={styles.errorSub}>Check your connection and try again.</AppText>
            <Button label="Try again" onPress={reload} accent={foodTheme.primary} style={styles.errorButton} />
          </View>
        ) : (
          <LoadingSkeleton />
        )}
        <FoodBottomNav activeTab={activeTab} onChange={handleTabChange} onCartPress={openCart} onYouPress={openYou} onHomePress={openHubHome} />
      </View>
    );
  }

  const restaurants = feed.restaurants.filter(
    (r) => venueMatches(dietFilter, r) && (!scheduleOnly || r.acceptsScheduledOrders),
  );

  // Honest empty state: the server authoritatively lists no vendors (all delisted / state-filtered)
  // and no filter is hiding anything — don't fall back to stale fixture restaurants. A schedule
  // filter that hides everything gets its own copy so the user knows which chip to switch off.
  const gridEmpty =
    restaurants.length > 0 ? undefined
    : scheduleOnly && feed.restaurants.length > 0 ? (
      <View style={styles.emptyState}>
        <AppText style={styles.emptyTitle}>No pre-order restaurants</AppText>
        <AppText style={styles.emptySub}>Turn off Pre-order to see all restaurants.</AppText>
      </View>
    ) : feed.vendorsAuthoritative && feed.restaurants.length === 0 ? (
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
        restaurants={restaurants}
        header={renderTopSections()}
        empty={gridEmpty}
        onPress={openRestaurant}
        onScroll={onScroll}
        refreshing={refreshing}
        onRefresh={refresh}
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
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(32),
  },
  errorTitle: {
    fontSize: ms(16),
    fontWeight: '600',
    color: foodTheme.textPrimary,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: ms(14),
    color: foodTheme.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  errorButton: {
    marginTop: 20,
    alignSelf: 'stretch',
  },
  heroWrap: {
    paddingHorizontal: hs(16),
    marginTop: SPACE.BLOCK,
  },
  categoryRailWrap: {
    marginTop: SPACE.BLOCK,
  },
  sectionHeaderWrap: {
    paddingHorizontal: hs(16),
    marginTop: SPACE.BLOCK,
  },
  sectionEmpty: {
    paddingHorizontal: hs(16),
    paddingVertical: 12,
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
