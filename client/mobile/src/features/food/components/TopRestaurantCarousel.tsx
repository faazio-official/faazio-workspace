import React, { memo, useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SCREEN_W, hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { foodTheme } from '../constants/theme';
import type { DiningRestaurant } from '../mocks/types';
import RatingBadge from './RatingBadge';
import DistanceBadge from './DistanceBadge';
import FavoriteButton from './FavoriteButton';

const CARD_W = SCREEN_W * 0.9;
const GAP = 12;
const SNAP = CARD_W + GAP;
const PAD = (SCREEN_W - CARD_W) / 2;
const CARD_H = 250;

interface TopRestaurantCarouselProps {
  restaurants: DiningRestaurant[];
  onPress?: (restaurant: DiningRestaurant) => void;
}

/**
 * Premium hero carousel. Card = 90% of screen width, 250 tall, snap + center,
 * scale 1.0 / 0.92, opacity 1.0 / 0.8, parallax image, pagination dots.
 * Autoplay disabled.
 */
const TopRestaurantCarousel = memo(function TopRestaurantCarousel({
  restaurants,
  onPress,
}: TopRestaurantCarouselProps) {
  const scrollX = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.value = event.nativeEvent.contentOffset.x;
  }, []);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / SNAP);
      setActiveIndex(Math.max(0, Math.min(restaurants.length - 1, index)));
    },
    [restaurants.length],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: DiningRestaurant; index: number }) => (
      <HeroCard restaurant={item} index={index} scrollX={scrollX} onPress={onPress} />
    ),
    [onPress],
  );

  return (
    <View>
      <FlashList
        data={restaurants}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: PAD }}
        bounces={false}
      />
      {restaurants.length > 1 ? (
        <PaginationDots count={restaurants.length} activeIndex={activeIndex} />
      ) : null}
    </View>
  );
});

const HeroCard = memo(function HeroCard({
  restaurant,
  index,
  scrollX,
  onPress,
}: {
  restaurant: DiningRestaurant;
  index: number;
  scrollX: SharedValue<number>;
  onPress?: (restaurant: DiningRestaurant) => void;
}) {
  const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];

  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollX.value, inputRange, [0.92, 1, 0.92], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.8, 1, 0.8], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  const parallaxStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [48, 0, -48],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX }] };
  });

  const handlePress = () => {
    onPress?.(restaurant);
  };

  return (
    <Animated.View style={[{ width: CARD_W, marginRight: GAP }, cardStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${restaurant.name}, rated ${restaurant.rating}, ${restaurant.distance} km away`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, parallaxStyle]}>
          <ExpoImage
            source={{ uri: restaurant.image }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={220}
          />
        </Animated.View>
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.fav}>
          <FavoriteButton id={restaurant.id} />
        </View>
        <View style={styles.content}>
          <AppText style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </AppText>
          <AppText style={styles.cuisine} numberOfLines={1}>
            {restaurant.cuisine}
          </AppText>
          <View style={styles.metaRow}>
            <RatingBadge rating={restaurant.rating} />
            <AppText style={styles.priceForTwo}>
              ₹{restaurant.priceForTwo.toLocaleString('en-IN')} for two
            </AppText>
          </View>
          <View style={styles.distanceRow}>
            <DistanceBadge distance={restaurant.distance} light />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const PaginationDots = memo(function PaginationDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.dots} accessibilityRole="image" accessibilityLabel={`Slide ${activeIndex + 1} of ${count}`}>
      {Array.from({ length: count }).map((_, i) => {
        const active = i === activeIndex;
        return (
          <View
            key={i}
            style={[styles.dot, active ? styles.dotActive : styles.dotInactive]}
          />
        );
      })}
    </View>
  );
});

export default TopRestaurantCarousel;

const styles = StyleSheet.create({
  card: {
    height: CARD_H,
    borderRadius: ms(20),
    backgroundColor: foodTheme.card,
    overflow: 'hidden',
    ...foodTheme.shadowCard,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fav: {
    position: 'absolute',
    top: vs(12),
    right: hs(12),
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: hs(16),
    paddingBottom: vs(16),
    paddingTop: vs(40),
  },
  name: {
    fontSize: ms(18),
    fontWeight: '600',
    color: foodTheme.white,
  },
  cuisine: {
    fontSize: ms(14),
    fontWeight: '400',
    color: 'rgba(255,255,255,0.82)',
    marginTop: vs(2),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginTop: vs(10),
  },
  priceForTwo: {
    fontSize: ms(14),
    fontWeight: '500',
    color: foodTheme.white,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(6),
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: hs(6),
    marginTop: vs(12),
  },
  dot: {
    height: ms(6),
    borderRadius: ms(3),
  },
  dotActive: {
    width: ms(16),
    backgroundColor: foodTheme.primary,
  },
  dotInactive: {
    width: ms(6),
    backgroundColor: foodTheme.dotInactive,
  },
});
