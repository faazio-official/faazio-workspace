import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import PressableScale from '@/components/shared/PressableScale';
import { neutral, parentRamp } from '@/theme/brandTokens';
import { RADIUS, TOUCH } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Fill colour for the primary variant. Defaults to the parent brand deep. */
  accent?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  accent = parentRamp.deep,
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;
  const palette = variant === 'primary'
    ? { background: accent, text: '#FFFFFF', border: 'transparent' }
    : variant === 'secondary'
      ? { background: neutral.surfaceAlt, text: neutral.ink, border: neutral.border }
      : { background: 'transparent', text: neutral.inkMuted, border: 'transparent' };

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: inactive ? 0.55 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText style={[styles.label, { color: palette.text }]} variant="label" weight="semibold">
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH.min,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    textAlign: 'center',
  },
});

export default Button;