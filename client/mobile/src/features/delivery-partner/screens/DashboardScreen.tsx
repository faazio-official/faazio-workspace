import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellRing, ChevronRight, PowerOff, Route as RouteIcon } from 'lucide-react-native';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPButton,
  DPSectionCard,
  DPSectionHeader,
  DPStat,
  DPStatStrip,
  DPSeparator,
  DPStatusPill,
  DPTimer,
  DPSkeleton,
  DPErrorState,
  DPEmptyState,
  DPRouteRail,
  DPOrderCard,
  DPFadeIn,
  DPFadeOut,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type DeliveryOrder, type DeliveryShiftSummary } from '@/services/api/GatewayClient';
import { startDeliveryPush } from '@/services/deliveryPush';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { useDeliverySettingsStore } from '@/state/deliverySettingsStore';
import { hs, ms, vs } from '@/utils/responsive';
import { headlineRupees, formatNumber, formatOnlineTime } from '../format';
import { isStopDone } from '../order';
import { type DeliveryPartnerStackParamList, type DeliveryTabParamList } from '../navigation';
import { activeOrderFrom } from '../activeOrder';
import { DeliveryHeader } from '../components/DeliveryHeader';
import { CallCustomerButton } from '../components/CallCustomerButton';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DeliveryTabParamList, 'Dashboard'>,
  NativeStackScreenProps<DeliveryPartnerStackParamList>
>;

/** Payment tag for an offer/active order: prepaid (UPI) vs collect-at-door (COD) state. */
const paymentLabel = (order: DeliveryOrder): string => {
  if (!order.paymentMethod) return '';
  if (order.paymentRequired) {
    return order.paymentReceived ? 'Collected at door' : 'Collect at door';
  }
  return `${order.paymentMethod} prepaid`;
};

/** Short "Cash"/"Prepaid" tag for summary meta lines. */
const paymentMeta = (order: DeliveryOrder): string =>
  order.paymentRequired ? 'Cash' : 'Prepaid';

