import React, { Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashFallback } from '@/components/SplashFallback';
import { navigationRef } from './navigationRef';
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
const CategoryDrillInScreen = lazyNamed(() => import('@/features/catalog/CategoryDrillInScreen'), 'CategoryDrillInScreen');
const VendorDetailScreen = lazyNamed(() => import('@/features/catalog/VendorDetailScreen'), 'VendorDetailScreen');
const UserDetailsScreen = lazyNamed(() => import('@/features/profile/UserDetailsScreen'), 'UserDetailsScreen');
const SavedAddressesScreen = lazyNamed(() => import('@/features/profile/SavedAddressesScreen'), 'SavedAddressesScreen');
const MyOrdersScreen = lazyNamed(() => import('@/features/profile/MyOrdersScreen'), 'MyOrdersScreen');
const OrderDetailsScreen = lazyNamed(() => import('@/features/profile/OrderDetailsScreen'), 'OrderDetailsScreen');
const RateVendorScreen = lazyNamed(() => import('@/features/profile/RateVendorScreen'), 'RateVendorScreen');
const YouScreen = lazyNamed(() => import('@/features/profile/YouScreen'), 'YouScreen');
const BloodDonorScreen = lazyNamed(() => import('@/features/pharma/blood-donor/BloodDonorScreen'), 'BloodDonorScreen');
const BloodDonorDetailsScreen = lazyNamed(() => import('@/features/pharma/blood-donor/DonorDetailsScreen'), 'DonorDetailsScreen');
const BloodRequestDescriptionScreen = lazyNamed(() => import('@/features/pharma/blood-donor/BloodRequestDescriptionScreen'), 'BloodRequestDescriptionScreen');
const FaazioRewardsScreen = lazyNamed(() => import('@/features/rewards/FaazioRewardsScreen'), 'FaazioRewardsScreen');
const SellWithUsScreen = lazyNamed(() => import('@/features/profile/SellWithUsScreen'), 'SellWithUsScreen');
const FavouritesScreen = lazyNamed(() => import('@/features/favourites/FavouritesScreen'), 'FavouritesScreen');
const DealsLandingScreen = lazyNamed(() => import('@/features/ecommerce/DealsLandingScreen'), 'DealsLandingScreen');
const PrescriptionFlowScreen = lazyNamed(() => import('@/features/pharma/prescription/PrescriptionFlowScreen'), 'PrescriptionFlowScreen');
const MedicalShopDetailsScreen = lazyNamed(() => import('@/features/pharma/MedicalShopDetailsScreen'), 'MedicalShopDetailsScreen');

export function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <ErrorBoundary
      scope="App"
      onReset={() => {
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        }
      }}
    >
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
            name="CategoryDrillIn"
            component={CategoryDrillInScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="VendorDetails"
            component={VendorDetailScreen}
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
            name="RateVendor"
            component={RateVendorScreen}
            options={{ animation: 'slide_from_bottom', animationDuration: 220 }}
          />
          <Stack.Screen
            name="BloodDonor"
            component={BloodDonorScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="BloodDonorDetails"
            component={BloodDonorDetailsScreen}
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
          <Stack.Screen
            name="Favourites"
            component={FavouritesScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="DealsLanding"
            component={DealsLandingScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="PrescriptionFlow"
            component={PrescriptionFlowScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="MedicalShopDetails"
            component={MedicalShopDetailsScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
        </Stack.Navigator>
      </Suspense>
    </ErrorBoundary>
  );
}
