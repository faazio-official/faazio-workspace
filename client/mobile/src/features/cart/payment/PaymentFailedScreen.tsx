import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XCircle, RefreshCw, Banknote, Smartphone, ChevronDown } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { BRAND } from './constants';

export interface PaymentFailedScreenProps {
  orderId: string;
  /** Payable amount in paisa. */
  amountPaisa: number;
  /** UPI app the shopper tried, for the retry copy. */
  upiLabel: string;
  /** True when the failure was a poll timeout rather than an explicit FAILED webhook. */
  timedOut?: boolean;
  /** A retry/COD switch is in flight — disables the buttons. */
  busy?: boolean;
  /** Other installed UPI apps to retry with (excludes the one just tried). */
  upiApps?: { id: string; label: string }[];
  /** Re-launch the same UPI app for the same amount (fresh detection window). */
  onRetry: () => void;
  /** Record the existing order as Cash on Delivery. */
  onSwitchToCod: () => void;
  /** Retry the existing order with a different UPI app. */
  onSelectApp?: (appId: string, label: string) => void;
}

/**
 * Payment failure + retry. The order was already placed, so retry re-launches the same
 * amount/app against the same order (a fresh 10-minute detection window) rather than
 * creating a new order. Switching to COD records a COD payment on the existing order.
 */
export default function PaymentFailedScreen({
  orderId,
  amountPaisa,
  upiLabel,
  timedOut = false,
  busy = false,
  upiApps = [],
  onRetry,
  onSwitchToCod,
  onSelectApp,
}: PaymentFailedScreenProps) {
  const insets = useSafeAreaInsets();
  const [showApps, setShowApps] = useState(false);
  const amount = (amountPaisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <View style={[styles.root, { paddingTop: insets.top + vs(32) }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <XCircle size={ms(48)} color="#DC2626" strokeWidth={2.2} />
        </View>
        <AppText style={styles.title}>Payment Failed</AppText>
        <AppText style={styles.amount}>₹{amount}</AppText>
        <AppText style={styles.reason}>
          {timedOut
            ? `We didn't receive a confirmation from ${upiLabel} in time.`
            : `${upiLabel} reported that the payment did not go through.`}
        </AppText>
        <AppText style={styles.order}>Order {orderId} — you can retry the same amount.</AppText>

        <TouchableOpacity
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={onRetry}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <RefreshCw size={ms(17)} color="#ffffff" strokeWidth={2.6} />
              <AppText style={styles.primaryText}>Click here to continue</AppText>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, busy && styles.btnDisabled]}
          onPress={onSwitchToCod}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Banknote size={ms(17)} color={BRAND.ink} strokeWidth={2.2} />
          <AppText style={styles.secondaryText}>Pay with Cash on Delivery</AppText>
        </TouchableOpacity>

        {onSelectApp && upiApps.length > 0 ? (
          <>
            <TouchableOpacity
              style={[styles.ghostBtn, busy && styles.btnDisabled]}
              onPress={() => setShowApps((v) => !v)}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Smartphone size={ms(16)} color={BRAND.blue} strokeWidth={2.2} />
              <AppText style={styles.ghostText}>Try another UPI app</AppText>
              <ChevronDown
                size={ms(15)}
                color={BRAND.blue}
                strokeWidth={2.4}
                style={{ transform: [{ rotate: showApps ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>
            {showApps ? (
              <View style={styles.appList}>
                {upiApps.map((app, i) => (
                  <TouchableOpacity
                    key={app.id}
                    style={[styles.appRow, i === upiApps.length - 1 && styles.appRowLast]}
                    onPress={() => {
                      setShowApps(false);
                      onSelectApp(app.id, app.label);
                    }}
                    disabled={busy}
                    activeOpacity={0.7}
                  >
                    <Smartphone size={ms(15)} color={BRAND.section} strokeWidth={2.2} />
                    <AppText style={styles.appRowText}>{app.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
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
    paddingHorizontal: hs(20),
    paddingBottom: vs(40),
    alignItems: 'stretch',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: vs(12),
  },
  title: {
    fontSize: ms(22),
    fontWeight: '800',
    color: BRAND.ink,
    textAlign: 'center',
  },
  amount: {
    fontSize: ms(28),
    fontWeight: '800',
    color: BRAND.ink,
    textAlign: 'center',
    marginTop: vs(6),
  },
  reason: {
    fontSize: ms(13),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: ms(19),
    marginTop: vs(10),
    paddingHorizontal: hs(12),
  },
  order: {
    fontSize: ms(11),
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: vs(6),
    marginBottom: vs(24),
  },
  primaryBtn: {
    height: Math.max(52, vs(52)),
    borderRadius: ms(14),
    backgroundColor: BRAND.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    marginTop: vs(12),
  },
  secondaryText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BRAND.ink,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    marginTop: vs(18),
    paddingVertical: vs(10),
  },
  ghostText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: BRAND.blue,
  },
  appList: {
    marginTop: vs(6),
    backgroundColor: '#ffffff',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: 'hidden',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingVertical: vs(12),
    paddingHorizontal: hs(16),
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  appRowLast: {
    borderBottomWidth: 0,
  },
  appRowText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: BRAND.ink,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});