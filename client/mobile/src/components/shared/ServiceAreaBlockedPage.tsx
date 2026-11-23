import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MapPinOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { useThemeMode } from '@/hooks/useThemeMode';
import { SUPPORT_EMAIL } from '@/lib/site';
import { useLocationStore } from '@/state/locationStore';
import { useServiceabilityStore } from '@/state/serviceabilityStore';
import { vs, ms } from '@/utils/responsive';

/**
 * Full-screen hard gate for an origin outside the district coverage the super admin has enabled.
 * The app deliberately does not mount the shopping navigator in this state: there is no useful
 * catalogue to browse when nothing can be delivered here.
 *
 * `Change location` clears the stored origin so the app returns to the location picker; a manual
 * pick inside an active district lifts the gate on the next check. `Notify me` is a real mailto —
 * no fake subscribe endpoint and no client-side "registered" state.
 */
export function ServiceAreaBlockedPage() {
  const insets = useSafeAreaInsets();
  const { palette } = useThemeMode();
  const check = useServiceabilityStore((s) => s.check);
  const districtName = useServiceabilityStore((s) => s.districtName);
  const stateName = useServiceabilityStore((s) => s.stateName);
  const reason = useServiceabilityStore((s) => s.reason);
  const resetServiceability = useServiceabilityStore((s) => s.reset);
  const resetLocation = useLocationStore((s) => s.reset);
  const [checking, setChecking] = useState(false);

  const changeLocation = useCallback(() => {
    resetServiceability();
    resetLocation();
  }, [resetLocation, resetServiceability]);

  const notifyMe = useCallback(() => {
    const area = [districtName, stateName].filter(Boolean).join(', ');
    const subject = area
      ? `Notify me when Faazio starts in ${area}`
      : 'Notify me when Faazio starts in my area';
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`,
    );
  }, [districtName, stateName]);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      await check(true);
    } finally {
      setChecking(false);
    }
  }, [check]);

  const body =
    reason === 'district_unavailable'
      ? 'Faazio has not switched on deliveries for this district yet. Pick another address, or we can let you know when coverage opens.'
      : 'This address is outside the districts where Faazio delivers right now. Pick another address, or we can let you know when coverage opens.';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          paddingTop: insets.top + vs(32),
          paddingBottom: insets.bottom + vs(24),
        },
      ]}
    >
      <FaazioLogo size={40} />

      <View style={[styles.iconCircle, { backgroundColor: palette.accentSoft }]}>
        <MapPinOff size={28} color={palette.accent} strokeWidth={2} />
      </View>

      <AppText style={[styles.title, { color: palette.text }]}>
        We&apos;re not in your area yet
      </AppText>
      <AppText style={[styles.body, { color: palette.textMuted }]}>{body}</AppText>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: palette.accent },
            pressed && styles.pressed,
          ]}
          onPress={changeLocation}
          accessibilityRole="button"
          accessibilityLabel="Choose another location"
        >
          <AppText style={[styles.primaryText, { color: palette.onAccent }]}>
            Choose another location
          </AppText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: palette.border },
            pressed && styles.pressed,
          ]}
          onPress={() => void retry()}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel="Check coverage again"
          accessibilityState={{ disabled: checking, busy: checking }}
        >
          {checking ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <AppText style={[styles.secondaryText, { color: palette.text }]}>
              Check again
            </AppText>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={notifyMe}
        style={styles.notifyLink}
        accessibilityRole="link"
        accessibilityLabel="Notify me when Faazio starts in my area"
      >
        <AppText style={[styles.notifyText, { color: palette.accent }]}>
          Notify me when we arrive
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(28),
  },
  iconCircle: {
    marginTop: vs(28),
    marginBottom: vs(16),
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 27,
    textAlign: 'center',
    marginBottom: vs(10),
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: ms(320),
    marginBottom: vs(28),
  },
  actions: {
    width: '100%',
    maxWidth: ms(340),
    gap: vs(10),
  },
  primaryButton: {
    height: vs(48),
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    height: vs(48),
    borderRadius: ms(14),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
  notifyLink: {
    marginTop: vs(22),
    paddingVertical: vs(8),
    paddingHorizontal: ms(12),
  },
  notifyText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
