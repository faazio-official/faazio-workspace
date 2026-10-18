import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { PHARMA_HERO_IMAGE, PHARMA_PALE, PHARMA_TEAL, PHARMA_TEAL_DARK } from '../../mocks/pharmaHomeFeed';
import type { SduiBanner } from '@data/home/sdui';
import PharmaImage from './PharmaImage';

interface PharmaHeroBannerProps {
  onOrderNow?: () => void;
  /** Portal-owned organic hero (`pharmaHero.banners[0]`); falls back to the built-in card when absent. */
  banner?: SduiBanner;
}

const PharmaHeroBanner = memo(function PharmaHeroBanner({
  onOrderNow,
  banner,
}: PharmaHeroBannerProps) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={['#F0FDF8', '#E0F2F1']} style={styles.card}>
        <View style={styles.left}>
          <View style={styles.pill}>
            <AppText style={styles.pillText}>STAY HEALTHY</AppText>
          </View>
          <View style={styles.titleBlock}>
            {banner ? (
              <AppText style={styles.titleDark} numberOfLines={2}>{banner.title}</AppText>
            ) : (
              <>
                <AppText style={styles.titleDark}>Your Health,</AppText>
                <AppText style={styles.titleTeal}>Our Priority</AppText>
              </>
            )}
          </View>
          <AppText style={styles.subtext} numberOfLines={1}>
            {banner?.subtitle ?? 'Get 25% OFF on your first order'}
          </AppText>
          <View style={styles.coupon}>
            <AppText style={styles.couponText}>Use code: HEALTH25</AppText>
          </View>
          <TouchableOpacity
            style={styles.cta}
            onPress={onOrderNow}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Order Now"
          >
            <AppText style={styles.ctaText}>Order Now →</AppText>
          </TouchableOpacity>
        </View>
        <PharmaImage uri={banner?.imageUrl ?? PHARMA_HERO_IMAGE} style={styles.image} contentFit="cover" />
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>
            UP TO{'\n'}50% OFF
          </AppText>
        </View>
      </LinearGradient>
      <View style={styles.dotsRow}>
        <View style={styles.dotActive} />
        <View style={styles.dotInactive} />
        <View style={styles.dotInactive} />
      </View>
    </View>
  );
});

export default PharmaHeroBanner;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: hs(16),
    marginTop: vs(16),
  },
  card: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: ms(16),
    overflow: 'hidden',
    flexDirection: 'row',
  },
  left: {
    width: '58%',
    padding: ms(14),
    justifyContent: 'center',
    gap: vs(4),
    zIndex: 1,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: PHARMA_TEAL_DARK,
    borderRadius: ms(10),
    paddingHorizontal: ms(8),
    paddingVertical: vs(3),
  },
  pillText: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  titleBlock: {
    gap: vs(0),
  },
  titleDark: {
    fontSize: ms(17),
    fontWeight: '900',
    color: PHARMA_TEAL_DARK,
    lineHeight: ms(19),
  },
  titleTeal: {
    fontSize: ms(17),
    fontWeight: '900',
    color: PHARMA_TEAL,
    lineHeight: ms(19),
  },
  subtext: {
    fontSize: ms(10),
    fontWeight: '500',
    color: '#4B5563',
  },
  coupon: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: PHARMA_TEAL,
    borderRadius: ms(6),
    paddingHorizontal: ms(8),
    paddingVertical: vs(2),
  },
  couponText: {
    fontSize: ms(9),
    fontWeight: '700',
    color: PHARMA_TEAL_DARK,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: PHARMA_TEAL,
    borderRadius: ms(20),
    paddingHorizontal: ms(14),
    paddingVertical: vs(7),
  },
  ctaText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '42%',
  },
  badge: {
    position: 'absolute',
    top: vs(10),
    right: hs(10),
    width: ms(60),
    height: ms(60),
    borderRadius: ms(30),
    backgroundColor: PHARMA_PALE,
    borderWidth: 1,
    borderColor: '#A9D6CF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: {
    fontSize: ms(8.5),
    fontWeight: '900',
    color: PHARMA_TEAL_DARK,
    textAlign: 'center',
    lineHeight: ms(10),
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: hs(6),
    marginTop: vs(10),
  },
  dotActive: {
    width: ms(14),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: PHARMA_TEAL,
  },
  dotInactive: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#E2E8F0',
  },
});
