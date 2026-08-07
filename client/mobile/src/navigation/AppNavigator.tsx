import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { LocationScreen } from '../features/auth/LocationScreen';
import { MainTabs } from './MainTabs';
import { SubAppScreen } from '../features/sub-app/SubAppScreen';
import { ProductDetailScreen } from '../features/product/ProductDetailScreen';
import { FoodStack } from './FoodStack';
import type { RootStackParamList } from './types';

export type { RootStackParamList, MainTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Onboarding">
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Location" component={LocationScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ statusBarStyle: 'light' }} />
      <Stack.Screen
        name="SubApp"
        component={SubAppScreen}
        options={{ statusBarStyle: 'dark', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="FoodApp"
        component={FoodStack}
        options={{ statusBarStyle: 'dark', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ statusBarStyle: 'dark', animation: 'fade', presentation: 'transparentModal' }}
      />
    </Stack.Navigator>
  );
}
