import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { FoodType } from '../mocks/homeFeed';
import RemoteImage from './RemoteImage';

const ITEM_W = 76;
const IMG_SIZE = 68;

interface MindGridRailProps {
  items: FoodType[];
  onPress?: (item: FoodType) => void;
}

/**
 * Section 4 — "What's on your mind?" circular cutout food images with centered
 * labels below. Reuses the food-type fixtures (Burgers, Pizza, Biryani, ...).
 */
const MindGridRail = memo(function MindGridRail({ items, onPress }: MindGridRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: FoodType }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <RemoteImage uri={item.image} variant="dish" style={styles.image} />
        <AppText style={styles.label} numberOfLines={1}>
          {item.name}
        </AppText>
      </TouchableOpacity>
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={items}
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

export default MindGridRail;

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
