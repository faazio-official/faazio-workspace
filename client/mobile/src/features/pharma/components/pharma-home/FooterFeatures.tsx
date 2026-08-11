import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ShieldCheck, Package, Headphones } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { PHARMA_INK, PHARMA_TEAL } from '../../mocks/pharmaHomeFeed';

const ITEMS = [
  { id: 'ff-1', label: 'Licensed Pharmacy', icon: ShieldCheck },
  { id: 'ff-2', label: 'Secure Packaging', icon: Package },
  { id: 'ff-3', label: '24x7 Customer Care', icon: Headphones },
];

const FooterFeatures = memo(function FooterFeatures() {
  return (
    <View style={styles.row}>
      {ITEMS.map((item, idx) => {
        const Icon = item.icon;
        return (
          <View key={item.id} style={[styles.item, idx > 0 && styles.itemBorder]}>
            <Icon size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
            <AppText style={styles.label} numberOfLines={2}>
              {item.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
});

export default FooterFeatures;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: vs(20),
    paddingHorizontal: hs(16),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(4),
    paddingHorizontal: hs(4),
  },
  itemBorder: {
    borderLeftWidth: 1,
    borderLeftColor: '#EEEEEE',
  },
  label: {
    fontSize: ms(9),
    fontWeight: '600',
    color: PHARMA_INK,
    textAlign: 'center',
  },
});
