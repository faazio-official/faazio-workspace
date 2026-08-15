import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SplashFallback } from './src/components/SplashFallback';
import { useAuthStore } from './src/state/authStore';
import { useLanguageStore } from './src/state/languageStore';
import { FONT_ASSETS, resolveFontFamily } from './src/theme/fonts';

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

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [ready, setReady] = useState(false);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateLanguage = useLanguageStore((s) => s.hydrate);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.all([hydrateAuth(), hydrateLanguage()]);
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [hydrateAuth, hydrateLanguage]);

  useEffect(() => {
    if (fontsLoaded && ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, ready]);

  if (!fontsLoaded && !fontError) {
    return <SplashFallback variant="royal" />;
  }

  if (!ready) {
    return <SplashFallback variant="royal" />;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="dark" />
        <NavigationContainer theme={navigationTheme}>
          <AppNavigator />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
