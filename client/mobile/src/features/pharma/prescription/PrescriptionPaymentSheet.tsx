import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import AppText from '@/components/AppText';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { brandRamp, neutral } from '@/theme/brandTokens';
import { SPACE } from '@/theme/spacing';
import { hs, ms, vs } from '@/utils/responsive';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';
import { detectUpiApps, type UpiApp } from '@/services/upi';
import {
  buildUpiIntent,
  launchUpiPayment,
} from '@/features/cart/payment/UpiIntent';
import { usePaymentPolling } from '@/features/cart/payment/usePaymentPolling';

type Method = { kind: 'upi'; id: string } | { kind: 'cod' } | null;
type Phase = 'select' | 'working' | 'polling' | 'done';

interface PrescriptionPaymentSheetProps {
  visible: boolean;
  /** The Rx id — it is also the materialised checkout order id. */
  orderId: string;
  /** Server-quoted total in whole rupees (display + UPI intent only; the server owns the amount). */
  amountRupees: number;
  onRequestClose: () => void;
  onPaid: () => void;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * Pay for a quoted prescription. Accepting the quote materialises it as a real checkout order on the
 * server (`POST /prescriptions/{id}/checkout`, idempotent), then the existing payment rail applies:
 * COD records a `PAID` row, UPI opens the Razorpay-backed intent and the server webhook confirms.
 * The amount is never sent by the client; every figure here is display-only.
 */
const PrescriptionPaymentSheet = memo(function PrescriptionPaymentSheet({
  visible,
  orderId,
  amountRupees,
  onRequestClose,
  onPaid,
}: PrescriptionPaymentSheetProps) {
  const [method, setMethod] = useState<Method>(null);
  const [phase, setPhase] = useState<Phase>('select');
  const [error, setError] = useState('');
  const [upiApps, setUpiApps] = useState<UpiApp[]>([]);

  // Reset the sheet each time it is shown so a previous attempt never leaks into a new one.
  useEffect(() => {
    if (!visible) return;
    setMethod(null);
    setPhase('select');
    setError('');
    let cancelled = false;
    void detectUpiApps()
      .then((apps) => {
        if (!cancelled) setUpiApps(apps);
      })
      .catch(() => {
        if (!cancelled) setUpiApps([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Foreground-only confirmation polling once the UPI intent has been launched.
  usePaymentPolling(orderId, {
    enabled: visible && phase === 'polling',
    poll: (id) => gateway.fetchPaymentStatus(id),
    onResolved: (status, timedOut) => {
      if (status === 'PAID') {
        setPhase('done');
        onPaid();
        return;
      }
      setPhase('select');
      setError(
        timedOut
          ? 'We did not get a payment confirmation. If money was debited, it will reconcile shortly.'
          : 'Payment failed or was cancelled. You can try again.',
      );
    },
  });

  const startPayment = useCallback(async () => {
    if (!method || phase === 'working' || phase === 'polling') return;
    setPhase('working');
    setError('');
    try {
      // Materialise the accepted quote as a real checkout order (idempotent).
      await gateway.checkoutPrescription(orderId);
      if (method.kind === 'cod') {
        await gateway.payForOrder(orderId, 'COD', 0);
        setPhase('done');
        onPaid();
        return;
      }
      const rzp = await gateway.createRazorpayOrder(orderId);
      if (rzp.status === 'PAID') {
        setPhase('done');
        onPaid();
        return;
      }
      if (rzp.status === 'FAILED') {
        setPhase('select');
        setError('Payment failed. Please try again.');
        return;
      }
      const launched = await launchUpiPayment(
        method.id,
        buildUpiIntent({
          orderId,
          amountPaisa: rzp.amountPaisa,
          txnRef: rzp.razorpayOrderId,
          note: 'Faazio prescription',
        }),
      );
      if (!launched) {
        setPhase('select');
        setError('Could not open that UPI app. Choose another method.');
        return;
      }
      setPhase('polling');
    } catch (err) {
      setPhase('select');
      if (err instanceof GatewayHttpError) {
        if (err.status === 409) {
          setError('This prescription is not ready to pay yet.');
        } else if (err.status === 503) {
          setError('Payments are temporarily unavailable. Please try again later.');
        } else {
          setError('We could not start the payment. Please try again.');
        }
      } else {
        setError('Check your connection and try again.');
      }
    }
  }, [method, phase, orderId, onPaid]);

  const busy = phase === 'working' || phase === 'polling';
  const canPay = method !== null && !busy && phase !== 'done';

  return (
    <SlideUpSheet visible={visible} onRequestClose={busy ? () => {} : onRequestClose}>
      <View style={styles.header}>
        <AppText style={styles.title}>Pay for prescription</AppText>
        <AppText style={styles.amount}>{rupees(amountRupees)}</AppText>
        <AppText style={styles.subtitle}>
          {phase === 'polling'
            ? 'Waiting for confirmation from your UPI app…'
            : 'Your pharmacy quoted these medicines. Pay to confirm the order.'}
        </AppText>
      </View>

      {phase === 'done' ? (
        <View style={styles.doneWrap}>
          <AppText style={styles.doneTitle}>Payment recorded</AppText>
          <AppText style={styles.doneText}>
            The pharmacy will prepare your medicines and mark the order ready.
          </AppText>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onRequestClose}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Close payment sheet"
          >
            <AppText style={styles.primaryBtnText}>Done</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.body}>
          <AppText style={styles.sectionLabel}>UPI</AppText>
          {upiApps.length === 0 ? (
            <AppText style={styles.hint}>No UPI app detected. Use cash on delivery below.</AppText>
          ) : null}
          {upiApps.map((app) => {
            const selected = method?.kind === 'upi' && method.id === app.id;
            return (
              <TouchableOpacity
                key={app.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setMethod({ kind: 'upi', id: app.id })}
                disabled={busy}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: busy }}
                accessibilityLabel={`Pay with ${app.label}`}
              >
                <View style={[styles.radio, selected && styles.radioOn]} />
                <AppText style={styles.optionLabel}>{app.label}</AppText>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.option, method?.kind === 'cod' && styles.optionSelected]}
            onPress={() => setMethod({ kind: 'cod' })}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ checked: method?.kind === 'cod', disabled: busy }}
            accessibilityLabel="Pay cash on delivery"
          >
            <View style={[styles.radio, method?.kind === 'cod' && styles.radioOn]} />
            <View style={styles.optionTextCol}>
              <AppText style={styles.optionLabel}>Cash on Delivery</AppText>
              <AppText style={styles.optionSub}>Pay when your medicines are delivered</AppText>
            </View>
          </TouchableOpacity>

          {error ? (
            <AppText style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, !canPay && styles.primaryBtnDisabled]}
            onPress={() => void startPayment()}
            disabled={!canPay}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPay, busy }}
            accessibilityLabel={`Pay ${rupees(amountRupees)}`}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppText style={styles.primaryBtnText}>{`Pay ${rupees(amountRupees)}`}</AppText>
            )}
          </TouchableOpacity>

          {phase === 'polling' ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setPhase('select')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Choose another payment method"
            >
              <AppText style={styles.secondaryBtnText}>Choose another method</AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </SlideUpSheet>
  );
});

export default PrescriptionPaymentSheet;

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: SPACE.BLOCK,
  },
  title: {
    fontSize: ms(16),
    fontWeight: '800',
    color: neutral.ink,
    marginBottom: vs(6),
  },
  amount: {
    fontSize: ms(28),
    fontWeight: '800',
    color: brandRamp.PHARMA.deep,
    marginBottom: vs(6),
  },
  subtitle: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    textAlign: 'center',
    lineHeight: vs(17),
  },
  body: {
    alignSelf: 'stretch',
  },
  sectionLabel: {
    fontSize: ms(11),
    fontWeight: '800',
    color: neutral.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: ms(0.6),
    marginBottom: vs(8),
  },
  hint: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    marginBottom: vs(8),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingVertical: vs(12),
    paddingHorizontal: hs(14),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    marginBottom: vs(8),
  },
  optionSelected: {
    borderColor: brandRamp.PHARMA.base,
    backgroundColor: brandRamp.PHARMA.tint,
  },
  optionTextCol: {
    flex: 1,
  },
  radio: {
    width: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    borderWidth: 2,
    borderColor: neutral.border,
  },
  radioOn: {
    borderColor: brandRamp.PHARMA.deep,
    backgroundColor: brandRamp.PHARMA.deep,
  },
  optionLabel: {
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.ink,
  },
  optionSub: {
    fontSize: ms(11),
    color: neutral.inkMuted,
    marginTop: vs(1),
  },
  error: {
    fontSize: ms(12),
    color: '#B91C1C',
    marginTop: vs(4),
    marginBottom: vs(4),
    lineHeight: vs(17),
  },
  primaryBtn: {
    marginTop: SPACE.ITEM,
    minHeight: 50,
    borderRadius: ms(12),
    backgroundColor: brandRamp.PHARMA.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  primaryBtnText: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(4),
  },
  secondaryBtnText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  doneWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  doneTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#16A34A',
    marginBottom: vs(6),
  },
  doneText: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    textAlign: 'center',
    lineHeight: vs(18),
    marginBottom: SPACE.BLOCK,
  },
});