import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bluetooth,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DPButton } from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { useCallStore } from '@/state/callStore';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';
import {
  acceptIncomingCall,
  clearCall,
  currentCallId,
  declineIncomingCall,
  endActiveCall,
  routeToBluetooth,
  switchCallToPstn,
  toggleMute,
  toggleSpeaker,
} from '../calling/callController';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'ActiveCall'>;

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Full-screen call surface. It renders only authoritative state from the gateway/call store:
 * connecting → ringing → active → ended. No fake timers or peer names; the peer is a masked role.
 */
export function ActiveCallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const phase = useCallStore((s) => s.phase);
  const call = useCallStore((s) => s.call);
  const orderId = useCallStore((s) => s.orderId);
  const peerLabel = useCallStore((s) => s.peerLabel);
  const connectedAt = useCallStore((s) => s.connectedAt);
  const muted = useCallStore((s) => s.muted);
  const speaker = useCallStore((s) => s.speaker);
  const bluetoothAvailable = useCallStore((s) => s.bluetoothAvailable);
  const incoming = useCallStore((s) => s.incoming);
  const reconnecting = useCallStore((s) => s.reconnecting);
  const fallbackPrompt = useCallStore((s) => s.fallbackPrompt);
  const error = useCallStore((s) => s.error);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (phase === 'idle' || phase === 'ended' || phase === 'error') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const elapsed = useMemo(() => {
    const started = connectedAt ?? (call ? Date.parse(call.createdAt) : now);
    return Number.isFinite(started) ? (now - started) / 1000 : 0;
  }, [call, connectedAt, now]);

  const status = useMemo(() => {
    if (phase === 'error') return error || 'Call failed';
    if (phase === 'ended') return 'Call ended';
    if (phase === 'ending') return 'Ending call…';
    if (phase === 'connecting') return 'Connecting…';
    if (incoming && phase === 'ringing') return 'Incoming delivery call';
    if (phase === 'ringing') {
      return call?.mode === 'PSTN_BRIDGING'
        ? 'Dialing the secure line…'
        : 'Ringing…';
    }
    if (reconnecting) return 'Reconnecting…';
    return call?.mode === 'PSTN_BRIDGING' ? 'Secure phone call' : 'In call';
  }, [call, error, incoming, phase, reconnecting]);

  const finish = () => {
    clearCall();
    navigation.goBack();
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

  const ended = phase === 'ended' || phase === 'error' || phase === 'idle';

  return (
    <View style={[styles.page, { paddingTop: insets.top + vs(24), paddingBottom: insets.bottom + vs(20) }]}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Phone size={ms(26)} color={DELIVERY.onBrand} strokeWidth={1.6} />
        </View>
        <AppText style={styles.peer}>{peerLabel}</AppText>
        <AppText style={styles.order}>
          {orderId ? `Order #${orderId.slice(-6)}` : 'Delivery call'}
        </AppText>
        <AppText style={styles.timer}>{ended ? '—' : formatDuration(elapsed)}</AppText>
        <AppText style={[styles.status, phase === 'error' && styles.statusError]}>{status}</AppText>
      </View>

      {reconnecting ? (
        <View style={styles.banner}>
          <AppText style={styles.bannerText}>
            Network changed. Reconnecting — if it does not recover, switch to a phone call.
          </AppText>
        </View>
      ) : null}

      {fallbackPrompt && !ended ? (
        <View style={styles.fallback}>
          <AppText style={styles.fallbackTitle}>App call not connecting?</AppText>
          <AppText style={styles.fallbackText}>
            Use the secure phone line instead. We dial a masked number, never the customer's.
          </AppText>
          <DPButton label="Switch to phone call" onPress={() => void switchCallToPstn()} />
        </View>
      ) : null}

      {!ended && incoming && phase === 'ringing' ? (
        <View style={styles.answerRow}>
          <DPButton label="Decline" variant="outline" fullWidth={false} onPress={onEnd} style={styles.answerButton} />
          <DPButton label="Accept" onPress={onAccept} fullWidth={false} style={styles.answerButton} />
        </View>
      ) : null}

      {!ended && !(incoming && phase === 'ringing') ? (
        <View style={styles.controlsWrap}>
          <View style={styles.controls}>
            <Control
              label={muted ? 'Unmute' : 'Mute'}
              active={muted}
              onPress={() => void toggleMute()}
              icon={
                muted ? (
                  <MicOff size={ms(22)} color={DELIVERY.ink} strokeWidth={1.6} />
                ) : (
                  <Mic size={ms(22)} color={DELIVERY.ink} strokeWidth={1.6} />
                )
              }
            />
            <Control
              label={speaker ? 'Speaker off' : 'Speaker'}
              active={speaker}
              onPress={() => void toggleSpeaker()}
              icon={
                speaker ? (
                  <Volume2 size={ms(22)} color={DELIVERY.ink} strokeWidth={1.6} />
                ) : (
                  <VolumeX size={ms(22)} color={DELIVERY.ink} strokeWidth={1.6} />
                )
              }
            />
            {bluetoothAvailable ? (
              <Control
                label="Bluetooth"
                onPress={() => void routeToBluetooth()}
                icon={<Bluetooth size={ms(22)} color={DELIVERY.ink} strokeWidth={1.6} />}
              />
            ) : null}
            <Control
              label="Phone line"
              onPress={() => void switchCallToPstn()}
              disabled={!call || call.mode === 'PSTN_BRIDGING'}
              icon={<PhoneCall size={ms(22)} color={DELIVERY.ink} strokeWidth={1.6} />}
            />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="End call"
            onPress={onEnd}
            style={styles.end}
          >
            <PhoneOff size={ms(26)} color={DELIVERY.onBrand} strokeWidth={1.7} />
          </TouchableOpacity>
          <AppText style={styles.endLabel}>End call</AppText>
        </View>
      ) : null}

      {ended ? (
        <View style={styles.doneWrap}>
          <DPButton label="Done" onPress={finish} />
        </View>
      ) : null}
    </View>
  );
}

