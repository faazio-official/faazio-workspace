import React, { useCallback, useMemo, useState } from 'react';
import { Linking, StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ExternalLink, PackageOpen } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { VendorRateButton } from '@/components/shared';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { getMyOrderById, getProductById, getVendorById, portalSectors, userProfile } from '@data/index';
import { SECTOR_VISUALS } from '@/theme/sectorVisuals';
import { useOrdersStore } from '@/state/ordersStore';
import { useCanRateVendor } from '@/hooks/useVendorRating';
import { gateway, type OrderInvoice } from '@/services/api/GatewayClient';
import { usePrescriptionDetail } from '@/features/pharma/prescription/usePrescriptionDetail';
import type { MyOrder } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetails'>;

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#16A34A',
  Shipped: '#2563EB',
  Processing: '#D97706',
  Cancelled: '#EF4444',
  'Awaiting quote': '#D97706',
  'Quote ready': '#2563EB',
  Ready: '#16A34A',
  Fulfilled: '#16A34A',
};

const STATUS_BADGE_BG: Record<string, string> = {
  Delivered: '#DCFCE7',
  Shipped: '#DBEAFE',
  Processing: '#FEF3C7',
  Cancelled: '#FEE2E2',
  'Awaiting quote': '#FEF3C7',
  'Quote ready': '#DBEAFE',
  Ready: '#DCFCE7',
  Fulfilled: '#DCFCE7',
};

/** Server Rx status → customer-facing label (pharma.prescription_status). */
const RX_STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Awaiting quote',
  QUOTED: 'Quote ready',
  READY: 'Ready',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
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
  /** Vendor identity snapshot — drives the rating CTA gate. */
  vendorId?: string;
}

