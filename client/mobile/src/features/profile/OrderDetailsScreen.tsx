import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ExternalLink, PackageOpen } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { getMyOrderById, getProductById, portalSectors, userProfile } from '@data/index';
import { SECTOR_VISUALS } from '@/theme/sectorVisuals';
import { useOrdersStore } from '@/state/ordersStore';
import type { MyOrder } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetails'>;

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#16A34A',
  Shipped: '#2563EB',
  Processing: '#D97706',
  Cancelled: '#EF4444',
};

const STATUS_BADGE_BG: Record<string, string> = {
  Delivered: '#DCFCE7',
  Shipped: '#DBEAFE',
  Processing: '#FEF3C7',
  Cancelled: '#FEE2E2',
};

interface PickupView {
  name: string;
  address: string;
  hours?: string;
  phone?: string;
}

/** Normalized order details shared by @data fixtures and in-session placed orders. */
interface OrderView {
  id: string;
  status: string;
  statusDate: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  app: 'FOOD' | 'MART' | 'PHARMA';
  emoji: string;
  productName: string;
  variant: string;
  price: number;
  qty: number;
  lineTotal: number;
  pickups: PickupView[];
  productId?: string;
}

export function OrderDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const placedOrder = useOrdersStore((s) => s.getOrderById(route.params.orderId));
  const dataOrder = useMemo(() => getMyOrderById(route.params.orderId), [route.params.orderId]);

  const order = useMemo<OrderView | null>(() => {
    if (placedOrder) {
      const first = placedOrder.items?.[0];
      const pickups: PickupView[] = placedOrder.pickups?.length
        ? placedOrder.pickups
        : placedOrder.pickup
          ? [placedOrder.pickup]
          : [];
      return {
        id: placedOrder.orderId,
        status: placedOrder.status,
        statusDate: new Date(placedOrder.placedAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        fulfillment: placedOrder.fulfillment,
        app: 'FOOD',
        emoji: first?.emoji ?? '🛍️',
        productName: placedOrder.vendorName,
        variant: first?.name ?? 'Order',
        price: first?.price ?? placedOrder.total,
        qty: placedOrder.items?.reduce((s, i) => s + i.quantity, 0) ?? 1,
        lineTotal: placedOrder.total,
        pickups,
      };
    }
    if (dataOrder) {
      return {
        id: dataOrder.id,
        status: dataOrder.status,
        statusDate: dataOrder.statusDate,
        fulfillment: dataOrder.fulfillment ?? 'DELIVERY',
        app: dataOrder.app,
        emoji: dataOrder.emoji,
        productName: dataOrder.productName,
        variant: dataOrder.variant,
        price: dataOrder.price,
        qty: dataOrder.qty,
        lineTotal: dataOrder.price * dataOrder.qty,
        pickups: dataOrder.pickup ? [dataOrder.pickup] : [],
        productId: dataOrder.productId,
      };
    }
    return null;
  }, [placedOrder, dataOrder]);

  const product = useMemo(
    () => (order?.productId ? getProductById(order.productId) : undefined),
    [order],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleViewProduct = useCallback(() => {
    if (!product) return;
    navigation.navigate('ProductDetail', { product });
  }, [navigation, product]);

  if (!order) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Order Details</AppText>
        </View>
        <View style={styles.missing}>
          <AppText style={styles.missingText}>This order could not be found.</AppText>
        </View>
      </View>
    );
  }

  const sector = portalSectors.find((s) => s.app === order.app);
  const visual = SECTOR_VISUALS[order.app];
  const statusColor = STATUS_COLORS[order.status] ?? '#374151';
  const statusBg = STATUS_BADGE_BG[order.status] ?? '#F3F4F6';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Order Details</AppText>
        </View>

        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <AppText style={[styles.statusText, { color: statusColor }]}>{order.status}</AppText>
          </View>
          <AppText style={styles.statusDate}>{order.statusDate}</AppText>
        </View>

        {/* Item card */}
        <View style={styles.card}>
          <AppText style={styles.sectionTitle}>Item</AppText>
          <View style={styles.itemRow}>
            <View style={styles.productImagePlaceholder}>
              <AppText style={styles.productEmoji}>{order.emoji}</AppText>
            </View>
            <View style={styles.itemInfo}>
              <AppText style={styles.productName}>{order.productName}</AppText>
              <AppText style={styles.productVariant}>{order.variant}</AppText>
              <AppText style={styles.lineMeta}>
                ₹{order.price} × {order.qty}
              </AppText>
            </View>
            <AppText style={styles.lineTotal}>₹{order.lineTotal}</AppText>
          </View>
        </View>

        {/* Order meta */}
        <View style={styles.card}>
          <AppText style={styles.sectionTitle}>Order</AppText>
          <View style={styles.metaRow}>
            <AppText style={styles.metaLabel}>Order ID</AppText>
            <AppText style={styles.metaValue}>{order.id}</AppText>
          </View>
          <View style={styles.metaRow}>
            <AppText style={styles.metaLabel}>Sector</AppText>
            <View style={styles.sectorBadge}>
              {visual ? (
                <visual.Icon size={ms(13)} color={visual.iconColor} strokeWidth={2.2} />
              ) : null}
              <AppText style={styles.sectorText}>{sector?.name ?? order.app}</AppText>
            </View>
          </View>
          <View style={styles.metaRow}>
            <AppText style={styles.metaLabel}>Fulfilment</AppText>
            <AppText style={styles.metaValue}>
              {order.fulfillment === 'PICKUP' ? 'Self Pickup' : 'Delivery'}
            </AppText>
          </View>
        </View>

        {/* Pickup from — one card per vendor for self-pickup orders */}
        {order.fulfillment === 'PICKUP' && order.pickups.length > 0 ? (
          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Pickup From</AppText>
            {order.pickups.map((pickup, i) => (
              <View key={`${pickup.name}-${i}`} style={i > 0 ? styles.pickupDivider : undefined}>
                <AppText style={styles.productName}>{pickup.name}</AppText>
                <AppText style={styles.pickupAddress}>{pickup.address}</AppText>
                {pickup.hours ? (
                  <AppText style={styles.pickupHours}>Open {pickup.hours}</AppText>
                ) : null}
                {pickup.phone ? (
                  <AppText style={styles.pickupHours}>Contact: {pickup.phone}</AppText>
                ) : null}
                <View style={styles.pickupContactRow}>
                  <AppText style={styles.pickupContactLabel}>Pickup contact: </AppText>
                  <AppText style={styles.pickupContactValue}>{userProfile.phone}</AppText>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* View Product */}
        {product ? (
          <TouchableOpacity
            onPress={handleViewProduct}
            style={styles.viewProductBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <PackageOpen size={ms(18)} color="#16A34A" strokeWidth={2.2} />
            <AppText style={styles.viewProductText}>View Product</AppText>
            <ExternalLink size={ms(15)} color="#16A34A" strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.bottomSpacer} />
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
    paddingHorizontal: hs(16),
    paddingBottom: vs(32),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(10),
    marginBottom: vs(8),
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

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: hs(16),
    marginBottom: vs(16),
  },
  statusPill: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  statusText: {
    fontSize: ms(12),
    fontWeight: '700',
  },
  statusDate: {
    fontSize: ms(12),
    color: '#6B7280',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: hs(16),
    marginBottom: vs(16),
  },
  sectionTitle: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: ms(0.6),
    marginBottom: vs(12),
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImagePlaceholder: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(8),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  productEmoji: {
    fontSize: ms(30),
  },
  itemInfo: {
    flex: 1,
    paddingRight: hs(8),
  },
  productName: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#111827',
    marginBottom: vs(3),
  },
  productVariant: {
    fontSize: ms(12),
    color: '#6B7280',
    marginBottom: vs(3),
  },
  lineMeta: {
    fontSize: ms(12),
    color: '#374151',
  },
  lineTotal: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#111827',
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(6),
  },
  metaLabel: {
    fontSize: ms(13),
    color: '#6B7280',
  },
  metaValue: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
    textAlign: 'right',
  },
  sectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingVertical: vs(4),
    paddingHorizontal: hs(10),
    borderRadius: ms(6),
    backgroundColor: '#F3F4F6',
  },
  sectorText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#374151',
  },
  pickupAddress: {
    fontSize: ms(13),
    color: '#6B7280',
    lineHeight: ms(19),
    marginBottom: vs(4),
  },
  pickupHours: {
    fontSize: ms(12),
    color: '#374151',
    marginBottom: vs(4),
  },
  pickupContactRow: {
    flexDirection: 'row',
    marginTop: vs(6),
  },
  pickupContactLabel: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#6B7280',
  },
  pickupContactValue: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#111827',
  },
  pickupDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: vs(12),
    marginTop: vs(12),
  },

  viewProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    paddingVertical: vs(14),
    borderRadius: ms(10),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  viewProductText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#16A34A',
  },

  missing: {
    alignItems: 'center',
    paddingTop: vs(48),
  },
  missingText: {
    fontSize: ms(14),
    color: '#6B7280',
  },
  bottomSpacer: {
    height: vs(40),
  },
});
