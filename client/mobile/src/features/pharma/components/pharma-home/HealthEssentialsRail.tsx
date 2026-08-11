import React, { memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { hs, vs } from '@/utils/responsive';
import type { PharmaHealthEssential } from '../../mocks/pharmaHomeFeed';
import PharmaSectionHeader from './PharmaSectionHeader';
import HealthEssentialCard from './cards/HealthEssentialCard';

const ITEM_W = hs(108);

const EssentialSeparator = () => <View style={styles.separator} />;

interface HealthEssentialsRailProps {
  items: PharmaHealthEssential[];
  onPress?: (item: PharmaHealthEssential) => void;
  onViewAll?: () => void;
}

const HealthEssentialsRail = memo(function HealthEssentialsRail({
  items,
  onPress,
  onViewAll,
}: HealthEssentialsRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: PharmaHealthEssential }) => (
      <HealthEssentialCard item={item} width={ITEM_W} onPress={() => onPress?.(item)} />
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <PharmaSectionHeader title="Health Essentials" onViewAll={onViewAll} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={EssentialSeparator}
        bounces={false}
      />
    </View>
  );
});

export default HealthEssentialsRail;

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
