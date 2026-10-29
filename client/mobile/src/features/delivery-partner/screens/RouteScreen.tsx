import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import InfoButton from '@/components/shared/InfoButton';
import {
  gateway,
  type DeliveryOrder,
  type DeliveryStop,
  type DeliveryStopStatus,
} from '@/services/api/GatewayClient';
import { Card, DP, ErrorText, Field, PrimaryButton, Screen } from '../components';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'Route'>;

const rupees = (paisa: number) => `₹${(paisa / 100).toFixed(0)}`;

function nextAction(stop: DeliveryStop): { label: string; status: DeliveryStopStatus } | null {
  if (stop.status === 'DELIVERED' || stop.status === 'FAILED') return null;
  if (stop.stopType === 'PICKUP') {
    if (stop.status === 'PENDING') return { label: 'Arrived at store', status: 'AT_PICKUP' };
    if (stop.status === 'AT_PICKUP') return { label: 'Picked up', status: 'PICKED_UP' };
    return null;
  }
  if (stop.status === 'AT_CUSTOMER') return null;
  return { label: 'Arrived at customer', status: 'AT_CUSTOMER' };
}

function canFail(stop: DeliveryStop, pickedUpOrders: Set<string>): boolean {
  if (stop.stopType === 'PICKUP') {
    return stop.status === 'PENDING' || stop.status === 'AT_PICKUP';
  }
  return (
    (stop.status === 'PENDING' || stop.status === 'AT_CUSTOMER') &&
    pickedUpOrders.has(stop.deliveryOrderId)
  );
}

/** All open stops of every accepted job, ordered by the server's global route sequence. */
function mergeRoute(orders: DeliveryOrder[]): DeliveryStop[] {
  return orders
    .filter((o) => o.status === 'ACCEPTED')
    .flatMap((o) => o.stops)
    .sort((a, b) =>
      a.sequence !== b.sequence ? a.sequence - b.sequence : a.stopId.localeCompare(b.stopId),
    );
}

const acceptedOnly = (orders: DeliveryOrder[]) => orders.filter((o) => o.status === 'ACCEPTED');

