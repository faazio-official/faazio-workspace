import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { DiningRestaurant } from '../mocks/types';
import RemoteImage from './RemoteImage';
import RatingBadge from './RatingBadge';

const CARD_W = 196;

interface PopularSpotRailProps {
  spots: DiningRestaurant[];
  onPress?: (spot: DiningRestaurant) => void;
}

/**
 * Section 4 — "Popular Dining Spots" horizontal rail. Landscape image on top
 * (rounded all corners), white body with the title and a green rating badge.
 */
const PopularSpotRail = memo(function PopularSpotRail({ spots, onPress }: PopularSpotRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: DiningRestaurant }) => (
      <PopularSpotCard spot={item} onPress={onPress} />
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={spots}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      />
    </View>
  );
});

const PopularSpotCard = memo(function PopularSpotCard({
  spot,
  onPress,
}: {
  spot: DiningRestaurant;
  onPress?: (spot: DiningRestaurant) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(spot)}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${spot.name}, ${spot.cuisine}`}
    >
      <RemoteImage uri={spot.image} variant="restaurant" style={styles.image} />
      <View style={styles.body}>
        <AppText style={styles.name} numberOfLines={1}>
          {spot.name}
        </AppText>
        <View style={styles.footer}>
          <RatingBadge rating={spot.rating} size="sm" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default PopularSpotRail;

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: vs(4),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  card: {
    width: CARD_W,
    borderRadius: ms(16),
    marginRight: hs(18),
    backgroundColor: foodTheme.card,
  },
  image: {
    width: '100%',
    height: vs(118),
    borderRadius: ms(16),
    backgroundColor: foodTheme.divider,
  },
  body: {
    padding: hs(12),
    gap: vs(5),
  },
  name: {
    fontSize: ms(13.5),
    fontWeight: '700',
    color: foodTheme.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(8),
  },
});
