import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Bike, ShoppingBag } from 'lucide-react-native';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { StoreProfile } from '@data/types';
import type { FulfillmentMode } from '@data/types';
import { PHARMA_TEAL, PHARMA_INK } from '../mocks/pharmaHomeFeed';

interface PharmaFulfilmentSheetProps {
  visible: boolean;
  vendor: StoreProfile | null;
  onRequestClose: () => void;
  onConfirm: (fulfillment: FulfillmentMode) => void;
}

const PharmaFulfilmentSheet = memo(function PharmaFulfilmentSheet({
  visible,
  vendor,
  onRequestClose,
  onConfirm,
}: PharmaFulfilmentSheetProps) {
  if (!vendor) return null;
  return (
    <SlideUpSheet visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.grabBar} />
      <AppText style={styles.title}>Choose delivery type</AppText>
      <AppText style={styles.subtitle} numberOfLines={1}>
        {vendor.name}
      </AppText>

      <TouchableOpacity
        style={styles.option}
        onPress={() => onConfirm('DELIVERY')}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={styles.optionIcon}>
          <Bike size={ms(20)} color={PHARMA_TEAL} strokeWidth={2} />
        </View>
        <View style={styles.optionBody}>
          <AppText style={styles.optionTitle}>Delivery</AppText>
          <AppText style={styles.optionDesc}>Delivered to your address</AppText>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, styles.optionLast]}
        onPress={() => onConfirm('PICKUP')}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={styles.optionIcon}>
          <ShoppingBag size={ms(20)} color={PHARMA_TEAL} strokeWidth={2} />
        </View>
        <View style={styles.optionBody}>
          <AppText style={styles.optionTitle}>Self Pickup</AppText>
          <AppText style={styles.optionDesc} numberOfLines={1}>
            Pickup from {vendor.name}
          </AppText>
        </View>
      </TouchableOpacity>
    </SlideUpSheet>
  );
});

export default PharmaFulfilmentSheet;

const styles = StyleSheet.create({
  grabBar: {
    width: ms(40),
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: vs(12),
  },
  title: {
    fontSize: ms(16),
    fontWeight: '900',
    color: PHARMA_INK,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#64748B',
    alignSelf: 'flex-start',
    marginTop: vs(2),
    marginBottom: vs(16),
  },
  option: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: hs(14),
    marginBottom: vs(10),
  },
  optionLast: {
    marginBottom: vs(8),
  },
  optionIcon: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(12),
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: PHARMA_INK,
  },
  optionDesc: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: vs(2),
  },
});
