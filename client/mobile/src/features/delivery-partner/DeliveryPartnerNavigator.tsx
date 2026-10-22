import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PhoneEntryScreen } from './screens/PhoneEntryScreen';
import { OtpVerifyScreen } from './screens/OtpVerifyScreen';
import { RegistrationFormScreen } from './screens/RegistrationFormScreen';
import { SubmissionSuccessScreen } from './screens/SubmissionSuccessScreen';
import { AcceptRejectScreen } from './screens/AcceptRejectScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { RouteScreen } from './screens/RouteScreen';
import type { DeliveryPartnerStackParamList } from './navigation';

const Stack = createNativeStackNavigator<DeliveryPartnerStackParamList>();

/** Isolated partner stack — never mounts a customer-app screen. */
export function DeliveryPartnerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, statusBarStyle: 'dark' }} initialRouteName="PhoneEntry">
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="Register" component={RegistrationFormScreen} />
      <Stack.Screen name="SubmissionSuccess" component={SubmissionSuccessScreen} />
      <Stack.Screen name="AcceptReject" component={AcceptRejectScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Route" component={RouteScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
