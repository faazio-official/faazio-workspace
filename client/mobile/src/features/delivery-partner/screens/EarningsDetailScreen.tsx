import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPBackLink,
  DPSectionCard,
  DPStatusPill,
  DPKeyValueRow,
  DPErrorState,
  DPSkeleton,
  DPSeparator,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type RiderPayout } from '@/services/api/GatewayClient';
import { hs, vs } from '@/utils/responsive';
import { headlineRupees, lineRupees, formatNumber } from '../format';
import type { DeliveryPartnerStackParamList } from '../navigation';
import { DeliveryHeader } from '../components/DeliveryHeader';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'EarningsDetail'>;

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
    <DPPage header={<DeliveryHeader />}>
      <DPBackLink onPress={() => navigation.goBack()} />
      <DPPageHeader title={`Order ${orderId.slice(-6)}`} description="Payout breakdown" />

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
            <AppText style={styles.total}>{headlineRupees(payout.totalPaisa)}</AppText>
            <DPSeparator />
            <DPKeyValueRow label="Distance" value={`${formatNumber(payout.distanceKm, 1)} km`} />
            <DPKeyValueRow label="Base (first 3 km)" value={lineRupees(payout.baseRatePaisa)} />
            <DPKeyValueRow label="Extra km" value={lineRupees(payout.extraKmChargePaisa)} />
            <DPKeyValueRow
              label={payout.surgeReason ? `Surge · ${payout.surgeReason}` : 'Surge'}
              value={lineRupees(payout.surgePaisa)}
              valueTone={payout.surgePaisa > 0 ? 'warning' : undefined}
            />
            <DPSeparator />
            <DPKeyValueRow label="Paid so far" value={lineRupees(paidNow)} valueTone="success" />
            <DPKeyValueRow label="Balance" value={lineRupees(balance)} valueTone={balance > 0 ? 'warning' : 'success'} />
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
  card: { marginBottom: vs(12) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  totalLabel: { ...DP_TYPE.micro, color: DELIVERY.inkMuted },
  total: { ...DP_TYPE.display, color: DELIVERY.ink, marginTop: vs(4), fontVariant: ['tabular-nums'] },
  note: { ...DP_TYPE.caption, color: DELIVERY.inkMuted },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
});