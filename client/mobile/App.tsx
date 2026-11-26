import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar, View, StyleSheet, AppState } from 'react-native';
import { NavigationContainer, type Theme } from '@react-navigation/native';
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
import { ServiceAreaBlockedPage } from './src/components/shared/ServiceAreaBlockedPage';
import { useConnectivityStore } from './src/state/connectivityStore';
import { useAuthStore } from './src/state/authStore';
import { useLocationStore } from './src/state/locationStore';
import { useAddressesStore } from './src/state/addressesStore';
import { useRemoteConfigStore } from './src/state/remoteConfigStore';
import {
  useServiceabilityStore,
  isServiceabilityPending,
  originKeyFor,
} from './src/state/serviceabilityStore';
import { useLiveLocation } from './src/hooks/useLiveLocation';
import { useCustomerLocationSync } from './src/hooks/useCustomerLocationSync';
import { useServiceability } from './src/hooks/useServiceability';
import { useLanguageStore } from './src/state/languageStore';
import { useOnboardingStore } from './src/state/onboardingStore';
import { hydrateUserStores } from './src/services/sessionStores';
import { startCustomerPush } from './src/services/customerPush';
import {
  bootstrapCalling,
  flushPendingActiveCall,
  shutdownCalling,
} from './src/features/customer/calling/callController';
import { useAppFonts, createNavigationFonts } from './src/theme/fonts';
import { useBottomInset } from './src/utils/responsive';
import { useThemeMode } from './src/hooks/useThemeMode';
import { createNavigationTheme } from './src/theme/theme';
import { installGlobalErrorHandlers } from './src/services/crashReporting';
import { flushPendingPaymentCallback, startPaymentCallbackLinks } from './src/services/paymentLinks';
import { reconcilePendingUpiOrder } from './src/services/paymentReconciliation';

// Branded splash stays visible for at least this long on cold start. The native
// launch theme (Android splash theme / iOS LaunchScreen) hands off to this JS
// splash, which is the single owner of the branded cold-start experience.
const SPLASH_MIN_DISPLAY_MS = 3000;

// Extra bound on holding the splash for the first coverage decision. The silent fix it waits on has
// its own 10 s native timeout, so this sits above that: the splash covers the real fix, and only a
// hung storage/native call can reach this ceiling. Showing the gate late is far better than flashing
// a catalogue that cannot deliver here.
const COVERAGE_HOLD_TIMEOUT_MS = 12000;

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

/**
 * Single owner of the bottom safe-area reservation. The window is edge-to-edge
 * (transparent Android nav bar), so content would otherwise slip under the
 * gesture pill / 3-button bar and the iOS home indicator. Reserving the inset
 * once here — instead of in every screen/bottom navbar — keeps the top
 * full-bleed (per-screen `insets.top` still applies) while every bottom edge
 * stays clear. Modals render in separate native windows, so those keep their
 * own insets.
 */