export function OrderDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const placedOrder = useOrdersStore((s) => s.getOrderById(route.params.orderId));
  const dataOrder = useMemo(() => getMyOrderById(route.params.orderId), [route.params.orderId]);
  // Prescription orders poll the durable Rx for the seller quote + READY reveal (remote mode only).
  const rxEnabled = Boolean(
    placedOrder?.kind === 'prescription' && gateway.remoteEnabled,
  );
  const rx = usePrescriptionDetail(placedOrder?.orderId, rxEnabled);

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
        app: placedOrder.kind === 'prescription' ? 'PHARMA' : 'FOOD',
        emoji: first?.emoji ?? '🛍️',
        productName: placedOrder.vendorName,
        variant: first?.name ?? 'Order',
        price: first?.price ?? placedOrder.total,
        qty: placedOrder.items?.reduce((s, i) => s + i.quantity, 0) ?? 1,
        lineTotal: placedOrder.total,
        pickups,
        vendorId: placedOrder.storeIds?.[0],
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
        vendorId: dataOrder.storeId,
      };
    }
    return null;
  }, [placedOrder, dataOrder]);

  const canRate = useCanRateVendor(order?.vendorId);
  const vendorName = order?.vendorId ? getVendorById(order.vendorId)?.name : undefined;

  const product = useMemo(
    () => (order?.productId ? getProductById(order.productId) : undefined),
    [order],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleViewProduct = useCallback(() => {
    if (!product) return;
    navigation.navigate('ProductDetail', { product });
  }, [navigation, product]);

  const handleRateVendor = useCallback(
    (vendor: { id: string; name: string }) =>
      navigation.navigate('RateVendor', { vendorId: vendor.id, vendorName: vendor.name }),
    [navigation],
  );

  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  const handleInvoice = useCallback(async () => {
    if (!gateway.remoteEnabled) {
      setInvoiceError('Invoice download needs an internet connection.');
      return;
    }
    setInvoiceBusy(true);
    setInvoiceError('');
    try {
      const next = await gateway.getOrderInvoice(route.params.orderId);
      setInvoice(next);
      if (next.downloadUrl) await Linking.openURL(next.downloadUrl);
    } catch {
      setInvoiceError('This invoice is not available yet.');
    } finally {
      setInvoiceBusy(false);
    }
  }, [route.params.orderId]);

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
  const statusLabel = rx ? RX_STATUS_LABEL[rx.status] ?? rx.status : order.status;
  const statusColor = STATUS_COLORS[statusLabel] ?? '#374151';
  const statusBg = STATUS_BADGE_BG[statusLabel] ?? '#F3F4F6';

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
            <AppText style={[styles.statusText, { color: statusColor }]}>{statusLabel}</AppText>
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

        {/* Pharmacy quote — durable Rx status + seller quote + recent history (remote only) */}
        {rx ? (
          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Pharmacy quote</AppText>
            {rx.status === 'RECEIVED' ? (
              <AppText style={styles.quoteHint}>
                Your prescription is with the pharmacy. The price appears here once they quote it.
              </AppText>
            ) : null}
            {rx.quote && rx.quote.length > 0 ? (
              <>
                {rx.quote.map((line, i) => (
                  <View key={`${line.name}-${i}`} style={styles.metaRow}>
                    <AppText style={styles.metaLabel}>
                      {line.name} × {line.qty}
                    </AppText>
                    <AppText style={styles.metaValue}>₹{line.price * line.qty}</AppText>
                  </View>
                ))}
                <View style={[styles.metaRow, styles.quoteTotalRow]}>
                  <AppText style={styles.quoteTotalLabel}>Total</AppText>
                  <AppText style={styles.lineTotal}>₹{rx.quotedTotal ?? 0}</AppText>
                </View>
              </>
            ) : null}
            {rx.history && rx.history.length > 0 ? (
              <View style={styles.historyWrap}>
                {rx.history.slice(-3).map((h, i) => (
                  <AppText key={`${h.toStatus}-${i}`} style={styles.historyLine}>
                    • {RX_STATUS_LABEL[h.toStatus] ?? h.toStatus}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

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

        {/* Rate vendor — verified buyers only (gate re-checked inside the screen) */}
        {canRate && order.vendorId ? (
          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Rate your purchase</AppText>
            <AppText style={styles.rateIntro}>
              {vendorName
                ? `How was your experience with ${vendorName}?`
                : 'Share your experience with this vendor.'}
            </AppText>
            <View style={styles.rateBtnWrap}>
              <VendorRateButton
                vendorId={order.vendorId}
                vendorName={vendorName}
                onPress={handleRateVendor}
              />
            </View>
          </View>
        ) : null}

        {/* Tax invoice — immutable server record, downloadable once rendered to PDF */}
        <View style={styles.card}>
          <AppText style={styles.sectionTitle}>Tax invoice</AppText>
          <AppText style={styles.invoiceHint}>
            GST invoice issued by the seller. Download it for returns or expense claims.
          </AppText>
          <TouchableOpacity
            onPress={() => void handleInvoice()}
            disabled={invoiceBusy}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={styles.invoiceBtn}
          >
            <AppText style={styles.invoiceBtnText}>
              {invoiceBusy ? 'Fetching invoice…' : invoice?.downloadUrl ? 'Download PDF invoice' : 'View invoice'}
            </AppText>
          </TouchableOpacity>
          {invoiceError ? <AppText style={styles.invoiceError}>{invoiceError}</AppText> : null}
          {invoice ? (
            <View style={styles.invoiceBody}>
              <InvoiceRow label="Invoice no." value={invoice.invoiceNumber} />
              <InvoiceRow label="Seller" value={invoice.sellerName || 'Faazio marketplace'} />
              {invoice.sellerGstin ? <InvoiceRow label="GSTIN" value={invoice.sellerGstin} /> : null}
              <InvoiceRow label="Taxable value" value={inr(invoice.taxableValuePaisa)} />
              <InvoiceRow label={`GST (${invoice.taxRatePct}%)`} value={inr(invoice.productTaxPaisa)} />
              <InvoiceRow label="Delivery fee" value={inr(invoice.deliveryFeePaisa)} />
              {invoice.couponDiscountPaisa > 0 ? (
                <InvoiceRow label="Discount" value={`− ${inr(invoice.couponDiscountPaisa)}`} />
              ) : null}
              <InvoiceRow label="Total paid" value={inr(invoice.totalPaisa)} strong />
            </View>
          ) : null}
        </View>

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

const inr = (paisa: number) => `₹${(paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function InvoiceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.invoiceRow}>
      <AppText style={styles.invoiceRowLabel}>{label}</AppText>
      <AppText style={[styles.invoiceRowValue, strong ? styles.invoiceRowStrong : null]}>{value}</AppText>
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
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(10),
    marginBottom: SPACE.BLOCK,
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
    marginBottom: SPACE.BLOCK,
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
    marginBottom: SPACE.BLOCK,
  },
  sectionTitle: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: ms(0.6),
    marginBottom: SPACE.BLOCK,
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
    paddingTop: SPACE.ITEM,
    marginTop: SPACE.ITEM,
  },

  rateIntro: {
    fontSize: ms(13),
    color: '#6B7280',
    lineHeight: ms(19),
    marginBottom: SPACE.BLOCK,
  },
  quoteHint: {
    fontSize: ms(13),
    color: '#6B7280',
    lineHeight: ms(19),
  },
  quoteTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: SPACE.ITEM,
    paddingTop: SPACE.ITEM,
  },
  quoteTotalLabel: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#111827',
  },
  historyWrap: {
    marginTop: SPACE.ITEM,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: SPACE.ITEM,
  },
  historyLine: {
    fontSize: ms(12),
    color: '#6B7280',
    marginBottom: vs(2),
  },
  rateBtnWrap: {
    marginTop: vs(2),
  },

  invoiceHint: {
    fontSize: ms(12),
    color: '#6B7280',
    lineHeight: ms(17),
    marginBottom: vs(8),
  },
  invoiceBtn: {
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  invoiceBtnText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  invoiceError: {
    marginTop: vs(6),
    fontSize: ms(12),
    color: '#B91C1C',
  },
  invoiceBody: {
    marginTop: vs(10),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: vs(8),
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: hs(10),
    paddingVertical: vs(3),
  },
  invoiceRowLabel: {
    fontSize: ms(12),
    color: '#6B7280',
    flex: 1,
  },
  invoiceRowValue: {
    fontSize: ms(12),
    color: '#111827',
    fontWeight: '600',
  },
  invoiceRowStrong: {
    fontWeight: '800',
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
