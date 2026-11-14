import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TONE, DP_TYPE, type DpTone } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPTimerProps {
  seconds: number;
  /** Below this threshold the timer flips to the danger tone. */
  dangerAt?: number;
  label?: string;
}

/**
 * Countdown for the 45 s offer window. The app ships no custom monospace font, so
 * `tabular-nums` gives the same fixed-width digits without a new font module.
 */
export function DPTimer({ seconds, dangerAt = 10, label }: DPTimerProps) {
  const tone: DpTone = seconds <= dangerAt ? 'danger' : seconds <= dangerAt * 3 ? 'warning' : 'brand';
  const colors = DP_TONE[tone];
  return (
    <View style={styles.wrap}>
      <AppText style={[styles.value, { color: colors.fg, fontVariant: ['tabular-nums'] }]}>
        {seconds}s
      </AppText>
      {label ? <AppText style={[styles.label, { color: colors.fg }]}>{label}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  value: { ...DP_TYPE.timer, letterSpacing: 0.5 },
  label: { fontSize: ms(10), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: vs(2) },
});