import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {
  ShoppingBag,
  ArrowRight,
  ChevronLeft,
  MapPin,
  Ticket,
  ShieldCheck,
  CheckCircle,
  Truck,
  Smartphone,
  CreditCard,
  Coins,
  AlertCircle,
  Check,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import EnterpriseIcon from './EnterpriseIcon';
import type { CartItem } from '@/state/cartStore';
import { defaultAddresses } from '@data/cart/addresses';
import { coupons } from '@data/cart/coupons';

const getAppLabel = (itemId: string) => {
  const id = itemId.toLowerCase();
  if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) {
    return { name: 'Fa Pharma', bgColor: '#fff1f2', textColor: '#f43f5e', border: '#ffe4e6', icon: '\u{1F48A}' };
  }
  if (id.startsWith('gr-') || id.includes('grocery') || id.startsWith('cat-gr') || id.startsWith('cat-fb')) {
    return { name: 'Faazio Grocery', bgColor: '#ecfdf5', textColor: '#059669', border: '#d1fae5', icon: '\u{1F966}' };
  }
  if (id.startsWith('fm-') || id.includes('mart') || id.startsWith('cat-mt') || id.startsWith('cat-mf')) {
    return { name: 'FA Mart', bgColor: '#eef2ff', textColor: '#4f46e5', border: '#e0e7ff', icon: '\u{1F6CD}' };
  }
  return { name: 'Food', bgColor: '#fffbeb', textColor: '#d97706', border: '#fef3c7', icon: '\u{1F354}' };
};

interface CartViewProps {
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  updateCartQuantity: (id: string, delta: number) => void;
  setActiveTab: (tab: 'Home' | 'Categories' | 'Explore' | 'Account' | 'Cart') => void;
  onScroll?: (offsetY: number) => void;
}

type CheckoutStep = 'BAG' | 'ADDRESS' | 'PAYMENT' | 'RECEIPT';

