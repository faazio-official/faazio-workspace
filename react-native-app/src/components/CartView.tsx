import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
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
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
}

const getAppLabel = (itemId: string) => {
  const id = itemId.toLowerCase();
  if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) {
    return { name: 'Fa Pharma', bgColor: '#fff1f2', textColor: '#f43f5e', border: '#ffe4e6', icon: '💊' };
  }
  if (id.startsWith('gr-') || id.includes('grocery') || id.startsWith('cat-gr') || id.startsWith('cat-fb')) {
    return { name: 'Faazio Grocery', bgColor: '#ecfdf5', textColor: '#059669', border: '#d1fae5', icon: '🥦' };
  }
  if (id.startsWith('fm-') || id.includes('mart') || id.startsWith('cat-mt') || id.startsWith('cat-mf')) {
    return { name: 'FA Mart', bgColor: '#eef2ff', textColor: '#4f46e5', border: '#e0e7ff', icon: '🛍️' };
  }
  return { name: 'Food', bgColor: '#fffbeb', textColor: '#d97706', border: '#fef3c7', icon: '🍔' };
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

  const [addresses, setAddresses] = useState([
    { id: 'addr-1', label: '🏠 Home (Primary)', address: 'Flat 405, Sea Breeze Residency, Bandra West, Mumbai - 400050', selected: true },
    { id: 'addr-2', label: '🏢 Office / Co-Working', address: 'Block C, Maker Chambers VI, Nariman Point, Mumbai - 400021', selected: false },
  ]);
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

  const subtotal = cartItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const deliveryFee = subtotal > 499 ? 0 : 49;
  const tax = Math.round(subtotal * 0.05);
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const finalTotal = Math.max(0, subtotal + deliveryFee + tax - discountAmount);

  const applyCoupon = () => {
    setPromoError(null);
    const code = promoCode.toUpperCase().trim();
    if (code === 'FAAZIO20') {
      const amt = Math.round(subtotal * 0.20);
      setAppliedDiscount({ code: 'FAAZIO20 (20% OFF)', amount: amt });
    } else if (code === 'SUPER50') {
      const amt = Math.round(subtotal * 0.50);
      setAppliedDiscount({ code: 'SUPER50 (50% OFF)', amount: amt });
    } else if (code === 'FREESHIP') {
      setAppliedDiscount({ code: 'FREESHIP (Delivery Save)', amount: deliveryFee });
    } else {
      setPromoError('Invalid coupon code. Try FAAZIO20 or SUPER50!');
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
      return [...unselected, { id: newId, label: '📍 New Address', address: customAddress.trim(), selected: true }];
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
              <ShoppingBag size={13} color="#0f172a" style={{ marginRight: 6 }} />
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
              <View style={styles.emptyIconCircle}>
                <ShoppingBag size={22} color="#94a3b8" />
              </View>
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
                        <Text style={styles.groupCountText}>{group.items.length} items</Text>
                      </View>

                      <View style={styles.appItemsBox}>
                        {group.items.map((item) => (
                          <View key={item.id} style={styles.cartItemRow}>
                            <View style={styles.cartItemLeft}>
                              <View style={styles.cartItemEmojiCircle}>
                                <Text style={styles.cartItemEmoji}>{item.emoji}</Text>
                              </View>
                              <View style={styles.cartItemMeta}>
                                <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.cartItemPrice}>₹{item.price.toLocaleString('en-IN')} each</Text>
                              </View>
                            </View>

                            <View style={styles.quantityWidget}>
                              <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.qtyBtn} activeOpacity={0.8}>
                                <Text style={styles.qtyBtnText}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.qtyValue}>{item.quantity}</Text>
                              <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.qtyBtn} activeOpacity={0.8}>
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
                    <Ticket size={14} color="#94a3b8" style={styles.couponIcon} />
                    <TextInput
                      placeholder="e.g. FAAZIO20, SUPER50"
                      value={promoCode}
                      onChangeText={(txt) => {
                        setPromoCode(txt);
                        setPromoError(null);
                      }}
                      style={styles.couponInput}
                      placeholderTextColor="#cbd5e1"
                      autoCapitalize="characters"
                    />
                  </View>
                  <TouchableOpacity onPress={applyCoupon} style={styles.couponApplyBtn} activeOpacity={0.8}>
                    <Text style={styles.couponApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>

                {appliedDiscount && (
                  <View style={styles.appliedDiscountBox}>
                    <Text style={styles.appliedDiscountText}>Applied: {appliedDiscount.code}</Text>
                    <TouchableOpacity onPress={removeCoupon} activeOpacity={0.8}>
                      <Text style={styles.removeCouponText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {promoError && (
                  <View style={styles.promoErrorBox}>
                    <AlertCircle size={10} color="#ef4444" style={{ marginRight: 4 }} />
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
                    <Text style={[styles.pricingValue, { color: '#16a34a', fontWeight: '900' }]}>FREE</Text>
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
                <ArrowRight size={13} color="#ffffff" style={{ marginLeft: 6 }} />
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
          <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }]}>
            <TouchableOpacity onPress={() => setStep('BAG')} style={styles.backBtn} activeOpacity={0.8}>
              <ChevronLeft size={12} color="#94a3b8" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitleCenter}>Select Delivery Address</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Address List */}
          <View style={styles.addressList}>
            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                onPress={() => selectAddress(addr.id)}
                style={[
                  styles.addressCard,
                  addr.selected ? { borderColor: '#0f172a', backgroundColor: '#f8fafc' } : null,
                ]}
                activeOpacity={0.9}
              >
                <View style={[styles.addressCardIconCircle, addr.selected ? { backgroundColor: '#0f172a' } : null]}>
                  <MapPin size={14} color={addr.selected ? '#ffffff' : '#64748b'} />
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
          <TouchableOpacity onPress={() => setStep('PAYMENT')} style={[styles.mainActionBtn, { marginTop: 24 }]} activeOpacity={0.8}>
            <Text style={styles.mainActionBtnText}>Proceed to Payment</Text>
            <ArrowRight size={13} color="#ffffff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (step === 'PAYMENT') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardBox}>
          <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }]}>
            <TouchableOpacity onPress={() => setStep('ADDRESS')} style={styles.backBtn} activeOpacity={0.8}>
              <ChevronLeft size={12} color="#94a3b8" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitleCenter}>Choose Payment Method</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Payment Method Selector Grid */}
          <View style={styles.paymentSelectorGrid}>
            <TouchableOpacity
              onPress={() => setPaymentMethod('UPI')}
              style={[styles.paymentGridCard, paymentMethod === 'UPI' ? styles.paymentGridCardActive : null]}
              activeOpacity={0.8}
            >
              <Smartphone size={16} color={paymentMethod === 'UPI' ? '#0f172a' : '#94a3b8'} />
              <Text style={styles.paymentGridCardText}>UPI Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPaymentMethod('CARD')}
              style={[styles.paymentGridCard, paymentMethod === 'CARD' ? styles.paymentGridCardActive : null]}
              activeOpacity={0.8}
            >
              <CreditCard size={16} color={paymentMethod === 'CARD' ? '#0f172a' : '#94a3b8'} />
              <Text style={styles.paymentGridCardText}>Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPaymentMethod('COD')}
              style={[styles.paymentGridCard, paymentMethod === 'COD' ? styles.paymentGridCardActive : null]}
              activeOpacity={0.8}
            >
              <Coins size={16} color={paymentMethod === 'COD' ? '#0f172a' : '#94a3b8'} />
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
            <ShieldCheck size={14} color="#059669" style={{ marginRight: 6 }} />
            <Text style={styles.secureDetailsText}>Secure SSL 256-bit Certified Transaction</Text>
          </View>

          {/* Summary pricing block */}
          <View style={styles.paymentPriceSummary}>
            <View style={{ flex: 1, marginRight: 10 }}>
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
            style={[styles.mainActionBtn, { backgroundColor: '#7CE045', marginTop: 14 }]}
            activeOpacity={0.8}
          >
            {paymentProcessing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.mainActionBtnText}>Processing Payment...</Text>
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <Text style={styles.mainActionBtnText}>PAY & PLACE ORDER NOW</Text>
                <CheckCircle size={13} color="#ffffff" style={{ marginLeft: 6 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // RECEIPT VIEW
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.cardBox}>
        {/* Receipt Success */}
        <View style={styles.receiptHeader}>
          <View style={styles.receiptCheckCircle}>
            <CheckCircle size={24} color="#56B821" />
          </View>
          <Text style={styles.receiptTitle}>Order Confirmed!</Text>
          <Text style={styles.receiptOrderId}>ID: {placedOrderDetails?.orderId}</Text>
        </View>

        {/* Live Delivery status steps */}
        <View style={styles.liveTrackingBox}>
          <View style={styles.liveTrackingHeader}>
            <View style={styles.liveTrackingHeaderLeft}>
              <Truck size={12} color="#475569" style={{ marginRight: 4 }} />
              <Text style={styles.liveTrackingLabel}>Real-Time Tracking Status</Text>
            </View>
            <View style={styles.etaBadge}>
              <Text style={styles.etaBadgeText}>Arriving in {placedOrderDetails?.eta}</Text>
            </View>
          </View>

          <View style={styles.liveStepsContainer}>
            <View style={styles.liveStepRow}>
              <View style={styles.liveStepConnectorLine} />
              <View style={styles.liveStepActiveDot} />
              <View style={styles.liveStepTextCol}>
                <Text style={styles.liveStepTitle}>Order Accepted by Hub</Text>
                <Text style={styles.liveStepDesc}>Confirmed at local Faazio distribution centre</Text>
              </View>
            </View>

            <View style={[styles.liveStepRow, { marginBottom: 0 }]}>
              <View style={styles.liveStepActiveDotPulse} />
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
                  <Text style={styles.purchasedItemEmoji}>{item.emoji}</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: 14,
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
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  badgeWrap: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 8.5,
    color: '#64748b',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1e293b',
  },
  emptyDesc: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
    lineHeight: 13,
  },
  goToHubBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  goToHubBtnText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  itemsListContainer: {
    width: '100%',
  },
  groupedAppSection: {
    marginBottom: 16,
  },
  appOriginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appOriginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  appOriginEmoji: {
    fontSize: 8,
    marginRight: 4,
  },
  appOriginName: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  groupCountText: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
  },
  appItemsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 10,
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  cartItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  cartItemEmojiCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
  },
  cartItemEmoji: {
    fontSize: 10,
  },
  cartItemMeta: {
    marginLeft: 8,
    flex: 1,
  },
  cartItemName: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  cartItemPrice: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 2,
  },
  quantityWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 2,
    borderRadius: 6,
  },
  qtyBtn: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
  },
  qtyValue: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1e293b',
    marginHorizontal: 4,
    minWidth: 10,
    textAlign: 'center',
  },
  couponContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  couponRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInputWrap: {
    flex: 1,
    position: 'relative',
  },
  couponIcon: {
    position: 'absolute',
    left: 10,
    top: 10,
  },
  couponInput: {
    height: 34,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 10,
    paddingLeft: 30,
    paddingRight: 10,
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  couponApplyBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  appliedDiscountBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  appliedDiscountText: {
    fontSize: 8.5,
    color: '#065f46',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  removeCouponText: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  promoErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  promoErrorText: {
    fontSize: 8,
    color: '#ef4444',
    fontWeight: '900',
  },
  pricingContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pricingLabel: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '700',
  },
  pricingValue: {
    fontSize: 9.5,
    color: '#1e293b',
    fontWeight: '700',
  },
  tipBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  tipText: {
    fontSize: 7.5,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 11,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
  },
  grandTotalValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  mainActionBtn: {
    width: '100%',
    height: 42,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  mainActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginLeft: 3,
  },
  headerTitleCenter: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  addressList: {
    width: '100%',
    gap: 8,
    marginTop: 10,
  },
  addressCard: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  addressCardIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressCardDetails: {
    marginLeft: 10,
    flex: 1,
    paddingRight: 20,
  },
  addressCardLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  addressCardText: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 11,
  },
  addressSelectMarker: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressSelectMarkerText: {
    color: '#ffffff',
    fontSize: 8,
  },
  customAddressForm: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  customAddressInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    fontSize: 9,
    fontWeight: '500',
    color: '#1e293b',
    minHeight: 50,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  customAddressBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  customAddressCancel: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  customAddressCancelText: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  customAddressSave: {
    backgroundColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  customAddressSaveText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  addAddressDashedBtn: {
    width: '100%',
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  addAddressDashedBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  paymentSelectorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  paymentGridCard: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentGridCardActive: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  paymentGridCardText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  paymentDetailPanel: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  upiInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  upiInput: {
    flex: 1,
    height: 32,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  upiVerifiedLabel: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  upiVerifiedText: {
    fontSize: 7.5,
    color: '#64748b',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  securePanelText: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 6,
  },
  cardInputGroup: {
    marginBottom: 10,
  },
  cardNumberInput: {
    height: 32,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 10,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  cardTwoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardColInput: {
    flex: 1,
  },
  cardCenterInput: {
    height: 32,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginTop: 4,
  },
  codBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  codBoxEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  codBoxTextCol: {
    flex: 1,
  },
  codBoxTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1e293b',
  },
  codBoxDesc: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 11,
  },
  secureDetailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 0.5,
    borderColor: '#d1fae5',
    padding: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  secureDetailsText: {
    fontSize: 7.5,
    color: '#065f46',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  paymentPriceSummary: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 8.5,
    color: '#1e293b',
    fontWeight: '900',
    marginTop: 2,
  },
  summaryRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  summaryPriceValue: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptHeader: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  receiptCheckCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  receiptTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  receiptOrderId: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  liveTrackingBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  liveTrackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 8,
    marginBottom: 10,
  },
  liveTrackingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveTrackingLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  etaBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 0.5,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  etaBadgeText: {
    fontSize: 7.5,
    color: '#047857',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  liveStepsContainer: {
    paddingLeft: 10,
  },
  liveStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
  },
  liveStepConnectorLine: {
    position: 'absolute',
    left: -7,
    top: 10,
    width: 1,
    height: 18,
    backgroundColor: '#cbd5e1',
  },
  liveStepActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    position: 'absolute',
    left: -10,
    top: 2,
  },
  liveStepActiveDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    position: 'absolute',
    left: -10,
    top: 2,
  },
  liveStepTextCol: {
    marginLeft: 8,
    flex: 1,
  },
  liveStepTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1e293b',
  },
  liveStepDesc: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 2,
  },
  purchasedItemsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  purchasedItemsList: {
    marginTop: 6,
  },
  purchasedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  purchasedItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  purchasedItemEmoji: {
    fontSize: 9,
    marginRight: 6,
  },
  purchasedItemName: {
    fontSize: 9,
    fontWeight: '900',
    color: '#334155',
  },
  purchasedItemPrice: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1e293b',
  },
  deliveryLocationSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  deliveryLocationAddress: {
    fontSize: 8.5,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 12,
    marginTop: 4,
  },
  receiptPaymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  paymentProtocolLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  paymentProtocolValue: {
    fontSize: 8,
    fontWeight: '900',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  receiptActionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
    marginTop: 12,
  },
  receiptNewOrderBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptNewOrderBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
  },
  receiptGoToHubBtn: {
    flex: 1,
    height: 36,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptGoToHubBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
});
