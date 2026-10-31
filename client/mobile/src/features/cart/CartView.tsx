import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Animated, Image, Alert } from 'react-native';
import {
  ArrowLeft,
  ShoppingBag,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  Ticket,
  Tag,
  Send,
  CheckCircle,
  Check,
  Store,
  Coins,
  Trash2,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EnterpriseIcon from '@/components/EnterpriseIcon';
import Checkbox from '@/components/shared/Checkbox';
import type { CartItem, CartCategory } from '@/state/cartStore';
import { getPickupPointsForItems, getStoreIdsForItems } from '@data/cart/pickup-resolver';
import type { Coupon, FulfillmentMode, PickupPoint, SavedAddress } from '@data/types';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import PaymentOptionsScreen from '@/features/cart/payment/PaymentOptionsScreen';
import type { PlaceOrderPayload } from '@/features/cart/payment/PaymentOptionsScreen';
import PaymentStatusScreen from '@/features/cart/payment/PaymentStatusScreen';
import PaymentFailedScreen from '@/features/cart/payment/PaymentFailedScreen';
import { buildUpiIntent, launchUpiPayment } from '@/features/cart/payment/UpiIntent';
import { detectUpiApps, type UpiApp } from '@/services/upi';
import BreakdownCard from '@/features/cart/payment/components/BreakdownCard';
import { computeTotals, estimateDeliveryBreakdown, DELIVERY_FEE_BASE_KM, DEFAULT_DELIVERY_FEE_PAISA } from './utils';
import type { CheckoutStep, DeliveryFeeBreakdown } from './utils';
import { haversineKm } from '@/utils/distance';
import { getStoreById } from '@data/directory/stores';
import type { RootStackParamList } from '@/navigation/types';
import { useRewardsStore } from '@/state/rewardsStore';
import { useOrdersStore } from '@/state/ordersStore';
import { useCartStore } from '@/state/cartStore';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';
import type { RazorpayOrderResult } from '@/services/api/GatewayClient';
import { clearUpiOrderPending, markUpiOrderPending } from '@/services/paymentReconciliation';
import { consumeLastClickedSlotId } from '@/services/adsAttribution';
import { coinsEarnedFor, isCardActive } from '@/features/rewards/rewardsLogic';
import { COIN_REDEEM_RATE, DISCOUNT_CARD_PERCENT } from '@data/rewards/rewards';
import { useLiveAddress } from '@/hooks/useLiveAddress';
import { useAuthStore } from '@/state/authStore';

const CATEGORY_META: Record<CartCategory, { label: string }> = {
  MART: { label: 'Mart' },
  FOOD: { label: 'Food' },
  PHARMA: { label: 'Pharma' },
};

const CATEGORY_ORDER: CartCategory[] = ['MART', 'FOOD', 'PHARMA'];

const inferCategory = (itemId: string): CartCategory => {
  const id = itemId.toLowerCase();
  if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) return 'PHARMA';
  if (id.startsWith('fm-') || id.startsWith('gr-') || id.includes('mart') || id.includes('grocery') || id.startsWith('cat-mt') || id.startsWith('cat-mf') || id.startsWith('cat-gr') || id.startsWith('cat-fb')) return 'MART';
  return 'FOOD';
};

/** Human copy for the server's machine reason code on an invalid coupon. */
const couponErrorMessage = (reason: string): string => {
  switch (reason) {
    case 'not_found':
      return 'That coupon code was not found.';
    case 'inactive':
      return 'This coupon is no longer available.';
    case 'expired':
      return 'This coupon has expired.';
    case 'wrong_sector':
      return 'This coupon is not valid for the items in your cart.';
    case 'wrong_state':
      return 'This coupon is not available in your location.';
    case 'min_order':
      return 'Your order does not meet this coupon\u2019s minimum value.';
    default:
      return 'This coupon cannot be applied.';
  }
};

