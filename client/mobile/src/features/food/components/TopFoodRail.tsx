import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { FoodType } from '../mocks/homeFeed';
import RemoteImage from './RemoteImage';

const ITEM_W = 112;
const IMG_SIZE = 84;

interface TopFoodRailProps {
  foods: FoodType[];
  onPress?: (food: FoodType) => void;
}

/**
 * Section 5 — "Top Food To Order" horizontal rail. Circular food image on top,
 * centered bold title + centered green-star rating below.
 */
const TopFoodRail = memo(function TopFoodRail({ foods, onPress }: TopFoodRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: FoodType }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, rated ${item.rating}`}
      >
        <RemoteImage uri={item.image} variant="dish" style={styles.image} />
        <AppText style={styles.name} numberOfLines={1}>
          {item.name}
        </AppText>
        <View style={styles.ratingRow}>
          <Star size={ms(12)} color={foodTheme.ratingGreen} fill={foodTheme.ratingGreen} strokeWidth={2.2} />
          <AppText style={styles.ratingText}>{item.rating.toFixed(1)}</AppText>
        </View>
      </TouchableOpacity>
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={foods}
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

export default TopFoodRail;

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: vs(4),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  item: {
    width: ITEM_W,
    alignItems: 'center',
    marginRight: hs(18),
  },
  image: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: IMG_SIZE / 2,
    backgroundColor: foodTheme.divider,
  },
  name: {
    fontSize: ms(13),
    fontWeight: '700',
    color: foodTheme.textPrimary,
    textAlign: 'center',
    marginTop: vs(6),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
    marginTop: vs(2),
  },
  ratingText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: foodTheme.textSecondary,
  },
});
