import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { SnackBeverage } from '../mocks/homeFeed';
import RemoteImage from './RemoteImage';

const ITEM_W = 88;
const TILE_SIZE = 72;

interface SnacksRailProps {
  snacks: SnackBeverage[];
  onPress?: (snack: SnackBeverage) => void;
}

/**
 * Section 8 — "Snacks & Beverages" horizontal rail. Square tiles with soft,
 * light-grey backgrounds (rounded) holding cutout food imagery; label below.
 */
const SnacksRail = memo(function SnacksRail({ snacks, onPress }: SnacksRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: SnackBeverage }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.tile}>
          <RemoteImage uri={item.image} variant="dish" style={styles.tileImage} />
        </View>
        <AppText style={styles.label} numberOfLines={2}>
          {item.name}
        </AppText>
      </TouchableOpacity>
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={snacks}
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

export default SnacksRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
    gap: hs(12),
  },
  item: {
    width: ITEM_W,
    alignItems: 'center',
    gap: vs(6),
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: ms(12),
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImage: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: '#F5F5F5',
  },
  label: {
    fontSize: ms(11),
    fontWeight: '400',
    color: '#1E2022',
    textAlign: 'center',
  },
});
