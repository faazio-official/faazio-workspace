import React, { useEffect, useRef, useState } from 'react';
import { ErrorUtils, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { SplashFallback } from './src/components/SplashFallback';
import { useAuthStore } from './src/state/authStore';
import { useLanguageStore } from './src/state/languageStore';
import { useAppFonts, resolveFontFamily } from './src/theme/fonts';
import { useBottomInset } from './src/utils/responsive';

// If a native module (SecureStore/AsyncStorage/fonts) hangs, the splash would
// otherwise stay up forever and trigger an ANR. Force-dismiss past this budget.
// Budget keeps the branded splash up for the 5s minimum plus headroom.
const SPLASH_TIMEOUT_MS = 10000;

// Branded splash stays visible for at least this long on cold start.
const SPLASH_MIN_DISPLAY_MS = 5000;

/**
 * Routes synchronous JS/render errors to a single logger so crashes are not
 * silently swallowed in release builds (babel strips all console.* there).
 * Kept as a module-scope install so it runs before any screen mounts.
 */
function installGlobalErrorHandlers() {
  if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      if (__DEV__) {
        console.warn('[Faazio:global-error]', isFatal, error);
      }
    });
  }
}
installGlobalErrorHandlers();

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

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [fontsLoaded, fontError] = useAppFonts();
  const [ready, setReady] = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const mountedAt = useRef(Date.now());
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLanguage = useLanguageStore((s) => s.hydrate);

  useEffect(() => {
    let active = true;
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
  }, [hydrateAuth, hydrateLanguage]);

  // Failsafe: never leave the native splash up if startup stalls.
  useEffect(() => {
    const forceHide = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(forceHide);
  }, []);

  useEffect(() => {
    if (fontsLoaded && ready) {
      const remaining = SPLASH_MIN_DISPLAY_MS - (Date.now() - mountedAt.current);
      if (remaining <= 0) {
        setMinSplashDone(true);
        SplashScreen.hideAsync().catch(() => {});
        return;
      }
      // Keep the branded splash up for the minimum display window.
      const timer = setTimeout(() => {
        setMinSplashDone(true);
        SplashScreen.hideAsync().catch(() => {});
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, ready]);

  if (!fontsLoaded && !fontError) {
    return <SplashFallback variant="royal" />;
  }

  if (!ready || !minSplashDone) {
    return <SplashFallback variant="royal" />;
  }

  return (
    <SafeAreaProvider>
      <AppLayout>
        <StatusBar style="dark" />
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <AppNavigator />
        </NavigationContainer>
      </AppLayout>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