function AppLayout({
  children,
  backgroundColor,
}: {
  children: React.ReactNode;
  backgroundColor: string;
}) {
  const bottomInset = useBottomInset();
  return (
    <View style={[styles.container, { backgroundColor, paddingBottom: bottomInset }]}>
      {children}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const [ready, setReady] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const mountedAt = useRef(Date.now());
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLanguage = useLanguageStore((s) => s.hydrate);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const { palette, barStyle } = useThemeMode();
  const language = useLanguageStore((s) => s.language);
  const navigationTheme = useMemo(
    () => createNavigationTheme(createNavigationFonts(language === 'ta') as Theme['fonts']),
    [language],
  );
  const fetchRemoteConfig = useRemoteConfigStore((s) => s.fetchConfig);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const locationStatus = useLocationStore((s) => s.status);
  const activeLocation = useLocationStore((s) => s.activeLocation);
  const fixAttemptedAt = useLocationStore((s) => s.fixAttemptedAt);
  const serviceabilityStatus = useServiceabilityStore((s) => s.status);
  const serviceabilityChecking = useServiceabilityStore((s) => s.checking);
  const serviceabilityLocationKey = useServiceabilityStore((s) => s.locationKey);
  const serviceabilityReason = useServiceabilityStore((s) => s.reason);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const hasConnected = useConnectivityStore((s) => s.hasConnected);
  const navigationBlocked = useConnectivityStore((s) => s.navigationBlocked);
  const startMonitoring = useConnectivityStore((s) => s.startMonitoring);
  // Hydrate the last fix and poll only while foregrounded (never prompts on launch).
  useLiveLocation();
  // Cache the saved addresses so proximity auto-select can match a fix against them without a
  // network round-trip on every poll. Server-only: an offline read keeps the last known list.
  useEffect(() => {
    if (!isAuthenticated) return;
    void useAddressesStore.getState().refresh();
  }, [isAuthenticated]);
  // Match the live origin against the superadmin-enabled district coverage. Runs under the splash
  // on a cold start, so the hard gate is already decided by the time the navigator is visible.
  useServiceability();
  // Report the covered origin's state/district/pincode so the admin directory gets a real location
  // and the stable customer id. Quiet until the origin is serviceable with a pincode.
  useCustomerLocationSync();

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
    // splash's minimum 3 s window covers the fetch, and a failure keeps the bake-time defaults. The
    // 4 s timeout mirrors the hydration bound so a black-holed connection can't strand the fetch.
    void withTimeout(fetchRemoteConfig(), 4000, 'remoteConfig').catch(() => {});
    (async () => {
      try {
        await Promise.all([
          withTimeout(hydrateAuth(), 4000, 'hydrateAuth'),
          withTimeout(hydrateLanguage(), 4000, 'hydrateLanguage'),
          withTimeout(hydrateOnboarding(), 4000, 'hydrateOnboarding'),
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
  }, [hydrateAuth, hydrateLanguage, hydrateOnboarding, fetchRemoteConfig]);

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

  // Attach the shared call controller after login and tear it down on sign-out, so a signed-out
  // device cannot ring for the previous account's calls. `bootstrapCalling` is prompt-free: it
  // registers no phone account, so no system dialog appears after OTP login. The native ring surface
  // itself is set up lazily on the first call/incoming push.
  const wasAuthenticated = useRef(isAuthenticated);
  const [serviceabilityGateExpired, setServiceabilityGateExpired] = useState(false);
  const [navigatorEverMounted, setNavigatorEverMounted] = useState(false);

  // A cold start must not flash the home page before the session's own position is known. The
  // coverage gate therefore waits for two things to settle: the first silent fix attempt of this
  // session (`fixAttemptedAt`, so a persisted origin can never decide coverage for a user who has
  // since moved) and a coverage result that belongs to the *current* origin. Both are bounded, so a
  // dead fix or a dead fetch cannot strand the branded splash.
  const currentOriginKey = originKeyFor({ status: locationStatus, activeLocation });
  const serviceabilityPendingNow =
    isAuthenticated &&
    isServiceabilityPending(
      {
        status: serviceabilityStatus,
        checking: serviceabilityChecking,
        locationKey: serviceabilityLocationKey,
      },
      currentOriginKey,
    );
  const firstFixSettled = !isAuthenticated || fixAttemptedAt !== null;
  // A coverage read that failed because the device was offline is not a verdict. Once connectivity
  // returns, hold the branded splash (only until the first navigator mount) until the forced
  // re-check `useServiceability` fires on reconnect settles, so an out-of-area device that booted
  // offline can never reach the catalogue in between.
  const coverageNeedsRecheck =
    isAuthenticated &&
    isOnline === true &&
    serviceabilityStatus === 'failed' &&
    serviceabilityReason === 'network';
  const holdForServiceability =
    !navigatorEverMounted &&
    (!firstFixSettled || serviceabilityPendingNow || coverageNeedsRecheck) &&
    !serviceabilityGateExpired;

  const coldStartOffline = isOnline === false && !hasConnected;
  const coverageBlocked =
    isAuthenticated &&
    locationStatus === 'ready' &&
    serviceabilityStatus === 'unserviceable';
  // The navigator is the fall-through surface, so this mirrors the render order below.
  const navigatorVisible =
    ready && minSplashDone && !coldStartOffline && !holdForServiceability && !coverageBlocked;

  useEffect(() => {
    if (!holdForServiceability) return;
    const timer = setTimeout(
      () => setServiceabilityGateExpired(true),
      COVERAGE_HOLD_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [holdForServiceability]);

  // Only mark the navigator as ever-mounted when it is actually rendered. A cold start stuck on the
  // offline page must keep this false, so the reconnect coverage re-check still holds the splash
  // instead of flashing the catalogue before the verdict arrives.
  useEffect(() => {
    if (navigatorVisible) setNavigatorEverMounted(true);
  }, [navigatorVisible]);
  useEffect(() => {
    if (isAuthenticated) void bootstrapCalling();
    else if (wasAuthenticated.current) void shutdownCalling();
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  if (!ready) {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <SplashFallback variant="royal" />
      </>
    );
  }

  if (!minSplashDone) {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <SplashFallback variant="royal" />
      </>
    );
  }

  // Cold start while already offline: the branded layer-2 splash must finish its minimum display
  // before the offline page may replace it — a fast-failing `/health` probe used to cut the splash
  // short. `hasConnected` false means we have never been online this session, so this is a cold
  // start; a mid-session drop keeps the mounted navigator and only surfaces the toast/blocker.
  if (coldStartOffline) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={barStyle} />
        <OfflinePage />
      </SafeAreaProvider>
    );
  }

  if (holdForServiceability) {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <SplashFallback variant="royal" />
      </>
    );
  }

  // Hard coverage gate: the superadmin district master is the authority. No shopping navigator is
  // mounted outside coverage, so a Chennai catalogue can never appear behind a Trichy address.
  // A settled `unserviceable` deliberately keeps the gate closed even while a re-check for a moved
  // origin is in flight (`holdForServiceability` shows the splash instead), so the fail-safe
  // direction is always "no catalogue" rather than a brief leak of an out-of-area feed.
  if (coverageBlocked) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={barStyle} />
        <ServiceAreaBlockedPage />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppLayout backgroundColor={palette.background}>
        <StatusBar barStyle={barStyle} />
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          onReady={() => {
            flushPendingPaymentCallback();
            flushPendingActiveCall();
          }}
          onStateChange={handleNavigationStateChange}
        >
          <AppNavigator />
        </NavigationContainer>
        {isOnline === false ? <OfflineToast /> : null}
        {navigationBlocked && isOnline === false ? (
          <View style={[styles.blocker, { backgroundColor: palette.background }]}>
            <OfflinePage reserveBottomInset={false} />
          </View>
        ) : null}
      </AppLayout>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