function ItemThumb({ item, size = 64 }: { item: CartItem; size?: number }) {
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
  onTrackOrder?: (orderId: string) => void;
  /** Restaurant-isolated cart mode (from a restaurant page). */
  restaurantName?: string;
  /** Coupon code handed off from an offer banner — auto-applied (validated) once loaded. */
  initialCouponCode?: string;
  /** Scoped-only: clear this restaurant's lines. */
  onClearItems?: () => void;
  /** Scoped-only: remove a single line. */
  onDeleteItem?: (itemId: string) => void;
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
  onTrackOrder,
  restaurantName,
  initialCouponCode,
  onClearItems,
  onDeleteItem,
}: CartViewProps) {
  const [step, setStep] = useState<CheckoutStep>('BAG');
  const [fulfillment, setFulfillment] = useState<FulfillmentMode | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
    /** A FREE-Delivery coupon's value is the live delivery fee, not a frozen amount. */
    freeDelivery?: boolean;
  } | null>(null);
  // The raw code (without the display suffix) the server re-validates + settles at placement.
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<CartCategory[]>(CATEGORY_ORDER);
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  // Coupon list is server-owned (GET /coupons). An authoritative empty list is a real empty — the
  // sheet never falls back to the retired fixtures when the gateway answers.
  const [couponList, setCouponList] = useState<Coupon[]>([]);

  useEffect(() => {
    let cancelled = false;
    void gateway
      .getCoupons()
      .then((list) => {
        if (cancelled) return;
        setCouponList(
          list.map((c) => ({
            code: c.code,
            discountPercent: c.valuePercent,
            label: c.title || c.code,
            minOrder: c.minOrder,
            isFreeDelivery: c.freeDelivery,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setCouponList([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Checkout must reference one of the caller's durable addresses. Fixture ids belong to the demo
  // user, so submitting them makes the server reject the order with `invalid_address`.
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  // Refetch on focus so an address added/edited on the SavedAddresses screen is picked up.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void gateway
        .getAddresses()
        .then((rows) => {
          if (!cancelled) setSavedAddresses(rows);
        })
        .catch(() => {
          if (!cancelled) setSavedAddresses([]);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const discountCard = useRewardsStore((s) => s.discountCard);
  const streakCardActive = discountCard ? isCardActive(discountCard, new Date()) : false;
  const insets = useSafeAreaInsets();

  const liveAddress = useLiveAddress(fulfillment === 'DELIVERY');
  // Only a resolved fix is persisted for auto-dispatch; idle/loading/denied keeps the 0,0 sentinel.
  const hasLiveFix = liveAddress.status === 'ready' && liveAddress.lat !== 0 && liveAddress.lng !== 0;
  const savedAddress = savedAddresses.find((a) => a.isDefault === true) ?? savedAddresses[0];
  const deliveryAddress = liveAddress?.address
    ? { label: 'Current location', address: liveAddress.address }
    : savedAddress
      ? {
          label:
            savedAddress.tag === 'HOME' ? 'Home' : savedAddress.tag === 'WORK' ? 'Work' : 'Saved address',
          address: savedAddress.address,
        }
      : { label: 'Delivery address', address: '' };
  const accountPhone = useAuthStore((s) => s.user?.phone);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  // In-flight UPI attempt (order already placed): drives the status/failed screens and retry.
  const [paymentAttempt, setPaymentAttempt] = useState<{
    orderId: string;
    amountPaisa: number;
    upiAppId: string;
    upiLabel: string;
    coinsRedeemed: number;
  } | null>(null);
  const [retryingPayment, setRetryingPayment] = useState(false);
  // True when the last UPI attempt failed by poll timeout (vs an explicit FAILED webhook).
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  // Detected UPI apps, offered on the failure screen to retry with a different app.
  const [installedUpiApps, setInstalledUpiApps] = useState<UpiApp[]>([]);
  useEffect(() => {
    let cancelled = false;
    void detectUpiApps().then((apps) => {
      if (!cancelled) setInstalledUpiApps(apps.filter((a) => a.installed));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // One key per checkout attempt: a retry after a lost response must not create a second order.
  const idempotencyKeyRef = useRef<string | null>(null);
  /** Server-authoritative delivery-fee quote (road distance); falls back to a Haversine estimate. */
  const [deliveryFeeQuote, setDeliveryFeeQuote] = useState<DeliveryFeeBreakdown | null>(null);

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
    pickups?: PickupPoint[];
    location?: { lat: number; lng: number };
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

  // FREE-Delivery coupons discount the *current* delivery fee (base + extra + any active surge), not
  // the fee that happened to be showing when the code was applied; a quote arriving later must
  // still be fully waived.
  const deliveryFeePaisaForDiscount =
    (fulfillment ?? 'DELIVERY') === 'PICKUP'
      ? 0
      : deliveryFeeQuote?.feePaisa ?? DEFAULT_DELIVERY_FEE_PAISA;
  const discountAmount = appliedDiscount
    ? appliedDiscount.freeDelivery
      ? deliveryFeePaisaForDiscount / 100
      : appliedDiscount.amount
    : 0;
  const selectedItems = useMemo(
    () => cartItems.filter((i) => !deselectedIds.has(i.id)),
    [cartItems, deselectedIds],
  );
  const storeIdsForQuote = useMemo(() => getStoreIdsForItems(selectedItems), [selectedItems]);
  const { subtotal, deliveryFee, tax, finalTotal } = computeTotals(
    selectedItems,
    discountAmount,
    fulfillment ?? 'DELIVERY',
    deliveryFeeQuote?.feePaisa,
  );
  const estimatedCoins = coinsEarnedFor(finalTotal);
  const originalTotal = selectedItems.reduce(
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

  const handleClearItems = () => {
    onClearItems?.();
    setDeselectedIds(new Set());
  };

  const handleDeleteItem = (id: string) => {
    onDeleteItem?.(id);
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const applyCouponCode = (code: string) => {
    const normalized = code.toUpperCase().trim();
    const coupon = couponList.find((c) => c.code === normalized);
    if (!coupon) return;
    setCouponError(null);
    // Server is the discount authority: validate the code against the cart before applying. The
    // figure shown is the server's (fixture-validated offline), never client-computed % math.
    const cats = new Set(selectedItems.map(getCatForItem));
    const app = cats.size === 1 ? [...cats][0] : undefined;
    void gateway
      .validateCoupon({ code: normalized, app, subtotal })
      .then((v) => {
        if (!v.valid) {
          setCouponError(couponErrorMessage(v.reason));
          return;
        }
        if (v.freeDelivery) {
          // Value is resolved from the live quote in `discountAmount`; 0 here is a placeholder.
          setAppliedDiscount({ code: `${normalized} (FREE Delivery)`, amount: 0, freeDelivery: true });
        } else {
          setAppliedDiscount({ code: `${normalized} (${v.valuePercent}% OFF)`, amount: v.discount });
        }
        setAppliedCouponCode(normalized);
        setShowCouponSheet(false);
      })
      .catch(() => setCouponError('Could not validate this coupon. Please try again.'));
  };

  const removeCoupon = () => {
    setAppliedDiscount(null);
    setAppliedCouponCode(null);
    setCouponError(null);
  };

  // Banner → cart hand-off: the restaurant offer banner passes its coupon code so the displayed
  // promise is honoured (and validated) instead of the shopper re-typing it. Apply once the coupon
  // list contains the code (server list loads async); an invalid/min-order code surfaces the same
  // inline error a manual entry would. Runs once.
  const prefilledCouponRef = useRef(false);
  useEffect(() => {
    if (prefilledCouponRef.current || !initialCouponCode) return;
    const code = initialCouponCode.toUpperCase().trim();
    if (!couponList.some((c) => c.code === code)) return; // wait for the server/fixture list
    prefilledCouponRef.current = true;
    applyCouponCode(code);
  }, [initialCouponCode, couponList, applyCouponCode]);

  const applyStreakCard = () => {
    if (!discountCard) return;
    const amt = Math.round(subtotal * (DISCOUNT_CARD_PERCENT / 100));
    setAppliedDiscount({ code: `Faazio Streak (${DISCOUNT_CARD_PERCENT}% OFF)`, amount: amt });
    setAppliedCouponCode(null);
    setShowCouponSheet(false);
  };

  const pickupPointList = useMemo(
    () => getPickupPointsForItems(selectedItems),
    [selectedItems],
  );

  // Server-authoritative delivery fee (road distance). Refetched on the FULFILLMENT step; kept once
  // fetched so the PAYMENT step shows the same figure the server will charge. A multi-store cart
  // quotes every pinned store and keeps the furthest one — settlement charges that same worst case.
  // Falls back to a Haversine + client-formula estimate (honest) when the gateway is unreachable.
  useEffect(() => {
    if (fulfillment !== 'DELIVERY') {
      setDeliveryFeeQuote(null);
      return;
    }
    if (step !== 'FULFILLMENT' && step !== 'PAYMENT') return;
    if (!hasLiveFix || storeIdsForQuote.length === 0) {
      setDeliveryFeeQuote(null);
      return;
    }
    let cancelled = false;
    const furthest = (quotes: DeliveryFeeBreakdown[]) =>
      quotes.reduce<DeliveryFeeBreakdown | null>(
        (max, q) => (max && max.totalPaisa >= q.totalPaisa ? max : q),
        null,
      );
    void (async () => {
      try {
        const quotes = await Promise.all(
          storeIdsForQuote.map((storeId) =>
            gateway.fetchDeliveryFee(storeId, liveAddress.lat, liveAddress.lng),
          ),
        );
        const quote = furthest(quotes);
        if (!cancelled && quote) setDeliveryFeeQuote(quote);
      } catch {
        // Honest estimate: the furthest pinned store's great-circle distance × the client formula.
        const km = storeIdsForQuote.reduce((maxKm, storeId) => {
          const store = getStoreById(storeId);
          if (
            !store ||
            typeof store.latitude !== 'number' ||
            typeof store.longitude !== 'number'
          ) {
            return maxKm;
          }
          return Math.max(
            maxKm,
            haversineKm(
              { latitude: liveAddress.lat, longitude: liveAddress.lng },
              { latitude: store.latitude, longitude: store.longitude },
            ),
          );
        }, DELIVERY_FEE_BASE_KM);
        if (!cancelled) {
          setDeliveryFeeQuote(estimateDeliveryBreakdown(km));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, fulfillment, hasLiveFix, storeIdsForQuote, liveAddress.lat, liveAddress.lng]);

  const handlePlaceOrder = (payload?: PlaceOrderPayload) => {
    const { method = 'COD', upiAppId, upiLabel, coinsRedeemed = 0 } = payload ?? {};
    setPaymentProcessing(true);
    void (async () => {
      try {
        const redeemRupees = Math.floor(coinsRedeemed / COIN_REDEEM_RATE);
        const paidAmount = Math.max(0, finalTotal - redeemRupees);
        const coinsEarned = coinsEarnedFor(paidAmount);
        const isPickup = fulfillment === 'PICKUP';
        const mode = fulfillment ?? 'DELIVERY';
        const pickups = isPickup ? pickupPointList : [];
        const primaryPickup = pickups[0];
        // Only a durable server address id is safe to submit; pickup carries no address.
        const addressId = isPickup ? undefined : savedAddress?.id || undefined;
        const idempotencyKey =
          idempotencyKeyRef.current ??
          (idempotencyKeyRef.current = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

        // Server is the money/stock authority: it prices, decrements stock and holds the idempotency
        // lock, returning the durable order id. In mock mode this resolves to a local order of the
        // same shape (the withFallback seam keeps checkout working offline). The coupon is re-validated
        // and settled server-side; the applied discount in the UI is display-only.
        const attributedSlotId = consumeLastClickedSlotId();
        const placed = await gateway.placeOrder({
          items: selectedItems.map((i) => ({ productId: i.id, qty: i.quantity })),
          ...(addressId ? { addressId } : {}),
          fulfillment: mode,
          paymentMethod: method,
          idempotencyKey,
          ...(appliedCouponCode ? { couponCode: appliedCouponCode } : {}),
          ...(attributedSlotId ? { attribution: { slotId: attributedSlotId } } : {}),
          ...(!isPickup && hasLiveFix
            ? { deliveryLocation: { latitude: liveAddress.lat, longitude: liveAddress.lng } }
            : {}),
          ...(primaryPickup
            ? { pickup: { name: primaryPickup.name, address: primaryPickup.address } }
            : {}),
          ...(pickups.length
            ? {
                pickups: pickups.map((p) => ({
                  name: p.name,
                  address: p.address,
                  hours: p.hours,
                  phone: p.phone,
                })),
              }
            : {}),
          ...(coinsRedeemed > 0 ? { coinsRedeemed } : {}),
        });
        const orderId = placed.id;

        // Server order is authoritative: adopt its id/status instead of a local Date.now() placeholder.
        useOrdersStore.getState().recordServerOrder(placed);
        // Coins are earned inside the order transaction server-side — refresh the ledger, never
        // write a local balance the server did not confirm.
        void useRewardsStore.getState().reconcile().catch(() => {});

        // The order already took the stock; drop the purchased lines from the durable server cart.
        // If any delete fails, re-pull the server cart so the device never hides a line the server
        // still holds (the next cart view must be honest, even if that means re-showing a line).
        const removals = await Promise.allSettled(
          selectedItems.map((i) => gateway.removeCartItem(i.id)),
        );
        if (removals.some((r) => r.status === 'rejected')) {
          void useCartStore.getState().hydrate().catch(() => {});
        }
        // Behavior analytics (ID-only, allowlisted) — the outbox is best-effort.
        selectedItems.forEach((i) => void gateway.trackEvent(i.id, 'order').catch(() => {}));

        const details = {
          orderId,
          items: [...selectedItems],
          subtotal,
          discount: discountAmount,
          tax,
          total: paidAmount,
          deliveryAddress: isPickup
            ? primaryPickup?.address ?? 'Pickup point'
            : deliveryAddress.address,
          payment:
            method === 'UPI'
              ? `UPI (${upiLabel ?? 'UPI'})`
              : 'Cash on Delivery',
          eta: isPickup ? '15 Mins' : '12-15 Mins',
          fulfillment: mode,
          pickup: primaryPickup,
          pickups,
          location: hasLiveFix ? { lat: liveAddress.lat, lng: liveAddress.lng } : undefined,
          coinsEarned,
          coinsRedeemed,
        };
        setPlacedOrderDetails(details);
        setCartItems(cartItems.filter((i) => deselectedIds.has(i.id)));
        setDeselectedIds(new Set());
        idempotencyKeyRef.current = null;

        // COD collects at delivery → straight to the receipt.
        if (method === 'COD') {
          setStep('RECEIPT');
          return;
        }

        // UPI: create the Razorpay order that the intent `tr` param + webhook reconcile on, then
        // hand off to the detected UPI app. The server is authoritative: a freshly created order is
        // PENDING; PAID/FAILED only arrive as real server states (e.g. an idempotent re-request after
        // the webhook already reconciled). There is no client-side mock PAID path.
        let rzp: RazorpayOrderResult;
        try {
          rzp = await gateway.createRazorpayOrder(orderId);
        } catch {
          setPaymentAttempt({
            orderId,
            amountPaisa: paidAmount * 100,
            upiAppId: upiAppId ?? '',
            upiLabel: upiLabel ?? 'UPI',
            coinsRedeemed,
          });
          setStep('PAYMENT_FAILED');
          return;
        }
        if (rzp.status === 'PAID') {
          await clearUpiOrderPending();
          setStep('RECEIPT');
          return;
        }
        if (rzp.status === 'FAILED') {
          setPaymentAttempt({
            orderId,
            amountPaisa: rzp.amountPaisa,
            upiAppId: upiAppId ?? '',
            upiLabel: upiLabel ?? 'UPI',
            coinsRedeemed,
          });
          setStep('PAYMENT_FAILED');
          return;
        }
        const attempt = {
          orderId,
          amountPaisa: rzp.amountPaisa,
          upiAppId: upiAppId ?? '',
          upiLabel: upiLabel ?? 'UPI',
          coinsRedeemed,
        };
        setPaymentAttempt(attempt);
        // Persist the in-flight order so a cold start can reconcile it even without a deep link.
        void markUpiOrderPending(orderId);
        setStep('PAYMENT_STATUS');
        void launchUpiPayment(
          attempt.upiAppId,
          buildUpiIntent({
            orderId,
            amountPaisa: rzp.amountPaisa,
            txnRef: rzp.razorpayOrderId,
          }),
        );
      } catch (err) {
        const message =
          err instanceof GatewayHttpError
            ? err.status === 409
              ? 'This order is already being processed. Please check My Orders before retrying.'
              : 'We could not place your order. Please review your address and items and try again.'
            : 'You appear to be offline. Check your connection and try again.';
        Alert.alert('Order not placed', message);
      } finally {
        setPaymentProcessing(false);
      }
    })();
  };

  // Retry the failed UPI payment: same order, same amount, optionally a different app. A fresh
  // 10-minute detection window starts on the status screen. Never places a second order.
  const handleRetryWithApp = (appId: string, label: string) => {
    const attempt = paymentAttempt;
    if (!attempt) return;
    setRetryingPayment(true);
    void (async () => {
      try {
        const rzp = await gateway.createRazorpayOrder(attempt.orderId);
        if (rzp.status === 'PAID') {
          await clearUpiOrderPending();
          setStep('RECEIPT');
          return;
        }
        if (rzp.status === 'FAILED') {
          setStep('PAYMENT_FAILED');
          return;
        }
        const next = {
          ...attempt,
          upiAppId: appId || attempt.upiAppId,
          upiLabel: label || attempt.upiLabel,
          amountPaisa: rzp.amountPaisa,
        };
        setPaymentAttempt(next);
        void markUpiOrderPending(next.orderId);
        setStep('PAYMENT_STATUS');
        void launchUpiPayment(
          next.upiAppId,
          buildUpiIntent({
            orderId: next.orderId,
            amountPaisa: rzp.amountPaisa,
            txnRef: rzp.razorpayOrderId,
          }),
        );
      } catch {
        Alert.alert('Could not restart payment', 'Please check your connection and try again.');
      } finally {
        setRetryingPayment(false);
      }
    })();
  };

  const handleRetryPayment = () =>
    handleRetryWithApp(paymentAttempt?.upiAppId ?? '', paymentAttempt?.upiLabel ?? 'UPI');

  // Switch the already-placed order to Cash on Delivery (records a COD payment server-side).
  const handleSwitchToCod = () => {
    const attempt = paymentAttempt;
    if (!attempt) return;
    setRetryingPayment(true);
    void (async () => {
      try {
        await gateway.payForOrder(attempt.orderId, 'COD', attempt.coinsRedeemed);
        await clearUpiOrderPending();
        setPlacedOrderDetails((prev) => (prev ? { ...prev, payment: 'Cash on Delivery' } : prev));
        setStep('RECEIPT');
      } catch {
        Alert.alert('Could not switch to Cash on Delivery', 'Please check your connection and try again.');
      } finally {
        setRetryingPayment(false);
      }
    })();
  };

  if (step === 'PAYMENT_STATUS' && paymentAttempt) {
    return (
      <View style={styles.paymentRoot}>
        <PaymentStatusScreen
          orderId={paymentAttempt.orderId}
          amountPaisa={paymentAttempt.amountPaisa}
          upiLabel={paymentAttempt.upiLabel}
          onPaid={() => {
            void clearUpiOrderPending();
            setStep('RECEIPT');
          }}
          onFailed={(timedOut) => {
            setPaymentTimedOut(timedOut);
            setStep('PAYMENT_FAILED');
          }}
        />
      </View>
    );
  }

  if (step === 'PAYMENT_FAILED' && paymentAttempt) {
    return (
      <View style={styles.paymentRoot}>
        <PaymentFailedScreen
          orderId={paymentAttempt.orderId}
          amountPaisa={paymentAttempt.amountPaisa}
          upiLabel={paymentAttempt.upiLabel}
          timedOut={paymentTimedOut}
          busy={retryingPayment}
          upiApps={installedUpiApps
            .filter((a) => a.id !== paymentAttempt.upiAppId)
            .map((a) => ({ id: a.id, label: a.label }))}
          onRetry={handleRetryPayment}
          onSwitchToCod={handleSwitchToCod}
          onSelectApp={handleRetryWithApp}
        />
      </View>
    );
  }

  if (step === 'BAG') {
    return (
      <View style={styles.bagRoot}>
        <View style={[styles.bagTopBar, { paddingTop: insets.top + vs(12) }]}>
          <TouchableOpacity onPress={onBack} style={styles.bagBackBtn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.4} />
          </TouchableOpacity>
          <AppText style={styles.bagTitle} numberOfLines={1}>
            {restaurantName ? `${restaurantName} Cart` : 'Your Cart'}
          </AppText>
          {onClearItems ? (
            <TouchableOpacity
              onPress={handleClearItems}
              style={styles.clearBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={restaurantName ? `Clear ${restaurantName} cart` : 'Clear cart'}
            >
              <AppText style={styles.clearText}>Clear</AppText>
            </TouchableOpacity>
          ) : (
            <View style={{ width: ms(40) }} />
          )}
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
              <AppText style={styles.emptyTitle}>
                {restaurantName ? `No items from ${restaurantName} yet` : 'Your cart is empty'}
              </AppText>
              <AppText style={styles.emptyDesc}>
                {restaurantName
                  ? 'Add dishes from this restaurant to get started!'
                  : "Browse Food, Mart, Grocery, or Pharma and tap 'Add to Bag' to get started!"}
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

              {grouped.map((group) => {
                const expanded = expandedCategories.includes(group.cat);
                const catSelectedCount = group.items.filter((i) => !deselectedIds.has(i.id)).length;
                const allChecked = catSelectedCount === group.items.length;
                const someChecked = catSelectedCount > 0 && catSelectedCount < group.items.length;
                const toggleGroup = () => {
                  setDeselectedIds((prev) => {
                    const next = new Set(prev);
                    if (allChecked) {
                      group.items.forEach((i) => next.add(i.id));
                    } else {
                      group.items.forEach((i) => next.delete(i.id));
                    }
                    return next;
                  });
                };
                return (
                  <View key={group.cat} style={styles.catCard}>
                    <TouchableOpacity style={styles.catHeader} onPress={() => toggleCategory(group.cat)} activeOpacity={0.7}>
                      <View style={styles.catHeaderLeft}>
                        <Checkbox checked={allChecked} indeterminate={someChecked} onToggle={toggleGroup} />
                        <View style={styles.catHeaderText}>
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
                      group.items.map((item) => {
                        const isDeselected = deselectedIds.has(item.id);
                        return (
                          <View key={item.id} style={[styles.itemRow, isDeselected && styles.itemRowDeselected]}>
                            <Checkbox
                              checked={!isDeselected}
                              onToggle={() =>
                                setDeselectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                })
                              }
                            />
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
                            {onDeleteItem ? (
                              <TouchableOpacity
                                onPress={() => handleDeleteItem(item.id)}
                                style={styles.deleteItemBtn}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${item.name}`}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Trash2 size={ms(16)} color="#ef4444" strokeWidth={2.2} />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })}
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
            <View style={styles.billBanner}>
              <View style={styles.billBannerLeft}>
                <AppText style={styles.toPayLabel}>To Pay: </AppText>
                <AppText style={styles.toPayValue}>₹{finalTotal.toLocaleString('en-IN')}</AppText>
                <AppText style={styles.origTotal}>₹{originalTotal.toLocaleString('en-IN')}</AppText>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.proceedBtn, selectedItems.length === 0 && styles.proceedBtnDisabled]}
              onPress={() => setStep('FULFILLMENT')}
              activeOpacity={0.88}
              disabled={selectedItems.length === 0}
            >
              <AppText style={styles.proceedText}>
                {selectedItems.length === 0 ? 'Select items to pay' : 'Place order'}
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        {/* Coupon Picker Sheet */}
        <SlideUpSheet visible={showCouponSheet} onRequestClose={() => setShowCouponSheet(false)}>
          <AppText style={styles.sheetTitle}>Apply Coupon</AppText>
          <AppText style={styles.sheetSubtitle}>Choose a coupon to save more on this order</AppText>
          {couponError ? <AppText style={styles.couponErrorText}>{couponError}</AppText> : null}
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
          {couponList.map((coupon) => {
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
      </View>
    );
  }

  if (step === 'FULFILLMENT') {
    return (
      <View style={styles.fulfillmentRoot}>
        <View style={[styles.bagTopBar, { paddingTop: insets.top + vs(12) }]}>
          <TouchableOpacity onPress={() => setStep('BAG')} style={styles.bagBackBtn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.4} />
          </TouchableOpacity>
          <AppText style={styles.bagTitle} numberOfLines={1}>
            How do you want your order?
          </AppText>
          <View style={{ width: ms(40) }} />
        </View>

        <ScrollView
          style={styles.fulfillmentScroll}
          contentContainerStyle={styles.fulfillmentScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <BreakdownCard
            total={finalTotal}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            deliveryBreakdown={fulfillment === 'PICKUP' ? undefined : deliveryFeeQuote ?? undefined}
            fulfillment={fulfillment ?? undefined}
          />

          <View style={styles.fulfilmentCard}>
            <AppText style={styles.fulfilmentTitle}>How do you want your order?</AppText>
            <View style={styles.fulfillmentToggle}>
              <TouchableOpacity
                onPress={() => setFulfillment('DELIVERY')}
                style={[styles.fulfillmentToggleOption, fulfillment === 'DELIVERY' && styles.fulfillmentToggleOptionActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: fulfillment === 'DELIVERY' }}
              >
                <Send size={ms(14)} color={fulfillment === 'DELIVERY' ? '#ffffff' : '#6B7280'} strokeWidth={2.2} />
                <AppText style={[styles.fulfillmentToggleText, fulfillment === 'DELIVERY' && styles.fulfillmentToggleTextActive]}>
                  Delivery
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
          </View>

          <AppText style={styles.fulfillmentSectionLabel}>Choose pickup or delivery</AppText>

          {fulfillment === 'DELIVERY' ? (
            <View style={styles.fulfillmentAddressCard}>
              <View style={styles.liveAddressIcon}>
                <Send size={ms(14)} color="#F97316" strokeWidth={2.2} />
              </View>
              <View style={styles.liveAddressBody}>
                <AppText style={styles.addrLabel} numberOfLines={1}>
                  {liveAddress?.status === 'loading' ? 'Locating your address…' : deliveryAddress.label}
                </AppText>
                <AppText style={styles.addrSub} numberOfLines={1}>
                  {liveAddress?.status === 'loading'
                    ? 'Getting your current location'
                    : deliveryAddress.address}
                </AppText>
              </View>
              {liveAddress?.status !== 'loading' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('SavedAddresses')}
                  style={styles.changeBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Change delivery address"
                >
                  <AppText style={styles.changeText}>Change</AppText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.fulfillmentPickupWrap}>
              {pickupPointList.map((p) => (
                <View key={p.id} style={styles.fulfillmentPickupCard}>
                  <View style={styles.pickupCardHeader}>
                    <Store size={ms(14)} color="#0F4C81" strokeWidth={2.2} />
                    <AppText style={styles.pickupCardName} numberOfLines={1}>
                      {p.name}
                    </AppText>
                  </View>
                  <AppText style={styles.fulfillmentPickupText}>{p.address}</AppText>
                  <AppText style={styles.fulfillmentPickupText}>Open {p.hours}</AppText>
                  <AppText style={styles.fulfillmentPickupText}>Contact: {p.phone}</AppText>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.fulfillmentBottomBar}>
          <TouchableOpacity
            style={[styles.proceedBtn, !fulfillment && styles.proceedBtnDisabled]}
            onPress={() => setStep('PAYMENT')}
            activeOpacity={0.88}
            disabled={!fulfillment}
          >
            <AppText style={styles.proceedText}>
              {fulfillment ? 'Proceed to pay' : 'Choose pickup or delivery'}
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'PAYMENT') {
    const itemCount = selectedItems.reduce((acc, curr) => acc + curr.quantity, 0);
    const primaryPickup = pickupPointList[0];
    return (
      <View style={styles.paymentRoot}>
        <PaymentOptionsScreen
          itemCount={itemCount}
          total={finalTotal}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          deliveryBreakdown={fulfillment === 'PICKUP' ? undefined : deliveryFeeQuote ?? undefined}
          deliveryAddress={{
            label: fulfillment === 'PICKUP' ? (primaryPickup?.name ?? 'Pickup point') : deliveryAddress.label,
            address: fulfillment === 'PICKUP' ? (primaryPickup?.address ?? '') : deliveryAddress.address,
          }}
          originLabel="Instamart"
          fulfillment={fulfillment ?? 'DELIVERY'}
          pickup={primaryPickup}
          contactPhone={accountPhone || savedAddress?.phone}
          onBack={() => setStep('FULFILLMENT')}
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
        <View style={styles.liveTrackingBox}>
          <View style={styles.liveTrackingHeader}>
            <View style={styles.liveTrackingHeaderLeft}>
              <Animated.View style={{ opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }}>
                <Store size={ms(10)} color="#475569" style={{ marginRight: hs(4) }} />
              </Animated.View>
              <AppText style={styles.liveTrackingLabel}>Real-Time Tracking Status</AppText>
            </View>
          </View>

          <View style={styles.liveStepsContainer}>
            <View style={[styles.liveStepRow, { marginBottom: 0 }]}>
              <View style={styles.liveStepDotOuter}>
                <Animated.View style={[styles.liveStepActiveDotPulse, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }]} />
              </View>
              <View style={styles.liveStepTextCol}>
                <AppText style={styles.liveStepTitle}>Order has been placed</AppText>
                {placedOrderDetails?.fulfillment === 'PICKUP' && placedOrderDetails?.pickup ? (
                  <AppText style={styles.liveStepDesc} numberOfLines={2}>
                    Pickup from: {placedOrderDetails.pickup.name}
                    {placedOrderDetails.pickups && placedOrderDetails.pickups.length > 1
                      ? ` +${placedOrderDetails.pickups.length - 1} more`
                      : ''}
                    , {placedOrderDetails.pickup.address}
                  </AppText>
                ) : (
                  <AppText style={styles.liveStepDesc}>Preparing your order for delivery</AppText>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Purchased list */}
        <View style={styles.purchasedItemsSection}>
          <AppText style={styles.sectionLabel}>Items Purchased</AppText>
          <View style={styles.purchasedItemsList}>
            {placedOrderDetails?.items.map((item) => (
              <View key={item.id} style={styles.purchasedItemRow}>
                <View style={styles.purchasedItemLeft}>
                  <AppText style={styles.purchasedItemName} numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <AppText style={styles.purchasedItemQty}>x {item.quantity}</AppText>
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
          {placedOrderDetails?.fulfillment === 'PICKUP' && placedOrderDetails?.pickups
            ? placedOrderDetails.pickups.map((p) => (
                <View key={p.id} style={styles.vendorPickupCard}>
                  <AppText style={styles.vendorPickupName}>{p.name}</AppText>
                  <AppText style={styles.vendorPickupText}>{p.address}</AppText>
                  <AppText style={styles.vendorPickupText}>Open {p.hours}</AppText>
                  <AppText style={styles.vendorPickupText}>Contact: {p.phone}</AppText>
                </View>
              ))
            : (
                <>
                  <AppText style={styles.deliveryLocationAddress}>{placedOrderDetails?.deliveryAddress}</AppText>
                  {placedOrderDetails?.fulfillment === 'PICKUP' ? (
                    <View style={styles.pickupContactRow}>
                      <AppText style={styles.pickupContactLabel}>Contact phone: </AppText>
                      <AppText style={styles.pickupContactValue}>{accountPhone || savedAddress?.phone || ''}</AppText>
                    </View>
                  ) : null}
                </>
              )}
        </View>

        {/* Payment info info */}
        <View style={styles.receiptPaymentDetails}>
          <AppText style={styles.paymentProtocolLabel}>Payment Protocol:</AppText>
          <AppText style={styles.paymentProtocolValue}>{placedOrderDetails?.payment}</AppText>
        </View>

        {/* Action Controls */}
        <View style={styles.receiptActionBtnRow}>
          {onTrackOrder && placedOrderDetails?.orderId ? (
            <TouchableOpacity
              onPress={() => onTrackOrder(placedOrderDetails!.orderId)}
              style={styles.receiptTrackOrderBtn}
              activeOpacity={0.9}
            >
              <AppText style={styles.receiptTrackOrderBtnText}>Track My Order</AppText>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => {
              setStep('BAG');
              setPlacedOrderDetails(null);
              setPaymentAttempt(null);
            }}
            style={styles.receiptNewOrderBtn}
            activeOpacity={0.8}
          >
            <AppText style={styles.receiptNewOrderBtnText}>New Order</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (onGoToHub) onGoToHub();
              else setActiveTab('Home');
              setStep('BAG');
              setPlacedOrderDetails(null);
              setPaymentAttempt(null);
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
    paddingBottom: SPACE.LIST_BOTTOM,
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
    paddingVertical: SPACE.LIST_BOTTOM,
  },
  itemsListContainer: {
    width: '100%',
    maxHeight: vs(260),
  },
  groupedAppSection: {
    marginBottom: SPACE.BLOCK,
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
    marginBottom: SPACE.BLOCK,
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
    marginBottom: SPACE.BLOCK,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(6),
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
  fulfillmentToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: ms(12),
    padding: vs(4),
    marginTop: vs(4),
  },
  fulfilmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(14),
    marginBottom: vs(12),
  },
  fulfilmentTitle: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    marginBottom: vs(4),
  },
  liveAddressIcon: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(12),
    backgroundColor: '#FDEDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(10),
  },
  liveAddressBody: {
    flex: 1,
  },
  fulfillmentRoot: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  fulfillmentScroll: {
    flex: 1,
  },
  fulfillmentScrollContent: {
    paddingHorizontal: hs(16),
    paddingTop: vs(6),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  fulfillmentSectionLabel: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: vs(8),
  },
  fulfillmentAddressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(14),
    marginBottom: vs(12),
  },
  changeBtn: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(6),
    borderRadius: ms(8),
    backgroundColor: '#E3F2FD',
  },
  changeText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#0F4C81',
  },
  fulfillmentPickupWrap: {
    gap: vs(10),
    marginBottom: vs(12),
  },
  fulfillmentPickupCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(14),
  },
  pickupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(6),
  },
  pickupCardName: {
    flex: 1,
    fontSize: ms(13),
    fontWeight: '800',
    color: '#0F4C81',
  },
  fulfillmentPickupText: {
    fontSize: ms(11),
    color: '#4B5563',
    fontWeight: '600',
    lineHeight: ms(17),
    marginTop: vs(1),
  },
  fulfillmentBottomBar: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  vendorPickupCard: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(12),
    padding: hs(12),
    marginTop: vs(8),
  },
  vendorPickupName: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#1E2022',
    marginBottom: vs(2),
  },
  vendorPickupText: {
    fontSize: ms(10.5),
    color: '#666666',
    fontWeight: '600',
    lineHeight: ms(15),
    marginTop: vs(1),
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
    maxWidth: '75%',
  },
  purchasedItemQty: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#94a3b8',
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
  receiptTrackOrderBtn: {
    flex: 1,
    height: Math.max(40, vs(40)),
    borderRadius: ms(10),
    backgroundColor: '#56B821',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptTrackOrderBtnText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
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
    flex: 1,
    fontSize: ms(18),
    fontWeight: '900',
    color: '#1E2022',
    marginLeft: hs(12),
  },
  clearBtn: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
  },
  clearText: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#ef4444',
  },
  bagScroll: {
    flex: 1,
  },
  bagScrollContent: {
    paddingTop: vs(16),
    paddingBottom: SPACE.SECTION,
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
    marginHorizontal: hs(16),
    marginBottom: vs(12),
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
  catCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: hs(16),
    paddingTop: vs(16),
    paddingBottom: vs(4),
    marginBottom: vs(12),
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.BLOCK,
  },
  catHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
  },
  catHeaderText: {
    flex: 1,
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
    gap: hs(10),
    paddingVertical: vs(10),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowDeselected: {
    opacity: 0.45,
  },
  itemThumb: {
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  itemDetails: {
    flex: 1,
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
  deleteItemBtn: {
    marginLeft: hs(8),
    padding: vs(4),
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
  proceedBtn: {
    height: Math.max(48, vs(48)),
    borderRadius: ms(12),
    backgroundColor: '#118C4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedBtnDisabled: {
    backgroundColor: '#94A3B8',
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
    marginBottom: SPACE.BLOCK,
  },
  couponErrorText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: SPACE.BLOCK,
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
});
