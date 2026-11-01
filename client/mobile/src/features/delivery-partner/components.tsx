import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  StyleProp,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import { semantic } from '@/theme/brandTokens';

export const DP = {
  brand: '#2c56f6',
  brandDark: '#122bb3',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  bg: '#f8fafc',
  card: '#ffffff',
  danger: '#dc2626',
  success: semantic.success,
  warning: '#b45309',
} as const;

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }, style]}>{children}</View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <AppTextInput
        placeholderTextColor="#94a3b8"
        {...props}
        style={[styles.input, props.style]}
      />
      {hint ? <AppText style={styles.hint}>{hint}</AppText> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'solid' | 'ghost' | 'danger';
}) {
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isGhost && styles.buttonGhost,
        isDanger && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading ? styles.buttonPressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? DP.brand : '#ffffff'} />
      ) : (
        <AppText style={[styles.buttonText, isGhost && styles.buttonGhostText]}>{label}</AppText>
      )}
    </Pressable>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'ACTIVE' || status === 'PAID'
      ? DP.success
      : status === 'REJECTED' || status === 'BLACKLISTED' || status === 'SUSPENDED'
        ? DP.danger
        : DP.warning;
  return (
    <View style={[styles.pill, { borderColor: tone }]}>
      <AppText style={[styles.pillText, { color: tone }]}>{status.replace(/_/g, ' ')}</AppText>
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <AppText style={styles.error}>{children}</AppText>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DP.bg },
  card: {
    backgroundColor: DP.card,
    borderRadius: ms(16),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DP.line,
    padding: hs(16),
  },
  field: { marginBottom: vs(12) },
  label: { fontSize: ms(11), fontWeight: '800', color: DP.muted, marginBottom: vs(6), textTransform: 'uppercase' },
  input: {
    minHeight: vs(48),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: DP.line,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    color: DP.ink,
  },
  hint: { fontSize: ms(11), color: DP.muted, marginTop: vs(4) },
  button: {
    minHeight: vs(50),
    borderRadius: ms(12),
    backgroundColor: DP.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(16),
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.5 },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: DP.brand },
  buttonDanger: { backgroundColor: DP.danger },
  buttonText: { fontSize: ms(14), fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.4 },
  buttonGhostText: { color: DP.brand },
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: ms(999),
    paddingHorizontal: hs(10),
    paddingVertical: vs(3),
  },
  pillText: { fontSize: ms(10), fontWeight: '900', letterSpacing: 0.5 },
  error: { fontSize: ms(12), color: DP.danger, marginBottom: vs(8) },
});
