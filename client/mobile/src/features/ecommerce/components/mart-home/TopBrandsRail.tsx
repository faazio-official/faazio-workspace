import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { MartTopBrand } from '../../mocks/martHomeFeed';
import MartImage from './MartImage';
import MartSectionHeader from './MartSectionHeader';

const ITEM_W = 90;

const BrandSeparator = () => <View style={styles.separator} />;

interface TopBrandsRailProps {
  brands: MartTopBrand[];
  onPress?: (brand: MartTopBrand) => void;
  onViewAll?: () => void;
}

const TopBrandsRail = memo(function TopBrandsRail({
  brands,
  onPress,
  onViewAll,
}: TopBrandsRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: MartTopBrand }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.imageWrap}>
          <MartImage uri={item.logoUrl} style={styles.image} />
        </View>
        <AppText style={styles.label} numberOfLines={1}>
          {item.name}
        </AppText>
      </TouchableOpacity>
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <MartSectionHeader title="Top Brands" onViewAll={onViewAll} />
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
    gap: vs(6),
  },
  imageWrap: {
    width: ITEM_W,
    height: ITEM_W,
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: hs(8),
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#1E2022',
    textAlign: 'center',
  },
});
