import React, { useCallback } from 'react';
import { View, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSharedValue } from 'react-native-reanimated';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { SpecialDish } from '../mocks/types';
import type { DiningRestaurant } from '../mocks/types';
import { dishToProduct } from '../mocks/specials';
import DiningScreen from './DiningScreen';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';

type Props = NativeStackScreenProps<FoodStackParamList, 'DiningDetail'>;

/**
 * Dedicated Dining view wrapper — renders the Dining content and owns the fixed
 * 4-tab bottom nav (Dining active). Home / Search / FoodOrder navigate to their
 * screens within the Food stack.
 */
export function DiningDetailScreen({ navigation, route }: Props) {
  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Home') {
        navigation.popToTop();
      } else if (tab === 'FoodOrder') {
        navigation.navigate('OrderDetail');
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

  const openDishProduct = useCallback(
    (dish: SpecialDish) => {
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('ProductDetail', { product: dishToProduct(dish) });
    },
    [navigation],
  );

  const openRestaurant = useCallback(
    (restaurant: DiningRestaurant) => {
      navigation.navigate('RestaurantProfile', { restaurant });
    },
    [navigation],
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
      <DiningScreen
        onBack={() => navigation.goBack()}
        autoScrollToGrid={route.params?.scrollToGrid}
        onRestaurantPress={openRestaurant}
        onDishPress={openDishProduct}
        onScroll={onScroll}
      />
      <FoodStatusBarStrip scrollY={scrollY} />
      <FoodBottomNav activeTab="Dining" onChange={handleTabChange} onCartPress={openCart} onYouPress={openYou} />
    </View>
  );
}

export default DiningDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: foodTheme.background,
  },
});
