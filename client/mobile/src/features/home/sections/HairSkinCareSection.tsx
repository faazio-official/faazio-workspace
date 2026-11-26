import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { hairSkinPicks } from '@data/home/demographics';
import type { Product } from '@data/types';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import {
  SectionHeader,
  usePricedProducts,
  HOME_GRID_CARD_WIDTH,
  HOME_GRID_GAP,
} from './common';
import type { SectionProps } from './common';

interface HairSkinCareSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture for first paint / offline. */
  products?: Product[];
}

// Hair & Skin Care pulls from BOTH the Mart Beauty catalog and Pharma OTC/wellness.
// Items carry their own `app`, so UniversalFeedCard renders each with its native skin.
function HairSkinCareSection({
  products = hairSkinPicks,
  onProductClick,
  quantityOf,
  onAddToCart,
  onUpdateQuantity,
}: HairSkinCareSectionProps) {
  const priced = usePricedProducts(products);
  return (
    <>
      <SectionHeader title="Hair & Skin Care" />
      <View style={styles.grid}>
        {priced.map((product) => {
          const quantity = quantityOf?.(product.id) ?? 0;
          return (
            <UniversalFeedCard
              key={product.id}
              product={product}
              width={HOME_GRID_CARD_WIDTH}
              imageAspect={1}
              nameLines={2}
              quantity={quantity}
              isAdded={quantity > 0}
              showRating={false}
              showBadge={false}
              compactPrice
              onPress={() => onProductClick?.(product)}
              onAdd={() => onAddToCart?.(product)}
              onIncrement={() => onUpdateQuantity?.(product.id, 1)}
              onDecrement={() => onUpdateQuantity?.(product.id, -1)}
            />
          );
        })}
      </View>
    </>
  );
}

export default memo(HairSkinCareSection);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: HOME_GRID_GAP,
    paddingHorizontal: hs(16),
  },
});
