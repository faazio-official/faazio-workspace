import React, { useCallback } from 'react';
import { View, ScrollView, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSharedValue } from 'react-native-reanimated';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import { vs } from '@/utils/responsive';
import { PROMOS, CUISINES, MEALS_COMBOS, SNACKS_BEVERAGES } from '../mocks/orderFeed';
import type { MealCombo } from '../mocks/orderFeed';
import { TODAYS_SPECIALS } from '../mocks/specials';
import { dishToProduct } from '../mocks/specials';
import { TOP_FOODS_TO_ORDER } from '../mocks/homeFeed';
import type { FoodType } from '../mocks/homeFeed';
import { useFoodFilterStore } from '@/state/foodFilterStore';
import { dishMatches, venueMatches } from '../utils/dietFilter';
import FoodSectionHeader from '../components/FoodSectionHeader';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';
import OrderHeader from '../components/order/OrderHeader';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';
import PromoCarousel from '../components/order/PromoCarousel';
import MindGridRail from '../components/order/MindGridRail';
import PopularDishRail from '../components/order/PopularDishRail';
import CuisineRail from '../components/order/CuisineRail';
import MealsComboRail from '../components/order/MealsComboRail';
import SnacksRail from '../components/order/SnacksRail';
import DietEmptyNote from '../components/DietEmptyNote';

type Props = NativeStackScreenProps<FoodStackParamList, 'OrderDetail'>;

/**
 * Order Food feed — the fully replaced home-style order screen:
 * 1. Location header  2. Hero promo carousel
 * 3. What's on your mind?  4. Popular Dishes  5. Explore Cuisines
 * 6. Meals & Combos  7. Snacks & Beverages
 * plus the fixed bottom nav (FoodOrder active) with a Cart entry point.
 */
export function OrderDetailScreen({ navigation }: Props) {
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);

  const filteredSpecialDishes = TODAYS_SPECIALS.filter((d) => dishMatches(dietFilter, d));
  const filteredCombos = MEALS_COMBOS.filter((c) => dishMatches(dietFilter, c));
  const filteredSnacks = SNACKS_BEVERAGES.filter((s) => dishMatches(dietFilter, s));
  const filteredMind = TOP_FOODS_TO_ORDER.filter((f) => venueMatches(dietFilter, f));
  const filterActive = dietFilter !== 'all';

  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Home') {
        navigation.popToTop();
      } else if (tab === 'Dining') {
        navigation.navigate('DiningDetail');
      } else if (tab === 'Search') {
        navigation.navigate('Search');
      }
    },
    [navigation],
  );

  const openCart = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Cart');
  }, [navigation]);

  const openYou = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('You');
  }, [navigation]);

  const openSearch = useCallback(
    (query?: string) => navigation.navigate('Search', query ? { initialQuery: query } : undefined),
    [navigation],
  );

  const openProduct = useCallback(
    (product: any) => {
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('ProductDetail', { product });
    },
    [navigation],
  );

  const openDishProduct = useCallback(
    (dish: any) => openProduct(dishToProduct(dish)),
    [openProduct],
  );

  const openMindSearch = useCallback(
    (item: FoodType) => openSearch(item.name),
    [openSearch],
  );

  const openComboSearch = useCallback(
    (combo: MealCombo) => openSearch(combo.name),
    [openSearch],
  );

  const scrollY = useSharedValue(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        <OrderHeader />
        {!filterActive ? <PromoCarousel promos={PROMOS} /> : null}
        <FoodSectionHeader title="What's on your mind?" onSeeAll={openSearch} />
        {filteredMind.length > 0 ? (
          <MindGridRail items={filteredMind} onPress={openMindSearch} />
        ) : (
          <DietEmptyNote />
        )}
        <PopularDishRail dishes={filteredSpecialDishes} onSeeAll={openSearch} onPress={openDishProduct} />
        {!filterActive ? (
          <>
            <FoodSectionHeader title="Explore Cuisines" onSeeAll={openSearch} />
            <CuisineRail cuisines={CUISINES} />
          </>
        ) : null}
        <FoodSectionHeader title="Meals & Combos" onSeeAll={openSearch} />
        {filteredCombos.length > 0 ? (
          <MealsComboRail combos={filteredCombos} onPress={openComboSearch} />
        ) : (
          <DietEmptyNote />
        )}
        <FoodSectionHeader title="Snacks & Beverages" onSeeAll={openSearch} />
        {filteredSnacks.length > 0 ? (
          <SnacksRail snacks={filteredSnacks} />
        ) : (
          <DietEmptyNote />
        )}
      </ScrollView>
      <FoodStatusBarStrip scrollY={scrollY} />
      <FoodBottomNav activeTab="FoodOrder" onChange={handleTabChange} onCartPress={openCart} onYouPress={openYou} />
    </View>
  );
}

export default OrderDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: vs(150),
  },
});
