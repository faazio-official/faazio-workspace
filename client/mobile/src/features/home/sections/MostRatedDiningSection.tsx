import React, { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { foodStores } from '@data/food/stores';
import type { StoreProfile } from '@data/types';
import NearbyRestaurantRow from '@/features/food/components/NearbyRestaurantRow';
import { SectionHeader, subAppIdFor } from './common';
import type { SectionProps } from './common';

function toRow(store: StoreProfile) {
  const distance = parseFloat(store.distance) || 0;
  return {
    id: store.id,
    name: store.name,
    image: store.coverImage,
    cuisine: store.categories[0] ?? 'Dining',
    rating: store.rating,
    distance,
    priceForTwo: 0,
    tags: [],
  };
}

function MostRatedDiningSection({ onLaunchSubApp }: SectionProps) {
  const topRated = [...foodStores].sort((a, b) => b.rating - a.rating).slice(0, 3);
  return (
    <>
      <SectionHeader title="Most Rated Dining" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {topRated.map((store) => (
          <NearbyRestaurantRow
            key={store.id}
            restaurant={toRow(store)}
            style={styles.railItem}
            onPress={() => onLaunchSubApp(subAppIdFor(store.app))}
          />
        ))}
      </ScrollView>
    </>
  );
}

export default memo(MostRatedDiningSection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(16),
  },
  railItem: {
    width: hs(280),
    marginHorizontal: 0,
    marginRight: hs(12),
    marginBottom: 0,
  },
});
