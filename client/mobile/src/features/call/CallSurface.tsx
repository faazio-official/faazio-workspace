import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import type { CallAudioRoute, CallPhase } from '@/state/callStore';
import type { DeliveryCallMode } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';

export interface CallSurfaceColors {
  surface: string;
  card: string;
  border: string;
  ink: string;
  inkMuted: string;
  brand: string;
  brandTint: string;
  onBrand: string;
  danger: string;
  warning: string;
  warningTint: string;
  radius: { pill: number; md: number; lg: number };
  touchMin: number;
}

export interface CallSurfaceProps {
  colors: CallSurfaceColors;
  peerLabel: string;
  orderId: string;
  /** Product label shown above the peer ("Delivery call" / "Order call"). */
  subtitle: string;
  phase: CallPhase;
  mode?: DeliveryCallMode;
  connectedAt: number | null;
  muted: boolean;
  speaker: boolean;
  audioRoute: CallAudioRoute;
  bluetoothAvailable: boolean;
  incoming: boolean;
  reconnecting: boolean;
  fallbackPrompt: boolean;
  notice: string | null;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onDone: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onBluetooth: () => void;
  onPhoneLine: () => void;
}

const OPEN_PHASES = new Set<CallPhase>(['connecting', 'ringing', 'active', 'ending']);

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Shared full-screen call surface. It renders only authoritative state from the gateway/call store:
 * connecting → ringing → active → ended. No fake timers or peer names; the peer is a masked role.
 * Colours are injected per product so both apps keep their own token contract.
 */
export function CallSurface({
  colors,
  peerLabel,
  orderId,
  subtitle,
  phase,
  mode,
  connectedAt,
  muted,
  speaker,
  audioRoute,
  bluetoothAvailable,
  incoming,
  reconnecting,
  fallbackPrompt,
  notice,
  error,
  onAccept,
  onDecline,
  onEnd,
  onDone,
  onToggleMute,
  onToggleSpeaker,
  onBluetooth,
  onPhoneLine,
}: CallSurfaceProps) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!OPEN_PHASES.has(phase)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const elapsed = useMemo(() => {
    // The timer only runs once the call is actually connected; ringing is not talk time.
    if (!connectedAt) return 0;
    return Math.max(0, (now - connectedAt) / 1000);
  }, [connectedAt, now]);

  const status = useMemo(() => {
    if (phase === 'error') return error || 'Call failed';
    if (phase === 'ended') return 'Call ended';
    if (phase === 'ending') return 'Ending call…';
    if (phase === 'connecting') return 'Connecting…';
    if (incoming && phase === 'ringing') return 'Incoming call';
    if (phase === 'ringing') {
      return mode === 'PSTN_BRIDGING' ? 'Dialing the secure line…' : 'Ringing…';
    }
    if (reconnecting) return 'Reconnecting…';
    return mode === 'PSTN_BRIDGING' ? 'Secure phone call' : 'In call';
  }, [error, incoming, mode, phase, reconnecting]);

  const ended = phase === 'ended' || phase === 'error' || phase === 'idle';
  const ringingIncoming = !ended && incoming && phase === 'ringing';
  const canUseVoipControls = mode === 'VOIP' && !ended && !ringingIncoming;

  return (
    <View
      style={[
        styles.page,
        {
          backgroundColor: colors.surface,
          paddingTop: insets.top + vs(24),
          paddingBottom: insets.bottom + vs(20),
        },
      ]}
    >
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <Phone size={ms(26)} color={colors.onBrand} strokeWidth={1.6} />
        </View>
        <AppText style={[styles.peer, { color: colors.ink }]}>{peerLabel}</AppText>
        <AppText style={[styles.order, { color: colors.inkMuted }]}>
          {orderId ? `${subtitle} · #${orderId.slice(-6)}` : subtitle}
        </AppText>
        <AppText style={[styles.timer, { color: colors.ink }]}>
          {ended ? '—' : formatDuration(elapsed)}
        </AppText>
        <AppText
          style={[styles.status, { color: phase === 'error' ? colors.danger : colors.inkMuted }]}
        >
          {status}
        </AppText>
      </View>

      {notice && !ended ? (
        <View style={[styles.banner, { backgroundColor: colors.warningTint }]}>
          <AppText style={[styles.bannerText, { color: colors.warning }]}>{notice}</AppText>
        </View>
      ) : null}

      {reconnecting && !ended ? (
        <View style={[styles.banner, { backgroundColor: colors.warningTint }]}>
          <AppText style={[styles.bannerText, { color: colors.warning }]}>
            Network changed. Reconnecting — if it does not recover, switch to a phone call.
          </AppText>
        </View>
      ) : null}

      {fallbackPrompt && !ended && !ringingIncoming ? (
        <View
          style={[
            styles.fallback,
            { backgroundColor: colors.warningTint, borderRadius: colors.radius.lg },
          ]}
        >
          <AppText style={[styles.fallbackTitle, { color: colors.ink }]}>
            App call not connecting?
          </AppText>
          <AppText style={[styles.fallbackText, { color: colors.inkMuted }]}>
            Use the secure phone line instead. We dial a masked number, never the other person's.
          </AppText>
          <SurfaceButton
            colors={colors}
            label="Switch to phone call"
            onPress={onPhoneLine}
            solid
          />
        </View>
      ) : null}

      {ringingIncoming ? (
        <View style={styles.answerRow}>
          <SurfaceButton colors={colors} label="Decline" onPress={onDecline} style={styles.answerButton} />
          <SurfaceButton
            colors={colors}
            label="Accept"
            onPress={onAccept}
            solid
            style={styles.answerButton}
          />
        </View>
      ) : null}

      {!ended && !ringingIncoming ? (
        <View style={styles.controlsWrap}>
          <View style={styles.controls}>
            {canUseVoipControls ? (
              <>
                <Control
                  colors={colors}
                  label={muted ? 'Unmute' : 'Mute'}
                  active={muted}
                  onPress={onToggleMute}
                  icon={
                    muted ? (
                      <MicOff size={ms(22)} color={colors.ink} strokeWidth={1.6} />
                    ) : (
                      <Mic size={ms(22)} color={colors.ink} strokeWidth={1.6} />
                    )
                  }
                />
                <Control
                  colors={colors}
                  label={speaker ? 'Speaker off' : 'Speaker'}
                  active={speaker}
                  onPress={onToggleSpeaker}
                  icon={
                    speaker ? (
                      <Volume2 size={ms(22)} color={colors.ink} strokeWidth={1.6} />
                    ) : (
                      <VolumeX size={ms(22)} color={colors.ink} strokeWidth={1.6} />
                    )
                  }
                />
                {bluetoothAvailable ? (
                  <Control
                    colors={colors}
                    label="Bluetooth"
                    active={audioRoute === 'bluetooth'}
                    onPress={onBluetooth}
                    icon={<Bluetooth size={ms(22)} color={colors.ink} strokeWidth={1.6} />}
                  />
                ) : null}
                <Control
                  colors={colors}
                  label="Phone line"
                  onPress={onPhoneLine}
                  icon={<PhoneCall size={ms(22)} color={colors.ink} strokeWidth={1.6} />}
                />
              </>
            ) : null}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="End call"
            onPress={onEnd}
            style={[styles.end, { backgroundColor: colors.danger }]}
          >
            <PhoneOff size={ms(26)} color={colors.onBrand} strokeWidth={1.7} />
          </TouchableOpacity>
          <AppText style={[styles.endLabel, { color: colors.inkMuted }]}>End call</AppText>
        </View>
      ) : null}

      {ended ? (
        <View style={styles.doneWrap}>
          <SurfaceButton colors={colors} label="Done" onPress={onDone} solid />
        </View>
      ) : null}
    </View>
  );
}

