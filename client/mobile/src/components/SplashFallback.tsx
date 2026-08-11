import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { FaazioLogo } from '@/components/FaazioLogo';

/**
 * Suspense fallback shown while a lazily-imported screen's JS chunk loads.
 * Lightweight on purpose — avoid importing heavy components here.
 */
export function SplashFallback() {
  return (
    <View style={styles.container}>
      <FaazioLogo size={40} />
      <ActivityIndicator size="small" color="#1162D3" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  spinner: {
    marginTop: 16,
  },
});
