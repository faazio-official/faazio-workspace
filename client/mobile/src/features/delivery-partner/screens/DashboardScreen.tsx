import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import {
  gateway,
  type DeliveryOrder,
  type DeliveryPartnerRider,
} from '@/services/api/GatewayClient';
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
import { Card, DP, ErrorText, PrimaryButton, Screen, StatusPill } from '../components';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'Dashboard'>;

const HEARTBEAT_MS = 120_000;

const rupees = (paisa: number) => `₹${(paisa / 100).toFixed(0)}`;

export function DashboardScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
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

  const offers = useMemo(
    () => orders.filter((o) => o.status === 'ASSIGNED'),
    [orders],
  );
  const active = useMemo(
    () => orders.filter((o) => o.status === 'ACCEPTED'),
    [orders],
  );

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
      if (me.status !== 'ACTIVE') {
        stopHeartbeat();
        navigation.replace('SubmissionSuccess');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [navigation, setRider, stopHeartbeat]);

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
  useEffect(() => {
    if (!online) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void gateway.getActiveDeliveryOrders().then(setOrders).catch(() => undefined);
    }, 20_000);
    return () => clearInterval(timer);
  }, [online]);

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
    navigation.replace('PhoneEntry');
  }, [logout, navigation, online, reset, stopHeartbeat]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        <View style={styles.header}>
          <FaazioLogo size={26} />
          <View style={styles.flex}>
            <AppText style={styles.kicker}>Delivery Partner</AppText>
            <AppText style={styles.name}>{rider?.fullName ?? 'Rider'}</AppText>
          </View>
          {rider ? <StatusPill status={rider.status} /> : null}
        </View>

        <Card style={[styles.availability, online ? styles.onlineCard : null]}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <AppText style={styles.availabilityTitle}>{online ? 'You are online' : 'You are offline'}</AppText>
              <AppText style={styles.availabilityCopy}>
                {online
                  ? 'Available — waiting for orders. Location heartbeats keep you in dispatch.'
                  : 'Go online to receive nearby delivery offers.'}
              </AppText>
            </View>
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: online }}
              onPress={() => void toggleOnline()}
              disabled={busy === 'availability'}
              style={[styles.switch, online && styles.switchOn]}
            >
              <View style={[styles.knob, online && styles.knobOn]} />
            </TouchableOpacity>
          </View>
          <View style={styles.loadRow}>
            <AppText style={styles.loadText}>
              Load {rider?.currentLoad ?? 0} / {rider?.maxCapacity ?? 0}
            </AppText>
            <AppText style={styles.loadText}>
              {rider?.completedOrders ?? 0} deliveries · {rider?.rating ? rider.rating.toFixed(1) : '—'}★
            </AppText>
          </View>
        </Card>

        <ErrorText>{error}</ErrorText>

        {offers.length > 0 ? (
          <>
            <AppText style={styles.sectionTitle}>New offers</AppText>
            {offers.map((order) => {
              const seconds = order.expiresAt
                ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000))
                : 45;
              const pickup = order.stops.find((s) => s.stopType === 'PICKUP');
              const drop = order.stops.find((s) => s.stopType === 'DROP');
              return (
                <Card key={order.orderId} style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <AppText style={styles.orderTitle}>
                      {pickup?.label || 'Store'} → {drop?.label || 'Customer'}
                    </AppText>
                    <AppText style={[styles.timer, seconds <= 10 && styles.timerDanger]}>{seconds}s</AppText>
                  </View>
                  <AppText style={styles.orderMeta}>
                    {pickup?.address || 'Pickup address'} · {drop?.address || 'Drop address'}
                  </AppText>
                  <AppText style={styles.orderMeta}>
                    {order.stops.length} stops · {Math.round(order.totalDistanceMeters / 1000)} km ·{' '}
                    {Math.round(order.estimatedDurationSeconds / 60)} min · {rupees(order.payoutAmountPaisa)}
                  </AppText>
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <PrimaryButton
                        label="Accept"
                        onPress={() => void accept(order.orderId)}
                        loading={busy === order.orderId}
                        disabled={seconds === 0}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => void reject(order.orderId)}
                      disabled={busy === order.orderId}
                      style={styles.reject}
                    >
                      <AppText style={styles.rejectText}>Reject</AppText>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        <AppText style={styles.sectionTitle}>Active route</AppText>
        {active.length === 0 ? (
          <Card>
            <AppText style={styles.empty}>
              No active deliveries. {online ? 'Stay online — offers appear here.' : 'Go online to start.'}
            </AppText>
          </Card>
        ) : (
          active.map((order) => {
            const done = order.stops.filter((s) => s.status === 'DELIVERED' || s.status === 'FAILED').length;
            return (
              <TouchableOpacity key={order.orderId} onPress={() => navigation.navigate('Route')}>
                <Card style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <AppText style={styles.orderTitle}>Order {order.orderId.slice(-6)}</AppText>
                    <AppText style={styles.badge}>
                      {done}/{order.stops.length} stops
                    </AppText>
                  </View>
                  <AppText style={styles.orderMeta}>
                    {order.stops.map((s) => s.label || s.stopType.toLowerCase()).join(' → ')}
                  </AppText>
                  <AppText style={styles.open}>Open route →</AppText>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity onPress={() => void onLogout()} style={styles.linkWrap}>
          <AppText style={styles.link}>Go offline & sign out</AppText>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(16), paddingBottom: vs(40) },
  header: { flexDirection: 'row', alignItems: 'center', gap: hs(10), marginTop: vs(12), marginBottom: vs(16) },
  flex: { flex: 1 },
  kicker: { fontSize: ms(10), fontWeight: '900', color: DP.brand, textTransform: 'uppercase', letterSpacing: 1.2 },
  name: { fontSize: ms(18), fontWeight: '900', color: DP.ink },
  availability: { marginBottom: vs(12) },
  onlineCard: { borderColor: DP.success },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  availabilityTitle: { fontSize: ms(18), fontWeight: '900', color: DP.ink },
  availabilityCopy: { fontSize: ms(12), lineHeight: ms(18), color: DP.muted, marginTop: vs(3) },
  switch: {
    width: ms(52), height: ms(30), borderRadius: ms(999), backgroundColor: '#cbd5e1',
    padding: ms(3), justifyContent: 'center',
  },
  switchOn: { backgroundColor: DP.success },
  knob: { width: ms(24), height: ms(24), borderRadius: ms(999), backgroundColor: '#ffffff' },
  knobOn: { alignSelf: 'flex-end' },
  loadRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: vs(14), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DP.line, paddingTop: vs(10) },
  loadText: { fontSize: ms(11), fontWeight: '800', color: DP.muted },
  sectionTitle: { fontSize: ms(13), fontWeight: '900', color: DP.ink, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: vs(8), marginBottom: vs(8) },
  orderCard: { marginBottom: vs(10) },
  orderTitle: { fontSize: ms(14), fontWeight: '900', color: DP.ink, flex: 1 },
  orderMeta: { fontSize: ms(12), lineHeight: ms(18), color: DP.muted, marginTop: vs(4) },
  timer: { fontSize: ms(13), fontWeight: '900', color: DP.warning },
  timerDanger: { color: DP.danger },
  actions: { flexDirection: 'row', alignItems: 'center', gap: hs(10), marginTop: vs(12) },
  reject: { paddingHorizontal: hs(16), paddingVertical: vs(12) },
  rejectText: { fontSize: ms(12), fontWeight: '900', color: DP.danger, textTransform: 'uppercase' },
  empty: { fontSize: ms(13), color: DP.muted, lineHeight: ms(19) },
  badge: { fontSize: ms(11), fontWeight: '900', color: DP.brand },
  open: { fontSize: ms(12), fontWeight: '900', color: DP.brand, marginTop: vs(8) },
  linkWrap: { alignItems: 'center', marginTop: vs(18) },
  link: { fontSize: ms(12), fontWeight: '800', color: DP.muted },
});
