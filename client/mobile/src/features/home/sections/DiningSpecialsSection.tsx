import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { foodStores } from '@data/food/stores';
import StoreCardBase from '@/components/shared/StoreCardBase';
import { SectionHeader, subAppIdFor } from './common';
import type { SectionProps } from './common';

export default function DiningSpecialsSection({ onLaunchSubApp }: SectionProps) {
  const specials = foodStores.slice(0, 3);
  return (
    <>
      <SectionHeader title="Today's Dining Special" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {specials.map((store) => (
          <StoreCardBase
            key={store.id}
            store={store}
            variant="rail"
            showAdLabel
            onPress={() => onLaunchSubApp(subAppIdFor(store.app))}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(16),
  },
});
