import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Animated, Image } from 'react-native';
import {
  ArrowLeft,
  ShoppingBag,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  MapPin,
  Ticket,
  Tag,
  Send,
  CheckCircle,
  Truck,
  Check,
  ChefHat,
  BriefcaseMedical,
  Store,
  Clock,
  Coins,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EnterpriseIcon from '@/components/EnterpriseIcon';
import type { CartItem, CartCategory } from '@/state/cartStore';
import { defaultAddresses } from '@data/cart/addresses';
import { coupons } from '@data/cart/coupons';
import { getPickupPointsForItems } from '@data/cart/pickup-resolver';
import { userProfile } from '@data/account/profile';
import type { FulfillmentMode, PickupPoint } from '@data/types';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import PaymentOptionsScreen from '@/features/cart/payment/PaymentOptionsScreen';
import { computeTotals } from './utils';
import type { CheckoutStep } from './utils';
import { useRewardsStore } from '@/state/rewardsStore';
import { coinsEarnedFor, isCardActive } from '@/features/rewards/rewardsLogic';
import { COIN_REDEEM_RATE, DISCOUNT_CARD_PERCENT } from '@data/rewards/rewards';

const CATEGORY_META: Record<CartCategory, { label: string; icon: LucideIcon; color: string }> = {
  MART: { label: 'Mart', icon: ShoppingBag, color: '#10B981' },
  FOOD: { label: 'Food', icon: ChefHat, color: '#F97316' },
  PHARMA: { label: 'Pharma', icon: BriefcaseMedical, color: '#0284C7' },
};

const CATEGORY_ORDER: CartCategory[] = ['MART', 'FOOD', 'PHARMA'];

const inferCategory = (itemId: string): CartCategory => {
  const id = itemId.toLowerCase();
  if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) return 'PHARMA';
  if (id.startsWith('fm-') || id.startsWith('gr-') || id.includes('mart') || id.includes('grocery') || id.startsWith('cat-mt') || id.startsWith('cat-mf') || id.startsWith('cat-gr') || id.startsWith('cat-fb')) return 'MART';
  return 'FOOD';
};

function ItemThumb({ item, size = 48 }: { item: CartItem; size?: number }) {
  const [errored, setErrored] = useState(false);
  const showImage = !!item.imageUrl && !errored;
  return (
    <View style={[styles.itemThumb, { width: ms(size), height: ms(size), borderRadius: ms(8) }]}>
      {showImage ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: '100%', height: '100%', borderRadius: ms(8) }}
          resizeMode="cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <EnterpriseIcon emoji={item.emoji} variant="square" size={ms(size * 0.62)} bgColor="#F3F4F6" />
      )}
    </View>
  );
}

interface CartViewProps {
  contentInset?: number;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  updateCartQuantity: (id: string, delta: number) => void;
  setActiveTab: (tab: 'Home' | 'Categories' | 'Explore' | 'Account' | 'Cart') => void;
  onScroll?: (offsetY: number) => void;
  onBack?: () => void;
  onGoToHub?: () => void;
}

