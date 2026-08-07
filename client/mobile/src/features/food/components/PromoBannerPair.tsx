import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { DINING_BANNER, ORDER_FOOD_BANNER } from '../constants/assets';

interface PromoBanner {
  id: string;
  image: any;
  label: string;
  onPress?: () => void;
}

interface PromoBannerPairProps {
  onDiningPress?: () => void;
  onOrderFoodPress?: () => void;
}

/**
 * Two local AVIF promotional banners side by side (49% width each). These are
 * the ONLY images pulled from local assets — never network-fetched.
 */
const PromoBannerPair = memo(function PromoBannerPair({
  onDiningPress,
  onOrderFoodPress,
}: PromoBannerPairProps) {
  const banners: PromoBanner[] = [
    { id: 'dining', image: DINING_BANNER, label: 'Premium Dining', onPress: onDiningPress },
    { id: 'order', image: ORDER_FOOD_BANNER, label: 'Order Food', onPress: onOrderFoodPress },
  ];

  return (
    <View style={styles.row}>
      {banners.map((banner) => (
        <BannerCard key={banner.id} banner={banner} />
      ))}
    </View>
  );
});

const BannerCard = memo(function BannerCard({ banner }: { banner: PromoBanner }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 260 });
  };

  return (
    <Animated.View style={[styles.cardWrap, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={banner.onPress}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={banner.label}
      >
        <ExpoImage
          source={banner.image}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={180}
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

export default PromoBannerPair;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
  },
  cardWrap: {
    width: '49%',
    height: vs(118),
    borderRadius: ms(18),
    backgroundColor: foodTheme.card,
    ...foodTheme.shadowCard,
  },
  card: {
    flex: 1,
    borderRadius: ms(18),
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