export function RouteScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpByStop, setOtpByStop] = useState<Record<string, string>>({});
  const [failureFor, setFailureFor] = useState<DeliveryStop | null>(null);
  const [failureReason, setFailureReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(acceptedOnly(await gateway.getActiveDeliveryOrders()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the route.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stops = useMemo(() => mergeRoute(orders), [orders]);
  const pickedUpOrders = useMemo(() => {
    const done = new Set<string>();
    for (const stop of stops) {
      if (stop.stopType === 'PICKUP' && stop.status === 'PICKED_UP') {
        done.add(stop.deliveryOrderId);
      }
    }
    return done;
  }, [stops]);
  const points = useMemo(
    () =>
      stops
        .filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number')
        .map((s) => ({ latitude: s.latitude as number, longitude: s.longitude as number })),
    [stops],
  );
  const payout = useMemo(
    () => acceptedOnly(orders).reduce((sum, o) => sum + o.payoutAmountPaisa, 0),
    [orders],
  );
  const distance = useMemo(
    () => acceptedOnly(orders).reduce((sum, o) => sum + o.totalDistanceMeters, 0),
    [orders],
  );
  const acceptedCount = useMemo(() => acceptedOnly(orders).length, [orders]);

  const refresh = useCallback(async () => {
    const fresh = acceptedOnly(await gateway.getActiveDeliveryOrders());
    setOrders(fresh);
    return fresh;
  }, []);

  const finishIfEmpty = useCallback(
    (updated: DeliveryOrder, fresh: DeliveryOrder[]) => {
      if (fresh.length > 0) return;
      if (updated.status === 'CANCELLED') {
        Alert.alert(
          'Delivery cancelled',
          'The pickup could not be completed. Your capacity is free again.',
          [{ text: 'Back to dashboard', onPress: () => navigation.replace('Dashboard') }],
        );
      } else if (updated.status === 'ROUTE_COMPLETE') {
        const failedDrop = updated.stops.some(
          (s) => s.stopType === 'DROP' && s.status === 'FAILED',
        );
        Alert.alert(
          failedDrop ? 'Route finished' : 'Route complete',
          failedDrop
            ? 'The route finished with a failed drop. Your capacity is free for the next order.'
            : 'All drops are done. Your capacity is free for the next order.',
          [{ text: 'Back to dashboard', onPress: () => navigation.replace('Dashboard') }],
        );
      }
    },
    [navigation],
  );

  const advance = useCallback(
    async (stop: DeliveryStop, status: DeliveryStopStatus, reason = '') => {
      setBusy(true);
      setError(null);
      try {
        const updated = await gateway.updateDeliveryStop(stop.stopId, status, reason);
        if (status === 'FAILED') {
          setFailureFor(null);
          setFailureReason('');
        }
        finishIfEmpty(updated, await refresh());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update this stop.');
      } finally {
        setBusy(false);
      }
    },
    [finishIfEmpty, refresh],
  );

  const startFailure = useCallback((stop: DeliveryStop) => {
    setError(null);
    setFailureReason('');
    setFailureFor(stop);
  }, []);

  const deliverWithOtp = useCallback(
    async (stop: DeliveryStop) => {
      const code = otpByStop[stop.stopId] ?? '';
      if (code.replace(/\D/g, '').length !== 4) {
        setError('Enter the 4-digit OTP given by the customer.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const updated = await gateway.verifyDeliveryOtp(stop.stopId, code);
        setOtpByStop((prev) => {
          const next = { ...prev };
          delete next[stop.stopId];
          return next;
        });
        finishIfEmpty(updated, await refresh());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Incorrect OTP.');
      } finally {
        setBusy(false);
      }
    },
    [finishIfEmpty, otpByStop, refresh],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <AppText style={styles.backText}>← Dashboard</AppText>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: hs(8) }}>
          <AppText style={styles.title}>Route</AppText>
          <InfoButton contentKey="Route" />
        </View>
        {stops.length > 0 ? (
          <AppText style={styles.subtitle}>
            {stops.length} stops · {acceptedCount} {acceptedCount === 1 ? 'order' : 'orders'} ·{' '}
            {Math.round(distance / 1000)} km · {rupees(payout)}
          </AppText>
        ) : null}

        {points.length >= 2 ? (
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: points[0].latitude,
                longitude: points[0].longitude,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
              }}
              showsUserLocation
            >
              <Polyline coordinates={points} strokeColor={DP.brand} strokeWidth={4} />
              {stops.map((stop, index) =>
                typeof stop.latitude === 'number' && typeof stop.longitude === 'number' ? (
                  <Marker
                    key={stop.stopId}
                    coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                    title={`${index + 1}. ${stop.label || stop.stopType}`}
                    description={stop.address}
                    pinColor={
                      stop.status === 'DELIVERED'
                        ? DP.success
                        : stop.stopType === 'PICKUP'
                          ? DP.warning
                          : DP.brand
                    }
                  />
                ) : null,
              )}
            </MapView>
          </View>
        ) : null}

        <ErrorText>{error}</ErrorText>
        {stops.length === 0 && !loading ? (
          <Card>
            <AppText style={styles.empty}>No active deliveries on this route.</AppText>
          </Card>
        ) : null}

        {stops.map((stop, index) => {
          const action = nextAction(stop);
          const done = stop.status === 'DELIVERED' || stop.status === 'FAILED';
          const blockedDrop =
            stop.stopType === 'DROP' &&
            stop.status === 'PENDING' &&
            !pickedUpOrders.has(stop.deliveryOrderId);
          const otpDrop =
            stop.stopType === 'DROP' && stop.status === 'AT_CUSTOMER' && stop.requiresOtp;
          return (
            <Card key={stop.stopId} style={[styles.stop, done && styles.stopDone]}>
              <View style={styles.stopHead}>
                <View style={[styles.seq, done && styles.seqDone]}>
                  <AppText style={styles.seqText}>{index + 1}</AppText>
                </View>
                <View style={styles.flex}>
                  <AppText style={styles.stopType}>
                    {stop.stopType === 'PICKUP' ? 'Pickup' : 'Drop'} ·{' '}
                    {stop.status.replace(/_/g, ' ')}
                  </AppText>
                  <AppText style={styles.stopLabel}>{stop.label || 'Stop'}</AppText>
                  <AppText style={styles.stopAddress}>{stop.address}</AppText>
                  {stop.customerPhone ? (
                    <AppText style={styles.stopAddress}>Customer: {stop.customerPhone}</AppText>
                  ) : null}
                  {stop.failureReason ? (
                    <AppText style={styles.failText}>{stop.failureReason}</AppText>
                  ) : null}
                </View>
              </View>

              {otpDrop ? (
                <>
                  <Field
                    label="Customer OTP"
                    value={otpByStop[stop.stopId] ?? ''}
                    onChangeText={(v) =>
                      setOtpByStop((prev) => ({
                        ...prev,
                        [stop.stopId]: v.replace(/\D/g, '').slice(0, 4),
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="4-digit code"
                    maxLength={4}
                  />
                  <PrimaryButton
                    label="Verify & deliver"
                    onPress={() => void deliverWithOtp(stop)}
                    loading={busy}
                  />
                </>
              ) : action && !blockedDrop ? (
                <PrimaryButton
                  label={action.label}
                  onPress={() => void advance(stop, action.status)}
                  loading={busy}
                />
              ) : stop.stopType === 'DROP' && stop.status === 'AT_CUSTOMER' ? (
                <PrimaryButton
                  label="Mark delivered"
                  onPress={() => void advance(stop, 'DELIVERED')}
                  loading={busy}
                />
              ) : null}

              {failureFor?.stopId === stop.stopId ? (
                <View style={styles.failureBox}>
                  <Field
                    label="What went wrong?"
                    value={failureReason}
                    onChangeText={setFailureReason}
                    placeholder="e.g. customer unreachable"
                  />
                  <PrimaryButton
                    label="Submit failure"
                    onPress={() => void advance(stop, 'FAILED', failureReason.trim())}
                    loading={busy}
                    disabled={failureReason.trim().length < 3}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setFailureFor(null);
                      setFailureReason('');
                    }}
                    style={styles.failButton}
                  >
                    <AppText style={styles.cancelText}>Cancel</AppText>
                  </TouchableOpacity>
                </View>
              ) : !done && canFail(stop, pickedUpOrders) ? (
                <TouchableOpacity onPress={() => startFailure(stop)} style={styles.failButton}>
                  <AppText style={styles.failButtonText}>Report a problem</AppText>
                </TouchableOpacity>
              ) : null}
            </Card>
          );
        })}

        {stops.length > 0 && stops.every((s) => s.status === 'DELIVERED' || s.status === 'FAILED') ? (
          <PrimaryButton label="Back to dashboard" onPress={() => navigation.replace('Dashboard')} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(16), paddingBottom: vs(40) },
  back: { marginTop: vs(12), marginBottom: vs(8) },
  backText: { fontSize: ms(12), fontWeight: '800', color: DP.brand },
  title: { fontSize: ms(26), fontWeight: '900', color: DP.ink },
  subtitle: { fontSize: ms(12), color: DP.muted, marginTop: vs(4), marginBottom: vs(12) },
  mapWrap: { height: vs(220), borderRadius: ms(16), overflow: 'hidden', marginBottom: vs(12) },
  map: { flex: 1 },
  stop: { marginBottom: vs(10) },
  stopDone: { opacity: 0.65 },
  stopHead: { flexDirection: 'row', gap: hs(12) },
  seq: {
    width: ms(28), height: ms(28), borderRadius: ms(999), backgroundColor: DP.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  seqDone: { backgroundColor: DP.success },
  seqText: { color: '#ffffff', fontSize: ms(12), fontWeight: '900' },
  flex: { flex: 1 },
  stopType: { fontSize: ms(10), fontWeight: '900', color: DP.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  stopLabel: { fontSize: ms(15), fontWeight: '900', color: DP.ink, marginTop: vs(2) },
  stopAddress: { fontSize: ms(12), lineHeight: ms(17), color: DP.muted, marginTop: vs(2) },
  failText: { fontSize: ms(12), color: DP.danger, marginTop: vs(4) },
  failButton: { alignItems: 'center', marginTop: vs(10) },
  failButtonText: { fontSize: ms(11), fontWeight: '800', color: DP.danger },
  failureBox: { marginTop: vs(12), paddingTop: vs(10), borderTopWidth: 1, borderTopColor: DP.line },
  cancelText: { fontSize: ms(11), fontWeight: '800', color: DP.muted },
  empty: { fontSize: ms(13), color: DP.muted },
});
