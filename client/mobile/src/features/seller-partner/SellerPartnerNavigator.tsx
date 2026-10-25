import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SellerWebViewScreen } from './screens/SellerWebViewScreen';
import type { SellerStackParamList } from './navigation';

const Stack = createNativeStackNavigator<SellerStackParamList>();

/**
 * The seller product is a WebView shell over the web partner portal. The portal owns every seller
 * screen and the session; the native stack exists only for safe-area/navigation chrome and future
 * modal surfaces (no customer/delivery screens are ever mounted here).
 */
export function SellerPartnerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, statusBarStyle: 'dark' }}>
      <Stack.Screen name="Portal" component={SellerWebViewScreen} />
    </Stack.Navigator>
  );
}

export default SellerPartnerNavigator;
