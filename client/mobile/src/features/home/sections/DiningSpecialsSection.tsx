import React, { memo, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { TODAYS_SPECIALS, dishToProduct } from '@data/food/specials';
import { recentlyViewedMart, recentlyViewedPharma, hotBrandDeals } from '@data/home/rails';
import type { Product } from '@data/types';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';

const DEAL_CARD_W = hs(150);
const CARDS_PER_RAIL = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Stable, non-overlapping samples for the two rails, computed once per mount so a
// re-render (e.g. add-to-cart feedback) doesn't reshuffle the layout.
function planRails(pool: Product[]): [Product[], Product[]] {
  const shuffled = shuffle(pool);
  const railA = shuffled.slice(0, CARDS_PER_RAIL);
  const railB = shuffled.slice(CARDS_PER_RAIL, CARDS_PER_RAIL * 2);
  return [railA, railB];
}

function DiningSpecialsSection({ onProductClick, addToCart }: SectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);

  const pool = useMemo<Product[]>(
    () => [
      ...TODAYS_SPECIALS.map(dishToProduct),
      ...recentlyViewedMart,
      ...hotBrandDeals,
      ...recentlyViewedPharma,
    ],
    [],
  );

  const [railA, railB] = useMemo(() => planRails(pool), [pool]);

  const renderRail = (rail: Product[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {rail.map((product) => (
        <UniversalFeedCard
          key={product.id}
          product={product}
          variant="rail"
          width={DEAL_CARD_W}
          imageAspect={1}
          roundedImageBottom
          isAdded={addedId === product.id}
          onPress={() => onProductClick?.(product)}
          onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
        />
      ))}
    </ScrollView>
  );

  return (
    <>
      <SectionHeader title="Today's Special" />
      {renderRail(railA)}
      <View style={styles.secondRail}>{renderRail(railB)}</View>
    </>
  );
}

export default memo(DiningSpecialsSection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(12),
  },
  secondRail: {
    marginTop: vs(8),
  },
});