function Control({
  label,
  icon,
  active = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.control}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.controlButton, active && styles.controlActive, disabled && styles.controlDisabled]}
      >
        {icon}
      </TouchableOpacity>
      <AppText style={styles.controlLabel}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: DELIVERY.surface,
    paddingHorizontal: hs(20),
    justifyContent: 'space-between',
  },
  identity: { alignItems: 'center', marginTop: vs(28) },
  avatar: {
    width: ms(72),
    height: ms(72),
    borderRadius: DELIVERY.radius.pill,
    backgroundColor: DELIVERY.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peer: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '600', marginTop: vs(16) },
  order: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(4) },
  timer: { ...DP_TYPE.display, color: DELIVERY.ink, fontWeight: '500', marginTop: vs(18) },
  status: { ...DP_TYPE.body, color: DELIVERY.inkMuted, marginTop: vs(8), textAlign: 'center' },
  statusError: { color: DELIVERY.danger },
  banner: {
    backgroundColor: DELIVERY.warningTint,
    borderRadius: DELIVERY.radius.md,
    padding: hs(12),
    marginTop: vs(12),
  },
  bannerText: { ...DP_TYPE.caption, color: DELIVERY.warning },
  fallback: {
    backgroundColor: DELIVERY.warningTint,
    borderRadius: DELIVERY.radius.lg,
    padding: hs(16),
    marginTop: vs(12),
    gap: vs(8),
  },
  fallbackTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  fallbackText: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginBottom: vs(4) },
  answerRow: { flexDirection: 'row', gap: hs(12), marginTop: vs(16) },
  answerButton: { flex: 1 },
  controlsWrap: { alignItems: 'center', gap: vs(18) },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: hs(14), flexWrap: 'wrap' },
  control: { alignItems: 'center', width: ms(68) },
  controlButton: {
    width: ms(52),
    height: ms(52),
    borderRadius: DELIVERY.radius.pill,
    backgroundColor: DELIVERY.card,
    borderWidth: 1,
    borderColor: DELIVERY.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { backgroundColor: DELIVERY.brandTint, borderColor: DELIVERY.brand },
  controlDisabled: { opacity: 0.4 },
  controlLabel: { ...DP_TYPE.micro, color: DELIVERY.inkMuted, marginTop: vs(6), textAlign: 'center' },
  end: {
    width: ms(64),
    height: ms(64),
    borderRadius: DELIVERY.radius.pill,
    backgroundColor: DELIVERY.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endLabel: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(6) },
  doneWrap: { marginTop: vs(16) },
});
