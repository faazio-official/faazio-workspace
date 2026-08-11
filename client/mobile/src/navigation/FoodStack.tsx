import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FoodHomeScreen } from '../features/food/screens/FoodHomeScreen';
import { FoodSearchScreen } from '../features/food/screens/FoodSearchScreen';
import { DiningDetailScreen } from '../features/food/screens/DiningDetailScreen';
import { OrderDetailScreen } from '../features/food/screens/OrderDetailScreen';
import type { FoodStackParamList } from './types';

const FoodStackNav = createNativeStackNavigator<FoodStackParamList>();

/**
 * Self-contained Food sub-app navigator. Bypasses SubAppWrapper: the root
 * FoodHome owns its own location header + 5-tab bottom nav, and the hero cards
 * push into the Dining / Order / Search screens.
 */
export function FoodStack() {
  return (
    <FoodStackNav.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right', statusBarStyle: 'dark' }}
    >
      <FoodStackNav.Screen name="FoodHome" component={FoodHomeScreen} />
      <FoodStackNav.Screen name="Search" component={FoodSearchScreen} />
      <FoodStackNav.Screen name="DiningDetail" component={DiningDetailScreen} />
      <FoodStackNav.Screen name="OrderDetail" component={OrderDetailScreen} />
    </FoodStackNav.Navigator>
  );
}

export default FoodStack;
