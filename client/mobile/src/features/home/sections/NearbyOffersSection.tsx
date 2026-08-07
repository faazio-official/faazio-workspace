import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { nearbyOffers } from '@data/home/nearbyOffers';
import ProductCardBase from '@/components/shared/ProductCardBase';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';

export default function NearbyOffersSection({ onProductClick, addToCart }: SectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <>
      <SectionHeader title="Nearby Offers" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {nearbyOffers.map((product) => (
          <ProductCardBase
            key={product.id}
            product={product}
            appBrand={product.app}
            variant="rail"
            showDescription
            isAdded={addedId === product.id}
            onPress={() => onProductClick?.(product)}
            onAdd={() => handleAdd(product.id, product.name, product.price, product.emoji)}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: vs(16),
  },
});
