import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPButton,
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPSectionHeader,
  DPKpiStrip,
  DPKpiCard,
  DPStatusPill,
  DPEmptyState,
  DPErrorState,
  DPSkeleton,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type RiderPayout } from '@/services/api/GatewayClient';
import { hs, vs } from '@/utils/responsive';
import { headlineRupees } from '../format';
import type { DeliveryPartnerStackParamList, DeliveryTabParamList } from '../navigation';
import { DeliveryHeader } from '../components/DeliveryHeader';
import { PayoutBreakdownModal } from './PayoutBreakdownModal';

function paidAmount(payout: RiderPayout): number {
  return payout.status === 'PAID' ? payout.totalPaisa : payout.paidAmountPaisa ?? 0;
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<DeliveryTabParamList, 'Payouts'>,
  NativeStackScreenProps<DeliveryPartnerStackParamList>
>;

export function PayoutScreen({ navigation }: Props) {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<RiderPayout | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await gateway.getDeliveryPayouts(50);
      setPayouts(Array.isArray(rows) ? rows : []);
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
      const paidNow = paidAmount(p);
      paidTotal += paidNow;
      pendingTotal += Math.max(0, p.totalPaisa - paidNow);
    }
    return { pending: pendingTotal, paid: paidTotal };
  }, [payouts]);

  return (
    <>
      <DPPage
        header={<DeliveryHeader />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <DPPageHeader title="Payouts" description="Per-job payout, distance and settlement status." />

        {loading && payouts.length === 0 ? (
          <DPSkeleton lines={6} />
        ) : error && payouts.length === 0 ? (
          <DPErrorState description={error} onRetry={() => void load()} />
        ) : (
          <>
            <DPKpiStrip style={styles.summaryRow}>
              <DPKpiCard label="Pending" value={headlineRupees(pending)} size="lead" />
              <DPKpiCard label="Paid out" value={headlineRupees(paid)} />
            </DPKpiStrip>

            <AppText style={styles.note}>
              Payout = ₹30 base for the first 3 km + ₹7/km after, plus night (11 PM–3 AM), weather and
              festival surge. Faazio settles the total; bank credit timing depends on the payout run.
            </AppText>

            {error ? <AppText style={styles.error}>{error}</AppText> : null}

            <DPSectionHeader title="Recent jobs" style={styles.section} />
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
              payouts.map((p) => {
                const orderRef = p.orderId.slice(-6);
                return (
                  <TouchableOpacity
                    key={p.payoutId ?? p.orderId}
                    onPress={() => navigation.navigate('EarningsDetail', { orderId: p.orderId })}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Order ${orderRef}, ${headlineRupees(p.totalPaisa)}, ${p.status}. Opens full breakdown.`}
                  >
                    <DPSectionCard style={styles.row}>
                      <View style={styles.rowTop}>
                        <AppText style={styles.rowTitle}>Order {orderRef}</AppText>
                        <DPStatusPill status={p.status} />
                      </View>
                      <View style={styles.rowAmount}>
                        <AppText style={styles.rowTotalLabel}>Total payout</AppText>
                        <AppText style={styles.rowTotal}>{headlineRupees(p.totalPaisa)}</AppText>
                      </View>
                      <View style={styles.rowFooter}>
                        <DPButton
                          label="View breakdown"
                          variant="outline"
                          size="sm"
                          fullWidth={false}
                          onPress={() => setSelectedPayout(p)}
                          accessibilityLabel={`View breakdown for order ${orderRef}`}
                        />
                      </View>
                    </DPSectionCard>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </DPPage>

      <PayoutBreakdownModal
        visible={selectedPayout !== null}
        payout={selectedPayout}
        onClose={() => setSelectedPayout(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  summaryRow: { marginBottom: vs(10) },
  note: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(10) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(10) },
  section: { marginTop: DELIVERY.space.SECTION },
  row: { marginBottom: vs(10) },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  rowTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  rowAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: hs(10),
    marginTop: vs(10),
  },
  rowTotalLabel: { ...DP_TYPE.caption, color: DELIVERY.inkMuted },
  rowTotal: { ...DP_TYPE.title, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  rowFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: vs(10) },
});