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
import {
  gateway,
  type PayoutSettings,
  type PayoutSummary,
  type RiderPayout,
} from '@/services/api/GatewayClient';
import { hs, vs } from '@/utils/responsive';
import { formatNumber, headlineRupees, lineRupees } from '../format';
import type { DeliveryPartnerStackParamList, DeliveryTabParamList } from '../navigation';
import { DeliveryHeader } from '../components/DeliveryHeader';
import { PayoutBreakdownModal } from './PayoutBreakdownModal';

function paidAmount(payout: RiderPayout): number {
  return payout.status === 'PAID' ? payout.totalPaisa : payout.paidAmountPaisa ?? 0;
}

/** A stable, collision-safe short reference for each order in the list (IDs share suffixes rarely
 * but the last-6 slice alone is not guaranteed unique). Extends the suffix until unique. */
function buildOrderRefs(orderIds: string[]): Map<string, string> {
  const refs = new Map<string, string>();
  const groups = new Map<string, string[]>();
  for (const id of orderIds) {
    const suffix = id.slice(-6);
    const group = groups.get(suffix) ?? [];
    group.push(id);
    groups.set(suffix, group);
  }
  for (const [suffix, ids] of groups) {
    if (ids.length === 1) {
      refs.set(ids[0], suffix);
      continue;
    }
    for (const id of ids) {
      let length = Math.min(7, id.length);
      let ref = id.slice(-length);
      while (length < id.length && ids.some((other) => other !== id && other.slice(-length) === ref)) {
        length += 1;
        ref = id.slice(-length);
      }
      refs.set(id, ref);
    }
  }
  return refs;
}

function rateCardRupees(paisa: number): string {
  // Keep whole-rupee rates clean; show paise when the admin set a non-round value.
  return paisa % 100 === 0 ? headlineRupees(paisa) : lineRupees(paisa);
}

function rateCardNote(card: PayoutSettings | null): string {
  const settlement = 'Faazio settles the total; bank credit timing depends on the payout run.';
  if (!card) {
    return `Payout follows Faazio's per-job distance and surge rate card. ${settlement}`;
  }
  const baseKm = formatNumber(card.baseDistanceKm, Number.isInteger(card.baseDistanceKm) ? 0 : 1);
  return (
    `Payout = ${rateCardRupees(card.baseRatePaisa)} base for the first ${baseKm} km + ` +
    `${rateCardRupees(card.perExtraKmPaisa)}/km after, plus night (11 PM–3 AM), weather and ` +
    `festival surge. ${settlement}`
  );
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
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [rateCard, setRateCard] = useState<PayoutSettings | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, totals, card] = await Promise.all([
        gateway.getDeliveryPayouts(50),
        gateway.getDeliveryPayoutsSummary().catch(() => null),
        gateway.getDeliveryPayoutSettings().catch(() => null),
      ]);
      setPayouts(Array.isArray(rows) ? rows : []);
      setSummary(totals);
      setRateCard(card);
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
    if (summary) {
      return { pending: summary.pendingPaisa, paid: summary.paidPaisa };
    }
    let pendingTotal = 0;
    let paidTotal = 0;
    for (const p of payouts) {
      const paidNow = paidAmount(p);
      paidTotal += paidNow;
      pendingTotal += Math.max(0, p.totalPaisa - paidNow);
    }
    return { pending: pendingTotal, paid: paidTotal };
  }, [payouts, summary]);

  const orderRefs = useMemo(() => buildOrderRefs(payouts.map((p) => p.orderId)), [payouts]);

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

            <AppText style={styles.note}>{rateCardNote(rateCard)}</AppText>

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
                const orderRef = orderRefs.get(p.orderId) ?? p.orderId.slice(-6);
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
        orderRef={
          selectedPayout ? orderRefs.get(selectedPayout.orderId) ?? selectedPayout.orderId.slice(-6) : undefined
        }
        baseDistanceKm={rateCard?.baseDistanceKm}
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