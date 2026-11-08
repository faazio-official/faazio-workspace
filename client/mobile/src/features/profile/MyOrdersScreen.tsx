import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { neutral } from '@/theme/brandTokens';
import { semanticTint } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';
import { SHADOW_COLOR } from '@/theme/tokens';
import {
  Linking,
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  ChevronLeft,
  SlidersHorizontal,
  PackageOpen,
  X,
  FileText,
  Utensils,
  Pill,
  ShoppingBag,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { VendorRateButton } from '@/components/shared';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { semantic } from '@/theme/brandTokens';
import { getCatalogEntryById } from '@data/index';
import type { OrderStatus, MyOrdersStatusFilter } from '@data/types';
import type { AppBrand } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';
import { useOrdersStore, type PlacedOrder } from '@/state/ordersStore';
import { gateway } from '@/services/api/GatewayClient';
import MyOrdersAppRail from './MyOrdersAppRail';
import type { AppFilter } from './MyOrdersAppRail';
import MyOrdersFilterSheet from './MyOrdersFilterSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'MyOrders'>;

const STATUS_COLORS: Record<OrderStatus, string> = {
  Delivered: semantic.success,
  Shipped: semantic.info,
  Processing: semantic.warning,
  Cancelled: semantic.danger,
};

const STATUS_BADGE_BG: Record<OrderStatus, string> = {
  Delivered: semanticTint.success,
  Shipped: semanticTint.info,
  Processing: semanticTint.warning,
  Cancelled: semanticTint.danger,
};

/** Durable pharma status → list label + pill colours (mirrors Order Details). */
const RX_STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Awaiting quote',
  PROCESSING: 'Processing',
  QUOTED: 'Quote ready',
  READY: 'Ready',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
};

const RX_PILL: Record<string, { bg: string; color: string }> = {
  'Awaiting quote': { bg: semanticTint.warning, color: semantic.warning },
  Processing: { bg: semanticTint.warning, color: semantic.warning },
  'Quote ready': { bg: semanticTint.info, color: semantic.info },
  Ready: { bg: semanticTint.success, color: semantic.success },
  Fulfilled: { bg: semanticTint.success, color: semantic.success },
  Cancelled: { bg: semanticTint.danger, color: semantic.danger },
};

/**
 * One row in My Orders, built only from durable server history (serverOrders) and in-session
 * placements (orders). Each carries the sub-app inferred from its line items / Rx kind.
 */
interface ViewOrder {
  order: PlacedOrder;
  app: AppBrand;
}

const inferPlacedApp = (o: PlacedOrder): AppBrand => {
  if (o.kind === 'prescription') return 'PHARMA';
  const first = o.items?.[0]?.id ?? '';
  // Prefer the catalog entry's own brand (covers server-hydrated history whose
  // line items may not match the legacy id heuristics below).
  const entry = getCatalogEntryById(first);
  if (entry) return entry.app;
  const id = first.toLowerCase();
  if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) return 'PHARMA';
  if (
    id.startsWith('fm-') ||
    id.startsWith('gr-') ||
    id.includes('mart') ||
    id.includes('grocery') ||
    id.startsWith('cat-mt') ||
    id.startsWith('cat-mf') ||
    id.startsWith('cat-gr') ||
    id.startsWith('cat-fb')
  ) {
    return 'MART';
  }
  return 'FOOD';
};

const placedToViewOrder = (o: PlacedOrder): ViewOrder => ({ order: o, app: inferPlacedApp(o) });

/** Stable id used for `key` and highlight matching across the merged list. */
const viewOrderRefId = (vo: ViewOrder): string => vo.order.orderId;

