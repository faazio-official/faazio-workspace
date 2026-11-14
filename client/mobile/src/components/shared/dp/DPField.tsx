import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { TextInputProps } from 'react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/** Labeled input with hint + error row (reference labeled form field). */
export function DPField({
  label,
  hint,
  error,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  style,
  ...props
}: DPFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <AppText style={styles.label}>{label}</AppText>
      <AppTextInput
        {...props}
        placeholderTextColor={DELIVERY.inkSubtle}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null, style, inputStyle]}
      />
      {error ? (
        <AppText style={styles.error}>{error}</AppText>
      ) : hint ? (
        <AppText style={styles.hint}>{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: vs(12) },
  label: { ...DP_TYPE.kicker, color: DELIVERY.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: vs(6) },
  input: {
    minHeight: Math.max(DELIVERY.touch.min, vs(48)),
    borderRadius: DELIVERY.radius.md,
    borderWidth: 1,
    borderColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    color: DELIVERY.ink,
  },
  inputFocused: { borderColor: DELIVERY.brand },
  inputError: { borderColor: DELIVERY.danger },
  hint: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle, marginTop: vs(4) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(4) },
});