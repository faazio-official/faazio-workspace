import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/state/authStore';
import { deliveryNavigationRef } from './navigationRef';
import { PhoneEntryScreen } from './screens/PhoneEntryScreen';
import { OtpVerifyScreen } from './screens/OtpVerifyScreen';
import { RegistrationFormScreen } from './screens/RegistrationFormScreen';
import { SubmissionSuccessScreen } from './screens/SubmissionSuccessScreen';
import { AcceptRejectScreen } from './screens/AcceptRejectScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { RouteScreen } from './screens/RouteScreen';
import { PayoutScreen } from './screens/PayoutScreen';
import type { DeliveryPartnerStackParamList } from './navigation';

const Stack = createNativeStackNavigator<DeliveryPartnerStackParamList>();

/** Isolated partner stack — never mounts a customer-app screen. */
export function DeliveryPartnerNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const wasAuthenticated = useRef(isAuthenticated);

  // GatewayClient.recoverSession clears the Keychain + authStore when a rider's token is dead.
  // Return the partner app to phone entry instead of leaving it on a dashboard with no session.
  useEffect(() => {
    if (!hydrated) return;
    if (wasAuthenticated.current && !isAuthenticated) {
      if (deliveryNavigationRef.isReady()) {
        deliveryNavigationRef.reset({ index: 0, routes: [{ name: 'PhoneEntry' }] });
      }
      wasAuthenticated.current = false;
    } else {
      wasAuthenticated.current = isAuthenticated;
    }
  }, [hydrated, isAuthenticated]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, statusBarStyle: 'dark' }} initialRouteName="PhoneEntry">
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="Register" component={RegistrationFormScreen} />
      <Stack.Screen name="SubmissionSuccess" component={SubmissionSuccessScreen} />
      <Stack.Screen name="AcceptReject" component={AcceptRejectScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Route" component={RouteScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Payouts" component={PayoutScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
