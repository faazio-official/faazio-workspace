import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';
import type { Product } from '@data/types';

interface AudienceGridSectionProps extends SectionProps {
  title: string;
  products: Product[];
}

// 2-column product grid for a single-brand curated audience (Men/Women/Children).
function AudienceGridSection({
  title, products,
  onProductClick, addToCart,
}: AudienceGridSectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <>
      <SectionHeader title={title} />
      <View style={styles.grid}>
        {products.map((product) => (
          <MartProductCard
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

export default memo(AudienceGridSection);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
  },
});
