import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Banknote, Smartphone } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/cartStore';
import { useRewardsStore } from '@/state/rewardsStore';
import { defaultAddresses } from '@data/cart/addresses';
import DeliveryInfoCard from './components/DeliveryInfoCard';
import PaymentSectionCard from './components/PaymentSectionCard';
import PaymentRow from './components/PaymentRow';
import CoinsRedeemRow from './components/CoinsRedeemRow';
import BreakdownCard from './components/BreakdownCard';
import UpiAppRow from './components/UpiAppRow';
import BottomPayBar from './components/BottomPayBar';
import { computeTotals, type DeliveryFeeBreakdown } from '../utils';
import { BRAND } from './constants';
import { COD_METHOD, type PaymentMethod } from './paymentData';
import { detectUpiApps, type UpiApp } from '@/services/upi';
import type { FulfillmentMode, PickupPoint } from '@data/types';
import { useAuthStore } from '@/state/authStore';
import { COIN_REDEEM_MIN } from '@data/rewards/rewards';
import { coinsForRedemption } from '@/features/rewards/rewardsLogic';

/** What the shopper picked at payment: a detected UPI app or Cash on Delivery. */
export interface PlaceOrderPayload {
  method: PaymentMethod;
  /** Detected UPI app id (drives the iOS intent rewrite on launch). */
  upiAppId?: string;
  upiLabel?: string;
  coinsRedeemed?: number;
}

export interface PaymentOptionsScreenProps {
  /** Items in the cart. Defaults to the shared cart store. */
  itemCount?: number;
  /** Final total (after coins). Defaults to the computed cart total. */
  total?: number;
  /** Ordered value (GST-inclusive product subtotal) for the breakdown card. */
  subtotal?: number;
  /** Customer-visible delivery fee for the breakdown card (0 for pickup). */
  deliveryFee?: number;
  /** Server quote breakdown (distance + active surges) for the bill rows. */
  deliveryBreakdown?: DeliveryFeeBreakdown;
  /** Selected delivery address. Defaults to the primary saved address. */
  deliveryAddress?: { label: string; address: string };
  /** Origin store name for the delivery timeline. */
  originLabel?: string;
  /** Fulfillment mode for this checkout (delivery vs self-pickup). */
  fulfillment?: FulfillmentMode;
  /** Chosen pickup point — shown when fulfillment is PICKUP. */
  pickup?: PickupPoint;
  /** Contact phone for pickup (defaults to the signed-in user profile phone). */
  contactPhone?: string;
  onBack?: () => void;
  /** Fired with the chosen method + coins being redeemed when the shopper pays. */
  onPlaceOrder?: (payload: PlaceOrderPayload) => void;
}

type SelectedMethod = { kind: 'upi'; id: string } | { kind: 'cod' } | null;

/**
 * "Payment Options" screen: pale-blue total + 2-row breakdown at top, detected UPI apps and
 * Cash on Delivery as methods, and a fixed floating "Pay ₹X" bar once a method is chosen.
 * Cards / net-banking / wallet are intentionally not offered (UPI + COD only).
 */
