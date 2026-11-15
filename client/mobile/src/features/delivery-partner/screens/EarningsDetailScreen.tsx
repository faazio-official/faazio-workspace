import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPStatusPill,
  DPKeyValueRow,
  DPErrorState,
  DPSkeleton,
  DPSeparator,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type RiderPayout } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';
import { formatRupees, formatNumber } from '../format';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'EarningsDetail'>;

/** Headline total is whole rupees; itemised ledger lines carry paise. */
const headline = (paisa: number) => formatRupees(paisa);
const line = (paisa: number) => formatRupees(paisa, 2);

/** Single-order payout breakdown from `GET /delivery/payouts/{orderId}`. */
export function EarningsDetailScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [payout, setPayout] = useState<RiderPayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayout(await gateway.getDeliveryPayout(orderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this payout.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const paidNow = payout ? (payout.paidAmountPaisa ?? (payout.status === 'PAID' ? payout.totalPaisa : 0)) : 0;
  const balance = payout ? Math.max(0, payout.totalPaisa - paidNow) : 0;

  return (
    <DPPage>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={ms(18)} color={DELIVERY.brand} strokeWidth={2} />
        <AppText style={styles.backText}>Back</AppText>
      </TouchableOpacity>
      <DPPageHeader kicker="Payout breakdown" title={`Order ${orderId.slice(-6)}`} />

      {loading && !payout ? (
        <DPSkeleton lines={5} />
      ) : error && !payout ? (
        <DPErrorState description={error} onRetry={() => void load()} />
      ) : payout ? (
        <>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          <DPSectionCard style={styles.card}>
            <View style={styles.rowBetween}>
              <AppText style={styles.totalLabel}>Total payout</AppText>
              <DPStatusPill status={payout.status} />
            </View>
            <AppText style={styles.total}>{headline(payout.totalPaisa)}</AppText>
            <DPSeparator />
            <DPKeyValueRow label="Distance" value={`${formatNumber(payout.distanceKm, 1)} km`} />
            <DPKeyValueRow label="Base (first 3 km)" value={line(payout.baseRatePaisa)} />
            <DPKeyValueRow label="Extra km" value={line(payout.extraKmChargePaisa)} />
            <DPKeyValueRow
              label={payout.surgeReason ? `Surge · ${payout.surgeReason}` : 'Surge'}
              value={line(payout.surgePaisa)}
              valueTone={payout.surgePaisa > 0 ? 'warning' : undefined}
            />
            <DPSeparator />
            <DPKeyValueRow label="Paid so far" value={line(paidNow)} valueTone="success" />
            <DPKeyValueRow label="Balance" value={line(balance)} valueTone={balance > 0 ? 'warning' : 'success'} />
            {payout.paidAt ? (
              <DPKeyValueRow label="Paid on" value={new Date(payout.paidAt).toLocaleDateString('en-IN')} />
            ) : null}
          </DPSectionCard>
          <AppText style={styles.note}>
            Amounts are server-derived from the stored distance and surge basis. Disbursement is
            recorded by a Faazio admin; bank credit timing depends on the payout run.
          </AppText>
        </>
      ) : null}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: hs(2), alignSelf: 'flex-start', paddingTop: vs(8), paddingBottom: vs(4) },
  backText: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '600' },
  card: { marginBottom: vs(12) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  totalLabel: { ...DP_TYPE.kicker, color: DELIVERY.inkMuted },
  total: { ...DP_TYPE.display, color: DELIVERY.ink, marginTop: vs(4), fontVariant: ['tabular-nums'] },
  note: { ...DP_TYPE.caption, color: DELIVERY.inkMuted },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
});