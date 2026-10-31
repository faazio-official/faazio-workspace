import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashFallback } from '@/components/SplashFallback';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import LanguageSelectionScreen from '@/features/onboarding/LanguageSelectionScreen';
import { LocationScreen } from '@/features/auth/LocationScreen';
import { MainTabs } from './MainTabs';
import { useAuthStore } from '@/state/authStore';

export type { RootStackParamList, MainTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Non-initial routes are lazy-loaded so only the first-frame screens (Onboarding
// / Login → MainTabs/Home) are evaluated at startup. Each still suspends into the
// SplashFallback boundary below while its module evaluates on first navigation.
//
// First-run auth chain (Login → LanguageSelection → Location) is kept EAGER on
// purpose: <Suspense> wraps the whole Stack.Navigator, so the first lazy push in
// the flow would swap the entire native tree for SplashFallback mid-navigation
// (a stall/white-flash with no recovery) instead of sliding a screen in. Metro
// ships one bundle, so lazy only defers evaluation — no download is saved.
const lazyNamed = <T extends { [K in string]: unknown }>(
  loader: () => Promise<T>,
  name: keyof T & string,
) => lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType<any> })));

const SubAppScreen = lazyNamed(() => import('@/features/sub-app/SubAppScreen'), 'SubAppScreen');
const FoodStack = lazyNamed(() => import('./FoodStack'), 'FoodStack');
const ProductDetailScreen = lazyNamed(() => import('@/features/product/ProductDetailScreen'), 'ProductDetailScreen');
const SearchRouteScreen = lazyNamed(() => import('@/features/search/SearchRouteScreen'), 'SearchRouteScreen');
const CartScreen = lazyNamed(() => import('@/features/cart/CartScreen'), 'CartScreen');
const PaymentOptionsScreen = lazyNamed(() => import('@/features/cart/payment/PaymentOptionsScreen'), 'default');
const PaymentCallbackScreen = lazyNamed(() => import('@/features/cart/payment/PaymentCallbackScreen'), 'default');
const AddCardScreen = lazyNamed(() => import('@/features/cart/payment/AddCardScreen'), 'default');
const CategoryDrillInScreen = lazyNamed(() => import('@/features/catalog/CategoryDrillInScreen'), 'CategoryDrillInScreen');
const VendorDetailScreen = lazyNamed(() => import('@/features/catalog/VendorDetailScreen'), 'VendorDetailScreen');
const UserDetailsScreen = lazyNamed(() => import('@/features/profile/UserDetailsScreen'), 'UserDetailsScreen');
const SavedAddressesScreen = lazyNamed(() => import('@/features/profile/SavedAddressesScreen'), 'SavedAddressesScreen');
const DeleteAccountScreen = lazyNamed(() => import('@/features/profile/DeleteAccountScreen'), 'DeleteAccountScreen');
const RequestDataDeletionScreen = lazyNamed(() => import('@/features/profile/RequestDataDeletionScreen'), 'RequestDataDeletionScreen');
const MyOrdersScreen = lazyNamed(() => import('@/features/profile/MyOrdersScreen'), 'MyOrdersScreen');
const NotificationsScreen = lazyNamed(() => import('@/features/notifications/NotificationsScreen'), 'NotificationsScreen');
const OrderDetailsScreen = lazyNamed(() => import('@/features/profile/OrderDetailsScreen'), 'OrderDetailsScreen');
const RateVendorScreen = lazyNamed(() => import('@/features/profile/RateVendorScreen'), 'RateVendorScreen');
const YouScreen = lazyNamed(() => import('@/features/profile/YouScreen'), 'YouScreen');
const BloodDonorScreen = lazyNamed(() => import('@/features/pharma/blood-donor/BloodDonorScreen'), 'BloodDonorScreen');
const BloodDonorDetailsScreen = lazyNamed(() => import('@/features/pharma/blood-donor/DonorDetailsScreen'), 'DonorDetailsScreen');
const BloodRequestDescriptionScreen = lazyNamed(() => import('@/features/pharma/blood-donor/BloodRequestDescriptionScreen'), 'BloodRequestDescriptionScreen');
const FaazioRewardsScreen = lazyNamed(() => import('@/features/rewards/FaazioRewardsScreen'), 'FaazioRewardsScreen');
const SellWithUsScreen = lazyNamed(() => import('@/features/seller-onboarding/SellerRegistrationScreen'), 'SellerRegistrationScreen');
const SellerRequestsScreen = lazyNamed(() => import('@/features/seller-onboarding/SellerRequestsScreen'), 'SellerRequestsScreen');
const SellerRequestDetailScreen = lazyNamed(() => import('@/features/seller-onboarding/SellerRequestDetailScreen'), 'SellerRequestDetailScreen');
const SellerPlatformFeeRequestScreen = lazyNamed(() => import('@/features/seller-onboarding/SellerPlatformFeeRequestScreen'), 'SellerPlatformFeeRequestScreen');
const FeeChangeRequestsScreen = lazyNamed(() => import('@/features/seller-onboarding/FeeChangeRequestsScreen'), 'FeeChangeRequestsScreen');
const FavouritesScreen = lazyNamed(() => import('@/features/favourites/FavouritesScreen'), 'FavouritesScreen');
const DealsLandingScreen = lazyNamed(() => import('@/features/ecommerce/DealsLandingScreen'), 'DealsLandingScreen');
const PrescriptionFlowScreen = lazyNamed(() => import('@/features/pharma/prescription/PrescriptionFlowScreen'), 'PrescriptionFlowScreen');
const MedicalShopDetailsScreen = lazyNamed(() => import('@/features/pharma/MedicalShopDetailsScreen'), 'MedicalShopDetailsScreen');

export function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const wasAuthenticated = useRef(isAuthenticated);

  // A dead/revoked session is cleared by GatewayClient.recoverSession, which also resets
  // authStore. Follow that transition here so the customer app actually returns to Login
  // instead of sitting on an authenticated screen with no Keychain session.
  useEffect(() => {
    if (!hydrated) return;
    if (wasAuthenticated.current && !isAuthenticated) {
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
      wasAuthenticated.current = false;
    } else {
      wasAuthenticated.current = isAuthenticated;
    }
  }, [hydrated, isAuthenticated]);

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
            name="AddCard"
            component={AddCardScreen}
            options={{ animation: 'slide_from_bottom', animationDuration: 220 }}
          />
          <Stack.Screen
            name="PaymentCallback"
            component={PaymentCallbackScreen}
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
            name="DeleteAccount"
            component={DeleteAccountScreen}
            options={{ animation: 'slide_from_right', animationDuration: 220 }}
          />
          <Stack.Screen
            name="RequestDataDeletion"
            component={RequestDataDeletionScreen}
            options={{ animation: 'slide_from_right', animationDuration: 220 }}
          />
          <Stack.Screen
            name="MyOrders"
            component={MyOrdersScreen}
            options={{ animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
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
            name="SellerPlatformFeeRequest"
            component={SellerPlatformFeeRequestScreen}
            options={{ animation: 'slide_from_right', animationDuration: 220 }}
          />
          <Stack.Screen
            name="FeeChangeRequests"
            component={FeeChangeRequestsScreen}
            options={{ animation: 'slide_from_right', animationDuration: 220 }}
          />
          <Stack.Screen
            name="SellerRequests"
            component={SellerRequestsScreen}
            options={{ animation: 'slide_from_right', animationDuration: 220 }}
          />
          <Stack.Screen
            name="SellerRequestDetail"
            component={SellerRequestDetailScreen}
            options={{ animation: 'slide_from_right', animationDuration: 220 }}
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
