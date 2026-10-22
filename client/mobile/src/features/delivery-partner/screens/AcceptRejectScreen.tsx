import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { gateway, type DeliveryOrder } from '@/services/api/GatewayClient';
import { Card, DP, ErrorText, PrimaryButton, Screen } from '../components';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'AcceptReject'>;

const rupees = (paisa: number) => `₹${(paisa / 100).toFixed(0)}`;
const DEFAULT_WINDOW_SECONDS = 45;

/**
 * Dedicated offer screen for a push tap / deep link. The countdown is authoritative from the
 * server's expiresAt; reaching zero behaves exactly like a rejection so the dispatch fallback
 * chain keeps moving.
 */
export function AcceptRejectScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const settled = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [single, active] = await Promise.all([
        gateway.getDeliveryRoute(orderId),
        gateway.getActiveDeliveryOrders().catch(() => []),
      ]);
      if (single.status === 'ACCEPTED') {
        navigation.replace('Route', { orderId });
        return;
      }
      if (single.status !== 'ASSIGNED') {
        setError('This offer is no longer available.');
        setOrder(single);
        return;
      }
      setOrder(single);
      setActiveCount(active.filter((o) => o.status === 'ACCEPTED').length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this offer.');
    } finally {
      setLoading(false);
    }
  }, [navigation, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!order) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [order]);

  const seconds = useMemo(() => {
    if (!order?.expiresAt) return DEFAULT_WINDOW_SECONDS;
    const remaining = Math.floor((new Date(order.expiresAt).getTime() - now) / 1000);
    return Math.max(0, Math.min(DEFAULT_WINDOW_SECONDS, remaining));
  }, [now, order?.expiresAt]);

  const rejectAndLeave = useCallback(
    async (expired: boolean) => {
      if (settled.current) return;
      settled.current = true;
      setBusy('reject');
      setError(null);
      try {
        await gateway.rejectDeliveryOrder(orderId);
      } catch {
        // The offer may already have been expired server-side; leaving is still correct.
      }
      if (expired) setError(null);
      navigation.replace('Dashboard');
    },
    [navigation, orderId],
  );

  useEffect(() => {
    if (!order || order.status !== 'ASSIGNED' || settled.current || busy) return;
    if (seconds > 0) return;
    void rejectAndLeave(true);
  }, [busy, order, rejectAndLeave, seconds]);

  const accept = useCallback(async () => {
    if (settled.current) return;
    setBusy('accept');
    setError(null);
    try {
      await gateway.acceptDeliveryOrder(orderId);
      settled.current = true;
      navigation.replace('Route', { orderId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this offer.');
      setBusy(null);
    }
  }, [navigation, orderId]);

  const pickup = order?.stops.find((s) => s.stopType === 'PICKUP');
  const drop = order?.stops.find((s) => s.stopType === 'DROP');
  const live = order?.status === 'ASSIGNED';
  const expired = live && seconds === 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <AppText style={styles.kicker}>New delivery offer</AppText>
          <AppText style={[styles.timer, seconds <= 10 && styles.timerDanger]}>{seconds}s</AppText>
        </View>
        <AppText style={styles.title}>{expired ? 'Offer expired' : 'Accept before the timer ends'}</AppText>

        <ErrorText>{error}</ErrorText>

        {order ? (
          <>
            <Card style={styles.card}>
              <AppText style={styles.section}>Pickup</AppText>
              <AppText style={styles.name}>{pickup?.label || 'Store'}</AppText>
              <AppText style={styles.meta}>{pickup?.address || 'Store address'}</AppText>
              <View style={styles.divider} />
              <AppText style={styles.section}>Drop</AppText>
              <AppText style={styles.name}>{drop?.label || drop?.customerName || 'Customer'}</AppText>
              <AppText style={styles.meta}>{drop?.address || 'Customer address'}</AppText>
            </Card>

            <Card style={styles.card}>
              <View style={styles.row}>
                <AppText style={styles.meta}>Payout</AppText>
                <AppText style={styles.payout}>{rupees(order.payoutAmountPaisa)}</AppText>
              </View>
              <View style={styles.row}>
                <AppText style={styles.meta}>Route</AppText>
                <AppText style={styles.value}>
                  {Math.round(order.totalDistanceMeters / 1000)} km ·{' '}
                  {Math.round(order.estimatedDurationSeconds / 60)} min
                </AppText>
              </View>
              <View style={styles.row}>
                <AppText style={styles.meta}>Your route</AppText>
                <AppText style={styles.value}>
                  {activeCount === 0
                    ? 'First active order'
                    : `${activeCount} active order${activeCount === 1 ? '' : 's'}; this makes ${
                        activeCount + 1
                      }`}
                </AppText>
              </View>
              {order.requireOtp ? (
                <AppText style={styles.otpNote}>Customer OTP required at handover.</AppText>
              ) : null}
            </Card>

            {live ? (
              <>
                <PrimaryButton
                  label={expired ? 'Offer expired' : 'Accept offer'}
                  onPress={() => void accept()}
                  loading={busy === 'accept'}
                  disabled={expired || busy !== null || loading}
                />
                <View style={styles.rejectWrap}>
                  <PrimaryButton
                    label="Reject"
                    variant="danger"
                    onPress={() => void rejectAndLeave(false)}
                    loading={busy === 'reject'}
                    disabled={expired || busy !== null || loading}
                  />
                </View>
              </>
            ) : (
              <View style={styles.rejectWrap}>
                <PrimaryButton
                  label="Back to dashboard"
                  variant="ghost"
                  onPress={() => navigation.replace('Dashboard')}
                />
              </View>
            )}
          </>
        ) : loading ? (
          <Card>
            <AppText style={styles.meta}>Loading offer…</AppText>
          </Card>
        ) : (
          <Card>
            <AppText style={styles.meta}>
              The offer is no longer assigned to you. It may have expired or moved to another rider.
            </AppText>
          </Card>
        )}

        {!loading && !order ? (
          <View style={styles.rejectWrap}>
            <PrimaryButton
              label="Back to dashboard"
              variant="ghost"
              onPress={() => navigation.replace('Dashboard')}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(18), paddingBottom: vs(40) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: vs(12) },
  kicker: {
    fontSize: ms(11),
    fontWeight: '900',
    color: DP.brand,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  timer: { fontSize: ms(28), fontWeight: '900', color: DP.warning },
  timerDanger: { color: DP.danger },
  title: { fontSize: ms(22), fontWeight: '900', color: DP.ink, marginTop: vs(4), marginBottom: vs(14) },
  card: { marginBottom: vs(12) },
  section: {
    fontSize: ms(10),
    fontWeight: '900',
    color: DP.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: { fontSize: ms(16), fontWeight: '900', color: DP.ink, marginTop: vs(3) },
  meta: { fontSize: ms(12), lineHeight: ms(18), color: DP.muted, marginTop: vs(2) },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DP.line,
    marginVertical: vs(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    paddingVertical: vs(5),
  },
  value: { fontSize: ms(12), fontWeight: '800', color: DP.ink, flexShrink: 1, textAlign: 'right' },
  payout: { fontSize: ms(18), fontWeight: '900', color: DP.success },
  otpNote: { fontSize: ms(12), fontWeight: '700', color: DP.warning, marginTop: vs(8) },
  rejectWrap: { marginTop: vs(8) },
});
