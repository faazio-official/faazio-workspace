import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Phone, PhoneCall } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { CALLING_ENABLED } from '@/lib/config';
import { useCallStore } from '@/state/callStore';
import { useThemeMode } from '@/hooks/useThemeMode';
import { navigationRef } from '@/navigation/navigationRef';
import { hs, ms, vs } from '@/utils/responsive';
import { initializeCustomerCalling, startCustomerCall } from '../calling/callController';

const OPEN = new Set(['connecting', 'ringing', 'active', 'ending']);

interface Props {
  orderId: string;
}

/**
 * Customer "Call delivery partner" action. The gateway chooses VOIP vs PSTN; the secondary action
 * forces the masked phone leg. No rider phone number is rendered or dialled.
 */
export function CallDeliveryPartnerButton({ orderId }: Props) {
  const { palette } = useThemeMode();
  const phase = useCallStore((s) => s.phase);
  const busy = OPEN.has(phase);
  // Mirrors the controller's 3 s start lock so a rapid second tap is visibly disabled.
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
  }, []);
  const holdLock = () => {
    setLocked(true);
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => setLocked(false), 3000);
  };
  if (!CALLING_ENABLED) return null;

  const onPrimary = () => {
    if (busy) {
      if (navigationRef.isReady()) navigationRef.navigate('ActiveCall');
      return;
    }
    if (locked) return;
    holdLock();
    // Lazily attach the native ring surface only when the user actually wants to call. Login stays
    // completely prompt-free (no phone account, no system dialog).
    void initializeCustomerCalling().finally(() => {
      void startCustomerCall(orderId, 'Delivery Partner');
    });
  };

  const onPstn = () => {
    if (busy || locked) return;
    holdLock();
    void initializeCustomerCalling().finally(() => {
      void startCustomerCall(orderId, 'Delivery Partner', { forcePstn: true });
    });
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Open the call in progress' : 'Call the delivery partner'}
        accessibilityState={{ disabled: locked && !busy }}
        activeOpacity={0.9}
        disabled={locked && !busy}
        onPress={onPrimary}
        style={[
          styles.primary,
          {
            backgroundColor: busy ? palette.card : palette.accent,
            opacity: locked && !busy ? 0.6 : 1,
          },
        ]}
      >
        <Phone
          size={ms(17)}
          color={busy ? palette.accent : palette.onAccent}
          strokeWidth={1.8}
        />
        <AppText
          style={[styles.primaryLabel, { color: busy ? palette.accent : palette.onAccent }]}
        >
          {locked ? 'Starting call…' : busy ? 'Call in progress' : 'Call delivery partner'}
        </AppText>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Use a secure phone call instead"
        activeOpacity={0.7}
        disabled={busy || locked}
        onPress={onPstn}
        style={[styles.secondary, (busy || locked) && styles.disabled]}
      >
        <PhoneCall size={ms(14)} color={palette.accent} strokeWidth={1.8} />
        <AppText style={[styles.secondaryText, { color: palette.accent }]}>
          Use phone call
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: vs(6) },
  primary: {
    minHeight: vs(48),
    borderRadius: ms(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
  },
  primaryLabel: { fontSize: ms(14), fontWeight: '600' },
  secondary: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
  },
  secondaryText: { fontSize: ms(13), fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
