import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { TextInput, TextInputProps } from 'react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  /** Fixed leading text inside the box, e.g. a country code (`+91`). */
  prefix?: string;
  /** Imperative handle to the inner input, e.g. a delayed focus after a navigation transition. */
  inputRef?: React.Ref<TextInput>;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/** Labeled input with hint + error row (reference labeled form field). */
export function DPField({
  label,
  hint,
  error,
  prefix,
  inputRef,
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
      <View style={[styles.inputBox, focused && styles.inputBoxFocused, error ? styles.inputBoxError : null]}>
        {prefix ? <AppText style={styles.prefix}>{prefix}</AppText> : null}
        <AppTextInput
          ref={inputRef}
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
          style={[styles.input, style, inputStyle]}
        />
      </View>
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
  label: { ...DP_TYPE.label, color: DELIVERY.inkMuted, marginBottom: vs(6) },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Math.max(DELIVERY.touch.min, vs(48)),
    borderRadius: DELIVERY.radius.md,
    borderWidth: 1,
    borderColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
    paddingHorizontal: hs(12),
  },
  inputBoxFocused: { borderColor: DELIVERY.brand },
  inputBoxError: { borderColor: DELIVERY.danger },
  prefix: { ...DP_TYPE.label, color: DELIVERY.inkMuted, marginRight: hs(8) },
  input: { flex: 1, alignSelf: 'stretch', fontSize: ms(14), color: DELIVERY.ink },
  hint: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle, marginTop: vs(4) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(4) },
});