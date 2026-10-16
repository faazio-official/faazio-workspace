import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { hairSkinPicks } from '@data/home/demographics';
import type { Product } from '@data/types';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { SectionHeader, useAddToCartFeedback, usePricedProducts } from './common';
import type { SectionProps } from './common';

interface HairSkinCareSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture for first paint / offline. */
  products?: Product[];
}

// Hair & Skin Care pulls from BOTH the Mart Beauty catalog and Pharma OTC/wellness.
// Items carry their own `app`, so UniversalFeedCard renders each with its native skin.
function HairSkinCareSection({ products = hairSkinPicks, onProductClick, addToCart }: HairSkinCareSectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  const priced = usePricedProducts(products);
  return (
    <>
      <SectionHeader title="Hair & Skin Care" />
      <View style={styles.grid}>
        {priced.map((product) => (
          <UniversalFeedCard
            key={product.id}
            product={product}
            isAdded={addedId === product.id}
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
          />
        ))}
      </View>
    </>
  );
}

export default memo(HairSkinCareSection);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
  },
});
