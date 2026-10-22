import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeliveryPartnerNavigator } from './features/delivery-partner/DeliveryPartnerNavigator';
import { SplashFallback } from './components/SplashFallback';
import { useAuthStore } from './state/authStore';
import { useAppFonts, resolveFontFamily } from './theme/fonts';
import { useBottomInset } from './utils/responsive';

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#f8fafc' },
  fonts: {
    regular: { fontFamily: resolveFontFamily('400'), fontWeight: '400' as const },
    medium: { fontFamily: resolveFontFamily('500'), fontWeight: '500' as const },
    bold: { fontFamily: resolveFontFamily('700'), fontWeight: '700' as const },
    heavy: { fontFamily: resolveFontFamily('800'), fontWeight: '800' as const },
    heading: { fontFamily: resolveFontFamily('900'), fontWeight: '900' as const },
  },
};

function Layout({ children }: { children: React.ReactNode }) {
  const bottomInset = useBottomInset();
  return <View style={[styles.container, { paddingBottom: bottomInset }]}>{children}</View>;
}

/**
 * Dedicated Delivery Partner root. Built as its own JS entry (`APP_VARIANT=delivery`) so the
 * customer navigator, stores and screens are never mounted in the partner experience.
 */
export default function DeliveryPartnerApp() {
  const [fontsLoaded] = useAppFonts();
  const [ready, setReady] = useState(false);
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    let active = true;
    void hydrateAuth().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [hydrateAuth]);

  if (!ready || !fontsLoaded) {
    return <SplashFallback variant="royal" />;
  }

  return (
    <SafeAreaProvider>
      <Layout>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer theme={navigationTheme}>
          <DeliveryPartnerNavigator />
        </NavigationContainer>
      </Layout>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
});
