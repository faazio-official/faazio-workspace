import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { NearbyRestaurant } from '../mocks/homeFeed';
import RemoteImage from './RemoteImage';
import RatingBadge from './RatingBadge';

interface NearbyRestaurantRowProps {
  restaurant: NearbyRestaurant;
  onPress?: (restaurant: NearbyRestaurant) => void;
}

/**
 * Section 6 — vertical list row. Square image (96×96) left, details middle
 * (title, subtitle, rating + distance) on the right.
 */
const NearbyRestaurantRow = memo(function NearbyRestaurantRow({
  restaurant,
  onPress,
}: NearbyRestaurantRowProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(restaurant)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${restaurant.cuisine}`}
    >
      <RemoteImage uri={restaurant.image} variant="restaurant" style={styles.image} />

      <View style={styles.details}>
        <AppText style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </AppText>
        <AppText style={styles.cuisine} numberOfLines={1}>
          {restaurant.cuisine}
        </AppText>

        <View style={styles.metricsRow}>
          <RatingBadge rating={restaurant.rating} size="sm" />
          <MapPin size={ms(11)} color={foodTheme.textMuted} strokeWidth={2.4} />
          <AppText style={styles.metricText}>{restaurant.distance.toFixed(1)} km</AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default NearbyRestaurantRow;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: foodTheme.card,
    borderRadius: ms(14),
    padding: hs(10),
    gap: hs(10),
    marginHorizontal: hs(16),
    marginBottom: vs(12),
  },
  image: {
    width: ms(96),
    height: ms(96),
    borderRadius: ms(12),
    backgroundColor: foodTheme.divider,
  },
  details: {
    flex: 1,
    gap: vs(3),
  },
  name: {
    fontSize: ms(15),
    fontWeight: '700',
    color: foodTheme.textPrimary,
  },
  cuisine: {
    fontSize: ms(11.5),
    fontWeight: '400',
    color: foodTheme.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginTop: vs(2),
  },
  metricText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: foodTheme.textSecondary,
  },
});
