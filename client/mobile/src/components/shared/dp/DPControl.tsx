import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPSwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** Pill track + sliding knob (reference online/offline switch). */
export function DPSwitch({ value, onValueChange, disabled, accessibilityLabel, style }: DPSwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      style={[styles.track, value ? styles.trackOn : styles.trackOff, disabled && styles.disabled, style]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

interface DPToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}

/** Settings toggle row: label + description on the left, switch on the right. */
export function DPToggle({ label, description, value, onValueChange, disabled }: DPToggleProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <AppText style={styles.rowLabel}>{label}</AppText>
        {description ? <AppText style={styles.rowDescription}>{description}</AppText> : null}
      </View>
      <DPSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={`${label} toggle`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: ms(50),
    height: ms(30),
    borderRadius: DELIVERY.radius.pill,
    padding: ms(3),
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: DELIVERY.success },
  trackOff: { backgroundColor: DELIVERY.inkSubtle },
  disabled: { opacity: 0.5 },
  knob: { width: ms(24), height: ms(24), borderRadius: DELIVERY.radius.pill, backgroundColor: DELIVERY.card },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(12), paddingVertical: vs(10) },
  rowText: { flex: 1 },
  rowLabel: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  rowDescription: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
});