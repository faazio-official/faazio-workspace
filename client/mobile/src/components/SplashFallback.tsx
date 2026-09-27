import React from 'react';
import { StyleSheet, View, ActivityIndicator, Image } from 'react-native';
import { FaazioLogo } from '@/components/FaazioLogo';
import logoImg from '@/assets/logo.png';

interface SplashFallbackProps {
  /**
   * 'royal' renders the cold-start splash with a Faazio blue (#4250FF)
   * background and the centered wide logo image (no spinner).
   * Default ('default') keeps the lightweight white/blue splash used by
   * navigation Suspense fallbacks.
   */
  variant?: 'default' | 'royal';
}

/**
 * Suspense fallback shown while a lazily-imported screen's JS chunk loads.
 * Lightweight on purpose — avoid importing heavy components here.
 */
export function SplashFallback({ variant = 'default' }: SplashFallbackProps) {
  if (variant === 'royal') {
    return (
      <View style={[styles.container, styles.royalContainer]}>
        <Image
          source={logoImg}
          style={styles.royalLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

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
  royalContainer: {
    backgroundColor: '#4250FF',
  },
  royalLogo: {
    width: 220,
    aspectRatio: 2171 / 724,
  },
  spinner: {
    marginTop: 16,
  },
});
