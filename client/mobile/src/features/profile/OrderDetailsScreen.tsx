import React, { useCallback, useMemo, useState } from 'react';
import { neutral } from '@/theme/brandTokens';
import { semanticTint } from '@/theme/brandTokens';
import { Linking, StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ExternalLink,
  PackageOpen,
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
import { getCatalogEntryById, getProductById, getVendorById, portalSectors } from '@data/index';
import { SECTOR_VISUALS } from '@/theme/sectorVisuals';
import { semantic } from '@/theme/brandTokens';
import { useOrdersStore } from '@/state/ordersStore';
import { useAuthStore } from '@/state/authStore';
import { useCanRateVendor } from '@/hooks/useVendorRating';
import { gateway, type OrderInvoice } from '@/services/api/GatewayClient';
import { SUPPORT_EMAIL } from '@/lib/site';
import { usePrescriptionDetail } from '@/features/pharma/prescription/usePrescriptionDetail';
import { usePrescriptionPayment } from '@/features/pharma/prescription/usePrescriptionPayment';
import PrescriptionPaymentSheet from '@/features/pharma/prescription/PrescriptionPaymentSheet';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetails'>;

const STATUS_COLORS: Record<string, string> = {
  Delivered: semantic.success,
  Shipped: semantic.info,
  Processing: semantic.warning,
  Cancelled: semantic.danger,
  'Awaiting quote': semantic.warning,
  'Quote ready': semantic.info,
  Ready: semantic.success,
  Fulfilled: semantic.success,
};

const STATUS_BADGE_BG: Record<string, string> = {
  Delivered: semanticTint.success,
  Shipped: semanticTint.info,
  Processing: semanticTint.warning,
  Cancelled: semanticTint.danger,
  'Awaiting quote': semanticTint.warning,
  'Quote ready': semanticTint.info,
  Ready: semanticTint.success,
  Fulfilled: semanticTint.success,
};

/** Server Rx status → customer-facing label (pharma.prescription_status). */
const RX_STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Awaiting quote',
  PROCESSING: 'Processing',
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

/** Normalized order details shared by durable server history and in-session placed orders. */
interface OrderView {
  id: string;
  status: string;
  statusDate: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  app: 'FOOD' | 'MART' | 'PHARMA';
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

/** Infer the sector from the order's first line (catalog entry first, then id heuristics). */
function inferOrderApp(kind: string, firstItemId: string | undefined): 'FOOD' | 'MART' | 'PHARMA' {
  if (kind === 'prescription') return 'PHARMA';
  if (firstItemId) {
    const entry = getCatalogEntryById(firstItemId);
    if (entry) return entry.app;
    const id = firstItemId.toLowerCase();
    if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) return 'PHARMA';
    if (id.startsWith('fm-') || id.startsWith('gr-') || id.includes('mart') || id.includes('grocery')) return 'MART';
  }
  return 'FOOD';
}

export function OrderDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const accountPhone = useAuthStore((s) => s.user?.phone);
  const placedOrder = useOrdersStore((s) => s.getOrderById(route.params.orderId));
  // Prescription orders poll the durable Rx for the seller quote + READY reveal (remote mode only).
  const rxEnabled = Boolean(
    placedOrder?.kind === 'prescription' && gateway.remoteEnabled,
  );
  const rx = usePrescriptionDetail(placedOrder?.orderId, rxEnabled);
  // The Rx id doubles as the materialised checkout order id, so the payment status is readable once
  // the quote is accepted. Only poll while the Rx is actually payable/settling.
  const rxPaymentEnabled = Boolean(rx && (rx.status === 'QUOTED' || rx.status === 'READY'));
  const rxPayment = usePrescriptionPayment(rx?.id, rxPaymentEnabled);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);

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
        app: inferOrderApp(placedOrder.kind, first?.id),
        productName: placedOrder.vendorName,
        variant: first?.name ?? 'Order',
        price: first?.price ?? placedOrder.total,
        qty: placedOrder.items?.reduce((s, i) => s + i.quantity, 0) ?? 1,
        lineTotal: placedOrder.total,
        pickups,
        productId: first?.id,
        vendorId: placedOrder.storeIds?.[0],
      };
    }
    return null;
  }, [placedOrder]);

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

  const supportOrderId = order?.id ?? route.params.orderId;
  const handleContactSupport = useCallback(() => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Help with order ${supportOrderId}`)}`,
    );
  }, [supportOrderId]);
  const handleRequestCancellation = useCallback(() => {
    void Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Cancel order ${supportOrderId}`)}&body=${encodeURIComponent(
        'Please cancel this order if it has not been packed yet.',
      )}`,
    );
  }, [supportOrderId]);

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
            <ChevronLeft size={ms(26)} color={neutral.ink} strokeWidth={2.2} />
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
  const statusColor = STATUS_COLORS[statusLabel] ?? neutral.inkMuted;
  const statusBg = STATUS_BADGE_BG[statusLabel] ?? neutral.surfaceAlt;

  const rxQuoteTotal = rx?.quote && rx.quote.length > 0 ? rx.quotedTotal ?? 0 : 0;
  const rxPaid = rxPayment.state === 'PAID';
  const rxPayable = Boolean(rx && rx.status === 'QUOTED' && rxQuoteTotal > 0 && gateway.remoteEnabled);
  const rxRefillable = Boolean(
    rx && (rx.status === 'FULFILLED' || rx.status === 'CANCELLED') && rx.vendorId,
  );

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
            <ChevronLeft size={ms(26)} color={neutral.ink} strokeWidth={2.2} />
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
              {placedOrder?.kind === 'prescription' ? (
                <FileText size={ms(22)} color={semantic.info} strokeWidth={1.5} />
              ) : order.app === 'PHARMA' ? (
                <Pill size={ms(22)} color={semantic.info} strokeWidth={1.5} />
              ) : order.app === 'FOOD' ? (
                <Utensils size={ms(22)} color={semantic.warning} strokeWidth={1.5} />
              ) : (
                <ShoppingBag size={ms(22)} color={semantic.neutral} strokeWidth={1.5} />
              )}
            </View>
            <View style={styles.itemInfo}>
              <AppText style={styles.productName}>{order.productName}</AppText>
              <AppText style={styles.productVariant}>{order.variant}</AppText>
              <AppText style={styles.lineMeta}>
                {placedOrder?.kind === 'prescription'
                  ? `${placedOrder.pages ?? 0} page${(placedOrder.pages ?? 0) === 1 ? '' : 's'}`
                  : `₹${order.price} × ${order.qty}`}
              </AppText>
            </View>
            {placedOrder?.kind === 'prescription' ? (
              rxQuoteTotal > 0 ? <AppText style={styles.lineTotal}>₹{rxQuoteTotal}</AppText> : null
            ) : (
              <AppText style={styles.lineTotal}>₹{order.lineTotal}</AppText>
            )}
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

            {/* Pay a quoted Rx through the reused checkout rail; the amount is server-derived. */}
            {rxPaid ? (
              <View style={[styles.metaRow, styles.quoteTotalRow]}>
                <AppText style={styles.metaLabel}>Payment</AppText>
                <AppText style={styles.paidValue}>Paid</AppText>
              </View>
            ) : rxPayment.state === 'PENDING' ? (
              <AppText style={styles.payPendingHint}>
                Payment processing — this updates automatically once confirmed.
              </AppText>
            ) : null}

            {rxPayable && !rxPaid ? (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => setPaymentSheetVisible(true)}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`Pay ₹${rxQuoteTotal} for this prescription`}
              >
                <AppText style={styles.payBtnText}>Pay ₹{rxQuoteTotal}</AppText>
              </TouchableOpacity>
            ) : null}

            {rxRefillable ? (
              <TouchableOpacity
                style={styles.refillBtn}
                onPress={() =>
                  navigation.navigate('PrescriptionFlow', { presetVendorId: rx.vendorId })
                }
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Order this prescription again"
              >
                <AppText style={styles.refillBtnText}>Order again</AppText>
              </TouchableOpacity>
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
                  <AppText style={styles.pickupContactValue}>{accountPhone || ''}</AppText>
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

        {/* Tax invoice — My Orders entry only. The post-payment confirmation deep link never
            offers a PDF download; the invoice lives under My Orders → Order Details. Prescription
            orders have no invoice row (shown honestly as absent, never fabricated). */}
        {route.params.entry !== 'confirmation' && placedOrder?.kind !== 'prescription' ? (
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
        ) : null}

        {/* View Product */}
        {product ? (
          <TouchableOpacity
            onPress={handleViewProduct}
            style={styles.viewProductBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <PackageOpen size={ms(18)} color={semantic.success} strokeWidth={2.2} />
            <AppText style={styles.viewProductText}>View Product</AppText>
            <ExternalLink size={ms(15)} color={semantic.success} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.card}>
          <AppText style={styles.sectionTitle}>Need help?</AppText>
          <AppText style={styles.helpText}>
            Contact support with your order number and we’ll look into it.
          </AppText>
          <TouchableOpacity
            onPress={handleContactSupport}
            style={styles.helpBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Contact support about this order"
          >
            <AppText style={styles.helpBtnText}>Contact support</AppText>
          </TouchableOpacity>
          {order.status === 'Processing' && placedOrder?.kind !== 'prescription' ? (
            <TouchableOpacity
              onPress={handleRequestCancellation}
              style={styles.helpSecondaryBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Request cancellation of this order"
            >
              <AppText style={styles.helpSecondaryText}>Request cancellation</AppText>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {rx ? (
        <PrescriptionPaymentSheet
          visible={paymentSheetVisible}
          orderId={rx.id}
          amountRupees={rxQuoteTotal}
          onRequestClose={() => {
            setPaymentSheetVisible(false);
            rxPayment.refresh();
          }}
          onPaid={() => rxPayment.refresh()}
        />
      ) : null}
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
    backgroundColor: neutral.surface,
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
    fontWeight: '600',
    color: neutral.ink,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: neutral.card,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
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
    fontWeight: '600',
  },
  statusDate: {
    fontSize: ms(12),
    color: neutral.inkMuted,
  },

  card: {
    backgroundColor: neutral.card,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    padding: hs(16),
    marginBottom: SPACE.BLOCK,
  },
  sectionTitle: {
    fontSize: ms(11),
    fontWeight: '600',
    color: neutral.inkSubtle,
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
    backgroundColor: neutral.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  itemInfo: {
    flex: 1,
    paddingRight: hs(8),
  },
  productName: {
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.ink,
    marginBottom: vs(3),
  },
  productVariant: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    marginBottom: vs(3),
  },
  lineMeta: {
    fontSize: ms(12),
    color: neutral.inkMuted,
  },
  lineTotal: {
    fontSize: ms(15),
    fontWeight: '600',
    color: neutral.ink,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(6),
  },
  metaLabel: {
    fontSize: ms(13),
    color: neutral.inkMuted,
  },
  metaValue: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.ink,
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
    backgroundColor: neutral.surfaceAlt,
  },
  sectorText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  pickupAddress: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    lineHeight: ms(19),
    marginBottom: vs(4),
  },
  pickupHours: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    marginBottom: vs(4),
  },
  pickupContactRow: {
    flexDirection: 'row',
    marginTop: vs(6),
  },
  pickupContactLabel: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  pickupContactValue: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.ink,
  },
  pickupDivider: {
    borderTopWidth: 1,
    borderTopColor: neutral.border,
    paddingTop: SPACE.ITEM,
    marginTop: SPACE.ITEM,
  },

  rateIntro: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    lineHeight: ms(19),
    marginBottom: SPACE.BLOCK,
  },
  quoteHint: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    lineHeight: ms(19),
  },
  quoteTotalRow: {
    borderTopWidth: 1,
    borderTopColor: neutral.border,
    marginTop: SPACE.ITEM,
    paddingTop: SPACE.ITEM,
  },
  quoteTotalLabel: {
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.ink,
  },
  paidValue: {
    fontSize: ms(13),
    fontWeight: '600',
    color: semantic.success,
  },
  payPendingHint: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    marginTop: SPACE.ITEM,
    lineHeight: ms(17),
  },
  payBtn: {
    marginTop: SPACE.ITEM,
    minHeight: 48,
    borderRadius: ms(10),
    backgroundColor: semantic.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: {
    fontSize: ms(15),
    fontWeight: '600',
    color: neutral.card,
  },
  refillBtn: {
    marginTop: vs(8),
    minHeight: 44,
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refillBtnText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: semantic.success,
  },
  historyWrap: {
    marginTop: SPACE.ITEM,
    borderTopWidth: 1,
    borderTopColor: neutral.surfaceAlt,
    paddingTop: SPACE.ITEM,
  },
  historyLine: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    marginBottom: vs(2),
  },
  rateBtnWrap: {
    marginTop: vs(2),
  },

  invoiceHint: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    lineHeight: ms(17),
    marginBottom: vs(8),
  },
  invoiceBtn: {
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: neutral.ink,
    alignItems: 'center',
  },
  invoiceBtnText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.card,
  },
  invoiceError: {
    marginTop: vs(6),
    fontSize: ms(12),
    color: semantic.danger,
  },
  invoiceBody: {
    marginTop: vs(10),
    borderTopWidth: 1,
    borderTopColor: neutral.surfaceAlt,
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
    color: neutral.inkMuted,
    flex: 1,
  },
  invoiceRowValue: {
    fontSize: ms(12),
    color: neutral.ink,
    fontWeight: '600',
  },
  invoiceRowStrong: {
    fontWeight: '600',
  },
  viewProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    paddingVertical: vs(14),
    borderRadius: ms(10),
    backgroundColor: neutral.card,
    borderWidth: 1,
    borderColor: semantic.success,
  },
  viewProductText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: semantic.success,
  },

  helpText: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    lineHeight: ms(18),
    marginBottom: vs(12),
  },
  helpBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(10),
    backgroundColor: semantic.success,
  },
  helpBtnText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.card,
  },
  helpSecondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(8),
  },
  helpSecondaryText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: semantic.danger,
  },

  missing: {
    alignItems: 'center',
    paddingTop: vs(48),
  },
  missingText: {
    fontSize: ms(14),
    color: neutral.inkMuted,
  },
  bottomSpacer: {
    height: vs(40),
  },
});
