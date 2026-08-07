import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { foodTheme } from '../constants/theme';
import type { DiningRestaurant } from '../mocks/types';
import RemoteImage from './RemoteImage';
import RatingBadge from './RatingBadge';
import FavoriteButton from './FavoriteButton';

interface RestaurantCardProps {
  restaurant: DiningRestaurant;
  onPress?: (restaurant: DiningRestaurant) => void;
}

/**
 * Single-column dining row — square image on the LEFT, details on the right.
 * Flat white card: no shadow, no border, compact text (matches the home feed).
 */
const RestaurantCard = memo(function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.98, { damping: 22, stiffness: 320 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 280 });
  };

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onPress?.(restaurant)}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${restaurant.name}, ${restaurant.cuisine}, rated ${restaurant.rating}, ${restaurant.distance} km away`}
      >
        <View style={styles.imageWrap}>
          <RemoteImage uri={restaurant.image} variant="restaurant" style={styles.image} />
          <View style={styles.fav}>
            <FavoriteButton id={restaurant.id} size={ms(30)} iconSize={ms(14)} />
          </View>
        </View>

        <View style={styles.details}>
          <AppText style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </AppText>
          <AppText style={styles.cuisine} numberOfLines={1}>
            {restaurant.cuisine}
          </AppText>

          <View style={styles.metricsRow}>
            <RatingBadge rating={restaurant.rating} size="sm" />
            <View style={styles.dot} />
            <AppText style={styles.metricText}>{restaurant.distance.toFixed(1)} km</AppText>
          </View>

          <View style={styles.locationRow}>
            <MapPin size={ms(10)} color={foodTheme.textMuted} strokeWidth={2.4} />
            <AppText style={styles.address} numberOfLines={1} ellipsizeMode="tail">
              {restaurant.address}
            </AppText>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default RestaurantCard;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: hs(16),
    marginBottom: vs(12),
    borderRadius: ms(14),
    backgroundColor: foodTheme.card,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(14),
    padding: hs(10),
    gap: hs(10),
  },
  imageWrap: {
    position: 'relative',
    width: ms(100),
    height: ms(100),
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: ms(12),
    backgroundColor: foodTheme.divider,
  },
  fav: {
    position: 'absolute',
    top: vs(6),
    right: hs(6),
  },
  details: {
    flex: 1,
    gap: vs(3),
  },
  name: {
    fontSize: ms(14.5),
    fontWeight: '700',
    color: foodTheme.textPrimary,
  },
  cuisine: {
    fontSize: ms(11),
    fontWeight: '400',
    color: foodTheme.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    marginTop: vs(2),
  },
  metricText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: foodTheme.textSecondary,
  },
  dot: {
    width: ms(3),
    height: ms(3),
    borderRadius: ms(1.5),
    backgroundColor: foodTheme.dotInactive,
    marginHorizontal: hs(1),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    marginTop: vs(1),
  },
  address: {
    flex: 1,
    fontSize: ms(10.5),
    fontWeight: '400',
    color: foodTheme.textMuted,
  },
});
