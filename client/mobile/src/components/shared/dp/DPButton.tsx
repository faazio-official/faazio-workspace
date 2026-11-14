import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

export type DPButtonVariant = 'solid' | 'ghost' | 'outline' | 'danger';
export type DPButtonSize = 'sm' | 'default';

interface DPButtonProps {
  label: string;
  onPress: () => void;
  variant?: DPButtonVariant;
  size?: DPButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Delivery button. The reference mobile view is a flat brand primary (`bg-primary`)
 * with ghost/outline/destructive siblings, so `solid` fills with the brand anchor
 * (no gradient library, no re-literal). Preserves `accessibilityRole="button"` so
 * existing behaviour tests keep querying by role + label.
 */
export function DPButton({
  label,
  onPress,
  variant = 'solid',
  size = 'default',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  accessibilityLabel,
  style,
}: DPButtonProps) {
  const inert = disabled || loading;
  const isSolid = variant === 'solid';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  const spinnerColor = isSolid || isDanger ? DELIVERY.onBrand : DELIVERY.brand;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: loading }}
      onPress={onPress}
      disabled={inert}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.default,
        fullWidth && styles.fullWidth,
        isSolid && styles.solid,
        isDanger && styles.danger,
        isGhost && styles.ghost,
        variant === 'outline' && styles.outline,
        inert && styles.inert,
        pressed && !inert ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <AppText
            style={[
              styles.label,
              size === 'sm' && styles.labelSm,
              isSolid || isDanger ? styles.labelOnBrand : styles.labelBrand,
            ]}
          >
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: DELIVERY.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(16),
  },
  default: { minHeight: Math.max(DELIVERY.touch.min, vs(48)) },
  sm: { minHeight: DELIVERY.touch.min, paddingHorizontal: hs(12) },
  fullWidth: { alignSelf: 'stretch' },
  solid: { backgroundColor: DELIVERY.brand },
  danger: { backgroundColor: DELIVERY.danger },
  ghost: { backgroundColor: 'transparent' },
  outline: {
    backgroundColor: DELIVERY.card,
    borderWidth: 1,
    borderColor: DELIVERY.border,
  },
  pressed: { opacity: 0.9 },
  inert: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: hs(8) },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: ms(14), fontWeight: '600', letterSpacing: 0.2 },
  labelSm: { fontSize: ms(13) },
  labelOnBrand: { color: DELIVERY.onBrand },
  labelBrand: { color: DELIVERY.brand },
});
