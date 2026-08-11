import React, { memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { hs, vs } from '@/utils/responsive';
import { nearbyOffers } from '@data/home/nearbyOffers';
import UniversalFeedCard from '@/features/home/cards/UniversalFeedCard';
import { SectionHeader, useAddToCartFeedback } from './common';
import type { SectionProps } from './common';

function NearbyOffersSection({ onProductClick, addToCart }: SectionProps) {
  const { addedId, handleAdd } = useAddToCartFeedback(addToCart);
  return (
    <>
      <SectionHeader title="Nearby Offers" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {nearbyOffers.map((product) => (
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
    paddingBottom: vs(16),
  },
});
