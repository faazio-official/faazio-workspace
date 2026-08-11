import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { MartCategory } from '../../mocks/martHomeFeed';
import MartImage from './MartImage';
import MartSectionHeader from './MartSectionHeader';

const ITEM_W = hs(72);

const CategorySeparator = () => <View style={styles.separator} />;

interface MartCategoryRailProps {
  categories: MartCategory[];
  onPress?: (category: MartCategory) => void;
}

const MartCategoryRail = memo(function MartCategoryRail({
  categories,
  onPress,
}: MartCategoryRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: MartCategory }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.circle}>
          <MartImage uri={item.cutoutImageUrl} style={styles.image} />
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
      <MartSectionHeader title="Shop by Category" />
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

export default MartCategoryRail;

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
    gap: vs(6),
  },
  circle: {
    width: ITEM_W,
    height: ITEM_W,
    borderRadius: ITEM_W / 2,
    backgroundColor: '#FFF8E1',
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
    color: '#1E2022',
    textAlign: 'center',
    lineHeight: ms(12),
    minHeight: vs(24),
  },
});
