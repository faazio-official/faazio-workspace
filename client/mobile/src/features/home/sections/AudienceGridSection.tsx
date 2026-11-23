import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import { SectionHeader, usePricedProducts } from './common';
import type { SectionProps } from './common';
import type { Product } from '@data/types';

interface AudienceGridSectionProps extends SectionProps {
  title: string;
  products: Product[];
}

// 2-column product grid for a single-brand curated audience (Men/Women/Children).
function AudienceGridSection({
  title, products,
  onProductClick,
}: AudienceGridSectionProps) {
  const priced = usePricedProducts(products);
  return (
    <>
      <SectionHeader title={title} />
      <View style={styles.grid}>
        {priced.map((product) => (
          <MartProductCard
            key={product.id}
            product={product}
            showAddButton={false}
            onPress={() => onProductClick?.(product)}
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
  },
});