export function DashboardScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const setActiveOrder = useDeliveryPartnerStore((s) => s.setActiveOrder);
  const online = useDeliveryPartnerStore((s) => s.online);
  const setOnline = useDeliveryPartnerStore((s) => s.setOnline);
  const setUnread = useDeliveryPartnerStore((s) => s.setUnread);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shiftSummary, setShiftSummary] = useState<DeliveryShiftSummary | null>(null);
  const [exiting, setExiting] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());
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
  }, [rootNavigation, setActiveOrder, setOnline, setRider, setUnread]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const refreshControl = (
    <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
  );

  if (booting) {
    return (
      <DPPage refreshControl={refreshControl} header={<DeliveryHeader />}>
        <DPSkeleton lines={7} />
      </DPPage>
    );
  }

  const fatal = Boolean(error) && !rider;

  return (
    <DPPage refreshControl={refreshControl} header={<DeliveryHeader />}>
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
            <DPSectionHeader
              title="This shift"
              actionLabel="View earnings"
              onAction={() => navigation.navigate('Payouts')}
            />
            <DPSectionCard>
              <DPStatStrip>
                <DPStat
                  size="display"
                  style={styles.summaryPrimary}
                  label="Deliveries completed"
                  value={String(rider?.completedOrders ?? 0)}
                />
                <DPStat
                  style={styles.summaryStat}
                  label="Load"
                  value={`${rider?.currentLoad ?? 0}/${rider?.maxCapacity ?? 0}`}
                />
                <DPStat
                  style={styles.summaryStat}
                  label="Rating"
                  value={rider?.rating ? formatNumber(rider.rating, 1) : '—'}
                />
              </DPStatStrip>
              <DPSeparator />
              <DPStatStrip>
                <DPStat
                  style={styles.summaryStat}
                  label="Shift earnings"
                  value={shiftSummary ? headlineRupees(shiftSummary.shiftEarningsPaisa) : '—'}
                />
                <DPStat
                  style={styles.summaryStat}
                  label="Online today"
                  value={shiftSummary ? formatOnlineTime(shiftSummary.onlineSecondsToday) : '—'}
                />
              </DPStatStrip>
              {!shiftSummary ? (
                <AppText style={styles.shiftNote}>
                  Shift earnings and online time are unavailable right now — pull to refresh.
                </AppText>
              ) : null}
            </DPSectionCard>
          </View>

          <View style={styles.section}>
            <DPSectionHeader title="Offers" count={offers.length > 0 ? offers.length : undefined} />
            {offers.length === 0 ? (
              <DPSectionCard>
                <DPEmptyState
                  compact
                  tone={online ? 'brand' : 'neutral'}
                  icon={
                    online ? (
                      <BellRing size={ms(20)} color={DELIVERY.brand} strokeWidth={1.8} />
                    ) : (
                      <PowerOff size={ms(20)} color={DELIVERY.inkMuted} strokeWidth={1.8} />
                    )
                  }
                  title={online ? 'Waiting for offers' : 'You are offline'}
                  description={
                    online
                      ? 'Dispatch will ping you when a delivery is nearby'
                      : 'Go online to receive offers'
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
                  <DPSectionCard style={styles.card}>
                    {seconds !== null ? (
                      <View style={styles.offerTop}>
                        <DPTimer seconds={seconds} />
                      </View>
                    ) : null}
                    <DPRouteRail
                      style={styles.rail}
                      activeIndex={0}
                      stops={[
                        { label: pickup?.label || 'Store', kind: 'pickup' },
                        { label: drop?.label || 'Customer', kind: 'drop' },
                      ]}
                    />
                    <AppText style={styles.cardMeta}>
                      {pickup?.address || 'Pickup address'} · {drop?.address || 'Drop address'}
                    </AppText>
                    <View style={styles.payRow}>
                      <View style={styles.payPrimary}>
                        <AppText style={styles.payout}>
                          {headlineRupees(order.payoutAmountPaisa)}
                        </AppText>
                        {paymentLabel(order) ? (
                          <View style={styles.payTag}>
                            <DPStatusPill
                              status={
                                order.paymentRequired
                                  ? order.paymentReceived
                                    ? 'PAID'
                                    : 'PENDING'
                                  : 'PAID'
                              }
                              label={paymentLabel(order)}
                            />
                          </View>
                        ) : null}
                      </View>
                      <AppText style={styles.payMeta}>
                        {order.stops.length} stops ·{' '}
                        {Math.round(order.totalDistanceMeters / 1000)} km ·{' '}
                        {Math.round(order.estimatedDurationSeconds / 60)} min
                      </AppText>
                    </View>
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
                      <View style={styles.linkRow}>
                        <AppText style={styles.link}>View full offer</AppText>
                        <ChevronRight size={ms(16)} color={DELIVERY.brand} strokeWidth={1.5} />
                      </View>
                    </TouchableOpacity>
                  </DPSectionCard>
                  </DPFadeIn>
                  </DPFadeOut>
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <DPSectionHeader
              title="Your route"
              actionLabel="Past deliveries"
              onAction={() => navigation.navigate('OrderHistory')}
            />
            {active.length === 0 ? (
              <DPSectionCard>
                <DPEmptyState
                  compact
                  tone={online ? 'brand' : 'neutral'}
                  icon={
                    online ? (
                      <RouteIcon size={ms(20)} color={DELIVERY.brand} strokeWidth={1.8} />
                    ) : (
                      <PowerOff size={ms(20)} color={DELIVERY.inkMuted} strokeWidth={1.8} />
                    )
                  }
                  title="No active deliveries"
                  description={
                    online
                      ? 'Accepted orders appear here as a route to run'
                      : 'Go online to start your shift'
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
                          kind: s.stopType === 'PICKUP' ? 'pickup' : s.stopType === 'DROP' ? 'drop' : 'stop',
                        }))}
                      />
                    }
                    amount={headlineRupees(order.payoutAmountPaisa)}
                    amountNote="on completion"
                    submeta={`${order.stops.length} stops · ${Math.round(
                      order.totalDistanceMeters / 1000,
                    )} km · ${paymentMeta(order)}`}
                    actionLabel="Open route"
                    onAction={() => navigation.navigate('Route')}
                    onPress={() => navigation.navigate('Route')}
                    accessibilityLabel={`Order ${order.orderId.slice(-6)}, ${done} of ${order.stops.length} stops done`}
                  />
                  <CallCustomerButton orderId={order.orderId} style={styles.activeCall} />
                  </DPFadeIn>
                );
              })
            )}
          </View>
        </>
      )}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  activeCall: { marginTop: vs(8), marginBottom: vs(4) },
  section: { marginTop: DELIVERY.space.SECTION },
  summaryPrimary: { flex: 1.4 },
  summaryStat: { flex: 1 },
  link: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '500' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: hs(2) },
  shiftNote: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle, marginTop: vs(8) },
  card: { marginBottom: DELIVERY.space.ITEM },
  offerTop: { alignItems: 'flex-end' },
  rail: { marginTop: vs(12) },
  cardMeta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(8) },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: hs(8), marginTop: vs(12) },
  payPrimary: { flexShrink: 1 },
  payout: { ...DP_TYPE.title, color: DELIVERY.ink, fontVariant: ['tabular-nums'] },
  payMeta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, flexShrink: 1, textAlign: 'right' },
  payTag: { marginTop: vs(8), flexDirection: 'row' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: hs(8), marginTop: vs(12) },
  reject: { paddingHorizontal: hs(16) },
  offerLink: { marginTop: vs(8) },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: hs(8), marginBottom: vs(8) },
  errorText: { ...DP_TYPE.caption, color: DELIVERY.danger, flex: 1 },
  errorRetry: { paddingHorizontal: hs(8) },
});