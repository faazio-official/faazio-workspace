import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FONT_ASSETS, resolveFontFamily } from './src/theme/fonts';

const navigationTheme = {
  ...DefaultTheme,
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

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor="#0f172a" />
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
