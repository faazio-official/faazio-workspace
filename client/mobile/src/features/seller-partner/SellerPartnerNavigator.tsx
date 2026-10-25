import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SellerLoginScreen } from './screens/SellerLoginScreen';
import { SellerDashboardScreen } from './screens/SellerDashboardScreen';
import { SellerOrdersScreen } from './screens/SellerOrdersScreen';
import { SellerOrderDetailScreen } from './screens/SellerOrderDetailScreen';
import type { SellerStackParamList } from './navigation';

const Stack = createNativeStackNavigator<SellerStackParamList>();

/** Isolated seller stack — customer and delivery screens are never mounted here. */
export function SellerPartnerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, statusBarStyle: 'dark' }} initialRouteName="Login">
      <Stack.Screen name="Login" component={SellerLoginScreen} />
      <Stack.Screen name="Dashboard" component={SellerDashboardScreen} />
      <Stack.Screen name="Orders" component={SellerOrdersScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="OrderDetail" component={SellerOrderDetailScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

export default SellerPartnerNavigator;