export default function CartView({
  contentInset = 0,
  cartItems,
  setCartItems,
  updateCartQuantity,
  setActiveTab,
  onScroll,
  onBack,
  onGoToHub,
}: CartViewProps) {
  const [step, setStep] = useState<CheckoutStep>('BAG');
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>('DELIVERY');
  const [selectedPickupId, setSelectedPickupId] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<CartCategory[]>(CATEGORY_ORDER);
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [showBillSheet, setShowBillSheet] = useState(false);

  const discountCard = useRewardsStore((s) => s.discountCard);
  const streakCardActive = discountCard ? isCardActive(discountCard, new Date()) : false;
  const insets = useSafeAreaInsets();

  const [addresses, setAddresses] = useState(
    defaultAddresses.map((a, i) => ({ id: a.id, label: a.label, address: a.address, selected: i === 0, isPrimary: a.isDefault === true }))
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
    fulfillment: FulfillmentMode;
    pickup?: PickupPoint;
    coinsEarned: number;
    coinsRedeemed: number;
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

  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const { subtotal, deliveryFee, tax, finalTotal } = computeTotals(cartItems, discountAmount, fulfillment);
  const estimatedCoins = coinsEarnedFor(finalTotal);
  const originalTotal = cartItems.reduce(
    (acc, curr) => acc + (curr.originalPrice ?? curr.price) * curr.quantity,
    0,
  );
  const savings = Math.max(0, originalTotal - subtotal);

  const getCatForItem = (item: CartItem): CartCategory => {
    if (item.category) return item.category;
    return inferCategory(item.id);
  };

  const grouped: { cat: CartCategory; meta: typeof CATEGORY_META[CartCategory]; items: CartItem[] }[] = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      meta: CATEGORY_META[cat],
      items: cartItems.filter((item) => getCatForItem(item) === cat),
    }))
    .filter((g) => g.items.length > 0);

  const toggleCategory = (cat: CartCategory) => {
    setExpandedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const applyCouponCode = (code: string) => {
    const normalized = code.toUpperCase().trim();
    const coupon = coupons.find((c) => c.code === normalized);
    if (!coupon) return;
    if (coupon.isFreeDelivery) {
      setAppliedDiscount({ code: `${coupon.code} (FREE Delivery)`, amount: deliveryFee });
    } else {
      const amt = Math.round(subtotal * (coupon.discountPercent / 100));
      setAppliedDiscount({ code: `${coupon.code} (${coupon.discountPercent}% OFF)`, amount: amt });
    }
    setShowCouponSheet(false);
  };

  const removeCoupon = () => {
    setAppliedDiscount(null);
  };

  const applyStreakCard = () => {
    if (!discountCard) return;
    const amt = Math.round(subtotal * (DISCOUNT_CARD_PERCENT / 100));
    setAppliedDiscount({ code: `Faazio Streak (${DISCOUNT_CARD_PERCENT}% OFF)`, amount: amt });
    setShowCouponSheet(false);
  };

  const selectAddress = (id: string) => {
    setAddresses(prev => prev.map(a => ({ ...a, selected: a.id === id })));
  };

  const addNewAddress = () => {
    if (customAddress.trim() === '') return;
    const newId = `addr-${Date.now()}`;
    setAddresses((prev) => {
      const unselected = prev.map((a) => ({ ...a, selected: false }));
      return [...unselected, { id: newId, label: '\u{1F4CD} New Address', address: customAddress.trim(), selected: true, isPrimary: false }];
    });
    setCustomAddress('');
    setShowAddAddress(false);
  };

  const selectedAddressObj = addresses.find((a) => a.selected) || addresses[0];

  const pickupPointList = useMemo(
    () => getPickupPointsForItems(cartItems),
    [cartItems],
  );

  useEffect(() => {
    if (pickupPointList.some((p) => p.id === selectedPickupId)) return;
    setSelectedPickupId(pickupPointList[0]?.id ?? '');
  }, [pickupPointList, selectedPickupId]);

  const selectedPickup = pickupPointList.find((p) => p.id === selectedPickupId) ?? pickupPointList[0];

  const handlePlaceOrder = (coinsRedeemed = 0) => {
    setPaymentProcessing(true);
    setTimeout(() => {
      const redeemRupees = Math.floor(coinsRedeemed / COIN_REDEEM_RATE);
      const paidAmount = Math.max(0, finalTotal - redeemRupees);
      const coinsEarned = coinsEarnedFor(paidAmount);
      const orderId = `FZ-${Math.floor(100000 + Math.random() * 900000)}`;
      useRewardsStore.getState().recordOrder(paidAmount, coinsRedeemed, orderId);
      const isPickup = fulfillment === 'PICKUP';
      const details = {
        orderId,
        items: [...cartItems],
        subtotal,
        discount: discountAmount,
        tax,
        total: paidAmount,
        deliveryAddress: isPickup
          ? selectedPickup?.address ?? 'Pickup point'
          : selectedAddressObj
            ? selectedAddressObj.address
            : 'Default Address',
        payment: paymentMethod === 'UPI' ? `UPI (${upiId})` : paymentMethod === 'CARD' ? `Credit Card (*${cardNumber.slice(-4) || '4242'})` : 'Cash on Delivery',
        eta: isPickup ? '15 Mins' : '12-15 Mins',
        fulfillment,
        pickup: isPickup ? selectedPickup : undefined,
        coinsEarned,
        coinsRedeemed,
      };
      setPlacedOrderDetails(details);
      setCartItems([]);
      setStep('RECEIPT');
      setPaymentProcessing(false);
    }, 2000);
  };

  if (step === 'BAG') {
    return (
      <View style={styles.bagRoot}>
        <View style={[styles.bagTopBar, { paddingTop: insets.top + vs(12) }]}>
          <TouchableOpacity onPress={onBack} style={styles.bagBackBtn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.4} />
          </TouchableOpacity>
          <AppText style={styles.bagTitle}>Your Cart</AppText>
          <View style={{ width: ms(40) }} />
        </View>

        <ScrollView
          style={styles.bagScroll}
          contentContainerStyle={styles.bagScrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
          scrollEventThrottle={16}
        >
          {cartItems.length === 0 ? (
            <View style={styles.bagEmpty}>
              <Animated.View style={[styles.emptyIconCircle, { transform: [{ translateY: bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
                <ShoppingBag size={ms(22)} color="#94a3b8" />
              </Animated.View>
              <AppText style={styles.emptyTitle}>Your cart is empty</AppText>
              <AppText style={styles.emptyDesc}>
                Browse Food, Mart, Grocery, or Pharma and tap 'Add to Bag' to get started!
              </AppText>
              <TouchableOpacity onPress={() => (onGoToHub ? onGoToHub() : setActiveTab('Home'))} style={styles.goToHubBtn} activeOpacity={0.8}>
                <AppText style={styles.goToHubBtnText}>Go to Hub</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Savings & Coupon Card */}
              <View style={styles.savingsCard}>
                <View style={styles.savingsStrip}>
                  <Tag size={ms(14)} color="#118C4F" strokeWidth={2.4} />
                  <AppText style={styles.savingsText}>
                    ₹{savings} savings on this order
                  </AppText>
                </View>
                <TouchableOpacity style={styles.couponRow} onPress={() => setShowCouponSheet(true)} activeOpacity={0.7}>
                  <View style={styles.couponRowLeft}>
                    <View style={styles.couponRowTitleRow}>
                      <Ticket size={ms(16)} color="#118C4F" strokeWidth={2.2} style={{ marginRight: hs(6) }} />
                      <AppText style={styles.couponRowTitle}>Apply Coupon</AppText>
                    </View>
                    <AppText style={styles.couponRowSub} numberOfLines={1}>
                      {appliedDiscount ? `Applied: ${appliedDiscount.code}` : 'Save more with coupons available for you'}
                    </AppText>
                  </View>
                  <ChevronRight size={ms(18)} color="#118C4F" strokeWidth={2.4} />
                </TouchableOpacity>
                {appliedDiscount && (
                  <TouchableOpacity style={styles.appliedChipRow} onPress={removeCoupon} activeOpacity={0.8}>
                    <Check size={ms(12)} strokeWidth={3} color="#059669" style={{ marginRight: hs(4) }} />
                    <AppText style={styles.appliedDiscountText}>{appliedDiscount.code}</AppText>
                    <AppText style={styles.removeCouponText}>  Remove</AppText>
                  </TouchableOpacity>
                )}
              </View>

              {/* Review Items */}
              <AppText style={styles.reviewTitle}>Review Items</AppText>
              {grouped.map((group) => {
                const expanded = expandedCategories.includes(group.cat);
                const Icon = group.meta.icon;
                return (
                  <View key={group.cat} style={styles.catCard}>
                    <TouchableOpacity style={styles.catHeader} onPress={() => toggleCategory(group.cat)} activeOpacity={0.7}>
                      <View style={styles.catHeaderLeft}>
                        <View style={[styles.catIconChip, { backgroundColor: `${group.meta.color}1A` }]}>
                          <Icon size={ms(18)} color={group.meta.color} strokeWidth={2.2} />
                        </View>
                        <View>
                          <AppText style={styles.catTitle}>{group.meta.label}</AppText>
                          <AppText style={styles.catCount}>{group.items.length} item{group.items.length > 1 ? 's' : ''}</AppText>
                        </View>
                      </View>
                      <ChevronDown
                        size={ms(18)}
                        color="#118C4F"
                        strokeWidth={2.4}
                        style={expanded ? { transform: [{ rotate: '180deg' }] } : undefined}
                      />
                    </TouchableOpacity>

                    {expanded &&
                      group.items.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                          <ItemThumb item={item} />
                          <View style={styles.itemDetails}>
                            <AppText style={styles.itemName} numberOfLines={2}>{item.name}</AppText>
                            {item.qtyDesc ? <AppText style={styles.itemQtyDesc}>{item.qtyDesc}</AppText> : null}
                            <View style={styles.stepperPill}>
                              <TouchableOpacity onPress={() => updateCartQuantity(item.id, -1)} style={styles.stepperBtn} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Minus size={ms(12)} color="#118C4F" strokeWidth={2.6} />
                              </TouchableOpacity>
                              <AppText style={styles.stepperValue}>{item.quantity}</AppText>
                              <TouchableOpacity onPress={() => updateCartQuantity(item.id, 1)} style={styles.stepperBtn} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Plus size={ms(12)} color="#118C4F" strokeWidth={2.6} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={styles.itemPriceCol}>
                            {item.originalPrice != null && (
                              <AppText style={styles.itemOrigPrice}>₹{item.originalPrice.toLocaleString('en-IN')}</AppText>
                            )}
                            <AppText style={styles.itemPrice}>₹{item.price.toLocaleString('en-IN')}</AppText>
                          </View>
                        </View>
                      ))}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {cartItems.length > 0 && (
          <View style={styles.bottomBar}>
            {estimatedCoins > 0 && (
              <View style={styles.coinEstimatePill}>
                <Coins size={ms(12)} color="#B45309" strokeWidth={2.2} />
                <AppText style={styles.coinEstimateText}>You'll earn ~{estimatedCoins} coins on this order</AppText>
              </View>
            )}
            <TouchableOpacity style={styles.billBanner} onPress={() => setShowBillSheet(true)} activeOpacity={0.8}>
              <View style={styles.billBannerLeft}>
                <AppText style={styles.toPayLabel}>To Pay: </AppText>
                <AppText style={styles.toPayValue}>₹{finalTotal.toLocaleString('en-IN')}</AppText>
                <AppText style={styles.origTotal}>₹{originalTotal.toLocaleString('en-IN')}</AppText>
              </View>
              <View style={styles.billBannerRight}>
                <AppText style={styles.viewBillText}>View Detailed Bill</AppText>
                <ChevronRight size={ms(14)} color="#F97316" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addrRow} onPress={() => setStep('ADDRESS')} activeOpacity={0.7}>
              <View style={styles.addrRowLeft}>
                {fulfillment === 'PICKUP' ? (
                  <>
                    <AppText style={styles.addrLabel} numberOfLines={1}>Pickup from {selectedPickup?.name ?? 'Store'} • Ready in 15 mins</AppText>
                    <AppText style={styles.addrSub} numberOfLines={1}>{selectedPickup?.address}</AppText>
                  </>
                ) : (
                  <>
                    <AppText style={styles.addrLabel} numberOfLines={1}>Deliver to {selectedAddressObj?.label ?? 'Home'} in 10 mins</AppText>
                    <AppText style={styles.addrSub} numberOfLines={1}>{selectedAddressObj?.address}</AppText>
                  </>
                )}
              </View>
              <View style={styles.locBtn}>
                {fulfillment === 'PICKUP' ? (
                  <Store size={ms(14)} color="#F97316" strokeWidth={2.2} />
                ) : (
                  <Send size={ms(14)} color="#F97316" strokeWidth={2.2} />
                )}
                <ChevronDown size={ms(13)} color="#F97316" strokeWidth={2.4} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.proceedBtn} onPress={() => setStep('ADDRESS')} activeOpacity={0.88}>
              <AppText style={styles.proceedText}>Proceed to Pay</AppText>
            </TouchableOpacity>
          </View>
        )}

        {/* Coupon Picker Sheet */}
        <SlideUpSheet visible={showCouponSheet} onRequestClose={() => setShowCouponSheet(false)}>
          <AppText style={styles.sheetTitle}>Apply Coupon</AppText>
          <AppText style={styles.sheetSubtitle}>Choose a coupon to save more on this order</AppText>
          {streakCardActive && discountCard && (
            <TouchableOpacity
              key="streak-card"
              style={styles.couponOption}
              activeOpacity={0.7}
              onPress={applyStreakCard}
            >
              <View style={styles.couponOptionLeft}>
                <Ticket size={ms(18)} color="#7C3AED" strokeWidth={2.2} />
                <View style={styles.couponOptionText}>
                  <AppText style={styles.couponOptionCode}>Faazio Streak — {discountCard.percent}% OFF</AppText>
                  <AppText style={styles.couponOptionDesc}>
                    Valid till {new Date(discountCard.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </AppText>
                </View>
              </View>
              {appliedDiscount?.code?.startsWith('Faazio Streak') ? (
                <View style={styles.couponAppliedBadge}>
                  <AppText style={styles.couponAppliedBadgeText}>APPLIED</AppText>
                </View>
              ) : (
                <View style={styles.couponSelectCircle}>
                  <Check size={ms(12)} color="#118C4F" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          )}
          {coupons.map((coupon) => {
            const active = appliedDiscount?.code?.startsWith(coupon.code);
            return (
              <TouchableOpacity
                key={coupon.code}
                style={styles.couponOption}
                activeOpacity={0.7}
                onPress={() => applyCouponCode(coupon.code)}
              >
                <View style={styles.couponOptionLeft}>
                  <Ticket size={ms(18)} color="#118C4F" strokeWidth={2.2} />
                  <View style={styles.couponOptionText}>
                    <AppText style={styles.couponOptionCode}>{coupon.code}</AppText>
                    <AppText style={styles.couponOptionDesc} numberOfLines={1}>
                      {coupon.isFreeDelivery ? 'FREE Delivery' : `${coupon.discountPercent}% OFF`} · Min order ₹{coupon.minOrder}
                    </AppText>
                  </View>
                </View>
                {active ? (
                  <View style={styles.couponAppliedBadge}>
                    <AppText style={styles.couponAppliedBadgeText}>APPLIED</AppText>
                  </View>
                ) : (
                  <View style={styles.couponSelectCircle}>
                    <Check size={ms(12)} color="#118C4F" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {appliedDiscount && (
            <TouchableOpacity style={styles.couponRemoveAction} onPress={removeCoupon} activeOpacity={0.7}>
              <AppText style={styles.couponRemoveActionText}>Remove Coupon</AppText>
            </TouchableOpacity>
          )}
        </SlideUpSheet>

        {/* Bill Details Sheet */}
        <SlideUpSheet visible={showBillSheet} onRequestClose={() => setShowBillSheet(false)}>
          <AppText style={styles.sheetTitle}>Bill Details</AppText>
          <View style={styles.billLine}>
            <AppText style={styles.pricingLabel}>Item Total</AppText>
            <AppText style={styles.pricingValue}>₹{subtotal.toLocaleString('en-IN')}</AppText>
          </View>
          {appliedDiscount && (
            <View style={styles.billLine}>
              <AppText style={[styles.pricingLabel, { color: '#059669' }]}>Coupon Discount</AppText>
              <AppText style={[styles.pricingValue, { color: '#059669' }]}>-₹{discountAmount.toLocaleString('en-IN')}</AppText>
            </View>
          )}
          <View style={styles.billLine}>
            <AppText style={styles.pricingLabel}>GST Taxes (5%)</AppText>
            <AppText style={styles.pricingValue}>₹{tax.toLocaleString('en-IN')}</AppText>
          </View>
          <View style={styles.billLine}>
            <AppText style={styles.pricingLabel}>Delivery Charges</AppText>
            {fulfillment === 'PICKUP' ? (
              <AppText style={[styles.pricingValue, { color: '#56B821', fontWeight: '900' }]}>FREE (Self Pickup)</AppText>
            ) : deliveryFee === 0 ? (
              <AppText style={[styles.pricingValue, { color: '#56B821', fontWeight: '900' }]}>FREE (₹49 Saved)</AppText>
            ) : (
              <AppText style={styles.pricingValue}>₹{deliveryFee}</AppText>
            )}
          </View>
          <View style={[styles.billLine, styles.billTotalLine]}>
            <AppText style={styles.grandTotalLabel}>To Pay</AppText>
            <AppText style={styles.grandTotalValue}>₹{finalTotal.toLocaleString('en-IN')}</AppText>
          </View>
        </SlideUpSheet>
      </View>
    );
  }

  if (step === 'ADDRESS') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingTop: contentInset }]} showsVerticalScrollIndicator={false}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={16}>
        <View style={styles.cardBox}>
          <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: vs(10) }]}>
            <TouchableOpacity onPress={() => setStep('BAG')} style={styles.backBtn} activeOpacity={0.8}>
              <ChevronLeft size={ms(12)} color="#94a3b8" />
              <AppText style={styles.backBtnText}>Back</AppText>
            </TouchableOpacity>
            <AppText style={styles.headerTitleCenter}>
              {fulfillment === 'PICKUP' ? 'Select Pickup Point' : 'Select Delivery Address'}
            </AppText>
            <View style={{ width: hs(40) }} />
          </View>

          {/* Deliver / Self-Pickup toggle */}
          <View style={styles.fulfillmentToggle}>
            <TouchableOpacity
              onPress={() => setFulfillment('DELIVERY')}
              style={[styles.fulfillmentToggleOption, fulfillment !== 'PICKUP' && styles.fulfillmentToggleOptionActive]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: fulfillment === 'DELIVERY' }}
            >
              <Send size={ms(14)} color={fulfillment === 'PICKUP' ? '#6B7280' : '#ffffff'} strokeWidth={2.2} />
              <AppText style={[styles.fulfillmentToggleText, fulfillment !== 'PICKUP' && styles.fulfillmentToggleTextActive]}>
                Deliver
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFulfillment('PICKUP')}
              style={[styles.fulfillmentToggleOption, fulfillment === 'PICKUP' && styles.fulfillmentToggleOptionActive]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: fulfillment === 'PICKUP' }}
            >
              <Store size={ms(14)} color={fulfillment === 'PICKUP' ? '#ffffff' : '#6B7280'} strokeWidth={2.2} />
              <AppText style={[styles.fulfillmentToggleText, fulfillment === 'PICKUP' && styles.fulfillmentToggleTextActive]}>
                Self Pickup
              </AppText>
            </TouchableOpacity>
          </View>

          {fulfillment === 'PICKUP' ? (
            /* Pickup Point List — one per distinct store in the cart */
            <View style={styles.addressList}>
              {pickupPointList.map((point) => {
                const isSelected = point.id === selectedPickupId;
                return (
                  <TouchableOpacity
                    key={point.id}
                    onPress={() => setSelectedPickupId(point.id)}
                    style={[
                      styles.addressCard,
                      isSelected ? { borderColor: '#0f172a', backgroundColor: '#f8fafc', shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 } : null,
                    ]}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.addressCardIconCircle, isSelected ? { backgroundColor: '#0f172a' } : null]}>
                      <Store size={ms(14)} color={isSelected ? '#ffffff' : '#64748b'} />
                    </View>
                    <View style={styles.addressCardDetails}>
                      <AppText style={styles.addressCardLabel}>{point.name}</AppText>
                      <AppText style={styles.addressCardText}>{point.address}</AppText>
                      <AppText style={styles.addressCardText}>Open {point.hours}</AppText>
                    </View>
                    {isSelected && (
                      <View style={styles.addressSelectMarker}>
                        <AppText style={styles.addressSelectMarkerText}>✓</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <View style={styles.pickupContactRow}>
                <AppText style={styles.pickupContactLabel}>Pickup contact: </AppText>
                <AppText style={styles.pickupContactValue}>{userProfile.phone}</AppText>
              </View>
            </View>
          ) : (
            <>
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
                      <AppText style={styles.addressCardLabel}>{`${addresses.indexOf(addr) === 0 ? '\u{1F3E0}' : '\u{1F3E2}'} ${addr.label}${addr.isPrimary ? ' (Primary)' : ''}`}</AppText>
                      <AppText style={styles.addressCardText}>{addr.address}</AppText>
                    </View>

                    {addr.selected && (
                      <View style={styles.addressSelectMarker}>
                        <AppText style={styles.addressSelectMarkerText}>✓</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Add custom Address Form */}
              {showAddAddress ? (
                <View style={styles.customAddressForm}>
                  <AppText style={styles.sectionLabel}>Type Custom Address</AppText>
                  <AppTextInput
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
                      <AppText style={styles.customAddressCancelText}>Cancel</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={addNewAddress} style={styles.customAddressSave} activeOpacity={0.8}>
                      <AppText style={styles.customAddressSaveText}>Save Address</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowAddAddress(true)} style={styles.addAddressDashedBtn} activeOpacity={0.8}>
                  <AppText style={styles.addAddressDashedBtnText}>+ Add Delivery Location</AppText>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Proceed to Payment Button */}
          <TouchableOpacity onPress={() => setStep('PAYMENT')} style={[styles.mainActionBtn, { marginTop: vs(24) }]} activeOpacity={0.8}>
            <AppText style={styles.mainActionBtnText}>Proceed to Payment</AppText>
            <ArrowRight size={ms(13)} color="#ffffff" style={{ marginLeft: hs(6) }} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (step === 'PAYMENT') {
    const itemCount = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);
    return (
      <View style={styles.paymentRoot}>
        <PaymentOptionsScreen
          itemCount={itemCount}
          total={finalTotal}
          deliveryAddress={{
            label: selectedAddressObj?.label ?? 'Home',
            address: selectedAddressObj?.address ?? '',
          }}
          originLabel="Instamart"
          fulfillment={fulfillment}
          pickup={selectedPickup}
          onBack={() => setStep('ADDRESS')}
          onPlaceOrder={handlePlaceOrder}
        />
      </View>
    );
  }

  // RECEIPT VIEW
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingTop: contentInset }]} showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}>
      <View style={styles.cardBox}>
        {/* Receipt Success */}
        <View style={styles.receiptHeader}>
          <View style={styles.receiptCheckCircle}>
            <CheckCircle size={ms(24)} color="#56B821" strokeWidth={2.5} />
          </View>
          <AppText style={styles.receiptTitle}>Order Confirmed!</AppText>
          <AppText style={styles.receiptOrderId}>ID: {placedOrderDetails?.orderId}</AppText>
        </View>

        {/* Live Delivery/Pickup status steps */}
        {placedOrderDetails?.fulfillment === 'PICKUP' ? (
          <View style={styles.liveTrackingBox}>
            <View style={styles.liveTrackingHeader}>
              <View style={styles.liveTrackingHeaderLeft}>
                <Animated.View style={{ opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }}>
                  <Store size={ms(10)} color="#475569" style={{ marginRight: hs(4) }} />
                </Animated.View>
                <AppText style={styles.liveTrackingLabel}>Pickup Status</AppText>
              </View>
              <View style={styles.etaBadge}>
                <AppText style={styles.etaBadgeText}>Ready in {placedOrderDetails?.eta}</AppText>
              </View>
            </View>

            <View style={styles.liveStepsContainer}>
              <View style={styles.liveStepRow}>
                <View style={styles.liveStepConnectorLine} />
                <View style={styles.liveStepDotOuter}>
                  <View style={styles.liveStepActiveDot} />
                </View>
                <View style={styles.liveStepTextCol}>
                  <AppText style={styles.liveStepTitle}>Order Packed</AppText>
                  <AppText style={styles.liveStepDesc}>Packed and ready at {placedOrderDetails?.pickup?.name}</AppText>
                </View>
              </View>

              <View style={[styles.liveStepRow, { marginBottom: 0 }]}>
                <View style={styles.liveStepDotOuter}>
                  <Animated.View style={[styles.liveStepActiveDotPulse, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }]} />
                </View>
                <View style={styles.liveStepTextCol}>
                  <AppText style={styles.liveStepTitle}>Ready for pickup</AppText>
                  <AppText style={styles.liveStepDesc}>Show your order ID {placedOrderDetails?.orderId} at the counter</AppText>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.liveTrackingBox}>
            <View style={styles.liveTrackingHeader}>
              <View style={styles.liveTrackingHeaderLeft}>
                <Animated.View style={{ opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }}>
                  <Truck size={ms(10)} color="#475569" style={{ marginRight: hs(4) }} />
                </Animated.View>
                <AppText style={styles.liveTrackingLabel}>Real-Time Tracking Status</AppText>
              </View>
              <View style={styles.etaBadge}>
                <AppText style={styles.etaBadgeText}>Arriving in {placedOrderDetails?.eta}</AppText>
              </View>
            </View>

            <View style={styles.liveStepsContainer}>
              <View style={styles.liveStepRow}>
                <View style={styles.liveStepConnectorLine} />
                <View style={styles.liveStepDotOuter}>
                  <View style={styles.liveStepActiveDot} />
                </View>
                <View style={styles.liveStepTextCol}>
                  <AppText style={styles.liveStepTitle}>Order Accepted by Hub</AppText>
                  <AppText style={styles.liveStepDesc}>Confirmed at local Faazio distribution centre</AppText>
                </View>
              </View>

              <View style={[styles.liveStepRow, { marginBottom: 0 }]}>
                <View style={styles.liveStepDotOuter}>
                  <Animated.View style={[styles.liveStepActiveDotPulse, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }]} />
                </View>
                <View style={styles.liveStepTextCol}>
                  <AppText style={styles.liveStepTitle}>Rider Assigning...</AppText>
                  <AppText style={styles.liveStepDesc}>Simulated delivery executive moving to pick location</AppText>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Purchased list */}
        <View style={styles.purchasedItemsSection}>
          <AppText style={styles.sectionLabel}>Items Purchased</AppText>
          <View style={styles.purchasedItemsList}>
            {placedOrderDetails?.items.map((item) => (
              <View key={item.id} style={styles.purchasedItemRow}>
                <View style={styles.purchasedItemLeft}>
                  <EnterpriseIcon emoji={item.emoji} variant="flat" size={ms(10)} />
                  <AppText style={styles.purchasedItemName} numberOfLines={1}>
                    {item.name} <AppText style={{ color: '#94a3b8', fontWeight: 'bold' }}>x {item.quantity}</AppText>
                  </AppText>
                </View>
                <AppText style={styles.purchasedItemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</AppText>
              </View>
            ))}
          </View>
        </View>

        {/* FaazioCoins earned / used */}
        {(placedOrderDetails?.coinsEarned ?? 0) > 0 || (placedOrderDetails?.coinsRedeemed ?? 0) > 0 ? (
          <View style={styles.receiptRewardsSection}>
            <AppText style={styles.sectionLabel}>FaazioCoins</AppText>
            {placedOrderDetails && placedOrderDetails.coinsEarned > 0 && (
              <View style={styles.receiptRewardsRow}>
                <AppText style={styles.receiptRewardsLabel}>Coins earned</AppText>
                <AppText style={styles.receiptRewardsEarn}>+{placedOrderDetails.coinsEarned}</AppText>
              </View>
            )}
            {placedOrderDetails && placedOrderDetails.coinsRedeemed > 0 && (
              <View style={styles.receiptRewardsRow}>
                <AppText style={styles.receiptRewardsLabel}>Coins used</AppText>
                <AppText style={styles.receiptRewardsRedeem}>−{placedOrderDetails.coinsRedeemed}</AppText>
              </View>
            )}
          </View>
        ) : null}

        {/* Delivering to / Pickup from location */}
        <View style={styles.deliveryLocationSection}>
          <AppText style={styles.sectionLabel}>
            {placedOrderDetails?.fulfillment === 'PICKUP' ? 'Pickup From' : 'Delivering To'}
          </AppText>
          <AppText style={styles.deliveryLocationAddress}>{placedOrderDetails?.deliveryAddress}</AppText>
          {placedOrderDetails?.fulfillment === 'PICKUP' ? (
            <View style={styles.pickupContactRow}>
              <AppText style={styles.pickupContactLabel}>Contact phone: </AppText>
              <AppText style={styles.pickupContactValue}>{userProfile.phone}</AppText>
            </View>
          ) : null}
        </View>

        {/* Payment info info */}
        <View style={styles.receiptPaymentDetails}>
          <AppText style={styles.paymentProtocolLabel}>Payment Protocol:</AppText>
          <AppText style={styles.paymentProtocolValue}>{placedOrderDetails?.payment}</AppText>
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
            <AppText style={styles.receiptNewOrderBtnText}>New Order</AppText>
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
            <AppText style={styles.receiptGoToHubBtnText}>Go to Hub</AppText>
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
  paymentRoot: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
  fulfillmentToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: ms(12),
    padding: vs(4),
    marginTop: vs(4),
  },
  fulfillmentToggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    paddingVertical: vs(9),
    borderRadius: ms(9),
  },
  fulfillmentToggleOptionActive: {
    backgroundColor: '#0f172a',
  },
  fulfillmentToggleText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#6B7280',
  },
  fulfillmentToggleTextActive: {
    color: '#ffffff',
  },
  pickupContactRow: {
    flexDirection: 'row',
    marginTop: vs(6),
  },
  pickupContactLabel: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#6B7280',
  },
  pickupContactValue: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#0f172a',
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
  receiptRewardsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(10),
  },
  receiptRewardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(3),
  },
  receiptRewardsLabel: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#64748b',
  },
  receiptRewardsEarn: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#7C3AED',
  },
  receiptRewardsRedeem: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#D97706',
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
  // ---- New "Your Cart" (BAG) UI styles ----
  bagRoot: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  bagTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
    backgroundColor: '#FFFFFF',
  },
  bagBackBtn: {
    width: ms(32),
    height: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagTitle: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#1E2022',
    marginLeft: hs(12),
  },
  bagScroll: {
    flex: 1,
  },
  bagScrollContent: {
    paddingHorizontal: hs(16),
    paddingTop: vs(16),
    paddingBottom: vs(24),
  },
  bagEmpty: {
    alignItems: 'center',
    paddingVertical: vs(60),
  },
  emptyIconCircle: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
  },
  emptyTitle: {
    fontSize: ms(15),
    fontWeight: '900',
    color: '#1E2022',
  },
  emptyDesc: {
    fontSize: ms(11),
    color: '#666666',
    textAlign: 'center',
    lineHeight: vs(16),
    marginTop: vs(8),
    paddingHorizontal: hs(20),
  },
  goToHubBtn: {
    marginTop: vs(20),
    height: Math.max(44, vs(44)),
    borderRadius: ms(12),
    paddingHorizontal: hs(24),
    backgroundColor: '#118C4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goToHubBtnText: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#ffffff',
  },
  savingsCard: {
    marginBottom: vs(4),
    borderRadius: ms(16),
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  savingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D8F3E5',
    padding: 12,
    gap: hs(8),
  },
  savingsText: {
    fontSize: ms(11.5),
    fontWeight: '700',
    color: '#118C4F',
    flex: 1,
  },
  couponRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: hs(16),
  },
  couponRowLeft: {
    flex: 1,
    marginRight: hs(12),
  },
  couponRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponRowTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#1E2022',
  },
  couponRowSub: {
    fontSize: ms(10.5),
    color: '#666666',
    marginTop: vs(4),
  },
  appliedChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
  },
  appliedDiscountText: {
    fontSize: ms(10.5),
    fontWeight: '800',
    color: '#059669',
  },
  removeCouponText: {
    fontSize: ms(10.5),
    fontWeight: '800',
    color: '#ef4444',
  },
  reviewTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#1E2022',
    marginTop: vs(20),
    marginBottom: vs(12),
  },
  catCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    padding: hs(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: vs(12),
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(16),
  },
  catHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconChip: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(10),
  },
  catTitle: {
    fontSize: ms(13.5),
    fontWeight: '900',
    color: '#1E2022',
  },
  catCount: {
    fontSize: ms(10.5),
    color: '#666666',
    marginTop: vs(2),
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(8),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemThumb: {
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  itemDetails: {
    flex: 1,
    paddingLeft: hs(12),
    marginRight: hs(8),
  },
  itemName: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#1E2022',
  },
  itemQtyDesc: {
    fontSize: ms(11),
    color: '#666666',
    marginTop: vs(2),
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: ms(8),
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
    marginTop: vs(8),
    alignSelf: 'flex-start',
  },
  stepperBtn: {
    width: ms(20),
    height: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#1E2022',
    marginHorizontal: hs(8),
  },
  itemPriceCol: {
    alignItems: 'flex-end',
    paddingLeft: hs(12),
  },
  itemOrigPrice: {
    fontSize: ms(10.5),
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  itemPrice: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#1E2022',
    marginTop: vs(2),
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    paddingBottom: vs(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  coinEstimatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: ms(8),
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
    marginBottom: vs(8),
    gap: hs(4),
  },
  coinEstimateText: {
    fontSize: ms(10.5),
    fontWeight: '800',
    color: '#92400E',
  },
  billBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF6E5',
    padding: hs(10),
    borderRadius: ms(8),
    marginBottom: vs(12),
  },
  billBannerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  billBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toPayLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#1E2022',
  },
  toPayValue: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#1E2022',
  },
  origTotal: {
    fontSize: ms(11),
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginLeft: hs(6),
  },
  viewBillText: {
    fontSize: ms(10.5),
    fontWeight: '800',
    color: '#F97316',
  },
  addrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  addrRowLeft: {
    flex: 1,
    marginRight: hs(10),
  },
  addrLabel: {
    fontSize: ms(12.5),
    fontWeight: '800',
    color: '#1E2022',
  },
  addrSub: {
    fontSize: ms(10.5),
    color: '#666666',
    marginTop: vs(2),
  },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDE8',
    borderRadius: ms(8),
    paddingHorizontal: hs(10),
    paddingVertical: vs(8),
    gap: hs(4),
  },
  proceedBtn: {
    height: Math.max(48, vs(48)),
    borderRadius: ms(12),
    backgroundColor: '#118C4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedText: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#ffffff',
  },
  sheetTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#1E2022',
  },
  sheetSubtitle: {
    fontSize: ms(11),
    color: '#666666',
    marginTop: vs(4),
    marginBottom: vs(16),
  },
  couponOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(12),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: ms(12),
    paddingHorizontal: hs(12),
    marginBottom: vs(10),
  },
  couponOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  couponOptionText: {
    marginLeft: hs(10),
    flex: 1,
  },
  couponOptionCode: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#1E2022',
  },
  couponOptionDesc: {
    fontSize: ms(10.5),
    color: '#666666',
    marginTop: vs(2),
  },
  couponAppliedBadge: {
    backgroundColor: '#D8F3E5',
    borderRadius: ms(6),
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
  },
  couponAppliedBadgeText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#118C4F',
  },
  couponSelectCircle: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    borderWidth: 1.5,
    borderColor: '#118C4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponRemoveAction: {
    alignItems: 'center',
    paddingVertical: vs(12),
    marginTop: vs(4),
  },
  couponRemoveActionText: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#ef4444',
  },
  billLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: vs(8),
  },
  billTotalLine: {
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    marginTop: vs(6),
    paddingTop: vs(12),
  },
});
