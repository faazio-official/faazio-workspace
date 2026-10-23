import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { BRAND } from '../constants';

interface BottomPayBarProps {
  total: number;
  onPay: () => void;
  disabled?: boolean;
}

/**
 * Fixed floating bottom "Pay ₹X" button for the payment step. Shown (via `visible`
 * at the call site) only once a payment method — a detected UPI app or a saved
 * card — has been chosen.
 */
export default function BottomPayBar({ total, onPay, disabled = false }: BottomPayBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, vs(16)) }]}>
      <TouchableOpacity
        onPress={onPay}
        style={[styles.payBtn, disabled && styles.payBtnDisabled]}
        activeOpacity={0.85}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Pay ₹${total.toLocaleString('en-IN')}`}
      >
        <AppText style={styles.payText}>Pay ₹{total.toLocaleString('en-IN')}</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  payBtn: {
    height: Math.max(52, vs(52)),
    borderRadius: ms(14),
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  payBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  payText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
});