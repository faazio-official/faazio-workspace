import React, { useCallback, useEffect, useState } from 'react';
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

/**
 * The branded layer-2 splash covers the WebView until the portal's seller session resolves — the
 * portal navigates to `/seller/*` (returning seller) or the WebView's bounded auth fallback fires
 * (signed-out seller lands on `/login`) — so the sign-in page never flashes before the dashboard.
 * The cold start is native splash → `SplashFallback` (royal) → dashboard or sign-in. The minimum
 * keeps the credit line visible on a fast auth resolve; the maximum is a last-resort release if the
 * WebView never reports (the WebView's own loader/retry takes over).
 */
const SPLASH_MIN_DISPLAY_MS = 1200;
const SPLASH_MAX_WAIT_MS = 5000;

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
 * seller session, so there is no native auth hydration gate here — instead the branded layer-2
 * splash stays over the WebView until the portal reports its auth resolved (see
 * `SellerWebViewScreen.onPortalReady`), which is what prevents the login-page flash.
 */
export default function SellerPartnerApp() {
  const [fontsLoaded] = useAppFonts();
  const [portalReady, setPortalReady] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [maxWaitDone, setMaxWaitDone] = useState(false);

  useEffect(() => {
    const min = setTimeout(() => setMinSplashDone(true), SPLASH_MIN_DISPLAY_MS);
    const max = setTimeout(() => setMaxWaitDone(true), SPLASH_MAX_WAIT_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, []);

  const markPortalReady = useCallback(() => setPortalReady(true), []);

  if (!fontsLoaded) {
    return <SplashFallback variant="royal" />;
  }

  const splashVisible = !minSplashDone || (!portalReady && !maxWaitDone);

  return (
    <SafeAreaProvider>
      <Layout>
        <StatusBar barStyle={splashVisible ? 'light-content' : 'dark-content'} />
        <ErrorBoundary scope="Seller">
          <NavigationContainer theme={navigationTheme}>
            <SellerPartnerNavigator onPortalReady={markPortalReady} />
          </NavigationContainer>
        </ErrorBoundary>
      </Layout>
      {splashVisible ? (
        <View style={styles.splashOverlay}>
          <SplashFallback variant="royal" />
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  /**
   * Overlay, not a conditional navigator: the WebView must mount immediately so
   * the splash only hides the first paint instead of delaying the load.
   */
  splashOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
