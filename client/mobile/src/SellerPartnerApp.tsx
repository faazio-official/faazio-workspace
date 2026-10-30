import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SellerPartnerNavigator } from './features/seller-partner/SellerPartnerNavigator';
import { SplashFallback } from './components/SplashFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppFonts, resolveFontFamily } from './theme/fonts';
import { useBottomInset } from './utils/responsive';
import { installGlobalErrorHandlers } from './services/crashReporting';

// Release crash observability for the seller partner app (see services/crashReporting.ts).
installGlobalErrorHandlers('seller');

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
 * Dedicated Seller Partner root. Built as its own JS entry (`APP_VARIANT=seller`) so the customer
 * and delivery navigators are never mounted in the seller experience. The web portal owns the
 * seller session, so there is no native auth hydration gate here.
 */
export default function SellerPartnerApp() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return <SplashFallback variant="royal" />;
  }

  return (
    <SafeAreaProvider>
      <Layout>
        <StatusBar barStyle="dark-content" />
        <ErrorBoundary scope="Seller">
          <NavigationContainer theme={navigationTheme}>
            <SellerPartnerNavigator />
          </NavigationContainer>
        </ErrorBoundary>
      </Layout>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
});
