import React, { useCallback, useState } from 'react';
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
  ChevronDown,
  MoreVertical,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { myOrders, myOrdersTabs } from '@data/index';
import type { MyOrder, OrderStatus, MyOrdersTab } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyOrders'>;

const NOTIFICATION_BADGE = '3';

const STATUS_COLORS: Record<OrderStatus, string> = {
  Delivered: '#16A34A',
  Shipped: '#2563EB',
  Processing: '#D97706',
};

const STATUS_BADGE_BG: Record<OrderStatus, string> = {
  Delivered: '#DCFCE7',
  Shipped: '#DBEAFE',
  Processing: '#FEF3C7',
};

export function MyOrdersScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MyOrdersTab>(
    route.params?.initialTab ?? 'All Orders',
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleNotificationPress = useCallback(() => {
    // TODO: Notifications screen — no-op placeholder (no target screen yet).
  }, []);
  const handleSettingsPress = useCallback(() => {
    // TODO: Settings screen — no-op placeholder (no target screen yet).
  }, []);

  const visibleOrders: MyOrder[] =
    activeTab === 'All Orders'
      ? myOrders
      : myOrders.filter((o) => o.status === activeTab);

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

        {/* 2. Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabScrollContent}
        >
          {myOrdersTabs.map((tab) => {
            const isActive = activeTab === tab.name;
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => setActiveTab(tab.name)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <AppText style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}>
                  {tab.name}
                </AppText>
                <View style={[styles.tabBadge, isActive ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
                  <AppText style={[styles.tabBadgeText, isActive ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive]}>
                    {tab.count}
                  </AppText>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 3. Sort & Filter Bar */}
        <View style={styles.sortFilterBar}>
          <TouchableOpacity style={styles.sortLeft} activeOpacity={0.7} accessibilityRole="button">
            <AppText style={styles.sortLabel}>Sort by</AppText>
            <AppText style={styles.sortValue}>Latest</AppText>
            <ChevronDown size={ms(14)} color="#111827" strokeWidth={2.4} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterRight} activeOpacity={0.7} accessibilityRole="button">
            <SlidersHorizontal size={ms(15)} color="#374151" strokeWidth={2.2} />
            <AppText style={styles.filterText}>Filter</AppText>
          </TouchableOpacity>
        </View>

        {/* 4. Order Cards */}
        <View style={styles.list}>
          {visibleOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <AppText style={styles.orderIdLabel}>
                    Order ID: <AppText style={styles.orderIdValue}>{order.orderNumber}</AppText>
                  </AppText>
                  <AppText style={styles.orderDate}>{order.orderDateTime}</AppText>
                </View>
                <TouchableOpacity
                  style={styles.menuBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Order options"
                >
                  <MoreVertical size={ms(18)} color="#6B7280" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {/* Card Body */}
              <View style={styles.cardBody}>
                <View style={styles.productImagePlaceholder}>
                  <AppText style={styles.productEmoji}>{order.emoji}</AppText>
                </View>
                <View style={styles.productInfo}>
                  <AppText style={styles.productName} numberOfLines={2}>{order.productName}</AppText>
                  <AppText style={styles.productVariant} numberOfLines={2}>{order.variant}</AppText>
                  <AppText style={styles.productQty}>Qty: {order.qty}</AppText>
                </View>
                <View style={styles.priceStatusInfo}>
                  <AppText style={styles.priceText}>₹{order.price}</AppText>
                  <View style={[styles.statusPill, { backgroundColor: STATUS_BADGE_BG[order.status] }]}>
                    <AppText style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                      {order.status}
                    </AppText>
                  </View>
                  <AppText style={styles.statusDate}>{order.statusDate}</AppText>
                </View>
              </View>

              {/* Card Footer */}
              <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.viewDetailsBtn} activeOpacity={0.7} accessibilityRole="button">
                  <AppText style={styles.viewDetailsText}>View Details &gt;</AppText>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.listBottomSpacer} />
        </View>
      </ScrollView>
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

  /* Tabs */
  tabScroll: {
    backgroundColor: '#FFFFFF',
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabScrollContent: {
    paddingHorizontal: hs(8),
  },
  tabItem: {
    alignItems: 'center',
    paddingVertical: vs(12),
    paddingHorizontal: hs(14),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#16A34A',
  },
  tabText: {
    fontSize: ms(13),
    fontWeight: '600',
    marginBottom: vs(6),
  },
  tabTextActive: {
    color: '#16A34A',
  },
  tabTextInactive: {
    color: '#6B7280',
  },
  tabBadge: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(10),
  },
  tabBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  tabBadgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  tabBadgeText: {
    fontSize: ms(10),
    fontWeight: '700',
  },
  tabBadgeTextActive: {
    color: '#16A34A',
  },
  tabBadgeTextInactive: {
    color: '#9CA3AF',
  },

  /* Sort & Filter Bar */
  sortFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: ms(13),
    color: '#6B7280',
    marginRight: hs(4),
  },
  sortValue: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#111827',
    marginRight: hs(2),
  },
  filterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  filterText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#374151',
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
    alignItems: 'flex-start',
    marginBottom: vs(12),
  },
  cardHeaderText: {
    flex: 1,
    paddingRight: hs(8),
  },
  orderIdLabel: {
    fontSize: ms(13),
    color: '#4B5563',
    marginBottom: vs(2),
  },
  orderIdValue: {
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: ms(12),
    color: '#9CA3AF',
  },
  menuBtn: {
    padding: hs(2),
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
    marginBottom: vs(4),
  },
  productVariant: {
    fontSize: ms(12),
    color: '#6B7280',
    marginBottom: vs(4),
  },
  productQty: {
    fontSize: ms(12),
    color: '#6B7280',
  },
  priceStatusInfo: {
    alignItems: 'flex-end',
    minWidth: hs(80),
  },
  priceText: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#111827',
    marginBottom: vs(4),
  },
  statusPill: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
    marginBottom: vs(2),
  },
  statusText: {
    fontSize: ms(11),
    fontWeight: '700',
  },
  statusDate: {
    fontSize: ms(10),
    color: '#9CA3AF',
    textAlign: 'right',
    lineHeight: vs(13),
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
