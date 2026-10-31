import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { useConnectivityStore } from '@/state/connectivityStore';
import { ms, vs } from '@/utils/responsive';

/**
 * Full-screen, non-scrollable offline page. Shown on a cold start while offline and in place of a
 * navigation the user attempted while offline. "Try again" re-runs the connectivity probe; when it
 * succeeds the guard's resume effect (App.tsx) either mounts the navigator or replays the pending
 * route, whose screens fire their normal HTTP reads on mount.
 */
export function OfflinePage() {
  const insets = useSafeAreaInsets();
  const isChecking = useConnectivityStore((s) => s.isChecking);
  const checkConnectivity = useConnectivityStore((s) => s.checkConnectivity);
  const [retrying, setRetrying] = useState(false);

  const onRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await checkConnectivity();
    } finally {
      setRetrying(false);
    }
  }, [checkConnectivity]);

  const busy = retrying || isChecking;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <FaazioLogo size={40} />
      <View style={styles.iconCircle}>
        <WifiOff size={26} color="#1162D3" />
      </View>
      <AppText style={styles.title}>You&apos;re offline</AppText>
      <AppText style={styles.body}>
        Looks like you&apos;re not connected to the internet. Check your connection and try again.
      </AppText>
      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={onRetry}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        {busy ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <AppText style={styles.buttonText}>Try again</AppText>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(32),
    backgroundColor: '#ffffff',
  },
  iconCircle: {
    marginTop: vs(24),
    marginBottom: vs(12),
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: vs(8),
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: vs(20),
  },
  button: {
    minWidth: ms(140),
    height: vs(44),
    borderRadius: ms(12),
    backgroundColor: '#1162D3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(24),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});