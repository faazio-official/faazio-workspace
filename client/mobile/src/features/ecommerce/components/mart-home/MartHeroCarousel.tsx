import React, { memo, useCallback, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { MartHeroBanner } from '../../mocks/martHomeFeed';
import MartImage from './MartImage';

const MART_YELLOW = '#FFC107';

interface MartHeroCarouselProps {
  banners: MartHeroBanner[];
  onPress?: (banner: MartHeroBanner) => void;
}

const MartHeroCarousel = memo(function MartHeroCarousel({
  banners,
  onPress,
}: MartHeroCarouselProps) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const pageWidth = width - hs(32);

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setActiveIndex(Math.max(0, Math.min(index, banners.length - 1)));
    },
    [pageWidth, banners.length],
  );

  const renderItem = useCallback(
    ({ item }: { item: MartHeroBanner }) => (
      <TouchableOpacity
        style={[styles.banner, { width: pageWidth }]}
        onPress={() => onPress?.(item)}
        activeOpacity={0.94}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.subtitle}`}
      >
        <MartImage uri={item.imageUrl} style={styles.image} contentFit="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.62)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.discountBadge}>
          <AppText style={styles.discountText}>{item.subtitle}</AppText>
        </View>
        <View style={styles.overlay}>
          <AppText style={styles.smallLabel}>MEGA MART</AppText>
          <AppText style={styles.title} numberOfLines={2}>
            {item.title}
          </AppText>
          <AppText style={styles.subtext} numberOfLines={1}>
            Groceries, Essentials & more...
          </AppText>
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.8}>
            <AppText style={styles.ctaText}>Shop Now →</AppText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ),
    [pageWidth, onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={banners}
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
        {banners.map((banner, index) => (
          <View
            key={banner.id}
            style={[styles.dot, index === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
});

export default MartHeroCarousel;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: hs(16),
    marginTop: vs(8),
    paddingBottom: vs(4),
  },
  content: {},
  banner: {
    aspectRatio: 16 / 9,
    borderRadius: ms(16),
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: vs(10),
    right: hs(10),
    backgroundColor: MART_YELLOW,
    borderRadius: ms(12),
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  discountText: {
    fontSize: ms(8),
    fontWeight: '800',
    color: '#1E2022',
  },
  overlay: {
    position: 'absolute',
    left: hs(14),
    right: hs(14),
    bottom: vs(12),
    gap: vs(4),
  },
  smallLabel: {
    fontSize: ms(9),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  title: {
    fontSize: ms(18),
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: ms(22),
  },
  subtext: {
    fontSize: ms(11),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.88)',
  },
  ctaBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(20),
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    marginTop: vs(6),
  },
  ctaText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#1E2022',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(5),
    marginTop: vs(8),
  },
  dot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: ms(20),
    backgroundColor: '#1E2022',
  },
});
