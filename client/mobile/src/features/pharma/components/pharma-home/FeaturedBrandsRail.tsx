import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { PharmaFeaturedBrand } from '../../mocks/pharmaHomeFeed';
import PharmaSectionHeader from './PharmaSectionHeader';
import FeaturedBrandCard from './cards/FeaturedBrandCard';

const ITEM_W = hs(84);

const BrandSeparator = () => <View style={styles.separator} />;

interface FeaturedBrandsRailProps {
  brands: PharmaFeaturedBrand[];
  onPress?: (brand: PharmaFeaturedBrand) => void;
  onViewAll?: () => void;
}

const FeaturedBrandsRail = memo(function FeaturedBrandsRail({
  brands,
  onPress,
  onViewAll,
}: FeaturedBrandsRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: PharmaFeaturedBrand }) => (
      <FeaturedBrandCard item={item} width={ITEM_W} onPress={() => onPress?.(item)} />
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <PharmaSectionHeader title="Featured Brands" onViewAll={onViewAll} />
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

export default FeaturedBrandsRail;

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
});
