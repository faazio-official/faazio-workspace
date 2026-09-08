import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Settings,
  ChevronLeft,
  SlidersHorizontal,
  PackageOpen,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { myOrders } from '@data/index';
import type { MyOrder, OrderStatus, MyOrdersStatusFilter } from '@data/types';
import type { AppBrand } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';
import MyOrdersAppRail from './MyOrdersAppRail';
import type { AppFilter } from './MyOrdersAppRail';
import MyOrdersFilterSheet from './MyOrdersFilterSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'MyOrders'>;

const NOTIFICATION_BADGE = '3';

const STATUS_COLORS: Record<OrderStatus, string> = {
  Delivered: '#16A34A',
  Shipped: '#2563EB',
  Processing: '#D97706',
  Cancelled: '#EF4444',
};

const STATUS_BADGE_BG: Record<OrderStatus, string> = {
  Delivered: '#DCFCE7',
  Shipped: '#DBEAFE',
  Processing: '#FEF3C7',
  Cancelled: '#FEE2E2',
};

export function MyOrdersScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [activeApp, setActiveApp] = useState<AppFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<MyOrdersStatusFilter>(
    route.params?.initialTab ?? 'All Orders',
  );
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [stagedStatus, setStagedStatus] = useState<MyOrdersStatusFilter>(statusFilter);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleNotificationPress = useCallback(() => {
    // TODO: Notifications screen — no-op placeholder (no target screen yet).
  }, []);
  const handleSettingsPress = useCallback(() => {
    // TODO: Settings screen — no-op placeholder (no target screen yet).
  }, []);

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

  const appCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: myOrders.length };
    for (const o of myOrders) {
      counts[o.app] = (counts[o.app] ?? 0) + 1;
    }
    return counts;
  }, []);

  const statusCounts = useMemo(() => {
    const inApp = myOrders.filter((o) => activeApp === 'ALL' || o.app === activeApp);
    const counts: Record<string, number> = {
      'All Orders': inApp.length,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    for (const o of inApp) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    }
    return counts;
  }, [activeApp]);

  const visibleOrders = useMemo(
    () =>
      myOrders.filter(
        (o) =>
          (activeApp === 'ALL' || o.app === activeApp) &&
          (statusFilter === 'All Orders' || o.status === statusFilter),
      ),
    [activeApp, statusFilter],
  );

  const hasActiveStatus = statusFilter !== 'All Orders';

  const handleClearFilters = useCallback(() => {
    setActiveApp('ALL');
    setStatusFilter('All Orders');
  }, []);

  const handleOpenOrder = useCallback(
    (orderId: string) => navigation.navigate('OrderDetails', { orderId }),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
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
              <Bell size={ms(22)} color="#0f172a" strokeWidth={2} />
              <View style={styles.notifBadge}>
                <AppText style={styles.notifBadgeText}>{NOTIFICATION_BADGE}</AppText>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSettingsPress}
              style={styles.headerIconBtn}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Settings size={ms(22)} color="#0f172a" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

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
              <X size={ms(13)} color="#16A34A" strokeWidth={2.4} />
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
            <SlidersHorizontal size={ms(15)} color="#374151" strokeWidth={2.2} />
            <AppText style={styles.filterText}>Filter</AppText>
            {hasActiveStatus ? <View style={styles.filterActiveDot} /> : null}
          </TouchableOpacity>
        </View>

        {/* 4. Order Cards / Empty State */}
        {visibleOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <PackageOpen size={ms(34)} color="#9CA3AF" strokeWidth={2} />
            </View>
            <AppText style={styles.emptyTitle}>No orders here yet</AppText>
            <AppText style={styles.emptySubtitle}>
              Try a different sub-app or clear your filters.
            </AppText>
            <TouchableOpacity
              onPress={handleClearFilters}
              style={styles.emptyBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <AppText style={styles.emptyBtnText}>Clear filters</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                activeOpacity={0.9}
                onPress={() => handleOpenOrder(order.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open order ${order.orderNumber}`}
              >
                {/* Card Header — date + status pills */}
                <View style={styles.cardHeader}>
                  <AppText style={styles.orderDate}>{order.orderDateTime}</AppText>
                  <View style={styles.headerPills}>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_BADGE_BG[order.status] }]}>
                      <AppText style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                        {order.status}
                      </AppText>
                    </View>
                    {order.fulfillment === 'PICKUP' ? (
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

                {/* Card Body */}
                <View style={styles.cardBody}>
                  <View style={styles.productImagePlaceholder}>
                    <AppText style={styles.productEmoji}>{order.emoji}</AppText>
                  </View>
                  <View style={styles.productInfo}>
                    <AppText style={styles.productName} numberOfLines={1}>{order.productName}</AppText>
                    <AppText style={styles.productMeta} numberOfLines={1}>
                      {order.variant} • Qty {order.qty}
                    </AppText>
                  </View>
                  <AppText style={styles.priceText}>₹{order.price}</AppText>
                </View>

                {/* Card Footer */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.viewDetailsBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    onPress={() => handleOpenOrder(order.id)}
                  >
                    <AppText style={styles.viewDetailsText}>View Details &gt;</AppText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.listBottomSpacer} />
          </View>
        )}
      </ScrollView>

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
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: vs(32),
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    paddingBottom: vs(10),
    backgroundColor: '#FFFFFF',
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
    fontWeight: '800',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  headerIconBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(4),
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
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
    color: '#6B7280',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingVertical: vs(5),
    paddingHorizontal: hs(10),
    borderRadius: ms(14),
    backgroundColor: '#DCFCE7',
  },
  statusChipText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#16A34A',
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
    color: '#374151',
  },
  filterActiveDot: {
    position: 'absolute',
    top: vs(-2),
    right: hs(-3),
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#16A34A',
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
  },
  emptyTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: vs(6),
  },
  emptySubtitle: {
    fontSize: ms(13),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: vs(20),
  },
  emptyBtn: {
    paddingVertical: vs(10),
    paddingHorizontal: hs(20),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#16A34A',
    backgroundColor: '#FFFFFF',
  },
  emptyBtnText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#16A34A',
  },

  /* List */
  list: {
    paddingHorizontal: hs(16),
    paddingTop: vs(4),
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    padding: hs(16),
    marginBottom: vs(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  /* Card Header */
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  orderDate: {
    fontSize: ms(12),
    color: '#6B7280',
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  productEmoji: {
    fontSize: ms(32),
  },
  productInfo: {
    flex: 1,
    paddingRight: hs(8),
  },
  productName: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#111827',
    marginBottom: vs(3),
  },
  productMeta: {
    fontSize: ms(12),
    color: '#6B7280',
  },
  priceText: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#111827',
    alignSelf: 'flex-start',
  },
  statusPill: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  statusText: {
    fontSize: ms(11),
    fontWeight: '700',
  },
  fulfillmentPill: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  fulfillmentPillDelivery: {
    backgroundColor: '#F3F4F6',
  },
  fulfillmentPillPickup: {
    backgroundColor: '#EEF2FF',
  },
  fulfillmentPillText: {
    fontSize: ms(10),
    fontWeight: '700',
  },
  fulfillmentPillTextDelivery: {
    color: '#6B7280',
  },
  fulfillmentPillTextPickup: {
    color: '#4F46E5',
  },

  /* Card Footer */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: vs(12),
  },
  viewDetailsBtn: {
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: '#16A34A',
    backgroundColor: '#FFFFFF',
  },
  viewDetailsText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#16A34A',
  },

  listBottomSpacer: {
    height: vs(40),
  },
});
