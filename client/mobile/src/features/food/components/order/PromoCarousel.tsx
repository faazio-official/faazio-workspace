import React, { memo, useCallback, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Clock } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../../constants/theme';
import type { Promo } from '../../mocks/orderFeed';
import RemoteImage from '../RemoteImage';

interface PromoCarouselProps {
  promos: Promo[];
  onPress?: (promo: Promo) => void;
}

const BANNER_HEIGHT = 160;

/**
 * Section 3 — hero promotional banner carousel. Paging FlatList; each banner is
 * a 60% brand-colored panel (badge, title, subtext, dashed coupon box, "T&C
 * Apply") that blends into a food image on the right 40%. Pagination dots below
 * (active = wide orange pill, inactive = small grey circles).
 */
const PromoCarousel = memo(function PromoCarousel({ promos, onPress }: PromoCarouselProps) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const pageWidth = width - hs(32);

  const onMomentumScrollEnd = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setActiveIndex(Math.max(0, Math.min(index, promos.length - 1)));
  }, [pageWidth, promos.length]);

  const renderItem = useCallback(
    ({ item }: { item: Promo }) => (
      <TouchableOpacity
        style={[styles.banner, { width: pageWidth }]}
        onPress={() => onPress?.(item)}
        activeOpacity={0.94}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. Use code ${item.code}`}
      >
        <View style={[styles.panel, { backgroundColor: item.bgColor }]}>
          <View style={styles.badge}>
            <Clock size={ms(11)} color={item.bgColor} strokeWidth={2.6} fill={item.bgColor} />
            <AppText style={[styles.badgeText, { color: item.bgColor }]}>HAPPY HOUR</AppText>
          </View>
          <AppText style={styles.title} numberOfLines={1}>
            {item.title}
          </AppText>
          <AppText style={styles.subtext} numberOfLines={1}>
            {item.subtext}
          </AppText>
          <View style={styles.couponBox}>
            <AppText style={styles.couponText}>Use code: {item.code}</AppText>
          </View>
          <AppText style={styles.terms}>T&C Apply</AppText>
        </View>
        <View style={styles.imageWrap}>
          <RemoteImage uri={item.image} variant="dish" style={styles.image} />
        </View>
      </TouchableOpacity>
    ),
    [pageWidth, onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={promos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={styles.content}
        bounces={false}
      />
      <View style={styles.dots}>
        {promos.map((promo, index) => (
          <View
            key={promo.id}
            style={[styles.dot, index === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
});

export default PromoCarousel;

const styles = StyleSheet.create({
  wrap: {
    marginTop: vs(20),
    paddingBottom: vs(4),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  banner: {
    height: vs(BANNER_HEIGHT),
    borderRadius: ms(16),
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#4A235A',
    marginRight: hs(12),
  },
  panel: {
    width: '60%',
    paddingHorizontal: hs(14),
    paddingVertical: vs(14),
    justifyContent: 'center',
    gap: vs(4),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    gap: hs(4),
    marginBottom: vs(4),
  },
  badgeText: {
    fontSize: ms(9),
    fontWeight: '800',
    letterSpacing: ms(0.6),
  },
  title: {
    fontSize: ms(22),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtext: {
    fontSize: ms(11),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  couponBox: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: ms(6),
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    marginTop: vs(2),
  },
  couponText: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  terms: {
    fontSize: ms(8.5),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 'auto',
  },
  imageWrap: {
    width: '40%',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: foodTheme.divider,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(5),
    marginTop: vs(10),
  },
  dot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: ms(20),
    backgroundColor: foodTheme.primary,
  },
});
