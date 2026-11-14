import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPStatusPill,
  DPEmptyState,
  DPErrorState,
  DPSkeleton,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type RiderPayout } from '@/services/api/GatewayClient';
import { DeliveryTabBar } from '../components/DeliveryTabBar';
import { hs, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'OrderHistory'>;

const rupees = (paisa: number) =>
  `₹${(paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Past-order history derived from the server-side earnings ledger — the same
 * `GET /delivery/payouts` rows shown in Earnings, re-presented per order. No
 * fabricated order-history endpoint: every row is a real completed payout.
 */
export function OrderHistoryScreen({ navigation }: Props) {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayouts(await gateway.getDeliveryPayouts(100));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your order history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      [...payouts].sort((a, b) => {
        const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return bTime - aTime;
      }),
    [payouts],
  );

  return (
    <DPPage
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      footer={<DeliveryTabBar active="OrderHistory" navigation={navigation} />}
    >
      <DPPageHeader
        kicker="Orders"
        title="Order history"
        description="Completed deliveries with their distance, surge and settlement status."
      />

      {loading && sorted.length === 0 ? (
        <DPSkeleton lines={4} />
      ) : error && sorted.length === 0 ? (
        <DPErrorState description={error} onRetry={() => void load()} />
      ) : sorted.length === 0 ? (
        <DPEmptyState
          title="No completed orders yet"
          description="Finished deliveries appear here with their payout breakdown."
        />
      ) : (
        <>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {sorted.map((p) => (
            <TouchableOpacity
              key={p.payoutId ?? p.orderId}
              onPress={() => navigation.navigate('EarningsDetail', { orderId: p.orderId })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Order ${p.orderId.slice(-6)} details`}
            >
              <DPSectionCard style={styles.row}>
                <View style={styles.rowBetween}>
                  <AppText style={styles.rowTitle}>Order {p.orderId.slice(-6)}</AppText>
                  <DPStatusPill status={p.status} />
                </View>
                <AppText style={styles.rowMeta}>
                  {p.distanceKm.toFixed(1)} km · {rupees(p.totalPaisa)} earned
                  {p.surgePaisa > 0 ? ` · surge ${rupees(p.surgePaisa)}` : ''}
                </AppText>
                <View style={styles.rowBetween}>
                  <AppText style={styles.rowMeta}>
                    {p.paidAt ? `Paid ${new Date(p.paidAt).toLocaleDateString('en-IN')}` : 'Awaiting settlement'}
                  </AppText>
                  <AppText style={styles.open}>Details →</AppText>
                </View>
              </DPSectionCard>
            </TouchableOpacity>
          ))}
        </>
      )}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: vs(10) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  rowTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  rowMeta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(4), flexShrink: 1 },
  open: { ...DP_TYPE.caption, fontWeight: '600', color: DELIVERY.brand, marginTop: vs(4) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
});