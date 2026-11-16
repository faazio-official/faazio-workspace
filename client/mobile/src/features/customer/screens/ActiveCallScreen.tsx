import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeMode } from '@/hooks/useThemeMode';
import { RADIUS, TOUCH } from '@/theme/tokens';
import { useCallStore } from '@/state/callStore';
import { CallSurface, type CallSurfaceColors } from '@/features/call/CallSurface';
import type { RootStackParamList } from '@/navigation/types';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveCall'>;

/**
 * Customer full-screen call surface. All call logic is shared with the delivery app; this screen
 * only supplies the customer theme (light/dark) and navigation.
 */
export function ActiveCallScreen({ navigation }: Props) {
  const { palette } = useThemeMode();
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

  const colors: CallSurfaceColors = {
    surface: palette.background,
    card: palette.card,
    border: palette.border,
    ink: palette.text,
    inkMuted: palette.textMuted,
    brand: palette.accent,
    brandTint: palette.accentSoft,
    onBrand: palette.onAccent,
    danger: palette.danger,
    warning: palette.coinText,
    warningTint: palette.coinSurface,
    radius: RADIUS,
    touchMin: TOUCH.min,
  };

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
      colors={colors}
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
