import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ShieldCheck, Truck, Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { VENDOR_YELLOW, TEXT_DARK, TEXT_LIGHT, BG_GRAY } from './theme';

interface Highlight {
  icon: React.ReactNode;
  title: string;
  sub: string;
}

const HIGHLIGHTS: Highlight[] = [
  { icon: <ShieldCheck color={VENDOR_YELLOW} size={ms(20)} strokeWidth={2.4} />, title: 'Verified Vendor', sub: 'Background verified' },
  { icon: <Truck color={VENDOR_YELLOW} size={ms(20)} strokeWidth={2.4} />, title: 'Fast Delivery', sub: '30-45 mins delivery' },
  { icon: <Star color={VENDOR_YELLOW} size={ms(20)} strokeWidth={2.4} />, title: 'Top Rated', sub: '4.6 ★ Rating' },
];

const VendorHighlights = memo(function VendorHighlights() {
  return (
    <View style={styles.container}>
      {HIGHLIGHTS.map((h, i) => (
        <React.Fragment key={h.title}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.item}>
            <View style={styles.iconCircle}>{h.icon}</View>
            <AppText style={styles.title}>{h.title}</AppText>
            <AppText style={styles.sub}>{h.sub}</AppText>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
});

export default VendorHighlights;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: BG_GRAY,
    marginHorizontal: hs(16),
    borderRadius: ms(12),
    paddingVertical: vs(12),
    justifyContent: 'space-evenly',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  item: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: hs(4),
  },
  iconCircle: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(4),
  },
  title: {
    fontSize: ms(11),
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  sub: {
    fontSize: ms(9),
    color: TEXT_LIGHT,
    textAlign: 'center',
    marginTop: vs(2),
  },
  divider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: vs(8),
  },
});
