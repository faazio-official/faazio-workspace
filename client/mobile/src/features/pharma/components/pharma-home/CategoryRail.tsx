import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { PharmaCategoryItem } from '../../mocks/pharmaHomeFeed';
import { PHARMA_INK } from '../../mocks/pharmaHomeFeed';
import PharmaImage from './PharmaImage';
import PharmaSectionHeader from './PharmaSectionHeader';

const ITEM_W = hs(72);

const CategorySeparator = () => <View style={styles.separator} />;

interface CategoryRailProps {
  categories: PharmaCategoryItem[];
  onPress?: (category: PharmaCategoryItem) => void;
  onViewAll?: () => void;
}

const CategoryRail = memo(function CategoryRail({
  categories,
  onPress,
  onViewAll,
}: CategoryRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: PharmaCategoryItem }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.circle}>
          <PharmaImage uri={item.cutoutImageUrl} style={styles.image} contentFit="cover" />
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
      <PharmaSectionHeader title="Shop by Category" onViewAll={onViewAll} />
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

export default CategoryRail;

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
    backgroundColor: '#E0F2F1',
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
    color: PHARMA_INK,
    textAlign: 'center',
    lineHeight: ms(12),
    minHeight: vs(24),
    marginTop: vs(6),
  },
});
