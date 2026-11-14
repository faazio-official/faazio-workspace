import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPFilterChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Active/inactive pill chip (reference rounded-full filter buttons). */
export function DPFilterChip({
  label,
  active = false,
  onPress,
  disabled = false,
  accessibilityLabel,
}: DPFilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.active : styles.inactive,
        disabled && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <AppText style={[styles.text, active ? styles.textActive : styles.textInactive]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: vs(30),
    borderRadius: DELIVERY.radius.pill,
    paddingHorizontal: hs(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: DELIVERY.brand },
  inactive: {
    backgroundColor: DELIVERY.card,
    borderWidth: 1,
    borderColor: DELIVERY.border,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { fontSize: ms(12), fontWeight: '600' },
  textActive: { color: DELIVERY.onBrand },
  textInactive: { color: DELIVERY.inkMuted },
});