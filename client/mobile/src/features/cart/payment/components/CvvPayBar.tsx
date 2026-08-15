import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { BRAND } from '../constants';

interface CvvPayBarProps {
  cvv: string;
  onChangeCvv: (text: string) => void;
  total: number;
  onPay: () => void;
}

/**
 * Expanded active-state row: outlined CVV input (left) + green PAY button
 * (right). Shown when the preferred card is selected.
 */
export default function CvvPayBar({ cvv, onChangeCvv, total, onPay }: CvvPayBarProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.cvvWrap}>
        <AppText style={styles.cvvLabel}>CVV</AppText>
        <AppTextInput
          style={styles.cvvInput}
          value={cvv}
          onChangeText={(t) => onChangeCvv(t.replace(/[^0-9]/g, ''))}
          placeholder="***"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
          secureTextEntry
          maxLength={3}
        />
      </View>
      <TouchableOpacity onPress={onPay} style={styles.payBtn} activeOpacity={0.85}>
        <AppText style={styles.payText}>PAY ₹{total.toLocaleString('en-IN')}</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: hs(12),
    paddingTop: vs(14),
    paddingBottom: vs(14),
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  cvvWrap: {
    flex: 1,
  },
  cvvLabel: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: vs(5),
  },
  cvvInput: {
    height: Math.max(44, vs(44)),
    borderWidth: 1.4,
    borderColor: '#C4C9CF',
    borderRadius: ms(10),
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    fontWeight: '700',
    color: BRAND.ink,
  },
  payBtn: {
    height: Math.max(44, vs(44)),
    borderRadius: ms(10),
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(20),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  payText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#ffffff',
  },
});
