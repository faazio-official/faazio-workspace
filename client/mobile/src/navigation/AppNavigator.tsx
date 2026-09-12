import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashFallback } from '@/components/SplashFallback';
import type { RootStackParamList } from './types';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { MainTabs } from './MainTabs';
import { useAuthStore } from '@/state/authStore';

export type { RootStackParamList, MainTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Non-initial routes are lazy-loaded so only the first-frame screens (Onboarding
// / Login → MainTabs/Home) are evaluated at startup. Each still suspends into the
// SplashFallback boundary below while its module evaluates on first navigation.
const lazyNamed = <T extends { [K in string]: unknown }>(
  loader: () => Promise<T>,
  name: keyof T & string,
) => lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType<any> })));

const LanguageSelectionScreen = lazyNamed(() => import('@/features/onboarding/LanguageSelectionScreen'), 'default');
const LocationScreen = lazyNamed(() => import('@/features/auth/LocationScreen'), 'LocationScreen');
const SubAppScreen = lazyNamed(() => import('@/features/sub-app/SubAppScreen'), 'SubAppScreen');
const FoodStack = lazyNamed(() => import('./FoodStack'), 'FoodStack');
const ProductDetailScreen = lazyNamed(() => import('@/features/product/ProductDetailScreen'), 'ProductDetailScreen');
const SearchRouteScreen = lazyNamed(() => import('@/features/search/SearchRouteScreen'), 'SearchRouteScreen');
const CartScreen = lazyNamed(() => import('@/features/cart/CartScreen'), 'CartScreen');
const PaymentOptionsScreen = lazyNamed(() => import('@/features/cart/payment/PaymentOptionsScreen'), 'default');
const MasterCategoriesScreen = lazyNamed(() => import('@/features/catalog/MasterCategoriesScreen'), 'MasterCategoriesScreen');
const UserDetailsScreen = lazyNamed(() => import('@/features/profile/UserDetailsScreen'), 'UserDetailsScreen');
const SavedAddressesScreen = lazyNamed(() => import('@/features/profile/SavedAddressesScreen'), 'SavedAddressesScreen');
const MyOrdersScreen = lazyNamed(() => import('@/features/profile/MyOrdersScreen'), 'MyOrdersScreen');
const OrderDetailsScreen = lazyNamed(() => import('@/features/profile/OrderDetailsScreen'), 'OrderDetailsScreen');
const YouScreen = lazyNamed(() => import('@/features/profile/YouScreen'), 'YouScreen');
const BloodDonorScreen = lazyNamed(() => import('@/features/pharma/blood-donor/BloodDonorScreen'), 'BloodDonorScreen');
const BloodRequestDescriptionScreen = lazyNamed(() => import('@/features/pharma/blood-donor/BloodRequestDescriptionScreen'), 'BloodRequestDescriptionScreen');
const FaazioRewardsScreen = lazyNamed(() => import('@/features/rewards/FaazioRewardsScreen'), 'FaazioRewardsScreen');
const SellWithUsScreen = lazyNamed(() => import('@/features/profile/SellWithUsScreen'), 'SellWithUsScreen');

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
            name="You"
            component={YouScreen}
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
          <Stack.Screen
            name="OrderDetails"
            component={OrderDetailsScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="BloodDonor"
            component={BloodDonorScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="BloodRequestDescription"
            component={BloodRequestDescriptionScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="FaazioRewards"
            component={FaazioRewardsScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="SellWithUs"
            component={SellWithUsScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
        </Stack.Navigator>
      </Suspense>
    </ErrorBoundary>
  );
}
