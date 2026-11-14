import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TONE, DP_TYPE, type DpTone } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPKeyValueRowProps {
  label: string;
  value: string;
  valueTone?: DpTone;
  style?: StyleProp<ViewStyle>;
}

/** Label / value pair used in detail cards (offer, earnings, profile). */
export function DPKeyValueRow({ label, value, valueTone, style }: DPKeyValueRowProps) {
  return (
    <View style={[styles.kvRow, style]}>
      <AppText style={styles.kvLabel}>{label}</AppText>
      <AppText style={[styles.kvValue, valueTone ? { color: DP_TONE[valueTone].fg } : null]}>
        {value}
      </AppText>
    </View>
  );
}

interface DPListRowProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Tappable list row with an optional chevron, matching the reference service rows. */
export function DPListRow({ title, subtitle, right, onPress, accessibilityLabel, style }: DPListRowProps) {
  const content = (
    <>
      <View style={styles.listText}>
        <AppText style={styles.listTitle}>{title}</AppText>
        {subtitle ? <AppText style={styles.listSubtitle}>{subtitle}</AppText> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={ms(18)} color={DELIVERY.inkSubtle} strokeWidth={2} /> : null)}
    </>
  );

  if (!onPress) {
    return <View style={[styles.listRow, style]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

interface DPAvatarProps {
  name: string;
  size?: number;
  tone?: DpTone;
}

/** Initials avatar (reference profile header). */
export function DPAvatar({ name, size = 48, tone = 'brand' }: DPAvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      style={{
        width: ms(size),
        height: ms(size),
        borderRadius: ms(size / 2),
        backgroundColor: DP_TONE[tone].bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText style={{ fontSize: ms(size / 2.6), fontWeight: '700', color: DP_TONE[tone].fg }}>
        {initials || 'F'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    paddingVertical: vs(6),
  },
  kvLabel: { ...DP_TYPE.body, color: DELIVERY.inkMuted, flexShrink: 1 },
  kvValue: { ...DP_TYPE.body, color: DELIVERY.ink, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  listRow: {
    minHeight: Math.max(DELIVERY.touch.min, vs(52)),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingVertical: vs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DELIVERY.border,
  },
  pressed: { opacity: 0.7 },
  listText: { flex: 1 },
  listTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  listSubtitle: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
});