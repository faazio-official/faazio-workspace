import React, { useCallback } from 'react';
import { View, ScrollView, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSharedValue } from 'react-native-reanimated';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import { vs } from '@/utils/responsive';
import { PROMOS, CUISINES, MEALS_COMBOS, SNACKS_BEVERAGES } from '../mocks/orderFeed';
import { TODAYS_SPECIALS } from '../mocks/specials';
import { TOP_FOODS_TO_ORDER } from '../mocks/homeFeed';
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

type Props = NativeStackScreenProps<FoodStackParamList, 'OrderDetail'>;

/**
 * Order Food feed — the fully replaced home-style order screen:
 * 1. Location header  2. Hero promo carousel
 * 3. What's on your mind?  4. Popular Dishes  5. Explore Cuisines
 * 6. Meals & Combos  7. Snacks & Beverages
 * plus the fixed bottom nav (FoodOrder active) with a Cart entry point.
 */
export function OrderDetailScreen({ navigation }: Props) {
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

  const openSearch = useCallback(() => navigation.navigate('Search'), [navigation]);

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
        <PromoCarousel promos={PROMOS} />
        <FoodSectionHeader title="What's on your mind?" onSeeAll={openSearch} />
        <MindGridRail items={TOP_FOODS_TO_ORDER} />
        <PopularDishRail dishes={TODAYS_SPECIALS} onSeeAll={openSearch} />
        <FoodSectionHeader title="Explore Cuisines" onSeeAll={openSearch} />
        <CuisineRail cuisines={CUISINES} />
        <FoodSectionHeader title="Meals & Combos" onSeeAll={openSearch} />
        <MealsComboRail combos={MEALS_COMBOS} />
        <FoodSectionHeader title="Snacks & Beverages" onSeeAll={openSearch} />
        <SnacksRail snacks={SNACKS_BEVERAGES} />
      </ScrollView>
      <FoodStatusBarStrip scrollY={scrollY} />
      <FoodBottomNav activeTab="FoodOrder" onChange={handleTabChange} onCartPress={openCart} />
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
