import React, { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { TODAYS_SPECIALS, dishToProduct } from '@data/food/specials';
import { SpecialDishCard } from '@/features/food/components';
import { SectionHeader } from './common';
import type { SectionProps } from './common';

function DiningSpecialsSection({ onProductClick }: SectionProps) {
  return (
    <>
      <SectionHeader title="Today's Dining Special" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {TODAYS_SPECIALS.map((dish) => (
          <SpecialDishCard
            key={dish.id}
            dish={dish}
            onPress={() => onProductClick?.(dishToProduct(dish))}
          />
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
});
