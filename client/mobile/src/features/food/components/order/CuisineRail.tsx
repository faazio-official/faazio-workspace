import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { CuisineItem } from '../../mocks/orderFeed';
import RemoteImage from '../RemoteImage';

const ITEM_W = 76;
const IMG_SIZE = 68;

interface CuisineRailProps {
  cuisines: CuisineItem[];
  onPress?: (cuisine: CuisineItem) => void;
}

/**
 * Section 6 — "Explore Cuisines" horizontal rail. Circular cutout cuisine
 * images with centered labels below (North Indian, South Indian, ...).
 */
const CuisineRail = memo(function CuisineRail({ cuisines, onPress }: CuisineRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: CuisineItem }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <RemoteImage uri={item.image} variant="dish" style={styles.image} />
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
        data={cuisines}
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

export default CuisineRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
    gap: hs(8),
  },
  item: {
    width: ITEM_W,
    alignItems: 'center',
    gap: vs(6),
  },
  image: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: IMG_SIZE / 2,
    backgroundColor: '#F5F5F5',
  },
  label: {
    fontSize: ms(11),
    fontWeight: '400',
    color: '#1E2022',
    textAlign: 'center',
  },
});
