import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';
import { usePressScale } from './DPPress';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  /** Icon-only control (e.g. a numeric stepper); supply `accessibilityLabel`. */
  iconOnly?: boolean;
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
  iconOnly = false,
  fullWidth = true,
  accessibilityLabel,
  style,
}: DPButtonProps) {
  const inert = disabled || loading;
  const isSolid = variant === 'solid';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  const spinnerColor = isSolid || isDanger ? DELIVERY.onBrand : DELIVERY.brand;
  const { onPressIn, onPressOut, animatedStyle } = usePressScale();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: loading }}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inert}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.default,
        fullWidth && styles.fullWidth,
        isSolid && styles.solid,
        isDanger && styles.danger,
        isGhost && styles.ghost,
        variant === 'outline' && styles.outline,
        inert && styles.inert,
        style,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : iconOnly ? (
        <View style={styles.icon}>{icon}</View>
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
    </AnimatedPressable>
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
  inert: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: hs(8) },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: ms(14), fontWeight: '500' },
  labelSm: { fontSize: ms(13), fontWeight: '500' },
  labelOnBrand: { color: DELIVERY.onBrand },
  labelBrand: { color: DELIVERY.brand },
});
