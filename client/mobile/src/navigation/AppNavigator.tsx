import React, { lazy, Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashFallback } from '@/components/SplashFallback';
import type { RootStackParamList } from './types';

export type { RootStackParamList, MainTabParamList } from './types';

// Lazy-load every screen so cold start parses only the initial route.
const OnboardingScreen = lazy(() =>
  import('../features/onboarding/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
);
const LoginScreen = lazy(() =>
  import('../features/auth/LoginScreen').then((m) => ({ default: m.LoginScreen })),
);
const LocationScreen = lazy(() =>
  import('../features/auth/LocationScreen').then((m) => ({ default: m.LocationScreen })),
);
const MainTabs = lazy(() =>
  import('./MainTabs').then((m) => ({ default: m.MainTabs })),
);
const SubAppScreen = lazy(() =>
  import('../features/sub-app/SubAppScreen').then((m) => ({ default: m.SubAppScreen })),
);
const FoodStack = lazy(() =>
  import('./FoodStack').then((m) => ({ default: m.FoodStack })),
);
const ProductDetailScreen = lazy(() =>
  import('../features/product/ProductDetailScreen').then((m) => ({ default: m.ProductDetailScreen })),
);
const SearchRouteScreen = lazy(() =>
  import('../features/search/SearchRouteScreen').then((m) => ({ default: m.SearchRouteScreen })),
);
const CartScreen = lazy(() =>
  import('../features/cart/CartScreen').then((m) => ({ default: m.CartScreen })),
);

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<SplashFallback />}>
        <Stack.Navigator
          screenOptions={{ headerShown: false, statusBarStyle: 'light' }}
          initialRouteName="Onboarding"
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Location" component={LocationScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="SubApp"
            component={SubAppScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="FoodApp"
            component={FoodStack}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ animation: 'fade', presentation: 'transparentModal' }}
          />
          <Stack.Screen
            name="Search"
            component={SearchRouteScreen}
            options={{ animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </Suspense>
    </ErrorBoundary>
  );
}