export function MyOrdersScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const placedOrders = useOrdersStore((s) => s.orders);
  const serverOrders = useOrdersStore((s) => s.serverOrders);
  const ordersHydrated = useOrdersStore((s) => s.ordersHydrated);
  const ordersError = useOrdersStore((s) => s.ordersError);
  const refreshOrders = useOrdersStore((s) => s.refresh);
  const highlightOrderId = route.params?.highlightOrderId;
  const [activeApp, setActiveApp] = useState<AppFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<MyOrdersStatusFilter>(
    route.params?.initialTab ?? 'All Orders',
  );
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [stagedStatus, setStagedStatus] = useState<MyOrdersStatusFilter>(statusFilter);
  const [notificationCount, setNotificationCount] = useState(0);
  const [invoiceNotice, setInvoiceNotice] = useState<string | null>(null);

  // Badge = UNREAD notifications only (read_at is stamped when the inbox is opened).
  const refreshNotifications = useCallback(() => {
    void gateway
      .getNotifications()
      .then((items) => setNotificationCount(items.filter((item) => !item.readAt).length))
      .catch(() => {
        // Inbox is best-effort; the badge simply stays hidden on failure.
      });
  }, []);

  // Server history is authoritative: refresh on every focus (status changes while away).
  useFocusEffect(
    useCallback(() => {
      void refreshOrders();
      refreshNotifications();
    }, [refreshOrders, refreshNotifications]),
  );

  useEffect(() => {
    refreshNotifications();
    // Poll while the screen is mounted (production monitoring without FCM): Rx READY / order-status
    // notifications land in the in-app inbox and the badge updates within the poll window.
    const timer = setInterval(refreshNotifications, 60_000);
    return () => clearInterval(timer);
  }, [refreshNotifications]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleNotificationPress = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  const handleOpenFilter = useCallback(() => {
    setStagedStatus(statusFilter);
    setFilterSheetVisible(true);
  }, [statusFilter]);

  const handleSelectStatus = useCallback((s: MyOrdersStatusFilter) => {
    setStagedStatus(s);
  }, []);

  const handleClear = useCallback(() => {
    setStagedStatus('All Orders');
  }, []);

  const handleApply = useCallback(() => {
    setStatusFilter(stagedStatus);
    setFilterSheetVisible(false);
  }, [stagedStatus]);

  const handleCloseSheet = useCallback(() => {
    setFilterSheetVisible(false);
  }, []);

  /**
   * Merged list: in-session placements above the durable server history. The server is the only
   * history authority — no `@data` fixture is substituted when it is empty/offline. Any history row
   * already present as an in-session placement is dropped so it isn't listed twice.
   */
  const allOrders = useMemo<ViewOrder[]>(() => {
    const placed: ViewOrder[] = placedOrders.map(placedToViewOrder);
    const history: ViewOrder[] = serverOrders.map(placedToViewOrder);
    const placedIds = new Set(placed.map((vo) => viewOrderRefId(vo)));
    return [...placed, ...history.filter((vo) => !placedIds.has(viewOrderRefId(vo)))];
  }, [placedOrders, serverOrders]);

  const appCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allOrders.length };
    for (const vo of allOrders) {
      counts[vo.app] = (counts[vo.app] ?? 0) + 1;
    }
    return counts;
  }, [allOrders]);

  const statusCounts = useMemo(() => {
    const inApp = allOrders.filter((vo) => activeApp === 'ALL' || vo.app === activeApp);
    const counts: Record<string, number> = {
      'All Orders': inApp.length,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    for (const vo of inApp) {
      counts[vo.order.status] = (counts[vo.order.status] ?? 0) + 1;
    }
    return counts;
  }, [activeApp, allOrders]);

  const visibleOrders = useMemo(
    () =>
      allOrders.filter(
        (vo) =>
          (activeApp === 'ALL' || vo.app === activeApp) &&
          (statusFilter === 'All Orders' || vo.order.status === statusFilter),
      ),
    [activeApp, statusFilter, allOrders],
  );

  /** Auto-select the highlighted order's sub-app (Part D requirement 4). */
  const highlightedApp = useMemo<AppFilter | null>(() => {
    if (!highlightOrderId) return null;
    return allOrders.find((vo) => viewOrderRefId(vo) === highlightOrderId)?.app ?? null;
  }, [highlightOrderId, allOrders]);

  useEffect(() => {
    if (highlightedApp && activeApp === 'ALL') {
      setActiveApp(highlightedApp);
    }
  }, [highlightedApp, activeApp]);

  const hasActiveStatus = statusFilter !== 'All Orders';

  const handleClearFilters = useCallback(() => {
    setActiveApp('ALL');
    setStatusFilter('All Orders');
  }, []);

  const handleOpenOrder = useCallback(
    (orderId: string) => navigation.navigate('OrderDetails', { orderId }),
    [navigation],
  );

  /** Open the presigned invoice when rendered; surface a failure inline instead of navigating. */
  const handleDownloadInvoice = useCallback(
    async (orderId: string) => {
      setInvoiceNotice(null);
      try {
        const invoice = await gateway.getOrderInvoice(orderId);
        if (invoice.downloadUrl) {
          await Linking.openURL(invoice.downloadUrl);
          return;
        }
        setInvoiceNotice('The invoice is still being generated. Try again in a moment.');
      } catch {
        setInvoiceNotice('Could not fetch the invoice. Check your connection and try again.');
      }
    },
    [],
  );

  const handleRateVendor = useCallback(
    (vendor: { id: string; name: string }) =>
      navigation.navigate('RateVendor', { vendorId: vendor.id, vendorName: vendor.name }),
    [navigation],
  );

  const renderOrderCard = useCallback(
    ({ item: vo }: { item: ViewOrder }) => {
      const highlighted = !!highlightOrderId && viewOrderRefId(vo) === highlightOrderId;
      const po = vo.order;

      // Prescription placed order — distinct card; opens OrderDetails for the durable Rx
      // status + seller quote (same route as item orders).
      if (po.kind === 'prescription') {
        const rxLabel = po.rxStatus ? RX_STATUS_LABEL[po.rxStatus] ?? po.rxStatus : 'Processing';
        const rxPill = RX_PILL[rxLabel] ?? RX_PILL.Processing;
        const needsPay = po.rxStatus === 'QUOTED';
        return (
          <TouchableOpacity
            style={[styles.orderCard, highlighted && styles.orderCardHighlighted]}
            activeOpacity={0.9}
            onPress={() => handleOpenOrder(po.orderId)}
            accessibilityRole="button"
            accessibilityLabel={`Open prescription order ${po.orderId}`}
          >
            <View style={styles.cardHeader}>
              <AppText style={styles.orderDate}>
                {new Date(po.placedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </AppText>
              <View style={styles.headerPills}>
                {needsPay ? (
                  <View style={styles.actionPill}>
                    <AppText style={styles.actionPillText}>Pay now</AppText>
                  </View>
                ) : null}
                <View style={[styles.statusPill, { backgroundColor: rxPill.bg }]}>
                  <AppText style={[styles.statusText, { color: rxPill.color }]}>{rxLabel}</AppText>
                </View>
                {po.fulfillment === 'PICKUP' ? (
                  <View style={[styles.fulfillmentPill, styles.fulfillmentPillPickup]}>
                    <AppText style={[styles.fulfillmentPillText, styles.fulfillmentPillTextPickup]}>Self Pickup</AppText>
                  </View>
                ) : (
                  <View style={[styles.fulfillmentPill, styles.fulfillmentPillDelivery]}>
                    <AppText style={[styles.fulfillmentPillText, styles.fulfillmentPillTextDelivery]}>Delivery</AppText>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.productImagePlaceholder}>
                <FileText size={ms(22)} color={semantic.info} strokeWidth={1.5} />
              </View>
              <View style={styles.productInfo}>
                <AppText style={styles.productName} numberOfLines={1}>Prescription order</AppText>
                <AppText style={styles.productMeta} numberOfLines={1}>
                  {po.pages ?? 0} pages • {po.vendorName}
                </AppText>
              </View>
              <AppText style={styles.priceText}>₹{po.total}</AppText>
            </View>
          </TouchableOpacity>
        );
      }

      // Placed items order (in-session + server history) — standard card from store data.
      const first = po.items?.[0];
      const orderApp = inferPlacedApp(po);
      const OrderIcon =
        orderApp === 'PHARMA' ? Pill : orderApp === 'FOOD' ? Utensils : ShoppingBag;
      const qtyTotal = po.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
      return (
        <TouchableOpacity
          style={[styles.orderCard, highlighted && styles.orderCardHighlighted]}
          activeOpacity={0.9}
          onPress={() => handleOpenOrder(po.orderId)}
          accessibilityRole="button"
          accessibilityLabel={`Open order ${po.orderId}`}
        >
          <View style={styles.cardHeader}>
            <AppText style={styles.orderDate}>
              {new Date(po.placedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </AppText>
            <View style={styles.headerPills}>
              <View style={[styles.statusPill, { backgroundColor: STATUS_BADGE_BG[po.status] }]}>
                <AppText style={[styles.statusText, { color: STATUS_COLORS[po.status] }]}>
                  {po.status}
                </AppText>
              </View>
              {po.fulfillment === 'PICKUP' ? (
                <View style={[styles.fulfillmentPill, styles.fulfillmentPillPickup]}>
                  <AppText style={[styles.fulfillmentPillText, styles.fulfillmentPillTextPickup]}>Self Pickup</AppText>
                </View>
              ) : (
                <View style={[styles.fulfillmentPill, styles.fulfillmentPillDelivery]}>
                  <AppText style={[styles.fulfillmentPillText, styles.fulfillmentPillTextDelivery]}>Delivery</AppText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.productImagePlaceholder}>
              <OrderIcon size={ms(22)} color={semantic.neutral} strokeWidth={1.5} />
            </View>
            <View style={styles.productInfo}>
              <AppText style={styles.productName} numberOfLines={1}>{po.vendorName}</AppText>
              <AppText style={styles.productMeta} numberOfLines={1}>
                {first?.name ?? 'Order'} • Qty {qtyTotal}
              </AppText>
            </View>
            <AppText style={styles.priceText}>₹{po.total}</AppText>
          </View>

          <View style={styles.cardFooter}>
            <VendorRateButton
              vendorId={po.storeIds?.[0]}
              variant="compact"
              onPress={handleRateVendor}
            />
            {po.status === 'Delivered' ? (
              <TouchableOpacity
                style={styles.invoiceBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Download invoice for order ${po.orderId}`}
                onPress={() => void handleDownloadInvoice(po.orderId)}
              >
                <AppText style={styles.invoiceBtnText}>Invoice</AppText>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.viewDetailsBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              onPress={() => handleOpenOrder(po.orderId)}
            >
              <AppText style={styles.viewDetailsText}>View Details &gt;</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [highlightOrderId, handleOpenOrder, handleRateVendor, handleDownloadInvoice],
  );

  return (
    <View style={styles.container}>
      {/* 1. Fixed header — stays pinned while the list scrolls (mirrors AccountView). */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={ms(26)} color={neutral.ink} strokeWidth={2.2} />
            </TouchableOpacity>
            <AppText style={styles.headerTitle}>My Orders</AppText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleNotificationPress}
              style={styles.headerIconBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Bell size={ms(22)} color={neutral.ink} strokeWidth={2} />
              {notificationCount > 0 ? (
                <View style={styles.notifBadge}>
                  <AppText style={styles.notifBadgeText}>{notificationCount > 9 ? '9+' : notificationCount}</AppText>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        data={visibleOrders}
        keyExtractor={(vo) => vo.order.id}
        renderItem={renderOrderCard}
        ListHeaderComponent={
          <>
        {invoiceNotice ? (
          <View style={styles.invoiceNotice}>
            <AppText style={styles.invoiceNoticeText}>{invoiceNotice}</AppText>
            <TouchableOpacity
              onPress={() => setInvoiceNotice(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={ms(14)} color={semantic.warning} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 2. Sub-app rail */}
        <MyOrdersAppRail activeApp={activeApp} counts={appCounts} onSelect={setActiveApp} />

        {/* 3. Filter bar */}
        <View style={styles.filterBar}>
          {hasActiveStatus ? (
            <TouchableOpacity
              onPress={handleClearFilters}
              style={styles.statusChip}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${statusFilter} filter`}
            >
              <AppText style={styles.statusChipText}>{statusFilter}</AppText>
              <X size={ms(13)} color={semantic.success} strokeWidth={2.4} />
            </TouchableOpacity>
          ) : (
            <AppText style={styles.summaryText}>
              Showing {visibleOrders.length} {visibleOrders.length === 1 ? 'order' : 'orders'}
            </AppText>
          )}
          <TouchableOpacity
            onPress={handleOpenFilter}
            style={styles.filterBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Filter orders"
          >
            <SlidersHorizontal size={ms(15)} color={neutral.inkMuted} strokeWidth={2.2} />
            <AppText style={styles.filterText}>Filter</AppText>
            {hasActiveStatus ? <View style={styles.filterActiveDot} /> : null}
          </TouchableOpacity>
        </View>

        </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <PackageOpen size={ms(34)} color={neutral.inkSubtle} strokeWidth={2} />
            </View>
            <AppText style={styles.emptyTitle}>
              {!ordersHydrated
                ? 'Loading your orders...'
                : ordersError
                  ? 'Could not load your orders'
                  : 'No orders here yet'}
            </AppText>
            <AppText style={styles.emptySubtitle}>
              {!ordersHydrated
                ? 'Fetching your server order history.'
                : ordersError
                  ? 'Check your connection and try again.'
                  : 'Try a different sub-app or clear your filters.'}
            </AppText>
            {ordersHydrated ? (
              <TouchableOpacity
                onPress={() => {
                  if (ordersError) {
                    void refreshOrders();
                    return;
                  }
                  handleClearFilters();
                }}
                style={styles.emptyBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <AppText style={styles.emptyBtnText}>
                  {ordersError ? 'Try again' : 'Clear filters'}
                </AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        ListFooterComponent={<View style={styles.listBottomSpacer} />}
      />

      <MyOrdersFilterSheet
        visible={filterSheetVisible}
        staged={stagedStatus}
        counts={statusCounts}
        onSelectStatus={handleSelectStatus}
        onClear={handleClear}
        onApply={handleApply}
        onClose={handleCloseSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutral.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACE.LIST_BOTTOM,
  },

  /* Header */
  header: {
    backgroundColor: neutral.card,
    paddingBottom: SPACE.BLOCK,
    zIndex: 10,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: hs(8),
    padding: hs(2),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '600',
    color: neutral.ink,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: ms(20),
    backgroundColor: neutral.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: vs(-3),
    right: hs(-3),
    minWidth: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    backgroundColor: semantic.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(4),
    borderWidth: 2,
    borderColor: neutral.card,
  },
  notifBadgeText: {
    color: neutral.card,
    fontSize: ms(11),
    fontWeight: '600',
  },

  /* Filter bar */
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
  },
  summaryText: {
    fontSize: ms(13),
    color: neutral.inkMuted,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingVertical: vs(5),
    paddingHorizontal: hs(10),
    borderRadius: ms(14),
    backgroundColor: semanticTint.success,
  },
  statusChipText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: semantic.success,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    position: 'relative',
  },
  filterText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  filterActiveDot: {
    position: 'absolute',
    top: vs(-2),
    right: hs(-3),
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: semantic.success,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingTop: vs(56),
    paddingHorizontal: hs(32),
  },
  emptyIconBox: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    backgroundColor: neutral.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  emptyTitle: {
    fontSize: ms(16),
    fontWeight: '600',
    color: neutral.ink,
    marginBottom: vs(6),
  },
  emptySubtitle: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    textAlign: 'center',
    marginBottom: SPACE.SECTION,
  },
  emptyBtn: {
    paddingVertical: vs(10),
    paddingHorizontal: hs(20),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: semantic.success,
    backgroundColor: neutral.card,
  },
  emptyBtnText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: semantic.success,
  },

  /* List */
  list: {
    paddingHorizontal: hs(16),
    paddingTop: vs(4),
  },
  orderCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(12),
    padding: hs(16),
    marginBottom: SPACE.BLOCK,
    borderWidth: 1,
    borderColor: neutral.border,
  },
  orderCardHighlighted: {
    borderColor: categorical.amber,
    borderWidth: 2,
    shadowColor: categorical.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },

  /* Card Header */
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.BLOCK,
  },
  orderDate: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    flexShrink: 1,
  },
  headerPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    marginLeft: hs(8),
  },

  /* Card Body */
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productImagePlaceholder: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(8),
    backgroundColor: neutral.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  productInfo: {
    flex: 1,
    paddingRight: hs(8),
  },
  productName: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.ink,
    marginBottom: vs(3),
  },
  productMeta: {
    fontSize: ms(12),
    color: neutral.inkMuted,
  },
  priceText: {
    fontSize: ms(15),
    fontWeight: '600',
    color: neutral.ink,
    alignSelf: 'flex-start',
  },
  statusPill: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  actionPill: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
    backgroundColor: semanticTint.warning,
  },
  actionPillText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: semantic.warning,
  },
  statusText: {
    fontSize: ms(11),
    fontWeight: '600',
  },
  fulfillmentPill: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  fulfillmentPillDelivery: {
    backgroundColor: neutral.surfaceAlt,
  },
  fulfillmentPillPickup: {
    backgroundColor: semanticTint.info,
  },
  fulfillmentPillText: {
    fontSize: ms(11),
    fontWeight: '600',
  },
  fulfillmentPillTextDelivery: {
    color: neutral.inkMuted,
  },
  fulfillmentPillTextPickup: {
    color: categorical.indigo,
  },

  /* Card Footer */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: hs(8),
    marginTop: SPACE.ITEM,
  },
  invoiceBtn: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(6),
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: neutral.ink,
  },
  invoiceBtnText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.ink,
  },
  viewDetailsBtn: {
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: semantic.success,
    backgroundColor: neutral.card,
  },
  viewDetailsText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: semantic.success,
  },

  listBottomSpacer: {
    height: vs(40),
  },

  invoiceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(8),
    marginHorizontal: hs(16),
    marginTop: vs(12),
    paddingVertical: vs(10),
    paddingHorizontal: hs(12),
    borderRadius: ms(10),
    backgroundColor: semanticTint.warning,
  },
  invoiceNoticeText: {
    flex: 1,
    fontSize: ms(12),
    color: semantic.warning,
  },
});
