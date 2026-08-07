import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import type { QuickCategory } from '../mocks/homeFeed';

const CATEGORY_W = 70;

interface CategoryRailProps {
  categories: QuickCategory[];
  onPress?: (category: QuickCategory) => void;
}

/**
 * Section 3 — horizontal rail of 8 quick category bubbles (grey circle +
 * dining icon + centered label).
 */
const CategoryRail = memo(function CategoryRail({ categories, onPress }: CategoryRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: QuickCategory }) => {
      const Icon = item.icon;
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => onPress?.(item)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <View style={styles.circle}>
            <Icon size={ms(21)} color={foodTheme.textSecondary} strokeWidth={1.9} />
          </View>
          <AppText style={styles.label} numberOfLines={1}>
            {item.label}
          </AppText>
        </TouchableOpacity>
      );
    },
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={categories}
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

export default CategoryRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
    gap: hs(10),
  },
  item: {
    width: CATEGORY_W,
    alignItems: 'center',
    gap: vs(6),
  },
  circle: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: ms(10),
    fontWeight: '400',
    color: '#374151',
    textAlign: 'center',
  },
});
