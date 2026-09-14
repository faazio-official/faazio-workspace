import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSharedValue } from 'react-native-reanimated';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { SpecialDish } from '../mocks/types';
import { dishToProduct } from '../mocks/specials';
import { useCartStore } from '@/state/cartStore';
import { useFoodFilterStore } from '@/state/foodFilterStore';
import { createFoodSearchConfig } from '@/features/search/configs/foodSearchConfig';
import SearchScreen from '@/features/search/SearchScreen';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';
import FoodAddModeSheet, { type FoodAddMode } from '../components/FoodAddModeSheet';

type Props = NativeStackScreenProps<FoodStackParamList, 'Search'>;

const CART_EMOJI = '🍽️';

/**
 * Food sub-app search screen. Composes the shared SearchScreen shell with the
 * Food search config (dishes-only, toggle-less with dining filter chips) plus
 * the floating cart bar and the fixed 2-tab bottom nav (Search active).
 */
export function FoodSearchScreen({ navigation, route }: Props) {
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);
  const addToCart = useCartStore((s) => s.addToCart);
  const [pendingDish, setPendingDish] = useState<SpecialDish | null>(null);

  const onDishPress = useCallback(
    (dish: SpecialDish) => {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.navigate('ProductDetail', { product: dishToProduct(dish) });
    },
    [navigation],
  );

  const onDishAdd = useCallback((dish: SpecialDish) => setPendingDish(dish), []);

  const handleConfirm = useCallback(
    (mode: FoodAddMode) => {
      if (pendingDish) {
        addToCart(pendingDish.id, pendingDish.dishName, pendingDish.price, CART_EMOJI, { fulfilment: mode });
      }
      setPendingDish(null);
    },
    [pendingDish, addToCart],
  );

  const config = useMemo(
    () => createFoodSearchConfig({ onDishPress, onDishAdd, dietFilter }),
    [onDishPress, onDishAdd, dietFilter],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Home') {
        navigation.popToTop();
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

  const scrollY = useSharedValue(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  return (
    <View style={styles.container}>
      <SearchScreen
        config={config}
        onBack={handleBack}
        initialQuery={route.params?.initialQuery}
        initialMode={route.params?.initialMode}
        onScroll={onScroll}
      />
      <FoodStatusBarStrip scrollY={scrollY} />
      <FoodBottomNav activeTab="Search" onChange={handleTabChange} onCartPress={openCart} onYouPress={openYou} />
      <FoodAddModeSheet
        visible={!!pendingDish}
        itemName={pendingDish?.dishName}
        onClose={() => setPendingDish(null)}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

export default FoodSearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: foodTheme.background,
  },
});
