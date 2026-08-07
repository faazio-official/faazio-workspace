import React from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import ProductCardBase from '@/components/shared/ProductCardBase';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';
import type { AppBrand, Product } from '@data/types';

interface AudienceGridSectionProps extends SectionProps {
  title: string;
  products: Product[];
  appBrand: AppBrand;
}

// 2-column product grid for a single-brand curated audience (Men/Women/Children).
export default function AudienceGridSection({
  title, products, appBrand,
  onProductClick, addToCart,
}: AudienceGridSectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <>
      <SectionHeader title={title} />
      <View style={styles.grid}>
        {products.map((product) => (
          <ProductCardBase
            key={product.id}
            product={product}
            appBrand={appBrand}
            variant="grid2"
            isAdded={addedId === product.id}
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(8),
  },
});