export default function PaymentOptionsScreen({
  itemCount: itemCountProp,
  total: totalProp,
  subtotal: subtotalProp,
  deliveryFee: deliveryFeeProp,
  deliveryBreakdown,
  deliveryAddress,
  originLabel = 'Instamart',
  fulfillment = 'DELIVERY',
  pickup,
  contactPhone,
  onBack,
  onPlaceOrder,
}: PaymentOptionsScreenProps) {
  const insets = useSafeAreaInsets();
  // The pickup contact is the signed-in shopper's verified phone, never a @data fixture. A caller
  // may pass an explicit override (saved address phone); otherwise fall back to the auth session.
  const accountPhone = useAuthStore((s) => s.user?.phone);
  const resolvedContactPhone = contactPhone || accountPhone || '';
  const cartItems = useCartStore((s) => s.cart);
  const totals = computeTotals(cartItems, 0, fulfillment);
  const coinBalance = useRewardsStore((s) => s.coinBalance);
  const itemCount = itemCountProp ?? cartItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const total = totalProp ?? totals.finalTotal;
  const subtotal = subtotalProp ?? totals.subtotal;
  const deliveryFee = deliveryFeeProp ?? totals.deliveryFee;
  const address = deliveryAddress ?? {
    label: defaultAddresses[0]?.label ?? 'Home',
    address: defaultAddresses[0]?.address ?? '',
  };

  const [installedUpiApps, setInstalledUpiApps] = useState<UpiApp[]>([]);
  const [selected, setSelected] = useState<SelectedMethod>(null);
  const [redeemRupees, setRedeemRupees] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void detectUpiApps().then((apps) => {
      if (!cancelled) setInstalledUpiApps(apps.filter((a) => a.installed));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showCoins = coinBalance >= COIN_REDEEM_MIN;
  const payableTotal = Math.max(0, total - redeemRupees);

  const handlePay = () => {
    if (!selected || !onPlaceOrder) return;
    const coins = redeemRupees > 0 ? coinsForRedemption(redeemRupees) : 0;
    if (selected.kind === 'cod') {
      onPlaceOrder({ method: 'COD', coinsRedeemed: coins });
      return;
    }
    const upi = installedUpiApps.find((a) => a.id === selected.id);
    onPlaceOrder({
      method: 'UPI',
      upiAppId: selected.id,
      upiLabel: upi?.label ?? 'UPI',
      coinsRedeemed: coins,
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity onPress={onBack ?? (() => {})} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={ms(20)} color={BRAND.ink} strokeWidth={2.4} />
        </TouchableOpacity>
        <AppText style={styles.topTitle}>Payment Options</AppText>
        <View style={{ width: ms(38) }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, selected && styles.scrollContentWithPayBar]}
        showsVerticalScrollIndicator={false}
      >
        <BreakdownCard
          total={payableTotal}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          deliveryBreakdown={deliveryBreakdown}
          fulfillment={fulfillment}
        />

        <DeliveryInfoCard
          origin={originLabel}
          originAddress={address.address}
          destination={fulfillment === 'PICKUP' ? (pickup?.name ?? address.label) : address.label}
          destinationAddress={fulfillment === 'PICKUP' ? (pickup?.address ?? address.address) : address.address}
          eta={fulfillment === 'PICKUP' ? '15 mins' : '10 mins'}
          fulfillment={fulfillment}
          pickup={pickup}
          contactPhone={resolvedContactPhone}
        />

        {showCoins && (
          <CoinsRedeemRow
            coinBalance={coinBalance}
            onToggle={(_checked, rupees) => setRedeemRupees(rupees)}
          />
        )}

        <PaymentSectionCard title="UPI">
          {installedUpiApps.length === 0 ? (
            <PaymentRow
              icon={Smartphone}
              iconBg="#EEF2FF"
              title="No UPI apps detected on this device"
              subtitle="Install GPay, PhonePe or BHIM to pay by UPI"
              last
            />
          ) : (
            installedUpiApps.map((app, i) => (
              <UpiAppRow
                key={app.id}
                app={app}
                selected={selected?.kind === 'upi' && selected.id === app.id}
                onPress={() => setSelected({ kind: 'upi', id: app.id })}
                last={i === installedUpiApps.length - 1}
              />
            ))
          )}
        </PaymentSectionCard>

        <PaymentSectionCard title="Cash on Delivery">
          <PaymentRow
            icon={Banknote}
            iconBg="#EAF7EE"
            title={COD_METHOD.label}
            subtitle={COD_METHOD.subtitle}
            selected={selected?.kind === 'cod'}
            trailing={selected?.kind === 'cod' ? 'check' : 'radio'}
            onPress={() => setSelected({ kind: 'cod' })}
            last
          />
        </PaymentSectionCard>

        <AppText style={styles.secureNote}>
          Payments are encrypted & processed securely under Faazio Gateway. UPI payments are
          confirmed by our server and this screen updates automatically.
        </AppText>
      </ScrollView>

      {selected ? <BottomPayBar total={payableTotal} onPay={handlePay} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
  },
  topBar: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
  },
  backBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(14),
  },
  topTitle: {
    flex: 1,
    fontSize: ms(15),
    fontWeight: '800',
    color: BRAND.ink,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingTop: vs(4),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  scrollContentWithPayBar: {
    paddingBottom: vs(90),
  },
  secureNote: {
    fontSize: ms(11),
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: hs(24),
    marginTop: vs(4),
  },
});