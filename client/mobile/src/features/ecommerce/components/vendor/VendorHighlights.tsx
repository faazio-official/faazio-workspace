import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ShieldCheck, Truck, Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { StoreProfile } from '@data/types';
import { VENDOR_INK, TEXT_DARK, TEXT_LIGHT, BG_GRAY } from './theme';

interface Highlight {
  icon: React.ReactNode;
  title: string;
  sub: string;
}

interface VendorHighlightsProps {
  vendor: Pick<StoreProfile, 'rating' | 'deliveryTime'>;
}

/**
 * Trust rail on the vendor header. Every badge derives from the store row (`rating` + `deliveryTime`)
 * instead of a hardcoded claim, so it never advertises a delivery time or rating the server did not
 * send. The "Verified Vendor" badge is a platform-level assertion (all listed vendors are onboarded).
 */
const VendorHighlights = memo(function VendorHighlights({ vendor }: VendorHighlightsProps) {
  const highlights = useMemo<Highlight[]>(() => {
    const items: Highlight[] = [
      {
        icon: <ShieldCheck color={VENDOR_INK} size={ms(20)} strokeWidth={2.4} />,
        title: 'Verified Vendor',
        sub: 'Background verified',
      },
      {
        icon: <Truck color={VENDOR_INK} size={ms(20)} strokeWidth={2.4} />,
        title: 'Fast Delivery',
        sub: vendor.deliveryTime ? `${vendor.deliveryTime} delivery` : 'On-time delivery',
      },
    ];
    if (vendor.rating > 0) {
      items.push({
        icon: <Star color={VENDOR_INK} size={ms(20)} strokeWidth={2.4} />,
        title: vendor.rating >= 4.5 ? 'Top Rated' : 'Rated',
        sub: `${vendor.rating} ★ Rating`,
      });
    }
    return items;
  }, [vendor.deliveryTime, vendor.rating]);

  return (
    <View style={styles.container}>
      {highlights.map((h, i) => (
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
