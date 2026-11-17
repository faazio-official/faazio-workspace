import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPBackLink,
  DPButton,
  DPField,
  DPSectionCard,
  DPStat,
  DPStatStrip,
  DPStatusPill,
  DPEmptyState,
  DPErrorState,
  DPSkeleton,
  DPRouteRail,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import {
  gateway,
  type DeliveryOrder,
  type DeliveryStop,
  type DeliveryStopStatus,
} from '@/services/api/GatewayClient';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { PickupScanModal } from './PickupScanModal';
import { hs, ms, vs } from '@/utils/responsive';
import { headlineRupees, formatNumber } from '../format';
import { isStopDone } from '../order';
import type { DeliveryPartnerStackParamList } from '../navigation';
import { resetToTab } from '../navigationRoutes';
import { activeOrderFrom } from '../activeOrder';
import { DeliveryHeader } from '../components/DeliveryHeader';
import { CallCustomerButton } from '../components/CallCustomerButton';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'Route'>;

function nextAction(stop: DeliveryStop): { label: string; status: DeliveryStopStatus } | null {
  if (stop.status === 'DELIVERED' || stop.status === 'FAILED') return null;
  if (stop.stopType === 'PICKUP') {
    // AT_PICKUP → PICKED_UP is gated on a seller-QR scan (0088), rendered separately.
    if (stop.status === 'PENDING') return { label: 'Arrived at store', status: 'AT_PICKUP' };
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
  const setActiveOrder = useDeliveryPartnerStore((s) => s.setActiveOrder);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpByStop, setOtpByStop] = useState<Record<string, string>>({});
  const [failureFor, setFailureFor] = useState<DeliveryStop | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [scanStop, setScanStop] = useState<DeliveryStop | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accepted = acceptedOnly(await gateway.getActiveDeliveryOrders());
      setOrders(accepted);
      setActiveOrder(activeOrderFrom(accepted));
      const qr = await gateway.getDeliveryUpipQr();
      setQrUrl(qr.qrUrl ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the route.');
    } finally {
      setLoading(false);
    }
  }, [setActiveOrder]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stops = useMemo(() => mergeRoute(orders), [orders]);
  const orderByStopId = useMemo(() => {
    const map = new Map<string, DeliveryOrder>();
    for (const order of acceptedOnly(orders)) {
      for (const stop of order.stops) map.set(stop.stopId, order);
    }
    return map;
  }, [orders]);
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
  const railActiveIndex = useMemo(() => {
    const idx = stops.findIndex((s) => s.status !== 'DELIVERED' && s.status !== 'FAILED');
    return idx === -1 ? stops.length : idx;
  }, [stops]);

  const refresh = useCallback(async () => {
    const fresh = acceptedOnly(await gateway.getActiveDeliveryOrders());
    setOrders(fresh);
    setActiveOrder(activeOrderFrom(fresh));
    return fresh;
  }, [setActiveOrder]);

  const finishIfEmpty = useCallback(
    (updated: DeliveryOrder, fresh: DeliveryOrder[]) => {
      if (fresh.length > 0) return;
      if (updated.status === 'CANCELLED') {
        Alert.alert(
          'Delivery cancelled',
          'The pickup could not be completed. Your capacity is free again.',
          [{ text: 'Back to home', onPress: () => resetToTab(navigation, 'Dashboard') }],
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
          [{ text: 'Back to home', onPress: () => resetToTab(navigation, 'Dashboard') }],
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

  const verifyPickup = useCallback(
    async (stop: DeliveryStop, token: string) => {
      setBusy(true);
      setError(null);
      try {
        const updated = await gateway.verifyDeliveryPickup(stop.stopId, token);
        setScanStop(null);
        finishIfEmpty(updated, await refresh());
      } catch (err) {
        // Close the scanner so a failed token never leaves it stuck on the "already handled" guard;
        // the rider can retry from the stop card.
        setScanStop(null);
        setError(err instanceof Error ? err.message : 'Could not verify the pickup QR.');
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

  /** Rider confirms "Payment received" for a COD DROP (cash or delivery QR scan). */
  const confirmPayment = useCallback(
    async (stop: DeliveryStop) => {
      const order = orderByStopId.get(stop.stopId);
      if (!order) return;
      setBusy(true);
      setError(null);
      try {
        await gateway.markDeliveryPaymentReceived(order.orderId, stop.stopId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not confirm the payment.');
      } finally {
        setBusy(false);
      }
    },
    [orderByStopId, refresh],
  );

  const deliverWithOtp = useCallback(
    async (stop: DeliveryStop) => {
      const code = otpByStop[stop.stopId] ?? '';
      if (code.replace(/\D/g, '').length !== 4) {
        setError('Enter the 4-digit OTP given by the customer.');
        return;
      }
      // COD gate (0077): an OTP verification completes the drop, so a COD order must be paid first.
      const order = orderByStopId.get(stop.stopId);
      if (order?.paymentRequired && !order.paymentReceived) {
        setError('Confirm "Payment received" (cash or QR) before delivering.');
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
    [finishIfEmpty, orderByStopId, otpByStop, refresh],
  );

  return (
    <DPPage header={<DeliveryHeader />}>
      <DPBackLink onPress={() => navigation.goBack()} />
      <DPPageHeader title="Route" />
      {stops.length > 0 ? (
        <DPSectionCard style={styles.summary}>
          <DPStatStrip>
            <DPStat style={styles.summaryPrimary} label="Payout on completion" value={headlineRupees(payout)} />
            <DPStat size="label" style={styles.summaryStat} label="Stops" value={String(stops.length)} />
            <DPStat size="label" style={styles.summaryStat} label="Orders" value={String(acceptedCount)} />
            <DPStat
              size="label"
              style={styles.summaryStat}
              label="Distance"
              value={`${formatNumber(Math.round(distance / 1000))} km`}
            />
          </DPStatStrip>
          <DPRouteRail
            style={styles.rail}
            activeIndex={railActiveIndex}
            stops={stops.map((s) => ({
              label: s.label || s.stopType,
              done: isStopDone(s.status),
              kind: s.stopType === 'PICKUP' ? 'pickup' : s.stopType === 'DROP' ? 'drop' : 'stop',
            }))}
          />
        </DPSectionCard>
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
            <Polyline coordinates={points} strokeColor={DELIVERY.brand} strokeWidth={4} />
            {stops.map((stop, index) =>
              typeof stop.latitude === 'number' && typeof stop.longitude === 'number' ? (
                <Marker
                  key={stop.stopId}
                  coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                  title={`${index + 1}. ${stop.label || stop.stopType}`}
                  description={stop.address}
                  pinColor={
                    stop.status === 'DELIVERED'
                      ? DELIVERY.success
                      : stop.stopType === 'PICKUP'
                        ? DELIVERY.warning
                        : DELIVERY.brand
                  }
                />
              ) : null,
            )}
          </MapView>
        </View>
      ) : null}

      {loading && stops.length === 0 ? (
        <DPSkeleton lines={6} />
      ) : error && stops.length === 0 ? (
        <DPErrorState description={error} onRetry={() => void load()} />
      ) : (
        <>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {stops.length === 0 ? (
            <DPEmptyState
              title="No active deliveries"
              description="Accepted orders appear here as a route to run."
            />
          ) : null}
        </>
      )}

      {stops.map((stop, index) => {
        const action = nextAction(stop);
        const done = isStopDone(stop.status);
        const blockedDrop =
          stop.stopType === 'DROP' &&
          stop.status === 'PENDING' &&
          !pickedUpOrders.has(stop.deliveryOrderId);
        const otpDrop =
          stop.stopType === 'DROP' && stop.status === 'AT_CUSTOMER' && stop.requiresOtp;
        const dropOrder = orderByStopId.get(stop.stopId);
        const paymentRequired = !!dropOrder?.paymentRequired;
        const paymentReceived = !!dropOrder?.paymentReceived;
        // COD must be collected before the OTP can complete the drop, so the payment controls
        // render first — otherwise the OTP branch would hide the "Payment received" button and
        // the order could never be completed.
        const awaitingPayment =
          stop.stopType === 'DROP' &&
          stop.status === 'AT_CUSTOMER' &&
          paymentRequired &&
          !paymentReceived;
        return (
          <DPSectionCard key={stop.stopId} style={[styles.stop, done && styles.stopDone]}>
            <View style={styles.stopHead}>
              <View style={[styles.seq, done && styles.seqDone]}>
                <AppText style={styles.seqText}>{index + 1}</AppText>
              </View>
              <View style={styles.flex}>
                <View style={styles.stopTypeRow}>
                  <AppText style={styles.stopType}>
                    {stop.stopType === 'PICKUP' ? 'Pickup' : 'Drop'}
                  </AppText>
                  <DPStatusPill status={stop.status} />
                </View>
                <AppText style={styles.stopLabel}>{stop.label || 'Stop'}</AppText>
                <AppText style={styles.stopAddress}>{stop.address}</AppText>
                {stop.stopType === 'DROP' && !done ? (
                  <CallCustomerButton
                    orderId={stop.deliveryOrderId}
                    showPstn
                    style={styles.callAction}
                  />
                ) : null}
                {stop.failureReason ? (
                  <AppText style={styles.failText}>{stop.failureReason}</AppText>
                ) : null}
              </View>
            </View>

            {awaitingPayment ? (
              <>
                {qrUrl ? (
                  <Image
                    source={{ uri: qrUrl }}
                    style={styles.qr}
                    resizeMode="contain"
                    resizeMethod="resize"
                  />
                ) : null}
                <AppText style={styles.payHint}>
                  COD · collect cash or ask the customer to scan the QR, then confirm.
                </AppText>
                <DPButton
                  label="Payment received"
                  onPress={() => void confirmPayment(stop)}
                  loading={busy}
                />
              </>
            ) : otpDrop ? (
              <>
                <DPField
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
                  containerStyle={styles.actionGap}
                />
                <DPButton
                  label="Verify & deliver"
                  onPress={() => void deliverWithOtp(stop)}
                  loading={busy}
                />
              </>
            ) : stop.stopType === 'PICKUP' && stop.status === 'AT_PICKUP' ? (
              <DPButton
                label="Scan seller QR & pick up"
                onPress={() => {
                  setError(null);
                  setScanStop(stop);
                }}
                loading={busy}
                style={styles.actionGap}
              />
            ) : action && !blockedDrop ? (
              <DPButton
                label={action.label}
                onPress={() => void advance(stop, action.status)}
                loading={busy}
                style={styles.actionGap}
              />
            ) : stop.stopType === 'DROP' && stop.status === 'AT_CUSTOMER' ? (
              <DPButton
                label="Mark delivered"
                onPress={() => void advance(stop, 'DELIVERED')}
                loading={busy}
                style={styles.actionGap}
              />
            ) : null}

            {failureFor?.stopId === stop.stopId ? (
              <View style={styles.failureBox}>
                <DPField
                  label="What went wrong?"
                  value={failureReason}
                  onChangeText={setFailureReason}
                  placeholder="e.g. customer unreachable"
                />
                <DPButton
                  label="Submit failure"
                  variant="danger"
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
                  accessibilityRole="button"
                >
                  <AppText style={styles.cancelText}>Cancel</AppText>
                </TouchableOpacity>
              </View>
            ) : !done && canFail(stop, pickedUpOrders) ? (
              <TouchableOpacity onPress={() => startFailure(stop)} style={styles.failButton} accessibilityRole="button">
                <AppText style={styles.failButtonText}>Report a problem</AppText>
              </TouchableOpacity>
            ) : null}
          </DPSectionCard>
        );
      })}

      {stops.length > 0 && stops.every((s) => s.status === 'DELIVERED' || s.status === 'FAILED') ? (
        <DPButton label="Back to home" onPress={() => resetToTab(navigation, 'Dashboard')} />
      ) : null}

      <PickupScanModal
        visible={!!scanStop}
        onClose={() => setScanStop(null)}
        onScanned={(token) => {
          if (scanStop) void verifyPickup(scanStop, token);
        }}
      />
    </DPPage>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: vs(12) },
  summaryPrimary: { flex: 1.6 },
  summaryStat: { flex: 1 },
  rail: { marginTop: vs(14) },
  mapWrap: { height: vs(200), borderRadius: DELIVERY.radius.lg, overflow: 'hidden', marginBottom: vs(12) },
  map: { flex: 1 },
  stop: { marginBottom: vs(10) },
  stopDone: { opacity: 0.7 },
  stopHead: { flexDirection: 'row', gap: hs(12) },
  seq: {
    width: ms(28),
    height: ms(28),
    borderRadius: DELIVERY.radius.pill,
    backgroundColor: DELIVERY.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqDone: { backgroundColor: DELIVERY.success },
  seqText: { ...DP_TYPE.micro, color: DELIVERY.onBrand, fontWeight: '600' },
  flex: { flex: 1 },
  stopTypeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(8) },
  stopType: { ...DP_TYPE.micro, color: DELIVERY.inkMuted },
  stopLabel: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600', marginTop: vs(4) },
  stopAddress: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
  callAction: { marginTop: vs(10) },
  failText: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(4) },
  qr: {
    width: '62%',
    aspectRatio: 1,
    alignSelf: 'center',
    marginTop: vs(10),
    borderRadius: DELIVERY.radius.md,
    backgroundColor: DELIVERY.card,
    borderWidth: 1,
    borderColor: DELIVERY.border,
  },
  payHint: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(8), marginBottom: vs(8), textAlign: 'center' },
  actionGap: { marginTop: vs(12) },
  failButton: { alignItems: 'center', minHeight: DELIVERY.touch.min, justifyContent: 'center', marginTop: vs(6) },
  failButtonText: { ...DP_TYPE.caption, fontWeight: '600', color: DELIVERY.danger },
  failureBox: { marginTop: vs(12), paddingTop: vs(10), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DELIVERY.border },
  cancelText: { ...DP_TYPE.caption, fontWeight: '600', color: DELIVERY.inkMuted },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
});