import React, { useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { CreditCard, Smartphone } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/cartStore';
import { defaultAddresses } from '@data/cart/addresses';
import PaymentHeader from './components/PaymentHeader';
import DeliveryInfoCard from './components/DeliveryInfoCard';
import PromoBanner from './components/PromoBanner';
import PaymentSectionCard from './components/PaymentSectionCard';
import PaymentRow from './components/PaymentRow';
import CvvPayBar from './components/CvvPayBar';
import { computeTotals } from '../utils';
import { BRAND } from './constants';
import { DEFAULT_CARD, OTHER_CARDS, SAVED_UPIS, MORE_OPTIONS } from './paymentData';
import type { FulfillmentMode, PickupPoint } from '@data/types';
import { userProfile } from '@data/account/profile';

export interface PaymentOptionsScreenProps {
  /** Items in the cart. Defaults to the shared cart store. */
  itemCount?: number;
  /** Total to pay (final total). Defaults to the computed cart total. */
  total?: number;
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
  onPlaceOrder?: () => void;
}

/**
 * Pixel-perfect "Payment Options" screen. Light-gray full-viewport background
 * with stacked white rounded cards. Selection is screen-local UI state.
 * Works standalone (defaults from cart store + saved addresses) or driven by
 * the cart wizard via props.
 */
export default function PaymentOptionsScreen({
  itemCount: itemCountProp,
  total: totalProp,
  deliveryAddress,
  originLabel = 'Instamart',
  fulfillment = 'DELIVERY',
  pickup,
  contactPhone = userProfile.phone,
  onBack,
  onPlaceOrder,
}: PaymentOptionsScreenProps) {
  const cartItems = useCartStore((s) => s.cart);
  const { finalTotal } = computeTotals(cartItems, 0);
  const itemCount = itemCountProp ?? cartItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const total = totalProp ?? finalTotal;
  const address = deliveryAddress ?? {
    label: defaultAddresses[0]?.label ?? 'Home',
    address: defaultAddresses[0]?.address ?? '',
  };

  const [selectedPaymentId, setSelectedPaymentId] = useState<string>(DEFAULT_CARD.id);
  const [cvv, setCvv] = useState('');

  const cardSelected = selectedPaymentId === DEFAULT_CARD.id;
  const defaultAddress = DEFAULT_CARD;

  return (
    <View style={styles.root}>
      <PaymentHeader itemCount={itemCount} total={total} onBack={onBack ?? (() => {})} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        <PromoBanner />

        <PaymentSectionCard title="Preferred Payment">
          <PaymentRow
            icon={CreditCard}
            iconBg="#FFF0E5"
            title={`${defaultAddress.network} •••• ${defaultAddress.last4}`}
            subtitle={`Expiry ${defaultAddress.exp}`}
            selected={cardSelected}
            trailing={cardSelected ? 'check' : 'radio'}
            onPress={() => setSelectedPaymentId(DEFAULT_CARD.id)}
          />
          {cardSelected && (
            <CvvPayBar cvv={cvv} onChangeCvv={setCvv} total={total} onPay={onPlaceOrder ?? (() => {})} />
          )}
        </PaymentSectionCard>

        <PaymentSectionCard title="UPI">
          {SAVED_UPIS.map((upi, i) => (
            <PaymentRow
              key={upi.id}
              icon={upi.emoji}
              iconBg="#EEF2FF"
              title={upi.label}
              subtitle={upi.handle}
              selected={selectedPaymentId === upi.id}
              trailing={selectedPaymentId === upi.id ? 'check' : 'radio'}
              onPress={() => setSelectedPaymentId(upi.id)}
              last={i === SAVED_UPIS.length - 1}
            />
          ))}
          <PaymentRow
            icon={Smartphone}
            iconBg="#F3F4F6"
            title="Add New UPI ID"
            trailing="add"
            onPress={() => {}}
            last
          />
        </PaymentSectionCard>

        <PaymentSectionCard title="Credit & Debit cards">
          {OTHER_CARDS.map((card, i) => (
            <PaymentRow
              key={card.id}
              icon={CreditCard}
              iconBg="#FFF0E5"
              title={`${card.network} •••• ${card.last4}`}
              subtitle={`Expiry ${card.exp}`}
              selected={selectedPaymentId === card.id}
              trailing={selectedPaymentId === card.id ? 'check' : 'radio'}
              onPress={() => setSelectedPaymentId(card.id)}
              last={i === OTHER_CARDS.length - 1}
            />
          ))}
          <PaymentRow
            icon={CreditCard}
            iconBg="#F3F4F6"
            title="Add New Card"
            trailing="add"
            onPress={() => {}}
            last
          />
        </PaymentSectionCard>

        <PaymentSectionCard title="More Payment Options">
          {MORE_OPTIONS.map((opt, i) => (
            <PaymentRow
              key={opt.id}
              icon={opt.icon}
              iconBg="#F3F4F6"
              title={opt.label}
              subtitle={opt.subtitle}
              trailing="chevron"
              onPress={() => {}}
              last={i === MORE_OPTIONS.length - 1}
            />
          ))}
        </PaymentSectionCard>

        <AppText style={styles.secureNote}>
          🔒 Payments are encrypted & processed securely under Faazio Gateway.
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: vs(40),
  },
  secureNote: {
    fontSize: ms(11),
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: hs(24),
    marginTop: vs(4),
  },
});
