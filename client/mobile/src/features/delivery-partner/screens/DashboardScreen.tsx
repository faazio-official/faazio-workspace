import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
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
  DPStatusPill,
  DPTimer,
  DPSkeleton,
  DPErrorState,
  DPEmptyState,
  DPUtilityBar,
  DPRouteRail,
  DPOrderCard,
  DPSwipeAccept,
  DPFadeIn,
  DPFadeOut,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type DeliveryOrder, type DeliveryShiftSummary } from '@/services/api/GatewayClient';
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
import { formatRupees, formatNumber, formatOnlineTime } from '../format';
import { type DeliveryPartnerStackParamList, type DeliveryTabParamList } from '../navigation';
import { activeOrderFrom } from '../activeOrder';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DeliveryTabParamList, 'Dashboard'>,
  NativeStackScreenProps<DeliveryPartnerStackParamList>
>;

const HEARTBEAT_MS = 120_000;

/** Payment tag for an offer/active order: prepaid (UPI) vs collect-at-door (COD) state. */
const paymentLabel = (order: DeliveryOrder): string => {
  if (!order.paymentMethod) return '';
  if (order.paymentRequired) {
    return order.paymentReceived ? 'Payment received' : 'COD · collect at door';
  }
  return `${order.paymentMethod} · prepaid`;
};

/** Short "Cash"/"Prepaid" tag for summary meta lines. */
const paymentMeta = (order: DeliveryOrder): string =>
  order.paymentRequired ? 'Cash' : 'Prepaid';

const isStopDone = (status: string) => status === 'DELIVERED' || status === 'FAILED';

