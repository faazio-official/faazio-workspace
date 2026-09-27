import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FoodHomeScreen } from '../features/food/screens/FoodHomeScreen';
import { FoodSearchScreen } from '../features/food/screens/FoodSearchScreen';
import { RestaurantProfileScreen } from '../features/food/screens/RestaurantProfileScreen';
import { RestaurantOffersScreen } from '../features/food/screens/RestaurantOffersScreen';
import { RestaurantMenuScreen } from '../features/food/screens/RestaurantMenuScreen';
import type { FoodStackParamList } from './types';

const FoodStackNav = createNativeStackNavigator<FoodStackParamList>();

/**
 * Self-contained Food sub-app navigator. Bypasses SubAppWrapper: the root
 * FoodHome owns its own location header + 2-tab bottom nav and the dining-first
 * home content (carousels + order rails + dining grid). Search, the restaurant
 * profile drill-in, and the profile's "View All" offers page complete the stack.
 */
export function FoodStack() {
  return (
    <FoodStackNav.Navigator
      screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 180, statusBarStyle: 'dark' }}
    >
      <FoodStackNav.Screen name="FoodHome" component={FoodHomeScreen} />
      <FoodStackNav.Screen name="Search" component={FoodSearchScreen} />
      <FoodStackNav.Screen name="RestaurantProfile" component={RestaurantProfileScreen} />
      <FoodStackNav.Screen name="RestaurantOffers" component={RestaurantOffersScreen} />
      <FoodStackNav.Screen name="RestaurantMenu" component={RestaurantMenuScreen} />
    </FoodStackNav.Navigator>
  );
}

export default FoodStack;