export default function CartView({
  cartItems,
  setCartItems,
  updateCartQuantity,
  setActiveTab,
  onScroll,
}: CartViewProps) {
  const [step, setStep] = useState<CheckoutStep>('BAG');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const [addresses, setAddresses] = useState(
    defaultAddresses.map((a, i) => ({ id: a.id, label: `${i === 0 ? '\u{1F3E0}' : '\u{1F3E2}'} ${a.label}${a.isDefault ? ' (Primary)' : ''}`, address: a.address, selected: i === 0 }))
  );
  const [customAddress, setCustomAddress] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'COD'>('UPI');
  const [upiId, setUpiId] = useState('user@upi');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const [placedOrderDetails, setPlacedOrderDetails] = useState<{
    orderId: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    deliveryAddress: string;
    payment: string;
    eta: string;
  } | null>(null);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim]);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const subtotal = cartItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const deliveryFee = subtotal > 499 ? 0 : 49;
  const tax = Math.round(subtotal * 0.05);
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const finalTotal = Math.max(0, subtotal + deliveryFee + tax - discountAmount);

  const applyCoupon = () => {
    setPromoError(null);
    const code = promoCode.toUpperCase().trim();
    const coupon = coupons.find(c => c.code === code);
    if (!coupon) {
      setPromoError('Invalid coupon code. Try FAAZIO20 or SUPER50!');
      return;
    }
    if (coupon.isFreeDelivery) {
      setAppliedDiscount({ code: `${coupon.code} (FREE Delivery)`, amount: deliveryFee });
    } else {
      const amt = Math.round(subtotal * (coupon.discountPercent / 100));
      setAppliedDiscount({ code: `${coupon.code} (${coupon.discountPercent}% OFF)`, amount: amt });
    }
  };

  const removeCoupon = () => {
    setAppliedDiscount(null);
    setPromoCode('');
  };

  const selectAddress = (id: string) => {
    setAddresses(prev => prev.map(a => ({ ...a, selected: a.id === id })));
  };

  const addNewAddress = () => {
    if (customAddress.trim() === '') return;
    const newId = `addr-${Date.now()}`;
    setAddresses((prev) => {
      const unselected = prev.map((a) => ({ ...a, selected: false }));
      return [...unselected, { id: newId, label: '\u{1F4CD} New Address', address: customAddress.trim(), selected: true }];
    });
    setCustomAddress('');
    setShowAddAddress(false);
  };

  const selectedAddressObj = addresses.find((a) => a.selected) || addresses[0];

  const handlePlaceOrder = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
      const details = {
        orderId: `FZ-${Math.floor(100000 + Math.random() * 900000)}`,
        items: [...cartItems],
        subtotal,
        discount: discountAmount,
        tax,
        total: finalTotal,
        deliveryAddress: selectedAddressObj ? selectedAddressObj.address : 'Default Address',
        payment: paymentMethod === 'UPI' ? `UPI (${upiId})` : paymentMethod === 'CARD' ? `Credit Card (*${cardNumber.slice(-4) || '4242'})` : 'Cash on Delivery',
        eta: '12-15 Mins'
      };
      setPlacedOrderDetails(details);
      setCartItems([]);
      setStep('RECEIPT');
      setPaymentProcessing(false);
    }, 2000);
  };

  if (step === 'BAG') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={16}>
        <View style={styles.cardBox}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <ShoppingBag size={ms(13)} color="#0f172a" style={{ marginRight: hs(6) }} />
              <Text style={styles.headerTitle}>Your Shopping Bag</Text>
            </View>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
          </View>

          {cartItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Animated.View style={[styles.emptyIconCircle, { transform: [{ translateY: bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
                <ShoppingBag size={ms(22)} color="#94a3b8" />
              </Animated.View>
              <Text style={styles.emptyTitle}>Your bag is empty</Text>
              <Text style={styles.emptyDesc}>
                Browse Food, FA Mart, Grocery, or Pharma and tap 'Add to Bag' to get started!
              </Text>
              <TouchableOpacity onPress={() => setActiveTab('Home')} style={styles.goToHubBtn} activeOpacity={0.8}>
                <Text style={styles.goToHubBtnText}>Go to Hub</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: '100%' }}>
              {/* Items List Grouped by App */}
              <View style={styles.itemsListContainer}>
                {(() => {
                  const grouped: Record<string, { label: ReturnType<typeof getAppLabel>; items: CartItem[] }> = {};
                  cartItems.forEach((item) => {
                    const label = getAppLabel(item.id);
                    if (!grouped[label.name]) {
                      grouped[label.name] = { label, items: [] };
                    }
                    grouped[label.name].items.push(item);
                  });

                  return Object.values(grouped).map((group) => (
                    <View key={group.label.name} style={styles.groupedAppSection}>
                      <View style={styles.appOriginRow}>
                        <View style={[styles.appOriginBadge, { backgroundColor: group.label.bgColor, borderColor: group.label.border }]}>
                          <Text style={styles.appOriginEmoji}>{group.label.icon}</Text>
                          <Text style={[styles.appOriginName, { color: group.label.textColor }]}>{group.label.name}</Text>
                        </View>
                        <Text style={styles.groupCountText}>{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</Text>
                      </View>

                      <View style={styles.appItemsBox}>
                        {group.items.map((item, index) => (
                          <View key={item.id} style={[styles.cartItemRow, index === group.items.length - 1 && { borderBottomWidth: 0 }]}>
                            <View style={styles.cartItemLeft}>
                              <View style={styles.cartItemIconWrap}>
                                <EnterpriseIcon emoji={item.emoji} variant="square" size={ms(34)} bgColor="#fff" />
                              </View>
                              <View style={styles.cartItemMeta}>
                                <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.cartItemPrice}>₹{item.price.toLocaleString('en-IN')} each</Text>
                              </View>
                            </View>

                            <View style={styles.quantityWidget}>
                              <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.qtyBtn} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={styles.qtyBtnText}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.qtyValue}>{item.quantity}</Text>
                              <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.qtyBtn} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={styles.qtyBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ));
                })()}
              </View>

              {/* Coupon System */}
              <View style={styles.couponContainer}>
                <Text style={styles.sectionLabel}>Have a Promo Coupon?</Text>
                <View style={styles.couponRow}>
                  <View style={styles.couponInputWrap}>
                    <Ticket size={ms(14)} color="#94a3b8" style={styles.couponIcon} />
                    <TextInput
                      placeholder="e.g. FAAZIO20, SUPER50"
                      value={promoCode}
                      onChangeText={(txt) => {
                        setPromoCode(txt);
                        setPromoError(null);
                      }}
                      style={[styles.couponInput, isFocused && { borderColor: '#0f172a' }]}
                      placeholderTextColor="#cbd5e1"
                      autoCapitalize="characters"
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                    />
                  </View>
                  <TouchableOpacity onPress={applyCoupon} style={styles.couponApplyBtn} activeOpacity={0.8}>
                    <Text style={styles.couponApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>

                {appliedDiscount && (
                  <View style={styles.appliedDiscountBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Check size={ms(12)} strokeWidth={3} color="#059669" style={{ marginRight: hs(4) }} />
                      <Text style={styles.appliedDiscountText}>Applied: {appliedDiscount.code}</Text>
                    </View>
                    <TouchableOpacity onPress={removeCoupon} activeOpacity={0.8}>
                      <Text style={styles.removeCouponText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {promoError && (
                  <View style={styles.promoErrorBox}>
                    <AlertCircle size={ms(10)} color="#ef4444" style={{ marginRight: hs(4) }} />
                    <Text style={styles.promoErrorText}>{promoError}</Text>
                  </View>
                )}
              </View>

              {/* Price Breakdown */}
              <View style={styles.pricingContainer}>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Subtotal</Text>
                  <Text style={styles.pricingValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
                </View>

                {appliedDiscount && (
                  <View style={styles.pricingRow}>
                    <Text style={[styles.pricingLabel, { color: '#059669', fontWeight: '900' }]}>Coupon Discount</Text>
                    <Text style={[styles.pricingValue, { color: '#059669', fontWeight: '900' }]}>-₹{discountAmount.toLocaleString('en-IN')}</Text>
                  </View>
                )}

                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>GST Taxes (5%)</Text>
                  <Text style={styles.pricingValue}>₹{tax.toLocaleString('en-IN')}</Text>
                </View>

                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Delivery Charges</Text>
                  {deliveryFee === 0 ? (
                    <Text style={[styles.pricingValue, { color: '#56B821', fontWeight: '900' }]}>FREE (₹49 Saved)</Text>
                  ) : (
                    <Text style={styles.pricingValue}>₹{deliveryFee}</Text>
                  )}
                </View>

                {deliveryFee > 0 && (
                  <View style={styles.tipBox}>
                    <Text style={styles.tipText}>
                      💡 Tip: Add items worth <Text style={{ fontWeight: '900', color: '#334155' }}>₹{(500 - subtotal).toLocaleString('en-IN')}</Text> more to qualify for <Text style={{ color: '#059669', fontWeight: '900' }}>FREE Delivery</Text>!
                    </Text>
                  </View>
                )}

                <View style={[styles.pricingRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>₹{finalTotal.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              {/* Action Button */}
              <TouchableOpacity onPress={() => setStep('ADDRESS')} style={styles.mainActionBtn} activeOpacity={0.8}>
                <Text style={styles.mainActionBtnText}>Select Delivery Address</Text>
                <ArrowRight size={ms(13)} color="#ffffff" style={{ marginLeft: hs(6) }} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  if (step === 'ADDRESS') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={16}>
        <View style={styles.cardBox}>
          <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: vs(10) }]}>
            <TouchableOpacity onPress={() => setStep('BAG')} style={styles.backBtn} activeOpacity={0.8}>
              <ChevronLeft size={ms(12)} color="#94a3b8" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitleCenter}>Select Delivery Address</Text>
            <View style={{ width: hs(40) }} />
          </View>

          {/* Address List */}
          <View style={styles.addressList}>
            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                onPress={() => selectAddress(addr.id)}
                style={[
                  styles.addressCard,
                  addr.selected ? { borderColor: '#0f172a', backgroundColor: '#f8fafc', shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 } : null,
                ]}
                activeOpacity={0.9}
              >
                <View style={[styles.addressCardIconCircle, addr.selected ? { backgroundColor: '#0f172a' } : null]}>
                  <MapPin size={ms(14)} color={addr.selected ? '#ffffff' : '#64748b'} />
                </View>
                <View style={styles.addressCardDetails}>
                  <Text style={styles.addressCardLabel}>{addr.label}</Text>
                  <Text style={styles.addressCardText}>{addr.address}</Text>
                </View>

                {addr.selected && (
                  <View style={styles.addressSelectMarker}>
                    <Text style={styles.addressSelectMarkerText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Add custom Address Form */}
          {showAddAddress ? (
            <View style={styles.customAddressForm}>
              <Text style={styles.sectionLabel}>Type Custom Address</Text>
              <TextInput
                placeholder="Apartment/Flat No, Landmark, Street name, Pincode"
                value={customAddress}
                onChangeText={setCustomAddress}
                multiline
                numberOfLines={3}
                style={styles.customAddressInput}
                placeholderTextColor="#cbd5e1"
              />
              <View style={styles.customAddressBtnRow}>
                <TouchableOpacity onPress={() => setShowAddAddress(false)} style={styles.customAddressCancel} activeOpacity={0.8}>
                  <Text style={styles.customAddressCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={addNewAddress} style={styles.customAddressSave} activeOpacity={0.8}>
                  <Text style={styles.customAddressSaveText}>Save Address</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowAddAddress(true)} style={styles.addAddressDashedBtn} activeOpacity={0.8}>
              <Text style={styles.addAddressDashedBtnText}>+ Add Delivery Location</Text>
            </TouchableOpacity>
          )}

          {/* Proceed to Payment Button */}
          <TouchableOpacity onPress={() => setStep('PAYMENT')} style={[styles.mainActionBtn, { marginTop: vs(24) }]} activeOpacity={0.8}>
            <Text style={styles.mainActionBtnText}>Proceed to Payment</Text>
            <ArrowRight size={ms(13)} color="#ffffff" style={{ marginLeft: hs(6) }} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (step === 'PAYMENT') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={16}>
        <View style={styles.cardBox}>
          <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: vs(10) }]}>
            <TouchableOpacity onPress={() => setStep('ADDRESS')} style={styles.backBtn} activeOpacity={0.8}>
              <ChevronLeft size={ms(12)} color="#94a3b8" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitleCenter}>Choose Payment Method</Text>
            <View style={{ width: hs(40) }} />
          </View>

          {/* Payment Method Selector Grid */}
          <View style={styles.paymentSelectorGrid}>
            <TouchableOpacity
              onPress={() => setPaymentMethod('UPI')}
              style={[styles.paymentGridCard, paymentMethod === 'UPI' ? styles.paymentGridCardActive : null]}
              activeOpacity={0.8}
            >
              <Smartphone size={ms(16)} color={paymentMethod === 'UPI' ? '#0f172a' : '#94a3b8'} />
              <Text style={styles.paymentGridCardText}>UPI Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPaymentMethod('CARD')}
              style={[styles.paymentGridCard, paymentMethod === 'CARD' ? styles.paymentGridCardActive : null]}
              activeOpacity={0.8}
            >
              <CreditCard size={ms(16)} color={paymentMethod === 'CARD' ? '#0f172a' : '#94a3b8'} />
              <Text style={styles.paymentGridCardText}>Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPaymentMethod('COD')}
              style={[styles.paymentGridCard, paymentMethod === 'COD' ? styles.paymentGridCardActive : null]}
              activeOpacity={0.8}
            >
              <Coins size={ms(16)} color={paymentMethod === 'COD' ? '#0f172a' : '#94a3b8'} />
              <Text style={styles.paymentGridCardText}>Cash</Text>
            </TouchableOpacity>
          </View>

          {/* UPI dynamic panel details */}
          {paymentMethod === 'UPI' && (
            <View style={styles.paymentDetailPanel}>
              <Text style={styles.sectionLabel}>Verify Unified Payment VPA</Text>
              <View style={styles.upiInputRow}>
                <TextInput
                  value={upiId}
                  onChangeText={setUpiId}
                  style={styles.upiInput}
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.upiVerifiedLabel}>
                  <Text style={styles.upiVerifiedText}>Verified</Text>
                </View>
              </View>
              <Text style={styles.securePanelText}>🔒 UPI transaction is encrypted securely under Faazio Gateway protocol.</Text>
            </View>
          )}

          {/* CARD Details */}
          {paymentMethod === 'CARD' && (
            <View style={styles.paymentDetailPanel}>
              <View style={styles.cardInputGroup}>
                <Text style={styles.sectionLabel}>Card Number</Text>
                <TextInput
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChangeText={(val) => {
                    const formatted = val.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                    setCardNumber(formatted);
                  }}
                  maxLength={19}
                  keyboardType="numeric"
                  style={styles.cardNumberInput}
                  placeholderTextColor="#cbd5e1"
                />
              </View>

              <View style={styles.cardTwoColRow}>
                <View style={styles.cardColInput}>
                  <Text style={styles.sectionLabel}>Expiry Date</Text>
                  <TextInput
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChangeText={setCardExpiry}
                    maxLength={5}
                    keyboardType="numeric"
                    style={styles.cardCenterInput}
                    placeholderTextColor="#cbd5e1"
                  />
                </View>
                <View style={styles.cardColInput}>
                  <Text style={styles.sectionLabel}>CVV Code</Text>
                  <TextInput
                    placeholder="***"
                    value={cardCvv}
                    onChangeText={setCardCvv}
                    maxLength={3}
                    secureTextEntry
                    keyboardType="numeric"
                    style={styles.cardCenterInput}
                    placeholderTextColor="#cbd5e1"
                  />
                </View>
              </View>
            </View>
          )}

          {/* COD DETAILS */}
          {paymentMethod === 'COD' && (
            <View style={styles.codBox}>
              <Text style={styles.codBoxEmoji}>💵</Text>
              <View style={styles.codBoxTextCol}>
                <Text style={styles.codBoxTitle}>Cash on Delivery selected</Text>
                <Text style={styles.codBoxDesc}>Simply pay using cash or local phone QR scanner to your delivery partner when they arrive.</Text>
              </View>
            </View>
          )}

          {/* Secure Details */}
          <View style={styles.secureDetailsCard}>
            <ShieldCheck size={ms(14)} color="#059669" style={{ marginRight: hs(6) }} />
            <Text style={styles.secureDetailsText}>Secure SSL 256-bit Certified Transaction</Text>
          </View>

          {/* Summary pricing block */}
          <View style={styles.paymentPriceSummary}>
            <View style={{ flex: 1, marginRight: hs(10) }}>
              <Text style={styles.summaryLabel}>Delivery Address</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{selectedAddressObj.address}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Total Payment</Text>
              <Text style={styles.summaryPriceValue}>₹{finalTotal.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Pay Button */}
          <TouchableOpacity
            onPress={handlePlaceOrder}
            disabled={paymentProcessing}
            style={[styles.mainActionBtn, { backgroundColor: '#7CE045', marginTop: vs(14) }, paymentProcessing && { shadowColor: 'rgba(124,224,69,0.3)', shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, shadowOpacity: 0.75, elevation: 8 }]}
            activeOpacity={0.8}
          >
            {paymentProcessing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: hs(6) }} />
                <Text style={styles.mainActionBtnText}>Processing Payment...</Text>
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <Text style={styles.mainActionBtnText}>PAY & PLACE ORDER NOW</Text>
                <CheckCircle size={ms(13)} color="#ffffff" style={{ marginLeft: hs(6) }} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // RECEIPT VIEW
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}>
      <View style={styles.cardBox}>
        {/* Receipt Success */}
        <View style={styles.receiptHeader}>
          <View style={styles.receiptCheckCircle}>
            <CheckCircle size={ms(24)} color="#56B821" strokeWidth={2.5} />
          </View>
          <Text style={styles.receiptTitle}>Order Confirmed!</Text>
          <Text style={styles.receiptOrderId}>ID: {placedOrderDetails?.orderId}</Text>
        </View>

        {/* Live Delivery status steps */}
        <View style={styles.liveTrackingBox}>
          <View style={styles.liveTrackingHeader}>
            <View style={styles.liveTrackingHeaderLeft}>
              <Animated.View style={{ opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }}>
                <Truck size={ms(10)} color="#475569" style={{ marginRight: hs(4) }} />
              </Animated.View>
              <Text style={styles.liveTrackingLabel}>Real-Time Tracking Status</Text>
            </View>
            <View style={styles.etaBadge}>
              <Text style={styles.etaBadgeText}>Arriving in {placedOrderDetails?.eta}</Text>
            </View>
          </View>

          <View style={styles.liveStepsContainer}>
            <View style={styles.liveStepRow}>
              <View style={styles.liveStepConnectorLine} />
              <View style={styles.liveStepDotOuter}>
                <View style={styles.liveStepActiveDot} />
              </View>
              <View style={styles.liveStepTextCol}>
                <Text style={styles.liveStepTitle}>Order Accepted by Hub</Text>
                <Text style={styles.liveStepDesc}>Confirmed at local Faazio distribution centre</Text>
              </View>
            </View>

            <View style={[styles.liveStepRow, { marginBottom: 0 }]}>
              <View style={styles.liveStepDotOuter}>
                <Animated.View style={[styles.liveStepActiveDotPulse, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }]} />
              </View>
              <View style={styles.liveStepTextCol}>
                <Text style={styles.liveStepTitle}>Rider Assigning...</Text>
                <Text style={styles.liveStepDesc}>Simulated delivery executive moving to pick location</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Purchased list */}
        <View style={styles.purchasedItemsSection}>
          <Text style={styles.sectionLabel}>Items Purchased</Text>
          <View style={styles.purchasedItemsList}>
            {placedOrderDetails?.items.map((item) => (
              <View key={item.id} style={styles.purchasedItemRow}>
                <View style={styles.purchasedItemLeft}>
                  <EnterpriseIcon emoji={item.emoji} variant="flat" size={ms(10)} />
                  <Text style={styles.purchasedItemName} numberOfLines={1}>
                    {item.name} <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>x {item.quantity}</Text>
                  </Text>
                </View>
                <Text style={styles.purchasedItemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Delivering to location */}
        <View style={styles.deliveryLocationSection}>
          <Text style={styles.sectionLabel}>Delivering To</Text>
          <Text style={styles.deliveryLocationAddress}>{placedOrderDetails?.deliveryAddress}</Text>
        </View>

        {/* Payment info info */}
        <View style={styles.receiptPaymentDetails}>
          <Text style={styles.paymentProtocolLabel}>Payment Protocol:</Text>
          <Text style={styles.paymentProtocolValue}>{placedOrderDetails?.payment}</Text>
        </View>

        {/* Action Controls */}
        <View style={styles.receiptActionBtnRow}>
          <TouchableOpacity
            onPress={() => {
              setStep('BAG');
              setPlacedOrderDetails(null);
            }}
            style={styles.receiptNewOrderBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.receiptNewOrderBtnText}>New Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setActiveTab('Home');
              setStep('BAG');
              setPlacedOrderDetails(null);
            }}
            style={styles.receiptGoToHubBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.receiptGoToHubBtnText}>Go to Hub</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(40),
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderRadius: ms(24),
    padding: hs(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: vs(14),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(16),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: ms(11.5),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  badgeWrap: {
    backgroundColor: '#f1f5f9',
    paddingVertical: vs(2),
    paddingHorizontal: hs(8),
    borderRadius: ms(12),
  },
  badgeText: {
    fontSize: ms(8.5),
    color: '#64748b',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: vs(40),
  },
  emptyIconCircle: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: vs(12),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#1e293b',
  },
  emptyDesc: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: vs(4),
    maxWidth: hs(220),
    lineHeight: ms(13),
  },
  goToHubBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: vs(10),
    paddingHorizontal: hs(20),
    borderRadius: ms(12),
    marginTop: vs(16),
  },
  goToHubBtnText: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemsListContainer: {
    width: '100%',
    maxHeight: vs(260),
  },
  groupedAppSection: {
    marginBottom: vs(16),
  },
  appOriginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(8),
  },
  appOriginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: ms(6),
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
  },
  appOriginEmoji: {
    fontSize: ms(8),
    marginRight: hs(4),
  },
  appOriginName: {
    fontSize: ms(8),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  groupCountText: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '600',
  },
  appItemsBox: {
    backgroundColor: 'rgba(248,250,252,0.2)',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(10),
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(8),
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  cartItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: hs(10),
  },
  cartItemIconWrap: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(8),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cartItemMeta: {
    marginLeft: hs(8),
    flex: 1,
  },
  cartItemName: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
  },
  cartItemPrice: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(2),
  },
  quantityWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: vs(2),
    borderRadius: ms(6),
  },
  qtyBtn: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#64748b',
  },
  qtyValue: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#1e293b',
    marginHorizontal: hs(4),
    minWidth: ms(10),
    textAlign: 'center',
  },
  couponContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(12),
    marginBottom: vs(16),
  },
  sectionLabel: {
    fontSize: ms(8.5),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: vs(6),
  },
  couponRow: {
    flexDirection: 'row',
    gap: hs(8),
  },
  couponInputWrap: {
    flex: 1,
    position: 'relative',
  },
  couponIcon: {
    position: 'absolute',
    left: hs(10),
    top: vs(10),
  },
  couponInput: {
    height: Math.max(36, vs(36)),
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(10),
    paddingLeft: hs(30),
    paddingRight: hs(10),
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#0f172a',
  },
  couponApplyBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: hs(16),
    height: Math.max(36, vs(36)),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyText: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  appliedDiscountBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    paddingVertical: vs(6),
    paddingHorizontal: hs(10),
    borderRadius: ms(10),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: vs(8),
  },
  appliedDiscountText: {
    fontSize: ms(8.5),
    color: '#065f46',
    fontWeight: '900',
    textTransform: 'uppercase',
    marginLeft: hs(4),
  },
  removeCouponText: {
    fontSize: ms(8),
    color: '#64748b',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  promoErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6),
  },
  promoErrorText: {
    fontSize: ms(8),
    color: '#ef4444',
    fontWeight: '900',
  },
  pricingContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(12),
    marginBottom: vs(16),
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(6),
  },
  pricingLabel: {
    fontSize: ms(9.5),
    color: '#94a3b8',
    fontWeight: '700',
  },
  pricingValue: {
    fontSize: ms(9.5),
    color: '#1e293b',
    fontWeight: '700',
  },
  tipBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(8),
    borderRadius: ms(8),
    marginVertical: vs(4),
  },
  tipText: {
    fontSize: ms(7.5),
    color: '#64748b',
    fontWeight: '500',
    lineHeight: ms(11),
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: vs(8),
    marginTop: vs(4),
  },
  grandTotalLabel: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
  },
  grandTotalValue: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  mainActionBtn: {
    width: '100%',
    height: Math.max(44, vs(44)),
    backgroundColor: '#020617',
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mainActionBtnText: {
    color: '#ffffff',
    fontSize: ms(12),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginLeft: hs(3),
  },
  headerTitleCenter: {
    fontSize: ms(10.5),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  addressList: {
    width: '100%',
    gap: vs(8),
    marginTop: vs(10),
  },
  addressCard: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(12),
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  addressCardIconCircle: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(12),
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCardDetails: {
    marginLeft: hs(10),
    flex: 1,
    paddingRight: hs(20),
  },
  addressCardLabel: {
    fontSize: ms(9.5),
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  addressCardText: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(2),
    lineHeight: ms(11),
  },
  addressSelectMarker: {
    position: 'absolute',
    top: vs(12),
    right: hs(14),
    width: ms(14),
    height: ms(14),
    borderRadius: ms(7),
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressSelectMarkerText: {
    color: '#ffffff',
    fontSize: ms(16),
  },
  customAddressForm: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(12),
    marginTop: vs(12),
  },
  customAddressInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: ms(10),
    padding: hs(8),
    fontSize: ms(9),
    fontWeight: '500',
    color: '#1e293b',
    minHeight: vs(50),
    textAlignVertical: 'top',
    marginTop: vs(4),
  },
  customAddressBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: hs(8),
    marginTop: vs(8),
  },
  customAddressCancel: {
    paddingVertical: vs(4),
    paddingHorizontal: hs(8),
  },
  customAddressCancelText: {
    fontSize: ms(8.5),
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  customAddressSave: {
    backgroundColor: '#0f172a',
    paddingVertical: vs(4),
    paddingHorizontal: hs(12),
    borderRadius: ms(6),
  },
  customAddressSaveText: {
    color: '#ffffff',
    fontSize: ms(8.5),
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  addAddressDashedBtn: {
    width: '100%',
    paddingVertical: vs(10),
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(12),
  },
  addAddressDashedBtnText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  paymentSelectorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: vs(12),
    marginBottom: vs(12),
  },
  paymentGridCard: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    paddingVertical: vs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentGridCardActive: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  paymentGridCardText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
    marginTop: vs(6),
    letterSpacing: 0.5,
  },
  paymentDetailPanel: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(12),
    marginBottom: vs(12),
  },
  upiInputRow: {
    flexDirection: 'row',
    gap: hs(8),
    marginTop: vs(4),
  },
  upiInput: {
    flex: 1,
    height: Math.max(32, vs(32)),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: ms(8),
    paddingHorizontal: hs(10),
    fontSize: ms(9.5),
    fontWeight: '700',
    color: '#1e293b',
  },
  upiVerifiedLabel: {
    backgroundColor: 'rgba(226,232,240,0.5)',
    paddingHorizontal: hs(8),
    borderRadius: ms(12),
    justifyContent: 'center',
  },
  upiVerifiedText: {
    fontSize: ms(7.5),
    color: '#64748b',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  securePanelText: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: vs(6),
  },
  cardInputGroup: {
    marginBottom: vs(10),
  },
  cardNumberInput: {
    height: Math.max(32, vs(32)),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: ms(8),
    paddingHorizontal: hs(10),
    fontSize: ms(10),
    fontWeight: '700',
    color: '#1e293b',
    marginTop: vs(4),
  },
  cardTwoColRow: {
    flexDirection: 'row',
    gap: hs(10),
  },
  cardColInput: {
    flex: 1,
  },
  cardCenterInput: {
    height: Math.max(32, vs(32)),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: ms(8),
    fontSize: ms(10),
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginTop: vs(4),
  },
  codBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(12),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  codBoxEmoji: {
    fontSize: ms(20),
    marginRight: hs(10),
  },
  codBoxTextCol: {
    flex: 1,
  },
  codBoxTitle: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#1e293b',
  },
  codBoxDesc: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: vs(2),
    lineHeight: ms(11),
  },
  secureDetailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236,253,245,0.5)',
    borderWidth: 0.5,
    borderColor: '#d1fae5',
    padding: hs(8),
    borderRadius: ms(10),
    marginBottom: vs(12),
  },
  secureDetailsText: {
    fontSize: ms(7.5),
    color: '#065f46',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  paymentPriceSummary: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  summaryLabel: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: ms(8.5),
    color: '#1e293b',
    fontWeight: '900',
    marginTop: vs(2),
  },
  summaryRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  summaryPriceValue: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(2),
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptHeader: {
    alignItems: 'center',
    paddingVertical: vs(10),
  },
  receiptCheckCircle: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    backgroundColor: '#EBFBE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(10),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  receiptTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  receiptOrderId: {
    fontSize: ms(8.5),
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: vs(4),
  },
  liveTrackingBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(12),
    marginBottom: vs(14),
  },
  liveTrackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: vs(8),
    marginBottom: vs(10),
  },
  liveTrackingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveTrackingLabel: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  etaBadge: {
    backgroundColor: '#EBFBE5',
    borderWidth: 0.5,
    borderColor: '#a7f3d0',
    borderRadius: ms(6),
    paddingVertical: vs(1),
    paddingHorizontal: hs(6),
  },
  etaBadgeText: {
    fontSize: ms(7.5),
    color: '#56B821',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  liveStepsContainer: {
    paddingLeft: hs(10),
  },
  liveStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: vs(12),
    position: 'relative',
  },
  liveStepConnectorLine: {
    position: 'absolute',
    left: hs(-7),
    top: vs(10),
    width: 1,
    height: vs(18),
    backgroundColor: '#cbd5e1',
  },
  liveStepDotOuter: {
    position: 'absolute',
    left: hs(-10),
    top: vs(2),
    width: ms(14),
    height: ms(14),
    borderRadius: ms(7),
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStepActiveDot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: '#56B821',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  liveStepActiveDotPulse: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: '#56B821',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  liveStepTextCol: {
    marginLeft: hs(8),
    flex: 1,
  },
  liveStepTitle: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#1e293b',
  },
  liveStepDesc: {
    fontSize: ms(7.5),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(2),
  },
  purchasedItemsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(10),
  },
  purchasedItemsList: {
    marginTop: vs(6),
    maxHeight: vs(120),
  },
  purchasedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(2),
  },
  purchasedItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: hs(10),
  },
  purchasedItemName: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#334155',
  },
  purchasedItemPrice: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#1e293b',
  },
  deliveryLocationSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(10),
  },
  deliveryLocationAddress: {
    fontSize: ms(8.5),
    color: '#64748b',
    fontWeight: '600',
    lineHeight: ms(12),
    marginTop: vs(4),
  },
  receiptPaymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(8),
    borderRadius: ms(10),
    marginTop: vs(10),
  },
  paymentProtocolLabel: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  paymentProtocolValue: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  receiptActionBtnRow: {
    flexDirection: 'row',
    gap: hs(10),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(14),
    marginTop: vs(12),
  },
  receiptNewOrderBtn: {
    flex: 1,
    height: Math.max(40, vs(40)),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptNewOrderBtnText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
  },
  receiptGoToHubBtn: {
    flex: 1,
    height: Math.max(40, vs(40)),
    backgroundColor: '#0f172a',
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptGoToHubBtnText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
});

export { getAppLabel };