export function DashboardScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const setActiveOrder = useDeliveryPartnerStore((s) => s.setActiveOrder);
  const reset = useDeliveryPartnerStore((s) => s.reset);
  const logout = useAuthStore((s) => s.logout);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(Boolean(rider?.isAvailable));
  const [unread, setUnread] = useState(0);
  const [shiftSummary, setShiftSummary] = useState<DeliveryShiftSummary | null>(null);
  const [exiting, setExiting] = useState<Record<string, boolean>>({});
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

  const offers = useMemo(() => orders.filter((o) => o.status === 'ASSIGNED'), [orders]);
  const active = useMemo(() => orders.filter((o) => o.status === 'ACCEPTED'), [orders]);

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
      const me = await gateway.getDeliveryPartnerMe();
      setRider(me);
      setOnline(me.isAvailable);
      // Resolve status first: GET /delivery/active rejects a non-ACTIVE rider with 409, so issuing
      // it concurrently would throw before this redirect and leave the rider on a broken dashboard.
      if (me.status !== 'ACTIVE') {
        setOrders([]);
        setActiveOrder(null);
        stopHeartbeat();
        rootNavigation()?.replace('SubmissionSuccess');
        return;
      }
      const [nextOrders, inbox, shift] = await Promise.all([
        gateway.getActiveDeliveryOrders(),
        // Best-effort: the inbox badge is a courtesy; a failure must not block the shift.
        gateway.getNotifications().catch(() => []),
        // Best-effort: a shift-summary failure shows "—", never a fabricated figure.
        gateway.getDeliveryShiftSummary().catch(() => null),
      ]);
      setOrders(nextOrders);
      setUnread(inbox.filter((item) => !item.readAt).length);
      setActiveOrder(activeOrderFrom(nextOrders));
      setShiftSummary(shift);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
      setBooting(false);
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
      void Promise.all([
        gateway.getActiveDeliveryOrders(),
        gateway.getDeliveryShiftSummary().catch(() => null),
      ])
        .then(([next, shift]) => {
          setOrders(next);
          setActiveOrder(activeOrderFrom(next));
          // Keep the last server value on a transient poll failure rather than flashing "—".
          if (shift) setShiftSummary(shift);
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
        // Keep the card mounted through its DPFadeOut exit, then drop it from state.
        setExiting((prev) => ({ ...prev, [orderId]: true }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reject this order.');
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const finishExit = useCallback((orderId: string) => {
    setExiting((prev) => {
      if (!prev[orderId]) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
  }, []);

  const onLogout = useCallback(async () => {
    stopHeartbeat();
    stopIOSBackgroundLocation();
    await saveIOSBackgroundConsent(false);
    if (online) await gateway.setDeliveryAvailability(false).catch(() => undefined);
    await logout();
    reset();
    rootNavigation()?.reset({ index: 0, routes: [{ name: 'PhoneEntry' }] });
  }, [logout, online, reset, rootNavigation, stopHeartbeat]);

  const refreshControl = (
    <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
  );

  if (booting) {
    return (
      <DPPage refreshControl={refreshControl}>
        <DPPageHeader kicker="Delivery partner" title="Today" />
        <DPSkeleton lines={7} />
      </DPPage>
    );
  }

  const fatal = Boolean(error) && !rider;

  return (
    <DPPage
      refreshControl={refreshControl}
      header={
        <DPUtilityBar
          online={online}
          onToggleOnline={() => void toggleOnline()}
          onlineBusy={busy === 'availability'}
          unreadCount={unread}
          onOpenInbox={() => navigation.navigate('Notifications')}
          profileName={rider?.fullName}
          onOpenProfile={() => navigation.navigate('RiderProfile')}
        />
      }
    >
      <DPPageHeader
        leading={<FaazioLogo size={26} />}
        kicker="Delivery partner"
        title={rider?.fullName ?? 'Rider'}
        actions={rider ? <DPStatusPill status={rider.status} /> : undefined}
        tone={online ? 'success' : 'neutral'}
      />

      {fatal ? (
        <DPErrorState
          title="Could not load your shift"
          description={error ?? undefined}
          onRetry={() => void refresh()}
        />
      ) : (
        <>
          {error ? (
            <DPSectionCard style={styles.errorCard}>
              <AppText style={styles.errorText}>{error}</AppText>
              <DPButton
                label="Retry"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => void refresh()}
                style={styles.errorRetry}
              />
            </DPSectionCard>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <AppText style={styles.sectionTitle}>This shift</AppText>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="View earnings"
                onPress={() => navigation.navigate('Payouts')}
              >
                <AppText style={styles.link}>View earnings →</AppText>
              </TouchableOpacity>
            </View>
            <DPSectionCard>
              <View style={styles.summaryRow}>
                <View style={styles.summaryPrimary}>
                  <AppText style={styles.summaryValue}>{rider?.completedOrders ?? 0}</AppText>
                  <AppText style={styles.summaryLabel}>Deliveries completed</AppText>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <AppText style={styles.summarySmall}>
                    {rider?.currentLoad ?? 0}/{rider?.maxCapacity ?? 0}
                  </AppText>
                  <AppText style={styles.summaryLabel}>Load</AppText>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <AppText style={styles.summarySmall}>
                    {rider?.rating ? formatNumber(rider.rating, 1) : '—'}
                  </AppText>
                  <AppText style={styles.summaryLabel}>Rating</AppText>
                </View>
              </View>
              <View style={styles.summaryHairline} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryStat}>
                  <AppText style={styles.summarySmall}>
                    {shiftSummary ? formatRupees(shiftSummary.shiftEarningsPaisa) : '—'}
                  </AppText>
                  <AppText style={styles.summaryLabel}>Shift earnings</AppText>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <AppText style={styles.summarySmall}>
                    {shiftSummary ? formatOnlineTime(shiftSummary.onlineSecondsToday) : '—'}
                  </AppText>
                  <AppText style={styles.summaryLabel}>Online today</AppText>
                </View>
              </View>
              {!shiftSummary ? (
                <AppText style={styles.shiftNote}>
                  Shift earnings and online time are unavailable right now — pull to refresh.
                </AppText>
              ) : null}
            </DPSectionCard>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <AppText style={styles.sectionTitle}>Offers</AppText>
              {offers.length > 0 ? (
                <AppText style={styles.sectionCount}>{offers.length}</AppText>
              ) : null}
            </View>
            {offers.length === 0 ? (
              <DPSectionCard>
                <DPEmptyState
                  compact
                  tone={online ? 'brand' : 'neutral'}
                  title={online ? 'Waiting for offers' : 'You are offline'}
                  description={
                    online
                      ? 'Stay online — dispatch will ping you as soon as a nearby delivery is assigned.'
                      : 'Go online to receive delivery offers.'
                  }
                />
              </DPSectionCard>
            ) : (
              offers.map((order, index) => {
                // Only the server's window drives the countdown; never fabricate one.
                const seconds = order.expiresAt
                  ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000))
                  : null;
                const pickup = order.stops.find((s) => s.stopType === 'PICKUP');
                const drop = order.stops.find((s) => s.stopType === 'DROP');
                return (
                  <DPFadeOut
                    key={order.orderId}
                    visible={!exiting[order.orderId]}
                    onExited={() => finishExit(order.orderId)}
                  >
                  <DPFadeIn index={index}>
                  <DPSwipeAccept
                    onAccept={() => void accept(order.orderId)}
                    disabled={busy === order.orderId || seconds === 0}
                  >
                  <DPSectionCard style={styles.card}>
                    <View style={styles.rowBetween}>
                      <AppText style={styles.cardKicker}>New delivery</AppText>
                      {seconds !== null ? <DPTimer seconds={seconds} /> : null}
                    </View>
                    <DPRouteRail
                      style={styles.rail}
                      activeIndex={0}
                      stops={[
                        { label: pickup?.label || 'Store' },
                        { label: drop?.label || 'Customer' },
                      ]}
                    />
                    <AppText style={styles.cardMeta}>
                      {pickup?.address || 'Pickup address'} · {drop?.address || 'Drop address'}
                    </AppText>
                    <View style={styles.payRow}>
                      <AppText style={styles.payout}>{formatRupees(order.payoutAmountPaisa)}</AppText>
                      <AppText style={styles.payMeta}>
                        {order.stops.length} stops ·{' '}
                        {Math.round(order.totalDistanceMeters / 1000)} km ·{' '}
                        {Math.round(order.estimatedDurationSeconds / 60)} min
                      </AppText>
                    </View>
                    {paymentLabel(order) ? (
                      <View style={styles.payTag}>
                        <DPStatusPill
                          status={order.paymentRequired ? (order.paymentReceived ? 'PAID' : 'PENDING') : 'ACCEPTED'}
                          label={paymentLabel(order)}
                        />
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
                        variant="outline"
                        fullWidth={false}
                        onPress={() => void reject(order.orderId)}
                        disabled={busy === order.orderId}
                        style={styles.reject}
                      />
                    </View>
                    <AppText style={styles.swipeHint}>Swipe right to accept</AppText>
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
                      <AppText style={styles.link}>View full offer →</AppText>
                    </TouchableOpacity>
                  </DPSectionCard>
                  </DPSwipeAccept>
                  </DPFadeIn>
                  </DPFadeOut>
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <AppText style={styles.sectionTitle}>Your route</AppText>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Past deliveries"
                onPress={() => navigation.navigate('OrderHistory')}
              >
                <AppText style={styles.link}>Past deliveries →</AppText>
              </TouchableOpacity>
            </View>
            {active.length === 0 ? (
              <DPSectionCard>
                <DPEmptyState
                  compact
                  tone={online ? 'brand' : 'neutral'}
                  title="No active deliveries"
                  description={
                    online
                      ? 'Accepted orders appear here as a route to run.'
                      : 'Go online to start your shift.'
                  }
                />
              </DPSectionCard>
            ) : (
              active.map((order, index) => {
                const done = order.stops.filter((s) => isStopDone(s.status)).length;
                const nextIdx = order.stops.findIndex((s) => !isStopDone(s.status));
                const activeIndex = nextIdx === -1 ? order.stops.length : nextIdx;
                return (
                  <DPFadeIn key={order.orderId} index={index}>
                  <DPOrderCard
                    style={styles.card}
                    title={`Order ${order.orderId.slice(-6)}`}
                    status="ACCEPTED"
                    statusLabel={`${done}/${order.stops.length} stops`}
                    rail={
                      <DPRouteRail
                        activeIndex={activeIndex}
                        stops={order.stops.map((s) => ({
                          label: s.label || s.stopType,
                          done: isStopDone(s.status),
                        }))}
                      />
                    }
                    amount={formatRupees(order.payoutAmountPaisa)}
                    amountNote="on completion"
                    submeta={`${order.stops.length} stops · ${Math.round(
                      order.totalDistanceMeters / 1000,
                    )} km · ${paymentMeta(order)}`}
                    actionLabel="Open route"
                    onAction={() => navigation.navigate('Route')}
                    onPress={() => navigation.navigate('Route')}
                    accessibilityLabel={`Order ${order.orderId.slice(-6)}, ${done} of ${order.stops.length} stops done`}
                  />
                  </DPFadeIn>
                );
              })
            )}
          </View>

          <TouchableOpacity
            onPress={() => void onLogout()}
            style={styles.linkWrap}
            accessibilityRole="button"
          >
            <AppText style={styles.signOut}>Go offline and sign out</AppText>
          </TouchableOpacity>
        </>
      )}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: vs(16) },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(10),
    marginBottom: vs(8),
  },
  sectionTitle: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  sectionCount: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle },
  link: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '500' },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryPrimary: { flex: 1.4 },
  summaryStat: { flex: 1 },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: DELIVERY.border,
    marginHorizontal: hs(12),
  },
  summaryValue: { ...DP_TYPE.display, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  summarySmall: { ...DP_TYPE.title, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  summaryLabel: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
  summaryHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DELIVERY.border,
    marginTop: vs(12),
  },
  shiftNote: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle, marginTop: vs(10) },
  card: { marginBottom: vs(10) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(10) },
  cardKicker: { ...DP_TYPE.kicker, color: DELIVERY.inkMuted },
  rail: { marginTop: vs(12) },
  cardMeta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(10) },
  payRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: hs(10), marginTop: vs(10) },
  payout: { ...DP_TYPE.title, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  payMeta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, flexShrink: 1, textAlign: 'right' },
  payTag: { marginTop: vs(8), flexDirection: 'row' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: hs(10), marginTop: vs(12) },
  reject: { paddingHorizontal: hs(16) },
  swipeHint: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle, marginTop: vs(8) },
  offerLink: { marginTop: vs(10) },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: hs(10), marginBottom: vs(8) },
  errorText: { ...DP_TYPE.caption, color: DELIVERY.danger, flex: 1 },
  errorRetry: { paddingHorizontal: hs(10) },
  linkWrap: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center', marginTop: vs(16) },
  signOut: { ...DP_TYPE.label, color: DELIVERY.inkMuted },
});