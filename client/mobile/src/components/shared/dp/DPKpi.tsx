import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TONE, DP_TYPE, type DpTone } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPKpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: DpTone;
  spark?: number[];
  style?: StyleProp<ViewStyle>;
}

/** Compact metric card: big value, label, optional delta and a mini bar sparkline. */
export function DPKpiCard({ label, value, delta, deltaTone = 'success', spark, style }: DPKpiCardProps) {
  const peak = spark && spark.length ? Math.max(...spark, 1) : 1;
  return (
    <View style={[styles.card, style]}>
      <AppText style={styles.value}>{value}</AppText>
      <AppText style={styles.label}>{label}</AppText>
      {delta ? (
        <AppText style={[styles.delta, { color: DP_TONE[deltaTone].fg }]}>{delta}</AppText>
      ) : null}
      {spark && spark.length ? (
        <View style={styles.spark}>
          {spark.map((point, index) => (
            <View
              key={index}
              style={[
                styles.sparkBar,
                {
                  height: Math.max(3, (point / peak) * vs(24)),
                  backgroundColor: index === spark.length - 1 ? DELIVERY.brand : DELIVERY.brandTint,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface DPKpiStripProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Row of equal-width KPI cards (reference 2-column Today's progress grid). */
export function DPKpiStrip({ children, style }: DPKpiStripProps) {
  return <View style={[styles.strip, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: hs(10) },
  card: {
    flex: 1,
    backgroundColor: DELIVERY.card,
    borderRadius: DELIVERY.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DELIVERY.border,
    padding: hs(12),
  },
  value: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '700' },
  label: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
  delta: { ...DP_TYPE.caption, fontWeight: '600', marginTop: vs(4) },
  spark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: ms(2),
    height: vs(24),
    marginTop: vs(8),
  },
  sparkBar: { flex: 1, borderRadius: ms(2) },
});