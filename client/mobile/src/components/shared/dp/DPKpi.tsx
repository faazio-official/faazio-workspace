import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, vs } from '@/utils/responsive';

export type DPKpiSize = 'lead' | 'default';

interface DPKpiCardProps {
  label: string;
  value: string;
  /** `lead` makes the card wider with a display-size figure; one leads per strip. */
  size?: DPKpiSize;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Stat card: a label and a big figure. Hierarchy is size and colour, not weight
 * (`docs/UI_DESIGN_SYSTEM.md` §3 Pass 7 — stat cards are numbers, no sparklines,
 * mini bars or filler icons). Sizes vary so one figure leads instead of a row of
 * equal boxes.
 */
export function DPKpiCard({
  label,
  value,
  size = 'default',
  onPress,
  accessibilityLabel,
  style,
}: DPKpiCardProps) {
  const lead = size === 'lead';
  const body = (
    <>
      <AppText
        style={[styles.value, lead && styles.valueLead]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </AppText>
      <AppText style={styles.label}>{label}</AppText>
    </>
  );

  if (!onPress) {
    return <View style={[styles.card, lead && styles.cardLead, style]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, lead && styles.cardLead, pressed && styles.pressed, style]}
    >
      {body}
    </Pressable>
  );
}

interface DPKpiStripProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Row of KPI cards (reference "Today's progress" grid). */
export function DPKpiStrip({ children, style }: DPKpiStripProps) {
  return <View style={[styles.strip, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: hs(10) },
  card: {
    flex: 1,
    backgroundColor: DELIVERY.card,
    borderRadius: DELIVERY.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DELIVERY.border,
    padding: hs(12),
  },
  cardLead: { flex: 1.6 },
  pressed: { opacity: 0.85 },
  value: { ...DP_TYPE.title, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  valueLead: { ...DP_TYPE.display, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  label: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
});
