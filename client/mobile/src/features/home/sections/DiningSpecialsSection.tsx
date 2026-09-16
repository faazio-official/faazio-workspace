import React, { memo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { hs, vs, SCREEN_W } from '@/utils/responsive';
import { TODAYS_SPECIALS, dishToProduct } from '@data/food/specials';
import type { SpecialDish } from '@data/types';
import TodaysSpecialCard from '@/features/home/cards/TodaysSpecialCard';
import { SectionHeader } from './common';
import type { SectionProps } from './common';

// 16pt page gutters + 12pt rail gap → exactly 2 columns per viewport.
const COL_W = (SCREEN_W - hs(16) * 2 - hs(12)) / 2;

function chunkPairs(dishes: SpecialDish[]): SpecialDish[][] {
  const pairs: SpecialDish[][] = [];
  for (let i = 0; i < dishes.length; i += 2) {
    pairs.push(dishes.slice(i, i + 2));
  }
  return pairs;
}

function DiningSpecialsSection({ onProductClick }: SectionProps) {
  const columns = chunkPairs(TODAYS_SPECIALS);
  return (
    <>
      <SectionHeader title="Today's Special" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {columns.map((pair, idx) => (
          <View key={`col-${idx}`} style={styles.column}>
            {pair.map((dish) => (
              <TodaysSpecialCard
                key={dish.id}
                dish={dish}
                width={COL_W}
                onPress={() => onProductClick?.(dishToProduct(dish))}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

export default memo(DiningSpecialsSection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(16),
  },
  column: {
    width: COL_W,
    marginRight: hs(12),
    gap: vs(12),
  },
});
