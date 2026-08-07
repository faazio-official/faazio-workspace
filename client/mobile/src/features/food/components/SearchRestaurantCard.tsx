import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, MapPin } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { DiningRestaurant } from '../mocks/types';
import RemoteImage from './RemoteImage';
import FavoriteButton from './FavoriteButton';

interface SearchRestaurantCardProps {
  restaurant: DiningRestaurant;
  onPress?: (restaurant: DiningRestaurant) => void;
}

const minutesLabel = (deliveryTime: string) => {
  const trimmed = deliveryTime.trim();
  return /^(\d+) min$/.test(trimmed) ? `${trimmed} s` : trimmed;
};

/**
 * Search result restaurant card — row layout per the search spec: square
 * thumbnail left with an optional offer badge overlay, details right (name +
 * heart, rating/time/cost metrics, cuisines, distance + neighborhood).
 */
const SearchRestaurantCard = memo(function SearchRestaurantCard({ restaurant, onPress }: SearchRestaurantCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(restaurant)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${restaurant.cuisine}, rated ${restaurant.rating}`}
    >
      <View style={styles.imageWrap}>
        <RemoteImage uri={restaurant.image} variant="restaurant" style={styles.image} />
        {restaurant.offerTag ? (
          <View style={styles.offerBadge}>
            <AppText style={styles.offerText} numberOfLines={1}>
              {restaurant.offerTag}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.details}>
        <View style={styles.headerRow}>
          <AppText style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </AppText>
          <FavoriteButton id={restaurant.id} size={ms(28)} iconSize={ms(15)} />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.ratingBadge}>
            <Star size={ms(10)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.5} />
            <AppText style={styles.ratingText}>{restaurant.rating.toFixed(1)}</AppText>
          </View>
          <View style={styles.dot} />
          <AppText style={styles.metricText}>{minutesLabel(restaurant.deliveryTime)}</AppText>
          <View style={styles.dot} />
          <AppText style={styles.metricText}>₹{restaurant.priceForTwo.toLocaleString('en-IN')} for two</AppText>
        </View>

        <AppText style={styles.cuisines} numberOfLines={1}>
          {restaurant.cuisines.join(', ')}
        </AppText>

        <View style={styles.locationRow}>
          <MapPin size={ms(11)} color={foodTheme.textMuted} strokeWidth={2.4} />
          <AppText style={styles.location} numberOfLines={1}>
            {restaurant.distance.toFixed(1)} km • {restaurant.neighborhood}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default SearchRestaurantCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: hs(12),
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginHorizontal: hs(16),
    marginBottom: vs(12),
  },
  imageWrap: {
    width: ms(100),
    height: ms(100),
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: ms(12),
    backgroundColor: foodTheme.divider,
  },
  offerBadge: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    backgroundColor: foodTheme.primary,
    borderBottomLeftRadius: ms(12),
    borderTopRightRadius: ms(8),
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
    maxWidth: ms(100),
  },
  offerText: {
    fontSize: ms(9),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  details: {
    flex: 1,
    paddingLeft: hs(12),
    gap: vs(4),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: hs(6),
  },
  name: {
    flex: 1,
    fontSize: ms(15),
    fontWeight: '700',
    color: foodTheme.textPrimary,
    lineHeight: ms(19),
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    backgroundColor: foodTheme.ratingGreen,
    borderRadius: ms(4),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: ms(11),
    fontWeight: '800',
  },
  dot: {
    width: ms(3),
    height: ms(3),
    borderRadius: ms(1.5),
    backgroundColor: foodTheme.dotInactive,
  },
  metricText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: foodTheme.textSecondary,
  },
  cuisines: {
    fontSize: ms(11.5),
    fontWeight: '400',
    color: '#666666',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    marginTop: vs(1),
  },
  location: {
    flex: 1,
    fontSize: ms(10.5),
    fontWeight: '400',
    color: '#666666',
  },
});
