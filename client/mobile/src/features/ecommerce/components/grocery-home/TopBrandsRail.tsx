import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, ms, vs } from '@/utils/responsive';
import type { GroceryTopBrand } from '../../mocks/groceryHomeFeed';
import GroceryImage from './GroceryImage';
import GrocerySectionHeader from './GrocerySectionHeader';

const ITEM_W = hs(84);

const BrandSeparator = () => <View style={styles.separator} />;

interface TopBrandsRailProps {
  brands: GroceryTopBrand[];
  onPress?: (brand: GroceryTopBrand) => void;
  onViewAll?: () => void;
}

const TopBrandsRail = memo(function TopBrandsRail({
  brands,
  onPress,
  onViewAll,
}: TopBrandsRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: GroceryTopBrand }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.circle}>
          <GroceryImage uri={item.logoUrl} style={styles.image} contentFit="contain" />
        </View>
      </TouchableOpacity>
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <GrocerySectionHeader title="Top Brands" onViewAll={onViewAll} />
      <FlashList
        data={brands}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={BrandSeparator}
        bounces={false}
      />
    </View>
  );
});

export default TopBrandsRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  separator: {
    width: hs(12),
  },
  item: {
    width: ITEM_W,
    alignItems: 'center',
  },
  circle: {
    width: ITEM_W,
    height: ITEM_W,
    borderRadius: ITEM_W / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: ms(12),
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
