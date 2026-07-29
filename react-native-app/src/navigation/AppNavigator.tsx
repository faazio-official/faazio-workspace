import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { LocationScreen } from '../features/auth/LocationScreen';
import { MainDashboardScreen } from '../features/home/MainDashboardScreen';

// Navigation Types
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Location: undefined;
  MainTabs: undefined;
  ProductDetail: { productId: string };
  BookingConfirmation: { bookingId: string };
  PrescriptionUpload: undefined;
  Cart: undefined;
  Checkout: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, statusBarHidden: true }} initialRouteName="Onboarding">
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Location" component={LocationScreen} />
      <Stack.Screen name="MainTabs" component={MainDashboardScreen} />
    </Stack.Navigator>
  );
}


