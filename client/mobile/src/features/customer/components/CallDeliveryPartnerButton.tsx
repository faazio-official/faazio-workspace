import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { CALLING_ENABLED } from '@/lib/config';
import { useCallStore } from '@/state/callStore';
import { useThemeMode } from '@/hooks/useThemeMode';
import { navigationRef } from '@/navigation/navigationRef';
import { hs, ms, vs } from '@/utils/responsive';
import { startCustomerCall } from '../calling/callController';

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
  if (!CALLING_ENABLED) return null;

  const onPrimary = () => {
    if (busy) {
      if (navigationRef.isReady()) navigationRef.navigate('ActiveCall');
      return;
    }
    void startCustomerCall(orderId, 'Delivery Partner');
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Open the call in progress' : 'Call the delivery partner'}
        activeOpacity={0.9}
        onPress={onPrimary}
        style={[styles.primary, { backgroundColor: busy ? palette.card : palette.accent }]}
      >
        <Phone
          size={ms(17)}
          color={busy ? palette.accent : palette.onAccent}
          strokeWidth={1.8}
        />
        <AppText
          style={[styles.primaryLabel, { color: busy ? palette.accent : palette.onAccent }]}
        >
          {busy ? 'Call in progress' : 'Call delivery partner'}
        </AppText>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Use a secure phone call instead"
        activeOpacity={0.7}
        disabled={busy}
        onPress={() => void startCustomerCall(orderId, 'Delivery Partner', { forcePstn: true })}
        style={[styles.secondary, busy && styles.disabled]}
      >
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
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: ms(13), fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
