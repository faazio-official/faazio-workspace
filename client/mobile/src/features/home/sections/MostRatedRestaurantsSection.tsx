import React, { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { foodStores } from '@data/food/stores';
import type { StoreProfile } from '@data/types';
import type { StoreRecord } from '@data/directory/stores';
import NearbyRestaurantRow from '@/features/food/components/NearbyRestaurantRow';
import { SectionHeader, subAppIdFor } from './common';
import type { SectionProps } from './common';

interface MostRatedRestaurantsSectionProps extends SectionProps {
  /** SDUI-joined stores (directory.stores); falls back to the food fixture offline. */
  stores?: StoreRecord[];
}

interface RestaurantStore {
  id: string;
  name: string;
  coverImage: string;
  categories: string[];
  rating: number;
  distance: string;
  app: StoreProfile['app'];
}

function toRow(store: RestaurantStore) {
  const distance = parseFloat(store.distance) || 0;
  return {
    id: store.id,
    name: store.name,
    image: store.coverImage,
    cuisine: store.categories[0] ?? 'Restaurant',
    rating: store.rating,
    distance,
    priceForTwo: 0,
    tags: [],
    dietType: 'both' as const,
  };
}

function MostRatedRestaurantsSection({ stores, onLaunchSubApp }: MostRatedRestaurantsSectionProps) {
  const source: RestaurantStore[] = stores && stores.length > 0 ? stores : foodStores;
  const topRated = [...source].sort((a, b) => b.rating - a.rating).slice(0, 3);
  return (
    <>
      <SectionHeader title="Most Rated Restaurants" />
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

export default memo(MostRatedRestaurantsSection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
  railItem: {
    width: hs(280),
    marginHorizontal: 0,
    marginRight: hs(12),
    marginBottom: 0,
  },
});