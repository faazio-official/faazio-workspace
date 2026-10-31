import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, View, StyleSheet, AppState } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import {
  handleNavigationStateChange,
  replayPendingNavigation,
} from './src/navigation/offlineNavigationGuard';
import { SplashFallback } from './src/components/SplashFallback';
import { OfflinePage } from './src/components/shared/OfflinePage';
import { OfflineToast } from './src/components/shared/OfflineToast';
import { useConnectivityStore } from './src/state/connectivityStore';
import { useAuthStore } from './src/state/authStore';
import { useRemoteConfigStore } from './src/state/remoteConfigStore';
import { useLiveLocation } from './src/hooks/useLiveLocation';
import { useLanguageStore } from './src/state/languageStore';
import { hydrateUserStores } from './src/services/sessionStores';
import { startCustomerPush } from './src/services/customerPush';
import { useAppFonts, resolveFontFamily } from './src/theme/fonts';
import { useBottomInset } from './src/utils/responsive';
import { installGlobalErrorHandlers } from './src/services/crashReporting';
import { flushPendingPaymentCallback, startPaymentCallbackLinks } from './src/services/paymentLinks';
import { reconcilePendingUpiOrder } from './src/services/paymentReconciliation';

// Branded splash stays visible for at least this long on cold start. The native
// launch theme (Android splash theme / iOS LaunchScreen) hands off to this JS
// splash, which is the single owner of the branded cold-start experience.
const SPLASH_MIN_DISPLAY_MS = 5000;

// Routes unhandled JS/render errors to the gateway /errors sink (release observability). Runs at
// module scope so it is installed before any screen mounts.
installGlobalErrorHandlers('app');

/** Resolves `promise` unless it doesn't settle within `ms` (rejects instead). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
  },
  fonts: {
    regular: {
      fontFamily: resolveFontFamily('400'),
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: resolveFontFamily('500'),
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: resolveFontFamily('700'),
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: resolveFontFamily('800'),
      fontWeight: '800' as const,
    },
    heading: {
      fontFamily: resolveFontFamily('900'),
      fontWeight: '900' as const,
    },
  },
};

/**
 * Single owner of the bottom safe-area reservation. The window is edge-to-edge
 * (transparent Android nav bar), so content would otherwise slip under the
 * gesture pill / 3-button bar and the iOS home indicator. Reserving the inset
 * once here — instead of in every screen/bottom navbar — keeps the top
 * full-bleed (per-screen `insets.top` still applies) while every bottom edge
 * stays clear. Modals render in separate native windows, so those keep their
 * own insets.
 */
