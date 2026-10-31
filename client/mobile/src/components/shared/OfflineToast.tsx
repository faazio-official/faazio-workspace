import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { useConnectivityStore } from '@/state/connectivityStore';
import { hs, vs } from '@/utils/responsive';

/**
 * Non-blocking "You're offline" toast that slides up from the bottom when connectivity drops while
 * the user is on a page, and slides away once it returns. It never blocks the current page — writes
 * keep their existing fallback behavior; only an attempted navigation is intercepted (OfflinePage).
 */
export function OfflineToast() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(vs(40))).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOnline === false) {
      setVisible(true);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (isOnline === true) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: vs(40), duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }
  }, [isOnline, opacity, translateY]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[styles.toast, { opacity, transform: [{ translateY }] }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <WifiOff size={15} color="#ffffff" />
        <AppText style={styles.text}>You&apos;re offline</AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: vs(84),
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
    borderRadius: hs(999),
    backgroundColor: '#1e293b',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});