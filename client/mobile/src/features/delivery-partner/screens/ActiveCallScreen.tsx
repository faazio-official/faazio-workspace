import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DELIVERY } from '@/theme/deliveryTokens';
import { useCallStore } from '@/state/callStore';
import { CallSurface, type CallSurfaceColors } from '@/features/call/CallSurface';
import type { DeliveryPartnerStackParamList } from '../navigation';
import {
  acceptIncomingCall,
  currentCallId,
  declineIncomingCall,
  dismissCall,
  endActiveCall,
  routeToBluetooth,
  switchCallToPstn,
  toggleMute,
  toggleSpeaker,
} from '../calling/callController';

const OPEN_PHASES = new Set(['connecting', 'ringing', 'active', 'ending']);

const COLORS: CallSurfaceColors = {
  surface: DELIVERY.surface,
  card: DELIVERY.card,
  border: DELIVERY.border,
  ink: DELIVERY.ink,
  inkMuted: DELIVERY.inkMuted,
  brand: DELIVERY.brand,
  brandTint: DELIVERY.brandTint,
  onBrand: DELIVERY.onBrand,
  danger: DELIVERY.danger,
  warning: DELIVERY.warning,
  warningTint: DELIVERY.warningTint,
  radius: DELIVERY.radius,
  touchMin: DELIVERY.touch.min,
};

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'ActiveCall'>;

/**
 * Delivery full-screen call surface. All call logic is shared with the customer app; this screen
 * only supplies the delivery theme and navigation.
 */
export function ActiveCallScreen({ navigation }: Props) {
  const phase = useCallStore((s) => s.phase);
  const call = useCallStore((s) => s.call);
  const orderId = useCallStore((s) => s.orderId);
  const peerLabel = useCallStore((s) => s.peerLabel);
  const connectedAt = useCallStore((s) => s.connectedAt);
  const muted = useCallStore((s) => s.muted);
  const speaker = useCallStore((s) => s.speaker);
  const audioRoute = useCallStore((s) => s.audioRoute);
  const bluetoothAvailable = useCallStore((s) => s.bluetoothAvailable);
  const incoming = useCallStore((s) => s.incoming);
  const reconnecting = useCallStore((s) => s.reconnecting);
  const fallbackPrompt = useCallStore((s) => s.fallbackPrompt);
  const notice = useCallStore((s) => s.notice);
  const error = useCallStore((s) => s.error);

  // Hardware back (or a swipe that slips through) must end the call, not abandon it with no UI.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!OPEN_PHASES.has(useCallStore.getState().phase)) return;
        event.preventDefault();
        void dismissCall('back').finally(() => {
          navigation.dispatch(event.data.action);
        });
      }),
    [navigation],
  );

  const finish = () => {
    void dismissCall('done').finally(() => navigation.goBack());
  };

  const onEnd = () => {
    const callId = currentCallId();
    if (!callId) {
      finish();
      return;
    }
    if (incoming && (phase === 'ringing' || phase === 'connecting')) {
      void declineIncomingCall(callId);
    } else {
      void endActiveCall('ended');
    }
  };

  const onAccept = () => {
    const callId = currentCallId();
    if (callId) void acceptIncomingCall(callId);
  };

  return (
    <CallSurface
      colors={COLORS}
      peerLabel={peerLabel}
      orderId={orderId}
      subtitle="Delivery call"
      phase={phase}
      mode={call?.mode}
      connectedAt={connectedAt}
      muted={muted}
      speaker={speaker}
      audioRoute={audioRoute}
      bluetoothAvailable={bluetoothAvailable}
      incoming={incoming}
      reconnecting={reconnecting}
      fallbackPrompt={fallbackPrompt}
      notice={notice}
      error={error}
      onAccept={onAccept}
      onDecline={onEnd}
      onEnd={onEnd}
      onDone={finish}
      onToggleMute={() => void toggleMute()}
      onToggleSpeaker={() => void toggleSpeaker()}
      onBluetooth={() => void routeToBluetooth()}
      onPhoneLine={() => void switchCallToPstn()}
    />
  );
}
