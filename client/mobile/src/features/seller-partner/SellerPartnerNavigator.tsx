import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SellerWebViewScreen } from './screens/SellerWebViewScreen';
import type { SellerStackParamList } from './navigation';

const Stack = createNativeStackNavigator<SellerStackParamList>();

interface SellerPartnerNavigatorProps {
  /** Called once the portal's seller session resolved (or the bounded fallback fired), to drop the
   *  branded splash so a returning seller lands straight on the dashboard. */
  onPortalReady?: () => void;
}

/**
 * The seller product is a WebView shell over the web partner portal. The portal owns every seller
 * screen and the session; the native stack exists only for safe-area/navigation chrome and future
 * modal surfaces (no customer/delivery screens are ever mounted here).
 */
export function SellerPartnerNavigator({ onPortalReady }: SellerPartnerNavigatorProps) {
  const renderPortal = useCallback(
    () => <SellerWebViewScreen onPortalReady={onPortalReady} />,
    [onPortalReady],
  );

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Portal">{renderPortal}</Stack.Screen>
    </Stack.Navigator>
  );
}

export default SellerPartnerNavigator;
