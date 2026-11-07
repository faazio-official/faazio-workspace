import React, { memo, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { TODAYS_SPECIALS, dishToProduct } from '@data/food/specials';
import { recentlyViewedMart, recentlyViewedPharma, hotBrandDeals } from '@data/home/rails';
import type { Product } from '@data/types';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { SectionHeader } from './common';
import type { SectionProps } from './common';

const DEAL_CARD_W = hs(116);
const CARDS_PER_RAIL = 10;

// Deterministic PRNG (mulberry32) so the two rails keep the same order across
// mounts and FlatList virtualisation — a random shuffle made the feed change
// every time the section scrolled out and back.
function seededShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  let seed = 0x1337c0de;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Stable, non-overlapping samples for the two rails, computed once per mount so a
// re-render doesn't reshuffle the layout.
function planRails(pool: Product[]): [Product[], Product[]] {
  const shuffled = seededShuffle(pool);
  const railA = shuffled.slice(0, CARDS_PER_RAIL);
  const railB = shuffled.slice(CARDS_PER_RAIL, CARDS_PER_RAIL * 2);
  return [railA, railB];
}

interface TodaysSpecialsSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture pool for first paint / offline. */
  products?: Product[];
}

function TodaysSpecialsSection({ products, onProductClick, onLaunchSubApp }: TodaysSpecialsSectionProps) {
  const pool = useMemo<Product[]>(
    () =>
      products && products.length > 0
        ? products
        : [
            ...TODAYS_SPECIALS.map(dishToProduct),
            ...recentlyViewedMart,
            ...hotBrandDeals,
            ...recentlyViewedPharma,
          ],
    [products],
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
          showRating={false}
          showPrice={false}
          showAddButton={false}
          showBadge={false}
          showHeart={false}
          onPress={() => onProductClick?.(product)}
        />
      ))}
    </ScrollView>
  );

  return (
    <>
      <SectionHeader
        title="Today's Special"
        actionLabel="View all"
        onAction={() => onLaunchSubApp('FA_MART')}
      />
      {renderRail(railA)}
      <View style={styles.secondRail}>{renderRail(railB)}</View>
    </>
  );
}

export default memo(TodaysSpecialsSection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
  secondRail: {
    marginTop: vs(4),
  },
});
