import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPButton,
  DPSectionCard,
  DPTimer,
  DPKeyValueRow,
  DPSeparator,
  DPStatusPill,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type DeliveryOrder } from '@/services/api/GatewayClient';
import { hs, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';
import { resetToTab } from '../navigationRoutes';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'AcceptReject'>;

const rupees = (paisa: number) => `₹${(paisa / 100).toFixed(0)}`;
const DEFAULT_WINDOW_SECONDS = 45;

/**
 * Dedicated offer screen for a push tap / deep link. The countdown is authoritative from the
 * server's expiresAt; reaching zero behaves exactly like a rejection so the dispatch fallback
 * chain keeps moving.
 */
export function AcceptRejectScreen({ navigation, route }: Props) {
  const { orderId, expiresAt } = route.params;
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
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
        navigation.replace('Route');
        return;
      }
      if (single.status !== 'ASSIGNED') {
        setError('This offer is no longer available.');
        setOrder(single);
        return;
      }
      setOrder(single);
      setActiveCount(active.filter((o) => o.status === 'ACCEPTED').length);
      // The server is authoritative; the link's timestamp covers a payload that omits it, and the
      // local fallback keeps the 45 s window hard even if both are missing.
      const serverDeadline = single.expiresAt ? new Date(single.expiresAt).getTime() : NaN;
      const linkDeadline = expiresAt ? new Date(expiresAt).getTime() : NaN;
      const next = Number.isFinite(serverDeadline)
        ? serverDeadline
        : Number.isFinite(linkDeadline)
          ? linkDeadline
          : Date.now() + DEFAULT_WINDOW_SECONDS * 1000;
      setDeadline(next);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this offer.');
    } finally {
      setLoading(false);
    }
  }, [expiresAt, navigation, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!order) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [order]);

  const seconds = useMemo(() => {
    if (deadline === null) return DEFAULT_WINDOW_SECONDS;
    const remaining = Math.floor((deadline - now) / 1000);
    return Math.max(0, Math.min(DEFAULT_WINDOW_SECONDS, remaining));
  }, [deadline, now]);

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
      resetToTab(navigation, 'Dashboard');
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
      navigation.replace('Route');
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
    <DPPage>
      <DPPageHeader
        kicker="New delivery offer"
        title={expired ? 'Offer expired' : 'Accept before the timer ends'}
        tone={expired ? 'danger' : 'brand'}
        actions={<DPTimer seconds={seconds} />}
      />

      {error ? <AppText style={styles.error}>{error}</AppText> : null}

      {order ? (
        <>
          <DPSectionCard style={styles.card}>
            <View style={styles.stopHead}>
              <AppText style={styles.section}>Pickup</AppText>
              <DPStatusPill status="ASSIGNED" label="Collect" />
            </View>
            <AppText style={styles.name}>{pickup?.label || 'Store'}</AppText>
            <AppText style={styles.meta}>{pickup?.address || 'Store address'}</AppText>
            <DPSeparator />
            <View style={styles.stopHead}>
              <AppText style={styles.section}>Drop</AppText>
              <DPStatusPill status="PENDING" label="Deliver" />
            </View>
            <AppText style={styles.name}>{drop?.label || drop?.customerName || 'Customer'}</AppText>
            <AppText style={styles.meta}>{drop?.address || 'Customer address'}</AppText>
          </DPSectionCard>

          <DPSectionCard style={styles.card}>
            <DPKeyValueRow label="Payout" value={rupees(order.payoutAmountPaisa)} valueTone="success" />
            <DPKeyValueRow
              label="Payment"
              value={
                order.paymentRequired
                  ? order.paymentReceived
                    ? 'Payment received'
                    : 'COD · collect cash or QR at the door'
                  : `${order.paymentMethod || 'Prepaid'} · prepaid`
              }
            />
            <DPKeyValueRow
              label="Route"
              value={`${Math.round(order.totalDistanceMeters / 1000)} km · ${Math.round(order.estimatedDurationSeconds / 60)} min`}
            />
            <DPKeyValueRow
              label="Your route"
              value={
                activeCount === 0
                  ? 'First active order'
                  : `${activeCount} active order${activeCount === 1 ? '' : 's'}; this makes ${activeCount + 1}`
              }
            />
            {order.requireOtp ? (
              <AppText style={styles.otpNote}>Customer OTP required at handover.</AppText>
            ) : null}
          </DPSectionCard>

          {live ? (
            <>
              <DPButton
                label={expired ? 'Offer expired' : 'Accept offer'}
                onPress={() => void accept()}
                loading={busy === 'accept'}
                disabled={expired || busy !== null || loading}
              />
              <DPButton
                label="Reject"
                variant="danger"
                onPress={() => void rejectAndLeave(false)}
                loading={busy === 'reject'}
                disabled={expired || busy !== null || loading}
                style={styles.rejectWrap}
              />
            </>
          ) : (
            <DPButton
              label="Back to dashboard"
              variant="outline"
              onPress={() => resetToTab(navigation, 'Dashboard')}
              style={styles.rejectWrap}
            />
          )}
        </>
      ) : loading ? (
        <DPSectionCard>
          <AppText style={styles.meta}>Loading offer...</AppText>
        </DPSectionCard>
      ) : (
        <DPSectionCard>
          <AppText style={styles.meta}>
            The offer is no longer assigned to you. It may have expired or moved to another rider.
          </AppText>
        </DPSectionCard>
      )}

      {!loading && !order ? (
        <DPButton
          label="Back to dashboard"
          variant="outline"
          onPress={() => resetToTab(navigation, 'Dashboard')}
          style={styles.rejectWrap}
        />
      ) : null}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: vs(12) },
  stopHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  section: { ...DP_TYPE.kicker, color: DELIVERY.inkMuted, textTransform: 'uppercase', letterSpacing: 1 },
  name: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '600', marginTop: vs(3) },
  meta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
  otpNote: { ...DP_TYPE.caption, fontWeight: '600', color: DELIVERY.warning, marginTop: vs(8) },
  rejectWrap: { marginTop: vs(8) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
});