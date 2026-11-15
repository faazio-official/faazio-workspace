import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPKpiStrip,
  DPKpiCard,
  DPStatusPill,
  DPEmptyState,
  DPErrorState,
  DPSkeleton,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type RiderPayout } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';
import { formatRupees, formatNumber } from '../format';
import type { DeliveryPartnerStackParamList, DeliveryTabParamList } from '../navigation';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DeliveryTabParamList, 'Payouts'>,
  NativeStackScreenProps<DeliveryPartnerStackParamList>
>;

/** Headline sums (KPI figures) render whole rupees; itemised lines carry paise. */
const headline = (paisa: number) => formatRupees(paisa);
const line = (paisa: number) => formatRupees(paisa, 2);

export function PayoutScreen({ navigation }: Props) {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayouts(await gateway.getDeliveryPayouts(50));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your payouts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { pending, paid } = useMemo(() => {
    let pendingTotal = 0;
    let paidTotal = 0;
    for (const p of payouts) {
      const paidNow = p.paidAmountPaisa ?? (p.status === 'PAID' ? p.totalPaisa : 0);
      paidTotal += paidNow;
      pendingTotal += Math.max(0, p.totalPaisa - paidNow);
    }
    return { pending: pendingTotal, paid: paidTotal };
  }, [payouts]);

  return (
    <DPPage
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <DPPageHeader kicker="Earnings" title="Payouts" description="Per-job payout, distance and settlement status." />

      {loading && payouts.length === 0 ? (
        <DPSkeleton lines={6} />
      ) : error && payouts.length === 0 ? (
        <DPErrorState description={error} onRetry={() => void load()} />
      ) : (
        <>
          <DPKpiStrip style={styles.summaryRow}>
            <DPKpiCard label="Pending" value={headline(pending)} size="lead" />
            <DPKpiCard label="Paid out" value={headline(paid)} />
          </DPKpiStrip>

          <AppText style={styles.note}>
            Payout = ₹30 base for the first 3 km + ₹7/km after, plus night (11 PM–3 AM), weather and
            festival surge. Faazio settles the total; bank credit timing depends on the payout run.
          </AppText>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          <AppText style={styles.sectionTitle}>Recent jobs</AppText>
          {payouts.length === 0 ? (
            <DPSectionCard>
              <DPEmptyState
                compact
                title="No payouts yet"
                description="Completed deliveries appear here with their distance and surge breakdown."
                tone="brand"
              />
            </DPSectionCard>
          ) : (
            payouts.map((p, index) => {
              const paidNow = p.paidAmountPaisa ?? (p.status === 'PAID' ? p.totalPaisa : 0);
              const balance = Math.max(0, p.totalPaisa - paidNow);
              return (
                <TouchableOpacity
                  key={`${p.payoutId ?? p.orderId}-${index}`}
                  onPress={() => navigation.navigate('EarningsDetail', { orderId: p.orderId })}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${p.orderId.slice(-6)} earnings`}
                >
                  <DPSectionCard style={styles.row}>
                    <View style={styles.rowBetween}>
                      <AppText style={styles.rowTitle}>Order {p.orderId.slice(-6)}</AppText>
                      <DPStatusPill status={p.status} />
                    </View>
                    <AppText style={styles.rowMeta}>
                      {formatNumber(p.distanceKm, 1)} km · base {line(p.baseRatePaisa)} · extra km{' '}
                      {line(p.extraKmChargePaisa)}
                      {p.surgePaisa > 0 ? ` · surge ${line(p.surgePaisa)}` : ''}
                    </AppText>
                    {p.surgeReason ? <AppText style={styles.rowMeta}>Surge: {p.surgeReason}</AppText> : null}
                    <View style={styles.rowBetween}>
                      <AppText style={styles.rowTotal}>{headline(p.totalPaisa)}</AppText>
                      <AppText style={styles.rowMeta}>
                        {paidNow > 0 ? `Paid ${line(paidNow)}` : ''}
                        {balance > 0 ? ` · Balance ${line(balance)}` : ''}
                        {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString('en-IN')}` : ''}
                      </AppText>
                    </View>
                    <View style={styles.openRow}>
                      <AppText style={styles.open}>View breakdown</AppText>
                      <ChevronRight size={ms(14)} color={DELIVERY.brand} strokeWidth={2} />
                    </View>
                  </DPSectionCard>
                </TouchableOpacity>
              );
            })
          )}
        </>
      )}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  summaryRow: { marginBottom: vs(10) },
  note: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(10) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(10) },
  sectionTitle: {
    ...DP_TYPE.label,
    color: DELIVERY.ink,
    fontWeight: '600',
    marginTop: DELIVERY.space.SECTION,
    marginBottom: DELIVERY.space.BLOCK,
  },
  row: { marginBottom: vs(10) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  rowTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  rowMeta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(4), flexShrink: 1 },
  rowTotal: { ...DP_TYPE.title, color: DELIVERY.ink, marginTop: vs(8), fontVariant: ['tabular-nums'] },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: hs(2), marginTop: vs(8) },
  open: { ...DP_TYPE.caption, fontWeight: '600', color: DELIVERY.brand },
});