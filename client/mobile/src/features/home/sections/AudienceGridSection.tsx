import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import {
  SectionHeader,
  usePricedProducts,
  HOME_GRID_CARD_WIDTH,
  HOME_GRID_GAP,
} from './common';
import type { SectionProps } from './common';
import type { Product } from '@data/types';

interface AudienceGridSectionProps extends SectionProps {
  title: string;
  products: Product[];
}

// 3-column product grid for a single-brand curated audience (Men/Women/Children).
function AudienceGridSection({
  title, products,
  onProductClick, quantityOf, onAddToCart, onUpdateQuantity,
}: AudienceGridSectionProps) {
  const priced = usePricedProducts(products);
  return (
    <>
      <SectionHeader title={title} />
      <View style={styles.grid}>
        {priced.map((product) => {
          const quantity = quantityOf?.(product.id) ?? 0;
          return (
            <MartProductCard
              key={product.id}
              product={product}
              width={HOME_GRID_CARD_WIDTH}
              imageAspect={1}
              nameLines={2}
              quantity={quantity}
              isAdded={quantity > 0}
              showBadge={false}
              showRating={false}
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

export default memo(AudienceGridSection);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: HOME_GRID_GAP,
    paddingHorizontal: hs(16),
  },
});
