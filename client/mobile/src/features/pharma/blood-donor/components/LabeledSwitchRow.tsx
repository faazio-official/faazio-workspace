import React, { type ReactNode } from 'react';
import { StyleSheet, View, Switch } from 'react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_RED, BLOOD_RED_TINT, BLOOD_TEXT, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

interface LabeledSwitchRowProps {
  /** Icon chip shown to the left of the label. */
  icon: ReactNode;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

/** Red-tint icon chip + semibold label + native `Switch` row. */
export function LabeledSwitchRow({ icon, label, value, onValueChange }: LabeledSwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconChip}>{icon}</View>
      <AppText style={styles.label}>{label}</AppText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E2E8F0', true: BLOOD_RED }}
        thumbColor="#ffffff"
        ios_backgroundColor="#E2E8F0"
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(14),
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
  },
  iconChip: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: BLOOD_RED_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: ms(14),
    fontWeight: '700',
    color: BLOOD_TEXT,
  },
});
