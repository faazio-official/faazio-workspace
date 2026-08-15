import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { hs, vs, ms, STATUS_BAR_INSET } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { BRAND } from '../constants';

interface PaymentHeaderProps {
  itemCount: number;
  total: number;
  onBack: () => void;
}

/**
 * White header bleeding into the Delivery card below: back arrow,
 * "Payment Options" title (bold 16px) and a gray summary subtitle.
 */
export default function PaymentHeader({ itemCount, total, onBack }: PaymentHeaderProps) {
  return (
    <View style={[styles.header, { paddingTop: STATUS_BAR_INSET + vs(8) }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <ArrowLeft size={ms(22)} color={BRAND.ink} strokeWidth={2.4} />
      </TouchableOpacity>
      <View style={styles.titleWrap}>
        <AppText style={styles.title}>Payment Options</AppText>
        <AppText style={styles.subtitle}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}. Total: ₹{total.toLocaleString('en-IN')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingBottom: vs(14),
  },
  backBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(14),
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: ms(16),
    fontWeight: '700',
    color: BRAND.ink,
  },
  subtitle: {
    fontSize: ms(12),
    color: '#6B7280',
    marginTop: vs(2),
  },
});
