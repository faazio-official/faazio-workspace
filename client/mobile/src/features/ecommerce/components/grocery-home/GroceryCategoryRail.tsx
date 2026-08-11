import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { GroceryCategory } from '../../mocks/groceryHomeFeed';
import { GROCERY_INK } from '../../mocks/groceryHomeFeed';
import GroceryImage from './GroceryImage';
import GrocerySectionHeader from './GrocerySectionHeader';

const ITEM_W = hs(72);

const CategorySeparator = () => <View style={styles.separator} />;

interface GroceryCategoryRailProps {
  categories: GroceryCategory[];
  onPress?: (category: GroceryCategory) => void;
  onViewAll?: () => void;
}

const GroceryCategoryRail = memo(function GroceryCategoryRail({
  categories,
  onPress,
  onViewAll,
}: GroceryCategoryRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: GroceryCategory }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.circle}>
          <GroceryImage uri={item.cutoutImageUrl} style={styles.image} />
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
      <GrocerySectionHeader title="Shop by Category" onViewAll={onViewAll} />
      <FlashList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={CategorySeparator}
        bounces={false}
      />
    </View>
  );
});

export default GroceryCategoryRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  separator: {
    width: hs(16),
  },
  item: {
    width: ITEM_W,
    alignItems: 'center',
  },
  circle: {
    width: ITEM_W,
    height: ITEM_W,
    borderRadius: ITEM_W / 2,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: ITEM_W / 2,
  },
  label: {
    fontSize: ms(9),
    fontWeight: '600',
    color: GROCERY_INK,
    textAlign: 'center',
    lineHeight: ms(12),
    minHeight: vs(24),
    marginTop: vs(6),
  },
});
