import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Smartphone } from 'lucide-react-native';
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
import { computeTotals } from '../utils';
import { BRAND } from './constants';
import { SAVED_CARDS, type SavedCard } from './paymentData';
import { detectUpiApps, type UpiApp } from '@/services/upi';
import { loadSavedCards } from './cardStorage';
import type { FulfillmentMode, PickupPoint } from '@data/types';
import { userProfile } from '@data/account/profile';
import { COIN_REDEEM_MIN } from '@data/rewards/rewards';
import { coinsForRedemption } from '@/features/rewards/rewardsLogic';
import type { RootStackParamList } from '@/navigation/types';

/** What the shopper picked at payment: a detected UPI app or a saved card. */
export interface PlaceOrderPayload {
  method: 'UPI' | 'CARD';
  upiLabel?: string;
  cardLast4?: string;
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

type SelectedMethod = { kind: 'upi' | 'card'; id: string } | null;

/**
 * Reworked "Payment Options" screen: pale-blue total + 2-row breakdown at top,
 * detected UPI apps and tokenized saved cards as methods, and a fixed floating
 * "Pay ₹X" bar once a method is chosen. No more hardcoded cards / net-banking /
 * wallet / COD, and no CVV prompt (tokenized flow).
 */
export default function PaymentOptionsScreen({
  itemCount: itemCountProp,
  total: totalProp,
  subtotal: subtotalProp,
  deliveryFee: deliveryFeeProp,
  deliveryAddress,
  originLabel = 'Instamart',
  fulfillment = 'DELIVERY',
  pickup,
  contactPhone = userProfile.phone,
  onBack,
  onPlaceOrder,
}: PaymentOptionsScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
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
  const [savedCards, setSavedCards] = useState<SavedCard[]>(SAVED_CARDS);
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

  // Refresh the card shelf whenever the screen regains focus (Add New Card returns).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadSavedCards().then((cards) => {
        if (active) setSavedCards(cards);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const showCoins = coinBalance >= COIN_REDEEM_MIN;
  const payableTotal = Math.max(0, total - redeemRupees);

  const handlePay = () => {
    if (!selected || !onPlaceOrder) return;
    const coins = redeemRupees > 0 ? coinsForRedemption(redeemRupees) : 0;
    if (selected.kind === 'upi') {
      const upi = installedUpiApps.find((a) => a.id === selected.id);
      onPlaceOrder({ method: 'UPI', upiLabel: upi?.label ?? 'UPI', coinsRedeemed: coins });
    } else {
      const card = savedCards.find((c) => c.id === selected.id);
      onPlaceOrder({ method: 'CARD', cardLast4: card?.last4, coinsRedeemed: coins });
    }
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
        <BreakdownCard total={payableTotal} subtotal={subtotal} deliveryFee={deliveryFee} fulfillment={fulfillment} />

        <DeliveryInfoCard
          origin={originLabel}
          originAddress={address.address}
          destination={fulfillment === 'PICKUP' ? (pickup?.name ?? address.label) : address.label}
          destinationAddress={fulfillment === 'PICKUP' ? (pickup?.address ?? address.address) : address.address}
          eta={fulfillment === 'PICKUP' ? '15 mins' : '10 mins'}
          fulfillment={fulfillment}
          pickup={pickup}
          contactPhone={contactPhone}
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

        <PaymentSectionCard title="Credit & Debit cards">
          {savedCards.map((card, i) => (
            <PaymentRow
              key={card.id}
              icon={CreditCard}
              iconBg="#FFF0E5"
              title={`${card.network} •••• ${card.last4}`}
              subtitle={`Expiry ${card.exp}`}
              selected={selected?.kind === 'card' && selected.id === card.id}
              trailing={selected?.kind === 'card' && selected.id === card.id ? 'check' : 'radio'}
              onPress={() => setSelected({ kind: 'card', id: card.id })}
              last={i === savedCards.length - 1}
            />
          ))}
          <PaymentRow
            icon={CreditCard}
            iconBg="#F3F4F6"
            title="Add New Card"
            trailing="add"
            onPress={() => navigation.navigate('AddCard')}
            last
          />
        </PaymentSectionCard>

        <AppText style={styles.secureNote}>
          Payments are encrypted & processed securely under Faazio Gateway. Saved cards are
          tokenized and stored in your device keychain.
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