import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';
import { createFoodSearchConfig } from '@/features/search/configs/foodSearchConfig';
import SearchScreen from '@/features/search/SearchScreen';
import FloatingCartBar from '@/features/search/FloatingCartBar';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';

type Props = NativeStackScreenProps<FoodStackParamList, 'Search'>;

/**
 * Food sub-app search screen. Composes the shared SearchScreen shell with the
 * Food search config (Restaurants / Dishes toggle, dining filter chips) plus
 * the floating cart bar and the fixed 4-tab bottom nav (Search active).
 */
export function FoodSearchScreen({ navigation }: Props) {
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
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Cart');
      }
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <SearchScreen config={config} onBack={handleBack} />
      <FloatingCartBar accentColor={foodTheme.primary} bottomOffset={vs(100)} onPress={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Cart')} />
      <FoodBottomNav activeTab="Search" onChange={handleTabChange} />
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
