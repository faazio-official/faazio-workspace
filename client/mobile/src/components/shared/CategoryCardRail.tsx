import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { CategoryCard } from '@/services/categoryRail';

const ITEM_W = hs(72);

const CategorySeparator = () => <View style={styles.separator} />;

interface CategoryCardRailProps {
  title: string;
  categories: CategoryCard[];
  accent?: string;
  cardBg?: string;
  onPress?: (card: CategoryCard) => void;
  onViewMore?: () => void;
}

/**
 * Shared horizontal "Shop by Category" rail used by every sub-app home.
 *
 * Renders circular icon category cards sourced from the unified Master
 * Categories tree (see `getCategoryCards`) and appends a trailing "View More"
 * card that opens the same Master Categories screen pre-scoped to that app.
 * Cards carry the master tab id so a tap can deep-link the sidebar to that tab.
 * Kept in shared/ with no feature imports so all homes stay consistent.
 */
const CategoryCardRail = memo(function CategoryCardRail({
  title,
  categories,
  accent = '#1E2022',
  cardBg = '#F1F5F9',
  onPress,
  onViewMore,
}: CategoryCardRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: CategoryCard }) => (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onPress?.(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={[styles.circle, { backgroundColor: cardBg }]}>
          <ExpoImage
            source={{ uri: item.icon }}
            style={styles.icon}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
        <AppText style={styles.label} numberOfLines={2}>
          {item.name}
        </AppText>
      </TouchableOpacity>
    ),
    [onPress, cardBg],
  );

  const renderFooter = useCallback(
    () =>
      onViewMore ? (
        <TouchableOpacity
          style={styles.item}
          onPress={onViewMore}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`View more ${title}`}
        >
          <View style={[styles.circle, { backgroundColor: accent }]}>
            <ChevronRight size={ms(24)} color="#FFFFFF" strokeWidth={2.6} />
          </View>
          <AppText style={[styles.label, { color: accent }]} numberOfLines={2}>
            View More
          </AppText>
        </TouchableOpacity>
      ) : null,
    [onViewMore, accent, title],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <FlashList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListFooterComponent={renderFooter}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={CategorySeparator}
        bounces={false}
      />
    </View>
  );
});

export default CategoryCardRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
  },
  title: {
    fontSize: ms(16),
    fontWeight: '700',
    color: '#1E2022',
    flexShrink: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: ms(40),
    height: ms(40),
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
