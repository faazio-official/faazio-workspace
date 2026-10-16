import React, { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { nearbyOffers } from '@data/home/nearbyOffers';
import type { Product } from '@data/types';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { SectionHeader, useAddToCartFeedback, usePricedProducts } from './common';
import type { SectionProps } from './common';

interface NearbyOffersSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture for first paint / offline. */
  products?: Product[];
}

function NearbyOffersSection({ products = nearbyOffers, onProductClick, addToCart }: NearbyOffersSectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  const priced = usePricedProducts(products);
  return (
    <>
      <SectionHeader title="Nearby Offers" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {priced.map((product) => (
          <UniversalFeedCard
            key={product.id}
            product={product}
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

export default memo(NearbyOffersSection);

const styles = StyleSheet.create({
  scroll: {
    paddingLeft: hs(16),
    paddingRight: hs(4),
    paddingBottom: SPACE.BLOCK,
  },
});
