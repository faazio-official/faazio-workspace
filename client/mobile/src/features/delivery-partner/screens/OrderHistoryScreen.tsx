import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPEmptyState,
  DPErrorState,
  DPSkeleton,
  DPOrderCard,
  DPFadeIn,
  DPTabStrip,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type RiderPayout } from '@/services/api/GatewayClient';
import { vs } from '@/utils/responsive';
import { headlineRupees, lineRupees, formatNumber } from '../format';
import type { DeliveryPartnerStackParamList, DeliveryTabParamList } from '../navigation';
import { DeliveryHeader } from '../components/DeliveryHeader';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DeliveryTabParamList, 'OrderHistory'>,
  NativeStackScreenProps<DeliveryPartnerStackParamList>
>;

type HistoryFilter = 'all' | 'paid' | 'pending';

/**
 * Past-order history derived from the server-side earnings ledger — the same
 * `GET /delivery/payouts` rows shown in Earnings, re-presented per order. No
 * fabricated order-history endpoint: every row is a real completed payout.
 */
export function OrderHistoryScreen({ navigation }: Props) {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('all');

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

  const paidCount = useMemo(() => sorted.filter((p) => p.status === 'PAID').length, [sorted]);
  const filtered = useMemo(
    () =>
      filter === 'all'
        ? sorted
        : sorted.filter((p) => (filter === 'paid' ? p.status === 'PAID' : p.status !== 'PAID')),
    [filter, sorted],
  );

  return (
    <DPPage
      header={<DeliveryHeader />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <DPPageHeader
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
          <DPTabStrip
            style={styles.strip}
            active={filter}
            onChange={(key) => setFilter(key as HistoryFilter)}
            tabs={[
              { key: 'all', label: 'All', count: sorted.length },
              { key: 'paid', label: 'Paid', count: paidCount },
              { key: 'pending', label: 'Pending', count: sorted.length - paidCount },
            ]}
          />
          {filtered.length === 0 ? (
            <DPEmptyState
              compact
              tone="neutral"
              title={`No ${filter} orders`}
              description="Try another filter to see the rest of your history."
            />
          ) : (
            filtered.map((p, index) => (
              <DPFadeIn key={`${p.payoutId ?? p.orderId}-${index}`} index={index}>
                <DPOrderCard
                  style={styles.row}
                  title={`Order ${p.orderId.slice(-6)}`}
                  status={p.status}
                  meta={
                    p.paidAt
                      ? `Paid ${new Date(p.paidAt).toLocaleDateString('en-IN')}`
                      : 'Awaiting settlement'
                  }
                  amount={headlineRupees(p.totalPaisa)}
                  amountNote="earned"
                  submeta={`${formatNumber(p.distanceKm, 1)} km${
                    p.surgePaisa > 0 ? ` · surge ${lineRupees(p.surgePaisa)}` : ''
                  }`}
                  actionLabel="Details"
                  onAction={() => navigation.navigate('EarningsDetail', { orderId: p.orderId })}
                  onPress={() => navigation.navigate('EarningsDetail', { orderId: p.orderId })}
                  accessibilityLabel={`Order ${p.orderId.slice(-6)} details`}
                />
              </DPFadeIn>
            ))
          )}
        </>
      )}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  strip: { marginBottom: vs(12) },
  row: { marginBottom: vs(10) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
});
