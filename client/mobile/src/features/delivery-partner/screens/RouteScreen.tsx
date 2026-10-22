import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
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

export function RouteScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orders = await gateway.getActiveDeliveryOrders();
      const found = orders.find((o) => o.orderId === orderId);
      if (found) setOrder(found);
      else {
        const single = await gateway.getDeliveryRoute(orderId);
        setOrder(single);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the route.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const points = useMemo(
    () =>
      (order?.stops ?? [])
        .filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number')
        .map((s) => ({ latitude: s.latitude as number, longitude: s.longitude as number })),
    [order],
  );

  const advance = useCallback(
    async (stop: DeliveryStop, status: DeliveryStopStatus) => {
      setBusy(true);
      setError(null);
      try {
        const next = await gateway.updateDeliveryStop(stop.stopId, status);
        setOrder(next);
        if (next.status === 'ROUTE_COMPLETE') {
          Alert.alert('Route complete', 'All drops are done. You are available for the next order.', [
            { text: 'Back to dashboard', onPress: () => navigation.replace('Dashboard') },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update this stop.');
      } finally {
        setBusy(false);
      }
    },
    [navigation],
  );

  const fail = useCallback(
    (stop: DeliveryStop) => {
      Alert.alert('Report a failed stop', 'Mark this stop as failed? Support will be notified.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark failed',
          style: 'destructive',
          onPress: () => void advance(stop, 'FAILED'),
        },
      ]);
    },
    [advance],
  );

  const deliverWithOtp = useCallback(async () => {
    const stop = order?.stops.find((s) => s.stopType === 'DROP' && s.status === 'AT_CUSTOMER');
    if (!stop) return;
    if (otp.replace(/\D/g, '').length !== 4) {
      setError('Enter the 4-digit OTP given by the customer.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await gateway.verifyDeliveryOtp(stop.stopId, otp);
      setOrder(next);
      setOtp('');
      if (next.status === 'ROUTE_COMPLETE') {
        Alert.alert('Route complete', 'All drops are done. You are available for the next order.', [
          { text: 'Back to dashboard', onPress: () => navigation.replace('Dashboard') },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect OTP.');
    } finally {
      setBusy(false);
    }
  }, [navigation, order, otp]);

  const deliverWithoutOtp = useCallback(
    async (stop: DeliveryStop) => {
      await advance(stop, 'DELIVERED');
    },
    [advance],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <AppText style={styles.backText}>← Dashboard</AppText>
        </TouchableOpacity>
        <AppText style={styles.title}>Route</AppText>
        {order ? (
          <AppText style={styles.subtitle}>
            {order.stops.length} stops · {Math.round(order.totalDistanceMeters / 1000)} km ·{' '}
            {Math.round(order.estimatedDurationSeconds / 60)} min · {rupees(order.payoutAmountPaisa)}
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
              {order?.stops.map((stop, index) =>
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
        {!order && !loading ? (
          <Card>
            <AppText style={styles.empty}>This delivery is no longer active.</AppText>
          </Card>
        ) : null}

        {order?.stops.map((stop, index) => {
          const action = nextAction(stop);
          const done = stop.status === 'DELIVERED' || stop.status === 'FAILED';
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
                    {stop.stopType === 'PICKUP' ? 'Pickup' : 'Drop'} · {stop.status.replace(/_/g, ' ')}
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
                    value={otp}
                    onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    placeholder="4-digit code"
                    maxLength={4}
                  />
                  <PrimaryButton label="Verify & deliver" onPress={() => void deliverWithOtp()} loading={busy} />
                </>
              ) : action ? (
                <PrimaryButton
                  label={action.label}
                  onPress={() => void advance(stop, action.status)}
                  loading={busy}
                />
              ) : stop.stopType === 'DROP' && stop.status === 'AT_CUSTOMER' ? (
                <PrimaryButton
                  label="Mark delivered"
                  onPress={() => void deliverWithoutOtp(stop)}
                  loading={busy}
                />
              ) : null}

              {!done && stop.stopType === 'DROP' && stop.status !== 'AT_CUSTOMER' ? (
                <TouchableOpacity onPress={() => fail(stop)} style={styles.failButton}>
                  <AppText style={styles.failButtonText}>Report a problem</AppText>
                </TouchableOpacity>
              ) : null}
            </Card>
          );
        })}

        {order?.status === 'ROUTE_COMPLETE' ? (
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
  empty: { fontSize: ms(13), color: DP.muted },
});
