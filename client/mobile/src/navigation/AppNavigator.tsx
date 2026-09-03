import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashFallback } from '@/components/SplashFallback';
import type { RootStackParamList } from './types';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { LocationScreen } from '@/features/auth/LocationScreen';
import LanguageSelectionScreen from '@/features/onboarding/LanguageSelectionScreen';
import { MainTabs } from './MainTabs';
import { SubAppScreen } from '@/features/sub-app/SubAppScreen';
import { FoodStack } from './FoodStack';
import { ProductDetailScreen } from '@/features/product/ProductDetailScreen';
import { SearchRouteScreen } from '@/features/search/SearchRouteScreen';
import { CartScreen } from '@/features/cart/CartScreen';
import PaymentOptionsScreen from '@/features/cart/payment/PaymentOptionsScreen';
import { MasterCategoriesScreen } from '@/features/catalog/MasterCategoriesScreen';
import { UserDetailsScreen } from '@/features/profile/UserDetailsScreen';
import { SavedAddressesScreen } from '@/features/profile/SavedAddressesScreen';
import { MyOrdersScreen } from '@/features/profile/MyOrdersScreen';
import { useAuthStore } from '@/state/authStore';

export type { RootStackParamList, MainTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <ErrorBoundary>
      <Suspense fallback={<SplashFallback />}>
        <Stack.Navigator
          screenOptions={{ headerShown: false, statusBarStyle: 'dark' }}
          initialRouteName={isAuthenticated ? 'MainTabs' : 'Onboarding'}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
          <Stack.Screen name="Location" component={LocationScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="SubApp"
            component={SubAppScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="MasterCategories"
            component={MasterCategoriesScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="FoodApp"
            component={FoodStack}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="Search"
            component={SearchRouteScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="PaymentOptions"
            component={PaymentOptionsScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="UserDetails"
            component={UserDetailsScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="SavedAddresses"
            component={SavedAddressesScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="MyOrders"
            component={MyOrdersScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
        </Stack.Navigator>
      </Suspense>
    </ErrorBoundary>
  );
}
