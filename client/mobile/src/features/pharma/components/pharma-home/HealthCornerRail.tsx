import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { PharmaHealthCornerArticle } from '../../mocks/pharmaHomeFeed';
import PharmaSectionHeader from './PharmaSectionHeader';
import HealthCornerCard from './cards/HealthCornerCard';

const ARTICLE_W = hs(280);

const ArticleSeparator = () => <View style={styles.separator} />;

interface HealthCornerRailProps {
  items: PharmaHealthCornerArticle[];
  onPress?: (item: PharmaHealthCornerArticle) => void;
  onViewAll?: () => void;
}

const HealthCornerRail = memo(function HealthCornerRail({
  items,
  onPress,
  onViewAll,
}: HealthCornerRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: PharmaHealthCornerArticle }) => (
      <HealthCornerCard item={item} width={ARTICLE_W} onPress={() => onPress?.(item)} />
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <PharmaSectionHeader title="Health Corner" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={ArticleSeparator}
        bounces={false}
      />
    </View>
  );
});

export default HealthCornerRail;

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
