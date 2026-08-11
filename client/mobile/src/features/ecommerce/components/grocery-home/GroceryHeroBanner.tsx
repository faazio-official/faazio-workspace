import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import {
  GROCERY_GREEN_DARK,
  GROCERY_PALE,
  GROCERY_HERO_IMAGE,
} from '../../mocks/groceryHomeFeed';
import GroceryImage from './GroceryImage';

interface GroceryHeroBannerProps {
  onShopNow?: () => void;
}

const GroceryHeroBanner = memo(function GroceryHeroBanner({
  onShopNow,
}: GroceryHeroBannerProps) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={['#F0F8EC', '#E4F1DD']} style={styles.card}>
        <View style={styles.left}>
          <View style={styles.titleBlock}>
            <AppText style={styles.title}>Groceries in</AppText>
            <View style={styles.titleRow}>
              <Zap size={ms(17)} color="#FACC15" fill="#FACC15" strokeWidth={2} />
              <AppText style={styles.titleAccent}>10 minutes</AppText>
            </View>
          </View>
          <AppText style={styles.subtext} numberOfLines={2}>
            Everything you need, delivered in record time.
          </AppText>
          <TouchableOpacity
            style={styles.cta}
            onPress={onShopNow}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Shop Now"
          >
            <AppText style={styles.ctaText}>Shop Now →</AppText>
          </TouchableOpacity>
        </View>
        <GroceryImage uri={GROCERY_HERO_IMAGE} style={styles.image} />
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>
            UP TO{'\n'}50% OFF
          </AppText>
        </View>
      </LinearGradient>
    </View>
  );
});

export default GroceryHeroBanner;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: hs(16),
    marginTop: vs(16),
  },
  card: {
    height: vs(180),
    borderRadius: ms(16),
    overflow: 'hidden',
    flexDirection: 'row',
  },
  left: {
    width: '58%',
    padding: ms(16),
    justifyContent: 'center',
    gap: vs(6),
    zIndex: 1,
  },
  titleBlock: {
    gap: vs(1),
  },
  title: {
    fontSize: ms(20),
    fontWeight: '900',
    color: GROCERY_GREEN_DARK,
    lineHeight: ms(22),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  titleAccent: {
    fontSize: ms(20),
    fontWeight: '900',
    color: GROCERY_GREEN_DARK,
    lineHeight: ms(22),
  },
  subtext: {
    fontSize: ms(10),
    fontWeight: '500',
    color: '#4B5563',
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: GROCERY_GREEN_DARK,
    borderRadius: ms(20),
    paddingHorizontal: ms(14),
    paddingVertical: vs(8),
    marginTop: vs(4),
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
    backgroundColor: GROCERY_PALE,
    borderWidth: 1,
    borderColor: '#BFDDBF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: {
    fontSize: ms(8.5),
    fontWeight: '900',
    color: GROCERY_GREEN_DARK,
    textAlign: 'center',
    lineHeight: ms(10),
  },
});
