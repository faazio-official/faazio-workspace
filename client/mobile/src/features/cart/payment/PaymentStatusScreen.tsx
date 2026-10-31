import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Smartphone } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { gateway } from '@/services/api/GatewayClient';
import { BRAND } from './constants';
import { usePaymentPolling } from './usePaymentPolling';

export interface PaymentStatusScreenProps {
  orderId: string;
  /** Payable amount in paisa (Razorpay order amount). */
  amountPaisa: number;
  /** Chosen UPI app label, for the "complete in <app>" hint. */
  upiLabel: string;
  /** Payment confirmed (server webhook reconciled) → show the receipt. */
  onPaid: () => void;
  /** Failed or timed out → show the retry screen (`timedOut` drives the copy). */
  onFailed: (timedOut: boolean) => void;
}

function formatTimer(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Shown after a UPI intent is launched. Polls the server (see `usePaymentPolling`) while the
 * app is foregrounded; the Razorpay webhook is the source of truth, so this works even if the
 * user backgrounds Faazio or the UPI app never returns to our callback.
 */
export default function PaymentStatusScreen({
  orderId,
  amountPaisa,
  upiLabel,
  onPaid,
  onFailed,
}: PaymentStatusScreenProps) {
  const insets = useSafeAreaInsets();
  const amount = (amountPaisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const { timedOut, elapsedMs } = usePaymentPolling(orderId, {
    poll: (id) => gateway.fetchPaymentStatus(id),
    onResolved: (status, wasTimeout) => {
      if (status === 'PAID') onPaid();
      else onFailed(wasTimeout);
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + vs(48) }]}>
      <View style={styles.card}>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={BRAND.green} />
        </View>
        <AppText style={styles.title}>
          {timedOut ? 'Still waiting for confirmation' : 'Waiting for payment confirmation...'}
        </AppText>
        <AppText style={styles.amount}>₹{amount}</AppText>

        <View style={styles.appRow}>
          <Smartphone size={ms(16)} color={BRAND.section} strokeWidth={2.2} />
          <AppText style={styles.appText}>Pay via {upiLabel}</AppText>
        </View>

        <AppText style={styles.hint}>
          Complete the payment in your UPI app. This screen updates automatically once the
          payment is confirmed — you can leave Faazio and come back.
        </AppText>

        <AppText style={styles.timer}>{formatTimer(elapsedMs)}</AppText>
        <AppText style={styles.order}>Order {orderId}</AppText>
      </View>
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
  spinnerWrap: {
    height: ms(64),
    justifyContent: 'center',
  },
  title: {
    fontSize: ms(15),
    fontWeight: '700',
    color: BRAND.ink,
    textAlign: 'center',
    marginTop: vs(12),
  },
  amount: {
    fontSize: ms(30),
    fontWeight: '800',
    color: BRAND.ink,
    marginTop: vs(6),
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    marginTop: vs(10),
  },
  appText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: BRAND.section,
  },
  hint: {
    fontSize: ms(12),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(16),
  },
  timer: {
    fontSize: ms(13),
    fontWeight: '700',
    color: BRAND.blue,
    marginTop: vs(18),
  },
  order: {
    fontSize: ms(11),
    color: '#9CA3AF',
    marginTop: vs(4),
  },
});
