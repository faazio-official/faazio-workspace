import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform, RefreshControl, StyleSheet, TouchableOpacity, Vibration, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import {
  DPPage,
  DPPageHeader,
  DPButton,
  DPSectionCard,
  DPSwitch,
  DPStatusPill,
  DPTimer,
  DPKpiStrip,
  DPKpiCard,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type DeliveryOrder } from '@/services/api/GatewayClient';
import { getCoarsePosition, requestLocationPermission } from '@/services/location';
import { startDeliveryPush } from '@/services/deliveryPush';
import { startDeliveryTracking, stopDeliveryTracking } from '@/services/deliveryTracking';
import {
  loadIOSBackgroundConsent,
  saveIOSBackgroundConsent,
  startIOSBackgroundLocation,
  stopIOSBackgroundLocation,
} from '@/services/deliveryBackgroundLocation';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { useDeliverySettingsStore } from '@/state/deliverySettingsStore';
import { hs, vs } from '@/utils/responsive';
import { type DeliveryPartnerStackParamList, type DeliveryTabParamList } from '../navigation';
import { activeOrderFrom } from '../activeOrder';
type Props = CompositeScreenProps<
  BottomTabScreenProps<DeliveryTabParamList, 'Dashboard'>,
  NativeStackScreenProps<DeliveryPartnerStackParamList>
>;

const HEARTBEAT_MS = 120_000;

const rupees = (paisa: number) => `₹${(paisa / 100).toFixed(0)}`;

/** Payment tag for an offer/active order: prepaid (UPI) vs collect-at-door (COD) state. */
const paymentLabel = (order: DeliveryOrder): string => {
  if (!order.paymentMethod) return '';
  if (order.paymentRequired) {
    return order.paymentReceived ? 'Payment received' : 'COD · collect at door';
  }
  return `${order.paymentMethod} · prepaid`;
};