function AppLayout({ children }: { children: React.ReactNode }) {
  const bottomInset = useBottomInset();
  return (
    <View style={[styles.container, { paddingBottom: bottomInset }]}>{children}</View>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const [ready, setReady] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const mountedAt = useRef(Date.now());
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLanguage = useLanguageStore((s) => s.hydrate);
  const fetchRemoteConfig = useRemoteConfigStore((s) => s.fetchConfig);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const hasConnected = useConnectivityStore((s) => s.hasConnected);
  const navigationBlocked = useConnectivityStore((s) => s.navigationBlocked);
  const startMonitoring = useConnectivityStore((s) => s.startMonitoring);
  // Hydrate the last fix and poll only while foregrounded (never prompts on launch).
  useLiveLocation();

  // Probe `/health` on mount, then poll while foregrounded so a connectivity drop is noticed
  // without a NetInfo dependency (see connectivityStore).
  useEffect(() => {
    startMonitoring();
    return () => useConnectivityStore.getState().stopMonitoring();
  }, [startMonitoring]);

  // When connectivity returns with a navigation blocked, replay the destination the user intended —
  // its screens mount fresh and run their normal HTTP reads.
  useEffect(() => {
    if (isOnline === true && navigationBlocked) {
      replayPendingNavigation();
    }
  }, [isOnline, navigationBlocked]);

  // UPI return leg: listen for `faazio://payment/callback` (warm + cold start). The callback page
  // re-verifies against the server, so a spoofed URL can never mark an order paid.
  useEffect(() => startPaymentCallbackLinks(), []);

  // Flush a callback queued while the navigator/session was not ready (e.g. cold start → login).
  useEffect(() => {
    if (isAuthenticated) flushPendingPaymentCallback();
  }, [isAuthenticated]);

  // Cold-start reconciliation: if the app was killed mid-UPI payment, the Razorpay webhook still
  // settles the order server-side. On login and on every foreground, re-check the persisted order
  // and route to the authoritative result (once per foreground).
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const check = async () => {
      const outcome = await reconcilePendingUpiOrder();
      if (!active || outcome.kind === 'none') return;
      if (!navigationRef.isReady()) return;
      if (navigationRef.getCurrentRoute()?.name === 'PaymentCallback') return;
      navigationRef.navigate('PaymentCallback', { orderId: outcome.orderId });
    };
    void check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    // Best-effort central remote config (superadmin-managed app settings). Fetched in parallel with
    // the session/language hydrations but never awaited, so startup is never blocked: the branded
    // splash's minimum 5 s window covers the fetch, and a failure keeps the bake-time defaults. The
    // 4 s timeout mirrors the hydration bound so a black-holed connection can't strand the fetch.
    void withTimeout(fetchRemoteConfig(), 4000, 'remoteConfig').catch(() => {});
    (async () => {
      try {
        await Promise.all([
          withTimeout(hydrateAuth(), 4000, 'hydrateAuth'),
          withTimeout(hydrateLanguage(), 4000, 'hydrateLanguage'),
        ]);
      } catch (error) {
        // A hanging/failing storage module must not block startup or become a
        // silent unhandled rejection — proceed with default (unauthenticated).
        if (__DEV__) {
          console.warn('[Faazio:hydrate]', error);
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [hydrateAuth, hydrateLanguage, fetchRemoteConfig]);

  useEffect(() => {
    if (fontsLoaded && ready) {
      const remaining = SPLASH_MIN_DISPLAY_MS - (Date.now() - mountedAt.current);
      if (remaining <= 0) {
        setMinSplashDone(true);
        return;
      }
      // Keep the branded splash up for the minimum display window.
      const timer = setTimeout(() => setMinSplashDone(true), remaining);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, ready]);

  // Session-scoped server state: pull the user's cart/favourites/orders/rewards after login or a
  // restored session, and register this device for push. Both are best-effort and independent.
  useEffect(() => {
    if (!isAuthenticated) return;
    void hydrateUserStores().catch(() => {});
    let active = true;
    let stopPush: (() => void) | undefined;
    void startCustomerPush()
      .then((cleanup) => {
        if (active) stopPush = cleanup;
        else cleanup();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      stopPush?.();
    };
  }, [isAuthenticated]);

  if (!ready) {
    return <SplashFallback variant="royal" />;
  }

  // Cold start while already offline: show the offline page immediately instead of a blank/loading
  // screen. `hasConnected` false means we have never been online this session, so this is a cold
  // start — a mid-session drop keeps the mounted navigator and only surfaces the toast/blocker.
  if (isOnline === false && !hasConnected) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <OfflinePage />
      </SafeAreaProvider>
    );
  }

  if (!minSplashDone) {
    return <SplashFallback variant="royal" />;
  }

  return (
    <SafeAreaProvider>
      <AppLayout>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          onReady={flushPendingPaymentCallback}
          onStateChange={handleNavigationStateChange}
        >
          <AppNavigator />
        </NavigationContainer>
        {isOnline === false ? <OfflineToast /> : null}
        {navigationBlocked && isOnline === false ? (
          <View style={styles.blocker}>
            <OfflinePage />
          </View>
        ) : null}
      </AppLayout>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  blocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
  },
});
