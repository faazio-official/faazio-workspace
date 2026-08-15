import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSharedValue } from 'react-native-reanimated';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';
import { createFoodSearchConfig } from '@/features/search/configs/foodSearchConfig';
import SearchScreen from '@/features/search/SearchScreen';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';

type Props = NativeStackScreenProps<FoodStackParamList, 'Search'>;

/**
 * Food sub-app search screen. Composes the shared SearchScreen shell with the
 * Food search config (Restaurants / Dishes toggle, dining filter chips) plus
 * the floating cart bar and the fixed 4-tab bottom nav (Search active).
 */
export function FoodSearchScreen({ navigation, route }: Props) {
  const onRestaurantPress = useCallback(
    (restaurant: DiningRestaurant) => navigation.navigate('OrderDetail'),
    [navigation],
  );
  const onDishPress = useCallback(
    (dish: SpecialDish) => navigation.navigate('OrderDetail'),
    [navigation],
  );

  const config = useMemo(
    () => createFoodSearchConfig({ onRestaurantPress, onDishPress }),
    [onRestaurantPress, onDishPress],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Home') {
        navigation.popToTop();
      } else if (tab === 'Dining') {
        navigation.navigate('DiningDetail');
      } else if (tab === 'FoodOrder') {
        navigation.navigate('OrderDetail');
      }
    },
    [navigation],
  );

  const openCart = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Cart');
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
      <FoodBottomNav activeTab="Search" onChange={handleTabChange} onCartPress={openCart} />
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