export function DashboardScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const setActiveOrder = useDeliveryPartnerStore((s) => s.setActiveOrder);
  const reset = useDeliveryPartnerStore((s) => s.reset);
  const logout = useAuthStore((s) => s.logout);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(Boolean(rider?.isAvailable));
  const [now, setNow] = useState(Date.now());
  const [iosBackgroundAllowed, setIosBackgroundAllowed] = useState(false);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrateOnOffer = useDeliverySettingsStore((s) => s.vibrateOnOffer);
  const hydrateSettings = useDeliverySettingsStore((s) => s.hydrate);
  const seenOffers = useRef<Set<string> | null>(null);

  const rootNavigation = useCallback(
    () => navigation.getParent<NativeStackNavigationProp<DeliveryPartnerStackParamList>>(),
    [navigation],
  );

  const offers = useMemo(
    () => orders.filter((o) => o.status === 'ASSIGNED'),
    [orders],
  );
  const active = useMemo(
    () => orders.filter((o) => o.status === 'ACCEPTED'),
    [orders],
  );

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  // Haptic alert (a local preference) when a genuinely new offer lands after mount.
  useEffect(() => {
    if (seenOffers.current === null) {
      seenOffers.current = new Set(offers.map((o) => o.orderId));
      return;
    }
    const fresh = offers.filter((o) => !seenOffers.current?.has(o.orderId));
    offers.forEach((o) => seenOffers.current?.add(o.orderId));
    if (fresh.length > 0 && vibrateOnOffer) Vibration.vibrate(200);
  }, [offers, vibrateOnOffer]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeat.current) {
      clearInterval(heartbeat.current);
      heartbeat.current = null;
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (AppState.currentState !== 'active') return;
    try {
      const fix = await getCoarsePosition();
      await gateway.sendDeliveryHeartbeat(fix.latitude, fix.longitude);
    } catch {
      // A missed heartbeat is non-fatal: the Valkey key expires and dispatch skips this rider.
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    void sendHeartbeat();
    heartbeat.current = setInterval(() => void sendHeartbeat(), HEARTBEAT_MS);
  }, [sendHeartbeat, stopHeartbeat]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, nextOrders] = await Promise.all([
        gateway.getDeliveryPartnerMe(),
        gateway.getActiveDeliveryOrders(),
      ]);
      setRider(me);
      setOnline(me.isAvailable);
      setOrders(nextOrders);
      setActiveOrder(activeOrderFrom(nextOrders));
      if (me.status !== 'ACTIVE') {
        stopHeartbeat();
        rootNavigation()?.replace('SubmissionSuccess');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [rootNavigation, setActiveOrder, setRider, stopHeartbeat]);

  useEffect(() => {
    void refresh();
    return stopHeartbeat;
  }, [refresh, stopHeartbeat]);

  // Resume iOS background tracking for a rider who was already online when the app relaunched.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    void loadIOSBackgroundConsent().then((allowed) => {
      if (active && allowed) setIosBackgroundAllowed(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!online) {
      stopHeartbeat();
      stopIOSBackgroundLocation();
      void stopDeliveryTracking();
      return;
    }
    startHeartbeat();
    // Android owns background wakes natively; iOS uses the CoreLocation watch below.
    // The JS interval intentionally bails when the app is not active so the two never duplicate.
    void startDeliveryTracking();
    // Resume without prompting: the OS dialog is only raised by the explicit online toggle.
    if (iosBackgroundAllowed) startIOSBackgroundLocation({ prompt: false });
    return () => {
      stopHeartbeat();
      stopIOSBackgroundLocation();
      void stopDeliveryTracking();
    };
  }, [iosBackgroundAllowed, online, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && online) void sendHeartbeat();
    });
    return () => sub.remove();
  }, [online, sendHeartbeat]);

  useEffect(() => {
    setNow(Date.now());
    if (offers.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [offers]);

  // Push is best-effort; poll while online so a missed FCM ping cannot hide an offer.
  // The same tick refreshes the raised active-order CTA so its label cannot go stale.
  useEffect(() => {
    if (!online) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void gateway
        .getActiveDeliveryOrders()
        .then((next) => {
          setOrders(next);
          setActiveOrder(activeOrderFrom(next));
        })
        .catch(() => undefined);
    }, 20_000);
    return () => clearInterval(timer);
  }, [online, setActiveOrder]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let active = true;
    void startDeliveryPush(() => {
      void refresh();
    })
      .then((cleanup) => {
        if (active) stop = cleanup;
        else cleanup();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      stop?.();
    };
  }, [refresh]);

  const confirmIOSBackground = useCallback((): Promise<boolean> => {
    if (Platform.OS !== 'ios') return Promise.resolve(false);
    return new Promise((resolve) => {
      Alert.alert(
        'Keep offers coming',
        'Faazio needs background location while you are online so dispatch can still find you when the app is not open. You can choose “Allow While Using” to stay foreground-only.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continue', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  }, []);

  const toggleOnline = useCallback(async () => {
    setBusy('availability');
    setError(null);
    const next = !online;
    try {
      if (next) {
        const granted = await requestLocationPermission();
        if (!granted) {
          throw new Error('Location permission is required to go online.');
        }
        if (Platform.OS === 'ios') {
          const allowBackground = await confirmIOSBackground();
          setIosBackgroundAllowed(allowBackground);
          await saveIOSBackgroundConsent(allowBackground);
          if (allowBackground) startIOSBackgroundLocation({ prompt: true });
        }
      } else {
        setIosBackgroundAllowed(false);
        stopIOSBackgroundLocation();
      }
      await gateway.setDeliveryAvailability(next);
      setOnline(next);
      if (next) startHeartbeat();
      else stopHeartbeat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change availability.');
    } finally {
      setBusy(null);
    }
  }, [confirmIOSBackground, online, startHeartbeat, stopHeartbeat]);

  const accept = useCallback(
    async (orderId: string) => {
      setBusy(orderId);
      setError(null);
      try {
        await gateway.acceptDeliveryOrder(orderId);
        await refresh();
        navigation.navigate('Route');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not accept this order.');
      } finally {
        setBusy(null);
      }
    },
    [navigation, refresh],
  );

  const reject = useCallback(
    async (orderId: string) => {
      setBusy(orderId);
      setError(null);
      try {
        await gateway.rejectDeliveryOrder(orderId);
        setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reject this order.');
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const onLogout = useCallback(async () => {
    stopHeartbeat();
    stopIOSBackgroundLocation();
    await saveIOSBackgroundConsent(false);
    if (online) await gateway.setDeliveryAvailability(false).catch(() => undefined);
    await logout();
    reset();
    rootNavigation()?.reset({ index: 0, routes: [{ name: 'PhoneEntry' }] });
  }, [logout, online, reset, rootNavigation, stopHeartbeat]);

  return (
    <DPPage
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <DPPageHeader
        leading={<FaazioLogo size={26} />}
        kicker="Delivery Partner"
        title={rider?.fullName ?? 'Rider'}
        actions={rider ? <DPStatusPill status={rider.status} /> : undefined}
        tone={online ? 'success' : 'neutral'}
      />

      <DPSectionCard style={styles.availability}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <AppText style={styles.availabilityTitle}>{online ? 'You are online' : 'You are offline'}</AppText>
            <AppText style={styles.availabilityCopy}>
              {online
                ? 'Available — waiting for orders. Location heartbeats keep you in dispatch.'
                : 'Go online to receive nearby delivery offers.'}
            </AppText>
          </View>
          <DPSwitch
            value={online}
            onValueChange={() => void toggleOnline()}
            disabled={busy === 'availability'}
            accessibilityLabel="Go online"
          />
        </View>
      </DPSectionCard>

      <DPKpiStrip style={styles.kpis}>
        <DPKpiCard label="Load" value={`${rider?.currentLoad ?? 0}/${rider?.maxCapacity ?? 0}`} />
        <DPKpiCard label="Deliveries" value={String(rider?.completedOrders ?? 0)} />
        <DPKpiCard label="Rating" value={rider?.rating ? rider.rating.toFixed(1) : '—'} />
      </DPKpiStrip>

      {error ? <AppText style={styles.error}>{error}</AppText> : null}

      {offers.length > 0 ? (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>New offers</AppText>
          {offers.map((order) => {
            const seconds = order.expiresAt
              ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000))
              : 45;
            const pickup = order.stops.find((s) => s.stopType === 'PICKUP');
            const drop = order.stops.find((s) => s.stopType === 'DROP');
            return (
              <DPSectionCard key={order.orderId} style={styles.orderCard}>
                <View style={styles.rowBetween}>
                  <AppText style={styles.orderTitle}>
                    {pickup?.label || 'Store'} → {drop?.label || 'Customer'}
                  </AppText>
                  <DPTimer seconds={seconds} />
                </View>
                <AppText style={styles.orderMeta}>
                  {pickup?.address || 'Pickup address'} · {drop?.address || 'Drop address'}
                </AppText>
                <AppText style={styles.orderMeta}>
                  {order.stops.length} stops · {Math.round(order.totalDistanceMeters / 1000)} km ·{' '}
                  {Math.round(order.estimatedDurationSeconds / 60)} min · {rupees(order.payoutAmountPaisa)}
                </AppText>
                {paymentLabel(order) ? (
                  <View style={styles.payTag}>
                    <DPStatusPill status={order.paymentRequired ? (order.paymentReceived ? 'PAID' : 'PENDING') : 'ACCEPTED'} label={paymentLabel(order)} />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <View style={styles.flex}>
                    <DPButton
                      label="Accept"
                      onPress={() => void accept(order.orderId)}
                      loading={busy === order.orderId}
                      disabled={seconds === 0}
                    />
                  </View>
                  <DPButton
                    label="Reject"
                    variant="danger"
                    fullWidth={false}
                    onPress={() => void reject(order.orderId)}
                    disabled={busy === order.orderId}
                    style={styles.reject}
                  />
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="View full offer details"
                  onPress={() =>
                    navigation.navigate('AcceptReject', {
                      orderId: order.orderId,
                      ...(order.expiresAt ? { expiresAt: order.expiresAt } : {}),
                    })
                  }
                  style={styles.offerLink}
                >
                  <AppText style={styles.open}>View full offer →</AppText>
                </TouchableOpacity>
              </DPSectionCard>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>Active route</AppText>
        {active.length === 0 ? (
          <DPSectionCard>
            <AppText style={styles.empty}>
              No active deliveries. {online ? 'Stay online — offers appear here.' : 'Go online to start.'}
            </AppText>
          </DPSectionCard>
        ) : (
          active.map((order) => {
            const done = order.stops.filter((s) => s.status === 'DELIVERED' || s.status === 'FAILED').length;
            return (
              <TouchableOpacity key={order.orderId} onPress={() => navigation.navigate('Route')} accessibilityRole="button">
                <DPSectionCard style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <AppText style={styles.orderTitle}>Order {order.orderId.slice(-6)}</AppText>
                    <DPStatusPill status="ACCEPTED" label={`${done}/${order.stops.length} stops`} />
                  </View>
                  <AppText style={styles.orderMeta}>
                    {order.stops.map((s) => s.label || s.stopType.toLowerCase()).join(' → ')}
                  </AppText>
                  {paymentLabel(order) ? (
                    <AppText style={styles.paymentTag}>{paymentLabel(order)}</AppText>
                  ) : null}
                  <AppText style={styles.open}>Open route →</AppText>
                </DPSectionCard>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <TouchableOpacity onPress={() => void onLogout()} style={styles.linkWrap} accessibilityRole="button">
        <AppText style={styles.link}>Go offline & sign out</AppText>
      </TouchableOpacity>
    </DPPage>
  );
}

const styles = StyleSheet.create({
  availability: { marginBottom: vs(12) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  flex: { flex: 1 },
  availabilityTitle: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '700' },
  availabilityCopy: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(3) },
  kpis: { marginBottom: vs(8) },
  section: { marginTop: vs(12) },
  sectionTitle: {
    ...DP_TYPE.kicker,
    color: DELIVERY.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: vs(8),
  },
  orderCard: { marginBottom: vs(10) },
  orderTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600', flex: 1 },
  orderMeta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(4) },
  payTag: { marginTop: vs(8), flexDirection: 'row' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: hs(10), marginTop: vs(12) },
  reject: { paddingHorizontal: hs(16) },
  empty: { ...DP_TYPE.body, color: DELIVERY.inkMuted },
  open: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '600', marginTop: vs(10) },
  paymentTag: { ...DP_TYPE.caption, fontWeight: '600', color: DELIVERY.warning, marginTop: vs(4) },
  offerLink: { marginTop: vs(2) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(10) },
  linkWrap: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center', marginTop: vs(16) },
  link: { ...DP_TYPE.label, color: DELIVERY.inkMuted, fontWeight: '500' },
});