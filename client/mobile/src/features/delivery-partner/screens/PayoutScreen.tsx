import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { gateway, type RiderPayout } from '@/services/api/GatewayClient';
import { Card, DP, ErrorText, Screen, StatusPill } from '../components';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'Payouts'>;

const rupees = (paisa: number) =>
  `₹${(paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function PayoutScreen({ navigation }: Props) {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(false);
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
      if (p.status === 'PAID') paidTotal += p.totalPaisa;
      else pendingTotal += p.totalPaisa;
    }
    return { pending: pendingTotal, paid: paidTotal };
  }, [payouts]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <AppText style={styles.backText}>←</AppText>
          </TouchableOpacity>
          <AppText style={styles.title}>Earnings</AppText>
        </View>

        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <AppText style={styles.summaryLabel}>Pending</AppText>
            <AppText style={styles.summaryValue}>{rupees(pending)}</AppText>
          </Card>
          <Card style={styles.summaryCard}>
            <AppText style={styles.summaryLabel}>Paid out</AppText>
            <AppText style={styles.summaryValue}>{rupees(paid)}</AppText>
          </Card>
        </View>

        <AppText style={styles.note}>
          Payout = ₹30 base for the first 3 km + ₹7/km after, plus night (11 PM–3 AM), weather and
          festival surge. Faazio settles the total; bank credit timing depends on the payout run.
        </AppText>

        <ErrorText>{error}</ErrorText>

        <AppText style={styles.sectionTitle}>Recent jobs</AppText>
        {payouts.length === 0 && !loading ? (
          <Card>
            <AppText style={styles.empty}>
              No payouts yet. Completed deliveries appear here with their distance and surge
              breakdown.
            </AppText>
          </Card>
        ) : (
          payouts.map((p) => (
            <Card key={p.payoutId ?? p.orderId} style={styles.row}>
              <View style={styles.rowBetween}>
                <AppText style={styles.rowTitle}>Order {p.orderId.slice(-6)}</AppText>
                <StatusPill status={p.status} />
              </View>
              <AppText style={styles.rowMeta}>
                {p.distanceKm.toFixed(1)} km · base {rupees(p.baseRatePaisa)} · extra km{' '}
                {rupees(p.extraKmChargePaisa)}
                {p.surgePaisa > 0 ? ` · surge ${rupees(p.surgePaisa)}` : ''}
              </AppText>
              {p.surgeReason ? <AppText style={styles.rowMeta}>Surge: {p.surgeReason}</AppText> : null}
              <View style={styles.rowBetween}>
                <AppText style={styles.rowTotal}>{rupees(p.totalPaisa)}</AppText>
                {p.paidAt ? (
                  <AppText style={styles.rowMeta}>
                    Paid {new Date(p.paidAt).toLocaleDateString('en-IN')}
                  </AppText>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(16), paddingBottom: vs(40) },
  header: { flexDirection: 'row', alignItems: 'center', gap: hs(8), marginTop: vs(12), marginBottom: vs(16) },
  back: { paddingVertical: vs(4), paddingRight: hs(4) },
  backText: { fontSize: ms(22), fontWeight: '900', color: DP.ink },
  title: { fontSize: ms(20), fontWeight: '900', color: DP.ink },
  summaryRow: { flexDirection: 'row', gap: hs(10) },
  summaryCard: { flex: 1 },
  summaryLabel: {
    fontSize: ms(10),
    fontWeight: '900',
    color: DP.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: { fontSize: ms(22), fontWeight: '900', color: DP.ink, marginTop: vs(4) },
  note: { fontSize: ms(11), lineHeight: ms(17), color: DP.muted, marginTop: vs(10) },
  sectionTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: DP.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: vs(16),
    marginBottom: vs(8),
  },
  empty: { fontSize: ms(13), color: DP.muted, lineHeight: ms(19) },
  row: { marginBottom: vs(10) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  rowTitle: { fontSize: ms(14), fontWeight: '900', color: DP.ink },
  rowMeta: { fontSize: ms(12), lineHeight: ms(18), color: DP.muted, marginTop: vs(4) },
  rowTotal: { fontSize: ms(16), fontWeight: '900', color: DP.ink, marginTop: vs(8) },
});
