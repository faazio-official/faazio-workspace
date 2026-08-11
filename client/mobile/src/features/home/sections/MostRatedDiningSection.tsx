import React, { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { foodStores } from '@data/food/stores';
import StoreCardBase from '@/components/shared/StoreCardBase';
import { SectionHeader, subAppIdFor } from './common';
import type { SectionProps } from './common';

function MostRatedDiningSection({ onLaunchSubApp }: SectionProps) {
  const topRated = [...foodStores].sort((a, b) => b.rating - a.rating).slice(0, 3);
  return (
    <>
      <SectionHeader title="Most Rated Dining" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {topRated.map((store) => (
          <StoreCardBase
            key={store.id}
            store={store}
            variant="rail"
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
});