function SurfaceButton({
  colors,
  label,
  onPress,
  solid = false,
  style,
}: {
  colors: CallSurfaceColors;
  label: string;
  onPress: () => void;
  solid?: boolean;
  style?: object;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.surfaceButton,
        { minHeight: Math.max(colors.touchMin, vs(48)) },
        solid
          ? { backgroundColor: colors.brand }
          : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      <AppText style={[styles.surfaceButtonLabel, { color: solid ? colors.onBrand : colors.brand }]}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

function Control({
  colors,
  label,
  icon,
  active = false,
  disabled = false,
  onPress,
}: {
  colors: CallSurfaceColors;
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
        style={[
          styles.controlButton,
          { backgroundColor: colors.card, borderColor: colors.border },
          active && { backgroundColor: colors.brandTint, borderColor: colors.brand },
          disabled && styles.controlDisabled,
        ]}
      >
        {icon}
      </TouchableOpacity>
      <AppText style={[styles.controlLabel, { color: colors.inkMuted }]}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: hs(20),
    justifyContent: 'space-between',
  },
  identity: { alignItems: 'center', marginTop: vs(28) },
  avatar: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  peer: { fontSize: ms(20), lineHeight: ms(26), fontWeight: '600', marginTop: vs(16) },
  order: { fontSize: ms(12), lineHeight: ms(17), fontWeight: '500', marginTop: vs(4) },
  timer: { fontSize: ms(30), lineHeight: ms(36), fontWeight: '500', marginTop: vs(18) },
  status: { fontSize: ms(14), lineHeight: ms(20), marginTop: vs(8), textAlign: 'center' },
  banner: {
    borderRadius: ms(10),
    padding: hs(12),
    marginTop: vs(12),
  },
  bannerText: { fontSize: ms(12), lineHeight: ms(17), fontWeight: '500' },
  fallback: {
    padding: hs(16),
    marginTop: vs(12),
    gap: vs(8),
  },
  fallbackTitle: { fontSize: ms(14), lineHeight: ms(19), fontWeight: '600' },
  fallbackText: { fontSize: ms(12), lineHeight: ms(17), marginBottom: vs(4) },
  answerRow: { flexDirection: 'row', gap: hs(12), marginTop: vs(16) },
  answerButton: { flex: 1 },
  surfaceButton: {
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(16),
  },
  surfaceButtonLabel: { fontSize: ms(14), lineHeight: ms(19), fontWeight: '600' },
  controlsWrap: { alignItems: 'center', gap: vs(18) },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: hs(14), flexWrap: 'wrap' },
  control: { alignItems: 'center', width: ms(68) },
  controlButton: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDisabled: { opacity: 0.4 },
  controlLabel: {
    fontSize: ms(11),
    lineHeight: ms(15),
    marginTop: vs(6),
    textAlign: 'center',
  },
  end: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  endLabel: { fontSize: ms(12), lineHeight: ms(17), fontWeight: '500', marginTop: vs(6) },
  doneWrap: { marginTop: vs(16) },
});
