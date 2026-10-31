import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { RootStackParamList } from '@/navigation/types';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';
import {
  clearUpiOrderPending,
  getPendingUpiOrder,
  markUpiOrderPending,
} from '@/services/paymentReconciliation';
import { BRAND } from './constants';

type Phase = 'verifying' | 'paid' | 'failed' | 'pending' | 'error';
type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Bound the in-app verification window; the webhook may already have resolved the order. */
const MAX_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2000;

/**
 * Return leg of a UPI payment. Opened by `faazio://payment/callback` (or the cold-start
 * reconciler) after a UPI app hands control back. The server (Razorpay webhook) is authoritative:
 * we re-read the payment status and route to the real outcome instead of trusting the URL.
 */
export default function PaymentCallbackScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentCallback'>>();
  const [phase, setPhase] = useState<Phase>('verifying');
  const [orderId, setOrderId] = useState<string | null>(route.params?.orderId ?? null);
  const cancelled = useRef(false);

  const verify = useCallback(async (id: string) => {
    setPhase('verifying');
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (cancelled.current) return;
      try {
        const { status } = await gateway.fetchPaymentStatus(id);
        if (status === 'PAID') {
          await clearUpiOrderPending();
          if (!cancelled.current) setPhase('paid');
          return;
        }
        if (status === 'FAILED') {
          await clearUpiOrderPending();
          if (!cancelled.current) setPhase('failed');
          return;
        }
      } catch (err) {
        // A 404 means the order is not ours (or gone) — stop, do not keep polling another user's id.
        if (err instanceof GatewayHttpError && err.status === 404) {
          if (!cancelled.current) setPhase('error');
          return;
        }
        // Transient (network / returning from another app) — keep polling.
      }
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    if (!cancelled.current) setPhase('pending');
  }, []);

  useEffect(() => {
    cancelled.current = false;
    void (async () => {
      const id = route.params?.orderId ?? (await getPendingUpiOrder());
      if (!id) {
        setPhase('error');
        return;
      }
      setOrderId(id);
      // Keep the cold-start marker pointed at this order until the status is terminal, so a payment
      // still settling after this screen closes is reconciled on the next foreground.
      await markUpiOrderPending(id);
      await verify(id);
    })();
    return () => {
      cancelled.current = true;
    };
  }, [route.params?.orderId, verify]);

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };
  const viewOrder = () => {
    if (orderId) navigation.replace('OrderDetails', { orderId });
  };
  const viewOrders = () => {
    navigation.replace('MyOrders', orderId ? { highlightOrderId: orderId } : undefined);
  };

  if (phase === 'verifying') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + vs(48) }]}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <ActivityIndicator size="large" color={BRAND.green} />
          </View>
          <AppText style={styles.title}>Verifying your payment…</AppText>
          <AppText style={styles.subtitle}>
            Confirming with the payment gateway. This only takes a moment.
          </AppText>
        </View>
      </View>
    );
  }

  const success = phase === 'paid';
  const Icon = success ? CheckCircle : phase === 'pending' ? Clock : XCircle;
  const iconColor = success ? BRAND.green : phase === 'pending' ? BRAND.blue : '#DC2626';
  const title =
    phase === 'paid'
      ? 'Payment successful'
      : phase === 'failed'
        ? 'Payment failed'
        : phase === 'pending'
          ? 'Payment not confirmed yet'
          : 'We couldn’t find that order';
  const subtitle =
    phase === 'paid'
      ? 'Your order is confirmed and being prepared.'
      : phase === 'failed'
        ? 'The payment did not go through. No money was deducted for a failed UPI payment.'
        : phase === 'pending'
          ? 'We haven’t received a confirmation yet. It can take a few minutes — check My Orders shortly.'
          : 'The payment return link was missing an order reference. Open My Orders to check the latest status.';

  return (
    <View style={[styles.root, { paddingTop: insets.top + vs(32) }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Icon size={ms(48)} color={iconColor} strokeWidth={2.2} />
        </View>
        <AppText style={styles.title}>{title}</AppText>
        <AppText style={styles.subtitle}>{subtitle}</AppText>
        {orderId ? <AppText style={styles.order}>Order {orderId}</AppText> : null}

        {success ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={viewOrder} activeOpacity={0.85} accessibilityRole="button">
            <AppText style={styles.primaryText}>View order</AppText>
          </TouchableOpacity>
        ) : null}

        {phase === 'pending' || phase === 'error' ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => (orderId ? void verify(orderId) : setPhase('error'))}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <RefreshCw size={ms(17)} color="#ffffff" strokeWidth={2.6} />
            <AppText style={styles.primaryText}>Verify again</AppText>
          </TouchableOpacity>
        ) : null}

        {!success ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={viewOrders} activeOpacity={0.85} accessibilityRole="button">
            <AppText style={styles.secondaryText}>Go to My Orders</AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryBtn} onPress={goHome} activeOpacity={0.85} accessibilityRole="button">
            <AppText style={styles.secondaryText}>Continue shopping</AppText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    paddingHorizontal: hs(20),
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: ms(20),
    paddingVertical: vs(32),
    paddingHorizontal: hs(20),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  scroll: {
    paddingBottom: vs(40),
    alignItems: 'stretch',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: ms(64),
    marginBottom: vs(12),
  },
  title: {
    fontSize: ms(20),
    fontWeight: '800',
    color: BRAND.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: ms(13),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: ms(19),
    marginTop: vs(8),
    paddingHorizontal: hs(8),
  },
  order: {
    fontSize: ms(11),
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: vs(6),
    marginBottom: vs(20),
  },
  primaryBtn: {
    height: Math.max(52, vs(52)),
    borderRadius: ms(14),
    backgroundColor: BRAND.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    marginTop: vs(24),
  },
  primaryText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
  secondaryBtn: {
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(12),
  },
  secondaryText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BRAND.ink,
  },
});