import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { hairSkinPicks } from '@data/home/demographics';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';

// Hair & Skin Care pulls from BOTH the Mart Beauty catalog and Pharma OTC/wellness.
// Items carry their own `app`, so UniversalFeedCard renders each with its native skin.
function HairSkinCareSection({ onProductClick, addToCart }: SectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <>
      <SectionHeader title="Hair & Skin Care" />
      <View style={styles.grid}>
        {hairSkinPicks.map((product) => (
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
    paddingBottom: vs(8),
  },
});
