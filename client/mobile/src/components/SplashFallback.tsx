import React from 'react';
import { StyleSheet, View, ActivityIndicator, Image } from 'react-native';
import { FaazioLogo } from '@/components/FaazioLogo';
import faazioLogoImg from '@/assets/faazio-logo.png';

interface SplashFallbackProps {
  /**
   * 'royal' renders the cold-start splash with a royal blue (#0000FF)
   * background, a white spinner, and the centered logo image.
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
          source={faazioLogoImg}
          style={styles.royalLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#ffffff" style={styles.spinner} />
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
    backgroundColor: '#0000FF',
  },
  royalLogo: {
    width: 140,
    height: 140,
  },
  spinner: {
    marginTop: 16,
  },
});
