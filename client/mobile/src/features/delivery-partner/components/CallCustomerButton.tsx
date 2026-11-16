import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Phone } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DPButton } from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { CALLING_ENABLED } from '@/lib/config';
import { useCallStore } from '@/state/callStore';
import { deliveryNavigationRef } from '../navigationRef';
import { ms, vs } from '@/utils/responsive';
import { startDeliveryCall } from '../calling/callController';

interface Props {
  orderId: string;
  peerLabel?: string;
  /** Show the explicit "Use phone call" secondary action (Route screen). */
  showPstn?: boolean;
  style?: StyleProp<ViewStyle>;
}

const OPEN = new Set(['connecting', 'ringing', 'active', 'ending']);

/**
 * Primary "Call customer" action. The gateway chooses VOIP vs PSTN; the secondary action forces the
 * masked PSTN leg. No raw customer number is rendered or dialled.
 */
export function CallCustomerButton({
  orderId,
  peerLabel = 'Customer',
  showPstn = false,
  style,
}: Props) {
  const phase = useCallStore((s) => s.phase);
  const busy = OPEN.has(phase);
  if (!CALLING_ENABLED) return null;

  const onPrimary = () => {
    if (busy) {
      if (deliveryNavigationRef.isReady()) deliveryNavigationRef.navigate('ActiveCall');
      return;
    }
    void startDeliveryCall(orderId, peerLabel);
  };

  return (
    <View style={[styles.wrap, style]}>
      <DPButton
        label={busy ? 'Call in progress' : 'Call customer'}
        variant={busy ? 'outline' : 'solid'}
        onPress={onPrimary}
        icon={<Phone size={ms(16)} color={busy ? DELIVERY.brand : DELIVERY.onBrand} strokeWidth={1.8} />}
        accessibilityLabel={busy ? 'Open the call in progress' : 'Call the customer'}
      />
      {showPstn ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Use a secure phone call instead"
          disabled={busy}
          onPress={() => void startDeliveryCall(orderId, peerLabel, { forcePstn: true })}
          style={[styles.secondary, busy && styles.secondaryDisabled]}
        >
          <AppText style={styles.secondaryText}>Use phone call</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: vs(6) },
  secondary: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center' },
  secondaryDisabled: { opacity: 0.4 },
  secondaryText: { ...DP_TYPE.caption, color: DELIVERY.brand, fontWeight: '600' },
});
